"use client";

/* 0009 — Proof
   A transcript editor for one chapter of a podcast. The producer tightens the
   episode by editing words, not waveforms: strike a phrase and the audio under
   it slides shut, the runtime drops, and the overview takes a notch. One clock
   drives the karaoke highlight, the dock, the overview and the meters, so the
   transcript and the audio can never drift apart. */

import { Bricolage_Grotesque, Literata } from "next/font/google";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import s from "./shot.module.css";
import {
  CHAPTERS,
  CH3_START,
  EPISODE,
  FILLER_ORDER,
  LOUDNESS,
  OUTER_CUTS,
  OUTER_REMOVED,
  PARAS,
  PRE_CUTS,
  REMOVED_BEFORE_CH3,
  SPEAKERS,
  TOKENS,
  ampAt,
  mmss,
  mmssd,
  secs,
  spanEnd,
  type FillerKind,
} from "./data";
import {
  CLOSE_MS,
  STRIKE_MS,
  cutHolding,
  edToSrc,
  episodeRemovedBefore,
  progressOf,
  tokenAt,
  type LiveCut,
} from "./engine";
import { DOCK_PLAY_AT, DOCK_PX_PER_SEC, buildOverview, drawDock, drawOverview } from "./draw";
import { Icon, SpeakerMark } from "./icons";

// Bricolage carries the interface and every figure; its optical sizes let the
// 11px dock labels and the chapter heading come from one family. Literata is
// for reading, which is the job the transcript pane actually does.
const ui = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["opsz", "wdth"] });
const read = Literata({ subsets: ["latin"], variable: "--font-literata", axes: ["opsz"] });

type Spec = { from: number; to: number; pre: boolean };
type Cut = Spec & { id: number; phase: "closing" | "closed" };
type Edit = { kind: "cut" | "restore"; specs: Spec[] };

const START_PARA = 5;
const RATES = [1, 1.25, 1.5] as const;
const SWEEP_STEP = 150;
/** Height of the transcript's edge fades, mirrored in shot.module.css. */
const FADE = 44;

const lenOf = (sp: { from: number; to: number }) => spanEnd(sp.to) - TOKENS[sp.from].start;
const textOf = (sp: { from: number; to: number }) =>
  TOKENS.slice(sp.from, sp.to + 1)
    .map((t) => t.text)
    .join(" ");

function makeLive() {
  const m = new Map<number, LiveCut>();
  PRE_CUTS.forEach((c, id) => m.set(id, { id, s0: TOKENS[c.from].start, s1: spanEnd(c.to), t0: -Infinity, dir: 1, p: 1 }));
  return m;
}

/** Chapter starts and lengths as the page first paints, before the clock runs. */
const INITIAL_CH = (() => {
  const list = [...makeLive().values()];
  return CHAPTERS.map((c) => {
    const a = c.start - episodeRemovedBefore(list, c.start);
    const b = c.end - episodeRemovedBefore(list, c.end);
    return { start: mmss(a), len: mmss(b - a) };
  });
})();

const setText = (el: HTMLElement | null, str: string) => {
  if (el && el.textContent !== str) el.textContent = str;
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export default function Proof() {
  const reduced = useReducedMotion() ?? false;

  /* ── edit state ─────────────────────────────────────────────────────── */

  const [cuts, setCuts] = useState<Cut[]>(() =>
    PRE_CUTS.map((c, id) => ({ id, from: c.from, to: c.to, pre: true, phase: "closed" as const })),
  );
  const [undoStack, setUndo] = useState<Edit[]>([]);
  const [redoStack, setRedo] = useState<Edit[]>([]);
  const [sel, setSel] = useState<{ a: number; f: number } | null>(null);
  const [flash, setFlash] = useState<ReadonlySet<number>>(() => new Set());
  const [sweep, setSweep] = useState<{ n: number; total: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [loop, setLoop] = useState(true);
  const [follow, setFollow] = useState(true);
  const [saving, setSaving] = useState(false);

  const live = useRef<Map<number, LiveCut>>(makeLive());
  const nextId = useRef(PRE_CUTS.length);
  const cutsRef = useRef(cuts);
  const reducedRef = useRef(reduced);
  const pb = useRef({ src: PARAS[START_PARA].start, playing: false, rate: 1, loop: true });
  const followRef = useRef(true);
  const sweepingRef = useRef(false);
  const scrollTarget = useRef<number | null>(null);
  const curRef = useRef(0);
  const timers = useRef<number[]>([]);
  const selRef = useRef(sel);

  useLayoutEffect(() => {
    cutsRef.current = cuts;
    selRef.current = sel;
    reducedRef.current = reduced;
  });

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  /** Which cut (index into `cuts`) each token belongs to, or -1. */
  const cutOf = useMemo(() => {
    const a = new Int32Array(TOKENS.length).fill(-1);
    cuts.forEach((c, k) => {
      for (let i = c.from; i <= c.to; i++) a[i] = k;
    });
    return a;
  }, [cuts]);

  const markSaving = useCallback(() => {
    setSaving(true);
    later(() => setSaving(false), 900);
  }, [later]);

  const addCut = useCallback(
    (sp: Spec) => {
      const id = nextId.current++;
      const instant = reducedRef.current;
      live.current.set(id, {
        id,
        s0: TOKENS[sp.from].start,
        s1: spanEnd(sp.to),
        t0: instant ? -Infinity : performance.now(),
        dir: 1,
        p: 0,
      });
      setCuts((prev) => [...prev, { ...sp, id, phase: instant ? "closed" : "closing" }]);
      if (!instant) {
        later(() => setCuts((prev) => prev.map((c) => (c.id === id ? { ...c, phase: "closed" } : c))), STRIKE_MS + CLOSE_MS);
      }
    },
    [later],
  );

  const removeCuts = useCallback(
    (specs: Spec[]) => {
      const gone = cutsRef.current.filter((c) => specs.some((sp) => sp.from === c.from && sp.to === c.to));
      if (!gone.length) return;
      const now = performance.now();
      for (const c of gone) {
        const l = live.current.get(c.id);
        if (l) {
          l.dir = -1;
          l.t0 = reducedRef.current ? -Infinity : now;
        }
      }
      const ids = new Set(gone.map((c) => c.id));
      setCuts((prev) => prev.filter((c) => !ids.has(c.id)));
      const back = new Set<number>();
      gone.forEach((c) => {
        for (let i = c.from; i <= c.to; i++) back.add(i);
      });
      setFlash(back);
      later(() => setFlash((cur) => (cur === back ? new Set() : cur)), 1200);
    },
    [later],
  );

  const apply = useCallback(
    (e: Edit, inverse: boolean) => {
      const cutting = (e.kind === "cut") !== inverse;
      if (cutting) e.specs.forEach(addCut);
      else removeCuts(e.specs);
      markSaving();
    },
    [addCut, removeCuts, markSaving],
  );

  const record = useCallback(
    (e: Edit) => {
      apply(e, false);
      setUndo((u) => [...u, e]);
      setRedo([]);
    },
    [apply],
  );

  const undo = useCallback(() => {
    if (sweepingRef.current || !undoStack.length) return;
    const e = undoStack[undoStack.length - 1];
    apply(e, true);
    setUndo(undoStack.slice(0, -1));
    setRedo([...redoStack, e]);
    setSel(null);
  }, [apply, undoStack, redoStack]);

  const redo = useCallback(() => {
    if (sweepingRef.current || !redoStack.length) return;
    const e = redoStack[redoStack.length - 1];
    apply(e, false);
    setRedo(redoStack.slice(0, -1));
    setUndo([...undoStack, e]);
  }, [apply, undoStack, redoStack]);

  /* ── selection ──────────────────────────────────────────────────────── */

  const range = useMemo(() => (sel ? ([Math.min(sel.a, sel.f), Math.max(sel.a, sel.f)] as const) : null), [sel]);

  /** The selection split into runs that are not already cut. */
  const runs = useMemo(() => {
    if (!range) return [];
    const out: Spec[] = [];
    let start = -1;
    for (let i = range[0]; i <= range[1] + 1; i++) {
      const free = i <= range[1] && cutOf[i] < 0;
      if (free && start < 0) start = i;
      if (!free && start >= 0) {
        out.push({ from: start, to: i - 1, pre: false });
        start = -1;
      }
    }
    return out;
  }, [range, cutOf]);

  const selInfo = useMemo(() => {
    let words = 0;
    let len = 0;
    for (const r of runs) {
      len += lenOf(r);
      for (let i = r.from; i <= r.to; i++) if (TOKENS[i].kind === "word") words++;
    }
    return { words, len };
  }, [runs]);

  const cutSelection = useCallback(() => {
    if (!runs.length || sweepingRef.current) return;
    record({ kind: "cut", specs: runs });
    setSel(null);
  }, [runs, record]);

  /* ── playback ───────────────────────────────────────────────────────── */

  const setPlay = useCallback((on: boolean) => {
    pb.current.playing = on;
    setPlaying(on);
  }, []);

  const seekSrc = useCallback((src: number) => {
    let t = src;
    for (const c of live.current.values()) if (c.dir === 1 && t >= c.s0 && t < c.s1) t = c.s1;
    pb.current.src = t;
    followRef.current = true;
    setFollow(true);
  }, []);

  const seekTok = useCallback((i: number) => seekSrc(TOKENS[i].start), [seekSrc]);

  const nudge = useCallback(
    (d: number) => {
      const lo = TOKENS[0].start;
      const hi = spanEnd(TOKENS.length - 1) - 0.05;
      seekSrc(Math.min(hi, Math.max(lo, pb.current.src + d)));
    },
    [seekSrc],
  );

  useEffect(() => {
    pb.current.rate = rate;
  }, [rate]);
  useEffect(() => {
    pb.current.loop = loop;
  }, [loop]);

  // Playback starts on its own, unless the visitor asked for less motion.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!reducedRef.current) setPlay(true);
    }, 300);
    return () => window.clearTimeout(t);
  }, [setPlay]);

  /* ── filler sweep ───────────────────────────────────────────────────── */

  const fillersLeft = useMemo(() => TOKENS.filter((t) => t.filler && cutOf[t.i] < 0), [cutOf]);
  const fillersCut = useMemo(() => TOKENS.filter((t) => t.filler && cutOf[t.i] >= 0).length, [cutOf]);
  const byKind = useMemo(() => {
    const m = new Map<FillerKind, number>(FILLER_ORDER.map((k) => [k, 0]));
    for (const t of fillersLeft) if (t.filler) m.set(t.filler, (m.get(t.filler) ?? 0) + 1);
    return m;
  }, [fillersLeft]);

  const tokEls = useRef<Array<HTMLElement | null>>([]);
  const scroller = useRef<HTMLDivElement>(null);

  const centreOn = useCallback((i: number) => {
    const sc = scroller.current;
    const el = tokEls.current[i];
    if (!sc || !el) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    scrollTarget.current = Math.max(0, top - sc.clientHeight * 0.45);
  }, []);

  const removeFillers = useCallback(() => {
    if (sweepingRef.current || !fillersLeft.length) return;
    const specs: Spec[] = fillersLeft.map((t) => ({ from: t.i, to: t.i, pre: false }));
    setSel(null);
    setUndo((u) => [...u, { kind: "cut", specs }]);
    setRedo([]);
    markSaving();
    if (reducedRef.current) {
      specs.forEach(addCut);
      return;
    }
    sweepingRef.current = true;
    setSweep({ n: 0, total: specs.length });
    specs.forEach((sp, k) =>
      later(() => {
        centreOn(sp.from);
        addCut(sp);
        setSweep({ n: k + 1, total: specs.length });
      }, k * SWEEP_STEP),
    );
    later(() => {
      sweepingRef.current = false;
      setSweep(null);
      followRef.current = true;
      setFollow(true);
      markSaving();
    }, specs.length * SWEEP_STEP + STRIKE_MS + CLOSE_MS);
  }, [fillersLeft, addCut, later, centreOn, markSaving]);

  /* ── pointer selection in the transcript ────────────────────────────── */

  const drag = useRef<{ anchor: number; moved: boolean } | null>(null);

  const tokenFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-i]");
    return el ? Number(el.dataset.i) : null;
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const el = target.closest<HTMLElement>("[data-i]");
    scroller.current?.focus({ preventScroll: true });
    if (!el) {
      setSel(null);
      return;
    }
    e.preventDefault();
    const i = Number(el.dataset.i);
    if (e.shiftKey) {
      setSel((prev) => ({ a: prev?.a ?? curRef.current, f: i }));
      return;
    }
    drag.current = { anchor: i, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const i = tokenFromPoint(e.clientX, e.clientY);
    if (i == null) return;
    if (i !== d.anchor || d.moved) {
      d.moved = true;
      setSel({ a: d.anchor, f: i });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      setSel(null);
      seekTok(d.anchor);
    }
  };

  /* ── keys ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === " ") {
        e.preventDefault();
        setPlay(!pb.current.playing);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selRef.current) {
        e.preventDefault();
        cutSelection();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape" && selRef.current) {
        setSel(null);
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !mod) {
        const target = e.target as HTMLElement | null;
        if (target && target !== document.body && !scroller.current?.contains(target)) return;
        e.preventDefault();
        const step = e.key === "ArrowLeft" ? -1 : 1;
        const cs = cutsRef.current;
        const isCut = (i: number) => cs.some((c) => i >= c.from && i <= c.to);
        const from = e.shiftKey ? (selRef.current?.f ?? curRef.current) : curRef.current;
        let i = from + step;
        while (i > 0 && i < TOKENS.length - 1 && isCut(i)) i += step;
        i = Math.max(0, Math.min(TOKENS.length - 1, i));
        if (e.shiftKey) setSel({ a: selRef.current?.a ?? curRef.current, f: i });
        else {
          setSel(null);
          seekTok(i);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cutSelection, undo, redo, setPlay, seekTok]);

  /* ── the floating cut bar follows the end of the selection ──────────── */

  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const sc = scroller.current;
    const b = bar.current;
    if (!sc || !b || !range) return;
    const el = tokEls.current[range[1]] ?? tokEls.current[range[0]];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    const left = Math.min(sc.clientWidth - b.offsetWidth - 16, Math.max(16, r.right - sr.left - b.offsetWidth / 2));
    b.style.transform = `translate(${Math.round(left)}px, ${Math.round(r.bottom - sr.top + sc.scrollTop + 8)}px)`;
  });

  /* ── canvases and the one clock ─────────────────────────────────────── */

  const dockRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const paraEls = useRef<Array<HTMLElement | null>>([]);
  const hoverX = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Live readouts are written by the clock, not by React; they are found by name. */
  const r = (key: string) => ({ "data-r": key });

  useEffect(() => {
    const dock = dockRef.current;
    const ov = ovRef.current;
    const sc = scroller.current;
    const root = rootRef.current;
    if (!dock || !ov || !sc || !root) return;
    const R: Record<string, HTMLElement | null> = {};
    root.querySelectorAll<HTMLElement>("[data-r]").forEach((el) => {
      R[el.dataset.r ?? ""] = el;
    });
    const dctx = dock.getContext("2d");
    const octx = ov.getContext("2d");
    if (!dctx || !octx) return;
    const family = ui.style.fontFamily;

    const size = { dw: 0, dh: 0, ow: 0, oh: 0, dpr: 1 };
    let base: ReturnType<typeof buildOverview> | null = null;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.dpr = dpr;
      size.dw = dock.clientWidth;
      size.dh = dock.clientHeight;
      size.ow = ov.clientWidth;
      size.oh = ov.clientHeight;
      dock.width = Math.round(size.dw * dpr);
      dock.height = Math.round(size.dh * dpr);
      ov.width = Math.round(size.ow * dpr);
      ov.height = Math.round(size.oh * dpr);
      base = buildOverview(size.ow, size.oh, dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(dock);
    ro.observe(ov);

    // The stretch of chapter the transcript pane is showing, in raw seconds.
    const view: [number, number] = [CH3_START, CH3_START + 60];
    const timeAtY = (y: number) => {
      for (const p of PARAS) {
        const el = paraEls.current[p.i];
        if (!el) continue;
        const rr = el.getBoundingClientRect();
        if (y < rr.top) return p.start;
        if (y <= rr.bottom) return p.start + ((y - rr.top) / Math.max(1, rr.height)) * (spanEnd(p.to) - p.start);
      }
      return spanEnd(TOKENS.length - 1);
    };
    const measureView = () => {
      const sr = sc.getBoundingClientRect();
      view[0] = timeAtY(sr.top);
      view[1] = timeAtY(sr.bottom);
    };

    let raf = 0;
    let last = 0;
    let curEl: HTMLElement | null = null;
    let curPara = -1;
    let lastCur = -1;
    let first = true;
    let frame = 0;
    let lufsM = -40;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const P = pb.current;

      // Resolve every cut's progress for this frame; drop the fully reopened.
      const list: LiveCut[] = [];
      for (const c of live.current.values()) {
        c.p = progressOf(c, now);
        if (c.dir === -1 && c.p <= 0) live.current.delete(c.id);
        else list.push(c);
      }
      list.sort((a, b) => a.s0 - b.s0);

      if (P.playing) {
        P.src += dt * P.rate;
        for (const c of list) if (c.dir === 1 && c.p > 0.5 && P.src >= c.s0 && P.src < c.s1) P.src = c.s1;
        const end = spanEnd(TOKENS.length - 1);
        if (P.src >= end) {
          if (P.loop) P.src = TOKENS[0].start;
          else {
            P.src = end - 0.01;
            P.playing = false;
            setPlaying(false);
          }
        }
      }

      // Karaoke: the current token, and how far through it we are.
      const cur = tokenAt(P.src);
      curRef.current = cur;
      const tok = TOKENS[cur];
      const el = tokEls.current[cur];
      if (el !== curEl) {
        curEl?.classList.remove(s.cur);
        curEl = el;
      }
      if (el) {
        if (!el.classList.contains(s.cur)) el.classList.add(s.cur);
        const k = Math.min(1, Math.max(0, (P.src - tok.start) / Math.max(0.05, tok.end - tok.start)));
        el.style.setProperty("--k", k.toFixed(3));
      }
      if (tok.para !== curPara) {
        paraEls.current[curPara]?.classList.remove(s.paraOn);
        curPara = tok.para;
        paraEls.current[curPara]?.classList.add(s.paraOn);
      }

      // Keep the spoken line in the reading band, unless the producer has
      // scrolled away to read ahead.
      if (followRef.current && !sweepingRef.current && !drag.current && el && (cur !== lastCur || first)) {
        const sr = sc.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const rel = er.top - sr.top;
        // The band is kept well inside the 44px fades at the top and bottom edges.
        const h = sc.clientHeight;
        if (first || rel < Math.max(h * 0.16, FADE + 24) || rel > Math.min(h * 0.66, h - FADE - 48)) {
          const target = Math.max(0, rel + sc.scrollTop - sc.clientHeight * 0.3);
          if (first || reducedRef.current) sc.scrollTop = target;
          else scrollTarget.current = target;
        }
        first = false;
      }
      lastCur = cur;
      if (scrollTarget.current != null) {
        const d = scrollTarget.current - sc.scrollTop;
        if (Math.abs(d) < 1 || reducedRef.current) {
          sc.scrollTop = scrollTarget.current;
          scrollTarget.current = null;
        } else sc.scrollTop += d * Math.min(1, dt * 9);
      }
      if (frame++ % 3 === 0) measureView();

      // Figures that move while a cut closes.
      const removedHere = list.reduce((a, c) => a + (c.s1 - c.s0) * c.p, 0);
      // Whole seconds first, so removed and runtime always add up to 42:06.
      const removed = Math.round(OUTER_REMOVED + removedHere);
      const runtime = EPISODE.raw - removed;
      const edNow = P.src - REMOVED_BEFORE_CH3 - list.reduce((a, c) => a + (P.src >= c.s1 ? (c.s1 - c.s0) * c.p : P.src > c.s0 ? (P.src - c.s0) * c.p : 0), 0);
      setText(R.tc, mmssd(edNow));
      setText(R.tcTotal, mmss(runtime));
      setText(R.removed, mmss(removed));
      setText(R.runtime, mmss(runtime));
      const over = runtime - EPISODE.slot;
      setText(R.slotText, over > 0 ? `${mmss(over)} over the ${mmss(EPISODE.slot)} slot` : `${mmss(-over)} under the ${mmss(EPISODE.slot)} slot`);
      R.slotText?.parentElement?.setAttribute("data-over", over > 0 ? "1" : "0");
      const lo = 34 * 60;
      R.slotFill?.style.setProperty("--f", ((runtime - lo) / (EPISODE.raw - lo)).toFixed(4));
      CHAPTERS.forEach((c, k) => {
        const a = c.start - episodeRemovedBefore(list, c.start);
        const b = c.end - episodeRemovedBefore(list, c.end);
        setText(R[`chs${k}`], mmss(a));
        setText(R[`chd${k}`], mmss(b - a));
        if (k === 3) setText(R.ch4Open, mmss(a));
      });
      const ch3 = CHAPTERS[2];
      R.chProg?.style.setProperty("--f", ((P.src - ch3.start) / (ch3.end - ch3.start)).toFixed(4));

      // Momentary loudness from the envelope under the playhead.
      const amp = P.playing ? ampAt(P.src) : 0;
      const target = amp > 0.03 ? -34 + 24 * Math.sqrt(amp) : -42;
      lufsM += (target - lufsM) * Math.min(1, dt * (target > lufsM ? 10 : 3));
      setText(R.lufsM, P.playing && lufsM > -40 ? `−${Math.abs(lufsM).toFixed(1)}` : "—");
      R.meter?.style.setProperty("--m", Math.max(0, Math.min(1, (lufsM + 36) / 30)).toFixed(3));

      // Canvases.
      const sl = selRef.current;
      const selSrc = sl
        ? ([TOKENS[Math.min(sl.a, sl.f)].start, spanEnd(Math.max(sl.a, sl.f))] as const)
        : null;
      dctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      drawDock(dctx, size.dw, size.dh, { src: P.src, cuts: list, sel: selSrc, cur, family });
      if (base) {
        octx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        drawOverview(octx, size.ow, size.oh, base, { src: P.src, cuts: list, view, hoverX: hoverX.current, family, now });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const onWheel = () => {
    if (sweepingRef.current) return;
    scrollTarget.current = null;
    if (followRef.current) {
      followRef.current = false;
      setFollow(false);
    }
  };

  const resume = () => {
    followRef.current = true;
    setFollow(true);
    const sc = scroller.current;
    const el = tokEls.current[curRef.current];
    if (sc && el) {
      const rel = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      scrollTarget.current = Math.max(0, rel + sc.scrollTop - sc.clientHeight * 0.3);
    }
  };

  const onDockDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    const x = e.clientX - cv.getBoundingClientRect().left;
    const list = [...live.current.values()].sort((a, b) => a.s0 - b.s0);
    const P = pb.current;
    const edPlay = P.src - list.reduce((a, c) => a + (P.src >= c.s1 ? (c.s1 - c.s0) * c.p : P.src > c.s0 ? (P.src - c.s0) * c.p : 0), 0);
    const ts = edToSrc(list, edPlay + (x - cv.clientWidth * DOCK_PLAY_AT) / DOCK_PX_PER_SEC);
    const i = tokenAt(ts);
    if (cutHolding(list, TOKENS[i].start)) return;
    setSel(null);
    seekTok(i);
  };

  const onOvMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    hoverX.current = e.clientX - e.currentTarget.getBoundingClientRect().left;
  };
  const onOvDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    const t = ((e.clientX - cv.getBoundingClientRect().left) / cv.clientWidth) * EPISODE.raw;
    if (t < TOKENS[0].start - 1 || t > spanEnd(TOKENS.length - 1)) return;
    setSel(null);
    seekTok(tokenAt(t));
  };

  /* ── derived for render ─────────────────────────────────────────────── */

  const committed = useMemo(() => cuts.map((c) => ({ ...c, s0: TOKENS[c.from].start, len: lenOf(c) })), [cuts]);
  const edStart = (src: number) =>
    src - REMOVED_BEFORE_CH3 - committed.reduce((a, c) => a + (src >= c.s0 + c.len ? c.len : 0), 0);

  const integrated = LOUDNESS.integrated + LOUDNESS.perFiller * fillersCut;
  const gap = LOUDNESS.target - integrated;
  const lufsPos = (v: number) => `${((v + 36) / 30) * 100}%`;
  const totalCuts = OUTER_CUTS.length + cuts.length;
  const inSel = (i: number) => !!range && i >= range[0] && i <= range[1];

  const rootStyle = {
    "--shot-sans": "var(--font-bricolage)",
    "--shot-display": "var(--font-bricolage)",
    "--shot-read": "var(--font-literata)",
  } as CSSProperties;

  return (
    <div ref={rootRef} className={`${s.root} ${ui.variable} ${read.variable}`} style={rootStyle}>
      {/* ── top bar ── */}
      <header className={s.top}>
        <div className={s.ident}>
          <span className={s.logo}>
            <Icon name="dele" />
          </span>
          <span className={s.appName}>Proof</span>
          <span className={s.crumbSep} aria-hidden />
          <span className={s.show}>{EPISODE.show}</span>
          <span className={s.episode}>
            <span className={s.epNo}>{EPISODE.number}</span>
            {EPISODE.title}
          </span>
        </div>

        <div className={s.transport} role="group" aria-label="Transport">
          <button type="button" className={s.iconBtn} onClick={() => nudge(-5)} aria-label="Back 5 seconds" title="Back 5 seconds">
            <Icon name="back" />
          </button>
          <button
            type="button"
            className={s.play}
            onClick={() => setPlay(!playing)}
            aria-label={playing ? "Pause" : "Play"}
            aria-keyshortcuts="Space"
          >
            <Icon name={playing ? "pause" : "play"} filled={!playing} />
          </button>
          <button type="button" className={s.iconBtn} onClick={() => nudge(5)} aria-label="Forward 5 seconds" title="Forward 5 seconds">
            <Icon name="fwd" />
          </button>
          <div className={s.clock} aria-label="Position in the edited episode">
            <span {...r("tc")} className={s.clockNow}>
              {mmssd(PARAS[START_PARA].start - REMOVED_BEFORE_CH3)}
            </span>
            <span className={s.clockOf}>
              / <span {...r("tcTotal")}>{mmss(EPISODE.raw - 134)}</span>
            </span>
          </div>
          <button type="button" className={s.textBtn} onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])} aria-label={`Playback speed ${rate}x`}>
            {rate}×
          </button>
          <button
            type="button"
            className={s.iconBtn}
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
            title={loop ? "Looping chapter 3" : "Loop chapter 3"}
            aria-label="Loop chapter"
          >
            <Icon name="loop" />
          </button>
        </div>

        <div className={s.actions}>
          <span className={s.saved} data-saving={saving ? "1" : "0"} aria-live="polite">
            {saving ? "Saving…" : "All edits saved"}
          </span>
          <button type="button" className={s.iconBtn} onClick={undo} disabled={!undoStack.length || !!sweep} aria-label="Undo" title="Undo (⌘Z)">
            <Icon name="undo" />
          </button>
          <button type="button" className={s.iconBtn} onClick={redo} disabled={!redoStack.length || !!sweep} aria-label="Redo" title="Redo (⇧⌘Z)">
            <Icon name="redo" />
          </button>
        </div>
      </header>

      {/* ── overview ── */}
      <section className={s.overview} aria-label="Whole episode">
        <canvas
          ref={ovRef}
          className={s.ovCanvas}
          onPointerMove={onOvMove}
          onPointerLeave={() => {
            hoverX.current = null;
          }}
          onPointerDown={onOvDown}
        />
      </section>

      {/* ── transcript ── */}
      <main className={s.sheetWrap}>
        <div
          ref={scroller}
          className={s.sheet}
          tabIndex={0}
          aria-label="Transcript, chapter 3. Click a word to play from it, drag or shift-click to select, Delete to cut."
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
        >
          <header className={s.sheetHead}>
            <h1 className={s.chTitle}>Teeth, fingers and rubber</h1>
            <p className={s.chMeta}>
              Chapter 3 of 6 · {mmss(CH3_START)}–{mmss(CHAPTERS[2].end)} raw · {SPEAKERS.host.name} with {SPEAKERS.guest.name}
            </p>
            <p className={s.legend}>
              <span>
                <span className={s.legendFiller}>um</span> filler
              </span>
              <span>
                <span className={s.legendPause}>1.4s</span> long pause
              </span>
              <span>
                <Icon name="dele" className={s.legendDele} /> cut, click to restore
              </span>
            </p>
          </header>

          {PARAS.map((p) => {
            const paraCuts = committed.filter((c) => c.to >= p.from && c.from <= p.to);
            const paraLen = paraCuts.reduce((a, c) => a + c.len, 0);
            const out: ReactNode[] = [];
            for (let i = p.from; i <= p.to; i++) {
              const ci = cutOf[i];
              const cut = ci >= 0 ? cuts[ci] : null;
              if (cut && cut.phase === "closed") {
                if (i === Math.max(cut.from, p.from)) {
                  out.push(
                    <button
                      key={`c${cut.id}`}
                      type="button"
                      className={s.seam}
                      data-tip={`“${textOf(cut)}” · ${secs(lenOf(cut))}`}
                      aria-label={`Restore “${textOf(cut)}”, ${secs(lenOf(cut))}`}
                      onClick={() => record({ kind: "restore", specs: [{ from: cut.from, to: cut.to, pre: cut.pre }] })}
                    >
                      <Icon name="dele" />
                    </button>,
                  );
                }
                continue;
              }
              const t = TOKENS[i];
              const cls = [
                t.kind === "pause" ? s.pause : s.tok,
                t.filler ? s.filler : "",
                inSel(i) && !cut ? s.sel : "",
                cut ? s.striking : "",
                flash.has(i) ? s.flash : "",
              ]
                .filter(Boolean)
                .join(" ");
              out.push(
                <span
                  key={i}
                  data-i={i}
                  className={cls}
                  ref={(node) => {
                    tokEls.current[i] = node;
                  }}
                  title={t.filler ? `Filler “${t.filler}” · ${secs(lenOf({ from: i, to: i }))}` : undefined}
                >
                  {t.kind === "pause" ? (
                    <>
                      <svg viewBox="0 0 12 8" className={s.pauseGlyph} aria-hidden>
                        <path d="M1 1v6M11 1v6M1 4h10" />
                      </svg>
                      {t.text}
                    </>
                  ) : (
                    t.text
                  )}
                </span>,
              );
            }
            return (
              <section
                key={p.i}
                className={s.para}
                data-speaker={p.speaker}
                ref={(node) => {
                  paraEls.current[p.i] = node;
                }}
              >
                <div className={s.gutter}>
                  <span className={s.who}>
                    <SpeakerMark who={p.speaker} className={s.mark} />
                    {SPEAKERS[p.speaker].short}
                  </span>
                  <span className={s.when}>{mmss(edStart(p.start))}</span>
                </div>
                <p className={s.words}>{out}</p>
                <div className={s.margin}>
                  {paraCuts.length > 0 && (
                    <span className={s.proofMark}>
                      <Icon name="dele" className={s.proofIcon} />
                      <span>
                        −{paraLen.toFixed(1)}s
                        <span className={s.proofCount}>
                          {paraCuts.length} {paraCuts.length === 1 ? "cut" : "cuts"}
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              </section>
            );
          })}

          <p className={s.sheetEnd}>
            End of chapter 3. Chapter 4, “{CHAPTERS[3].title}”, opens at <span {...r("ch4Open")}>{INITIAL_CH[3].start}</span> in the edit.
          </p>

          {range && runs.length > 0 && (
            <div ref={bar} className={s.cutBar} onPointerDown={(e) => e.stopPropagation()}>
              <span className={s.cutBarInfo}>
                {selInfo.words} {selInfo.words === 1 ? "word" : "words"} · {secs(selInfo.len)}
              </span>
              <button type="button" className={s.cutBtn} onClick={cutSelection}>
                <Icon name="scissors" />
                Cut
                <kbd className={s.kbd}>Del</kbd>
              </button>
            </div>
          )}
        </div>

        {!follow && (
          <button type="button" className={s.followBtn} onClick={resume}>
            <Icon name="follow" />
            Back to the playhead
          </button>
        )}
      </main>

      {/* ── right rail ── */}
      <aside className={s.rail} aria-label="Edit summary">
        <section className={s.block}>
          <h2 className={s.h}>This edit</h2>
          <p className={s.summary}>
            <b className={s.num}>{totalCuts}</b> cuts · <b className={s.num} {...r("removed")}>2:14</b> removed · runtime{" "}
            <b className={s.num} {...r("runtime")}>
              39:52
            </b>
          </p>
          <div className={s.slot}>
            <div className={s.slotTrack} {...r("slotFill")}>
              <span className={s.slotFill} />
              <span className={s.slotMark} style={{ left: `${((EPISODE.slot - 34 * 60) / (EPISODE.raw - 34 * 60)) * 100}%` }} />
            </div>
            <div className={s.slotScale}>
              <span>34:00</span>
              <span>{mmss(EPISODE.raw)} raw</span>
            </div>
            <p className={s.slotNote}>
              <Icon name="warn" className={s.noteIcon} />
              <span {...r("slotText")}>1:52 over the 38:00 slot</span>
            </p>
          </div>
        </section>

        <section className={s.block}>
          <h2 className={s.h}>
            Fillers <span className={s.hMeta}>chapter 3</span>
          </h2>
          <ul className={s.kinds}>
            {FILLER_ORDER.map((k) => (
              <li key={k} className={s.kind} data-zero={byKind.get(k) === 0 ? "1" : "0"}>
                <span className={s.kindWord}>{k}</span>
                <span className={s.num}>{byKind.get(k)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={s.primary}
            onClick={removeFillers}
            disabled={!fillersLeft.length || !!sweep}
            style={{ "--f": sweep ? sweep.n / sweep.total : 0 } as CSSProperties}
            data-sweeping={sweep ? "1" : "0"}
          >
            <span className={s.primaryFill} aria-hidden />
            <span className={s.primaryLabel}>
              {sweep ? (
                <>
                  <span className={s.num}>
                    Removing {sweep.n} of {sweep.total}
                  </span>
                </>
              ) : fillersLeft.length ? (
                <>
                  <Icon name="sweep" />
                  <span>
                    Remove {fillersLeft.length} {fillersLeft.length === 1 ? "filler" : "fillers"}
                  </span>
                </>
              ) : (
                <>
                  <Icon name="check" />
                  No fillers left
                </>
              )}
            </span>
          </button>
        </section>

        <section className={s.block}>
          <h2 className={s.h}>
            Chapters <span className={s.hMeta}>edited times</span>
          </h2>
          <ol className={s.chapters}>
            {CHAPTERS.map((c, k) => (
              <li key={c.n} className={s.chapter} data-open={c.n === 3 ? "1" : "0"}>
                <span className={s.chN}>{c.n}</span>
                <span className={s.chName}>
                  {c.title}
                  {c.n === 3 && (
                    <span className={s.chProg} {...r("chProg")}>
                      <span />
                    </span>
                  )}
                </span>
                <span className={s.chT} {...r(`chs${k}`)}>
                  {INITIAL_CH[k].start}
                </span>
                <span className={s.chD} {...r(`chd${k}`)}>
                  {INITIAL_CH[k].len}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.block}>
          <h2 className={s.h}>
            Loudness <span className={s.hMeta}>target −16 LUFS</span>
          </h2>
          <p className={s.lufs}>
            <span className={s.lufsLabel}>Integrated</span>
            <b className={s.lufsVal}>−{Math.abs(integrated).toFixed(1)}</b>
            <span className={s.lufsUnit}>LUFS</span>
          </p>
          <div className={s.meter} {...r("meter")}>
            <span className={s.meterFill} />
            <span className={s.meterTarget} style={{ left: lufsPos(LOUDNESS.target) }} />
            <span className={s.meterInt} style={{ left: lufsPos(integrated) }} />
          </div>
          <div className={s.meterScale}>
            {[-36, -30, -24, -18, -12, -6].map((v) => (
              <span key={v} style={{ left: lufsPos(v) }}>
                {v === -6 ? "−6" : `−${-v}`}
              </span>
            ))}
          </div>
          <dl className={s.lufsStats}>
            <div>
              <dt>Momentary</dt>
              <dd className={s.num} {...r("lufsM")}>
                —
              </dd>
            </div>
            <div>
              <dt>True peak</dt>
              <dd className={s.num}>−{Math.abs(LOUDNESS.truePeak).toFixed(1)} dBTP</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd className={s.num}>{LOUDNESS.range.toFixed(1)} LU</dd>
            </div>
          </dl>
          <p className={s.note}>
            <Icon name="warn" className={s.noteIcon} />
            {gap.toFixed(1)} LU under target. Export adds {gap.toFixed(1)} dB of gain; the peak stays under −1 dBTP.
          </p>
        </section>
      </aside>

      {/* ── dock ── */}
      <section className={s.dock} aria-label="Waveform at the playhead">
        <div className={s.lanes}>
          <span className={s.dockHead}>
            <span className={s.num}>{DOCK_PX_PER_SEC}</span> px/s
          </span>
          {(["host", "guest"] as const).map((w) => (
            <span key={w} className={s.lane} data-speaker={w}>
              <SpeakerMark who={w} className={s.mark} />
              <span>
                {SPEAKERS[w].name}
                <span className={s.laneRole}>{SPEAKERS[w].role}</span>
              </span>
            </span>
          ))}
          <span className={s.dockFoot}>Words</span>
        </div>
        <div className={s.dockStage}>
          <canvas ref={dockRef} className={s.dockCanvas} onPointerDown={onDockDown} />
        </div>
      </section>
    </div>
  );
}

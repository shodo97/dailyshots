"use client";

/* 0012 — Hive
   A beekeeping inspection, recorded at the open hive. The person holding the
   phone is in a veil and gloves, in full sun, often with a frame in the other
   hand, so everything is big, high contrast and short: beeswax yellow as the
   surface, warm near-black ink, white, and four data colours for what is on
   the comb. Coverage is painted onto each frame with a thumb; the strip, the
   tool readouts and the summary are all counted from the same painted cells. */

import { Lexend } from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CARD_H, COMB_H, COMB_W, COMB_X, COMB_Y } from "./comb";
import {
  APIARY,
  CAPPED,
  CELLS,
  DATE_LABEL,
  EMPTY,
  FRAME_COUNT,
  HIVE,
  HONEY,
  LID_OFF,
  OPEN,
  OPENED_AFTER_S,
  POLLEN,
  PREVIOUS,
  START,
  TREAT_AT,
  WASH_BEES,
  WEATHER,
  buildGrids,
  countGrid,
  totals,
  type Cat,
  type Counts,
  type QueenCells,
  type Temper,
} from "./data";
import { FrameCard, type Painter } from "./frame";
import { Battery, Icon, Signal } from "./icons";
import s from "./shot.module.css";

const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });

type Kind = "brood" | "honey" | "pollen" | "empty";
const TOOLS: { kind: Kind; label: string }[] = [
  { kind: "brood", label: "Brood" },
  { kind: "honey", label: "Honey" },
  { kind: "pollen", label: "Pollen" },
  { kind: "empty", label: "Empty" },
];

/** Whole percentages for the four tools that always total 100 (largest remainder). */
function shares(c: Counts): Record<Kind, number> {
  const raw = [c[CAPPED] + c[OPEN], c[HONEY], c[POLLEN], c[EMPTY]].map((n) => (n / CELLS) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - out[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) out[order[k][1]]++;
  return { brood: out[0], honey: out[1], pollen: out[2], empty: out[3] };
}
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? "0.0" : `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
};
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** The scripted thumb's stroke on frame 2: brood has spread up into the honey arch. */
const DEMO_PATH: [number, number][] = [
  [0.2, 0.46],
  [0.3, 0.24],
  [0.4, 0.44],
  [0.5, 0.2],
  [0.6, 0.4],
  [0.7, 0.22],
  [0.8, 0.44],
];

export default function Hive() {
  const reduce = !!useReducedMotion();

  /* ── the record ─────────────────────────────────────────────────────────── */
  const [grids] = useState(buildGrids);
  const [counts, setCounts] = useState<Counts[]>(() => grids.map(countGrid));
  const [versions, setVersions] = useState<number[]>(() => grids.map(() => 0));
  const [idx, setIdx] = useState(START.frame);
  const [dir, setDir] = useState(1);
  const [kind, setKind] = useState<Kind>("honey");
  const [broodMode, setBroodMode] = useState<typeof CAPPED | typeof OPEN>(CAPPED);
  const [pulse, setPulse] = useState<Kind | null>(null);
  const [queenSeen, setQueenSeen] = useState(START.queenSeen);
  const [eggsSeen, setEggsSeen] = useState(START.eggsSeen);
  const [queenCells, setQueenCells] = useState<QueenCells>(START.queenCells);
  const [temper, setTemper] = useState<Temper>(START.temper);
  const [mites, setMites] = useState(START.mites);
  const [save, setSave] = useState<"idle" | "saving" | "saved">("idle");
  const [savedOnce, setSavedOnce] = useState(false);
  const [openFor, setOpenFor] = useState(OPENED_AFTER_S);

  const undo = useRef<{ frame: number; snap: Uint8Array }[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);

  const cat: Cat =
    kind === "brood" ? broodMode : kind === "honey" ? HONEY : kind === "pollen" ? POLLEN : EMPTY;

  const touch = useCallback(() => setSave((v) => (v === "saving" ? v : "idle")), []);

  const recount = useCallback(
    (i: number) => {
      setCounts((prev) => {
        const next = prev.slice();
        next[i] = countGrid(grids[i]);
        return next;
      });
      touch();
    },
    [grids, touch],
  );

  const onStroke = useCallback(
    (i: number) => {
      undo.current.push({ frame: i, snap: grids[i].slice() });
      if (undo.current.length > 40) undo.current.shift();
      setUndoDepth(undo.current.length);
    },
    [grids],
  );

  const idxRef = useRef(idx);
  const goTo = useCallback((i: number) => {
    const n = Math.max(0, Math.min(FRAME_COUNT - 1, i));
    const cur = idxRef.current;
    if (n === cur) return;
    idxRef.current = n;
    setDir(n > cur ? 1 : -1);
    setIdx(n);
  }, []);

  const doUndo = () => {
    const step = undo.current.pop();
    setUndoDepth(undo.current.length);
    if (!step) return;
    grids[step.frame].set(step.snap);
    setVersions((v) => v.map((n, k) => (k === step.frame ? n + 1 : n)));
    recount(step.frame);
    if (step.frame !== idx) goTo(step.frame);
  };

  const pickTool = (k: Kind) => {
    if (k === "brood" && kind === "brood") setBroodMode((m) => (m === CAPPED ? OPEN : CAPPED));
    setKind(k);
  };

  /* ── painters, so the scripted thumb paints through the same path as a finger */
  const painters = useRef(new Map<number, Painter>());
  const register = useCallback((i: number, p: Painter | null) => {
    if (p) painters.current.set(i, p);
    else painters.current.delete(i);
  }, []);

  /* ── the clock: the hive has been open for a while already ──────────────── */
  useEffect(() => {
    if (save === "saved") return;
    const id = window.setInterval(() => setOpenFor((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [save]);
  const nowMin = LID_OFF.h * 60 + LID_OFF.m + Math.floor(openFor / 60);
  const nowLabel = `${Math.floor(nowMin / 60)}:${String(nowMin % 60).padStart(2, "0")}`;

  /* ── the scripted thumb ─────────────────────────────────────────────────── */
  const thumbRef = useRef<HTMLDivElement>(null);
  const demoAbort = useRef(false);

  useEffect(() => {
    if (reduce) return;
    demoAbort.current = false;
    const thumb = thumbRef.current;
    if (!thumb) return;
    const timers: number[] = [];
    let raf = 0;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const place = (x: number, y: number) => {
      thumb.style.transform = `translate(${x}px, ${y}px)`;
    };
    const combPt = (u: number, v: number): [number, number] => [COMB_X + u * COMB_W, COMB_Y + v * COMB_H];
    const pathAt = (t: number): [number, number] => {
      const segs = DEMO_PATH.length - 1;
      const f = Math.min(segs - 1e-6, Math.max(0, t * segs));
      const k = Math.floor(f);
      const r = f - k;
      const [u0, v0] = DEMO_PATH[k];
      const [u1, v1] = DEMO_PATH[k + 1];
      return combPt(u0 + (u1 - u0) * r, v0 + (v1 - v0) * r);
    };
    const tween = (ms: number, from: [number, number], to: [number, number], each?: (x: number, y: number) => void) =>
      new Promise<void>((done) => {
        const t0 = performance.now();
        const step = (now: number) => {
          if (demoAbort.current) return done();
          const t = Math.min(1, (now - t0) / ms);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          const x = from[0] + (to[0] - from[0]) * e;
          const y = from[1] + (to[1] - from[1]) * e;
          place(x, y);
          each?.(x, y);
          if (t < 1) raf = requestAnimationFrame(step);
          else done();
        };
        raf = requestAnimationFrame(step);
      });

    const run = async () => {
      const p0 = pathAt(0);
      place(p0[0] + 40, p0[1] + 120);
      at(900, () => {
        if (demoAbort.current) return;
        setKind("brood");
        setPulse("brood");
      });
      await new Promise((r) => at(1250, () => r(null)));
      if (demoAbort.current) return;
      thumb.dataset.state = "hover";
      await tween(380, [p0[0] + 40, p0[1] + 120], p0);
      if (demoAbort.current) return;
      thumb.dataset.state = "press";
      const painter = () => painters.current.get(idxRef.current);
      painter()?.paintAt(p0[0], p0[1], CAPPED, true);
      // The stroke itself: eased along the path, painting as it goes.
      await new Promise<void>((done) => {
        const t0 = performance.now();
        const dur = 2400;
        const step = (now: number) => {
          if (demoAbort.current) return done();
          const t = Math.min(1, (now - t0) / dur);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          const [x, y] = pathAt(e);
          place(x, y);
          painter()?.paintAt(x, y, CAPPED, false);
          if (t < 1) raf = requestAnimationFrame(step);
          else done();
        };
        raf = requestAnimationFrame(step);
      });
      if (demoAbort.current) return;
      // Lift off and fade between gestures; the thumb is only on screen while
      // it is doing something.
      thumb.dataset.state = "off";
      await new Promise((r) => at(420, () => r(null)));
      if (demoAbort.current) return;
      // Then touch down on the top bar and flick to the next frame.
      place(250, 9);
      thumb.dataset.state = "press";
      await new Promise((r) => at(160, () => r(null)));
      if (demoAbort.current) return;
      at(90, () => !demoAbort.current && goTo(idxRef.current + 1));
      await tween(300, [250, 9], [40, 2]);
      thumb.dataset.state = "off";
    };
    void run();
    return () => {
      demoAbort.current = true;
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [reduce, goTo]);

  const stopDemo = () => {
    if (demoAbort.current) return;
    demoAbort.current = true;
    if (thumbRef.current) thumbRef.current.dataset.state = "off";
  };

  useEffect(() => {
    if (!pulse) return;
    const t = window.setTimeout(() => setPulse(null), 520);
    return () => window.clearTimeout(t);
  }, [pulse]);

  /* ── derived ────────────────────────────────────────────────────────────── */
  const sum = useMemo(() => totals(counts), [counts]);
  const cur = counts[idx];
  const toolPct = shares(cur);
  const mitePct = mites / WASH_BEES;
  const swarm = queenCells === "2+";

  const queenCellsRef = useRef<HTMLDivElement>(null);
  const jumpToCells = () =>
    queenCellsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });

  const doSave = () => {
    if (save !== "idle") return;
    setSave("saving");
    window.setTimeout(() => {
      setSave("saved");
      setSavedOnce(true);
    }, reduce ? 0 : 900);
  };

  /* ── strip scrubbing ────────────────────────────────────────────────────── */
  const stripRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const stripIndex = (clientX: number) => {
    const r = stripRef.current!.getBoundingClientRect();
    return Math.floor(((clientX - r.left) / r.width) * FRAME_COUNT);
  };

  const rootStyle = {
    "--shot-sans": "var(--font-lexend)",
    "--shot-display": "var(--font-lexend)",
  } as CSSProperties;

  return (
    <div className={`${s.root} ${lexend.variable}`} style={rootStyle} onPointerDownCapture={stopDemo}>
      {/* ── status bar ── */}
      <div className={s.status}>
        <span className={s.statusTime}>{nowLabel}</span>
        <span className={s.statusIcons}>
          <Signal bars={1} />
          <Battery level={0.64} />
        </span>
      </div>

      {/* ── hive identity ── */}
      <header className={s.head}>
        <div className={s.headRow}>
          <p className={s.apiary}>{APIARY}</p>
          <p className={s.weather}>
            <Icon name="sun" size={22} />
            <b>{WEATHER.tempC}°</b>
            <span className={s.srOnly}>{WEATHER.sky},</span>
            {WEATHER.wind}
          </p>
        </div>
        <h1 className={s.hive}>
          Hive {HIVE.number} <span>{HIVE.name}</span>
        </h1>
        <div className={s.headRow}>
          <p className={s.when}>
            {DATE_LABEL}, lid off {LID_OFF.h}:{String(LID_OFF.m).padStart(2, "0")}
          </p>
          <p className={s.openFor} data-saved={save === "saved" ? "1" : "0"}>
            {save === "saved" ? "Closed " : "Open "}
            <span className={s.tnum}>{clock(openFor)}</span>
          </p>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {swarm && (
          <motion.button
            key="swarm"
            type="button"
            className={s.swarm}
            onClick={jumpToCells}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Icon name="alert" size={26} />
            <span>Swarm cells — plan a split today</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── the box, side on ── */}
      <section className={s.box} aria-label="Brood box">
        <div
          ref={stripRef}
          className={s.strip}
          onPointerDown={(e) => {
            if (e.button > 0) return;
            scrubbing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            goTo(stripIndex(e.clientX));
          }}
          onPointerMove={(e) => scrubbing.current && goTo(stripIndex(e.clientX))}
          onPointerUp={() => (scrubbing.current = false)}
          onPointerCancel={() => (scrubbing.current = false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const n = Math.max(0, Math.min(FRAME_COUNT - 1, idx + (e.key === "ArrowRight" ? 1 : -1)));
              goTo(n);
              (stripRef.current?.children[n] as HTMLElement | undefined)?.focus();
            }
          }}
        >
          {counts.map((c, i) => {
            const sh = shares(c);
            return (
            <button
              key={i}
              type="button"
              className={s.slot}
              aria-current={i === idx ? "true" : undefined}
              tabIndex={i === idx ? 0 : -1}
              aria-label={`Frame ${i + 1}: brood ${sh.brood}%, honey ${sh.honey}%, pollen ${sh.pollen}%, empty ${sh.empty}%`}
              onClick={() => goTo(i)}
            >
              <span className={s.slotBar}>
                <i className={s.segHoney} style={{ height: `${(c[HONEY] / CELLS) * 100}%` }} />
                <i className={s.segPollen} style={{ height: `${(c[POLLEN] / CELLS) * 100}%` }} />
                <i className={s.segCapped} style={{ height: `${(c[CAPPED] / CELLS) * 100}%` }} />
                <i className={s.segOpen} style={{ height: `${(c[OPEN] / CELLS) * 100}%` }} />
                <i className={s.segEmpty} style={{ height: `${(c[EMPTY] / CELLS) * 100}%` }} />
              </span>
              <span className={s.slotNum}>
                {i === idx && (
                  <motion.span
                    layoutId="hive-slot"
                    className={s.slotMark}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }}
                  />
                )}
                <span className={s.slotNumText}>{i + 1}</span>
              </span>
            </button>
            );
          })}
        </div>
      </section>

      {/* ── the frame in hand ── */}
      <section className={s.well} aria-label="Frame being inspected">
        <div className={s.wellHead}>
          <h2 className={s.frameTitle}>
            Frame <span className={s.tnum}>{idx + 1}</span>
            <small> of {FRAME_COUNT}</small>
          </h2>
          <div className={s.wellBtns}>
            <button
              type="button"
              className={s.iconBtn}
              onClick={() => goTo(idx - 1)}
              disabled={idx === 0}
              aria-label="Previous frame"
            >
              <Icon name="left" size={28} />
            </button>
            <button
              type="button"
              className={s.iconBtn}
              onClick={() => goTo(idx + 1)}
              disabled={idx === FRAME_COUNT - 1}
              aria-label="Next frame"
            >
              <Icon name="right" size={28} />
            </button>
          </div>
        </div>

        <div
          className={s.stack}
          style={{ height: CARD_H + 18 }}
          tabIndex={0}
          role="group"
          aria-roledescription="frame stack"
          aria-label={`Frame ${idx + 1} of ${FRAME_COUNT}. Left and right arrow keys change frame. Paint on the comb, drag the wood to swipe.`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") goTo(idx + 1);
            else if (e.key === "ArrowLeft") goTo(idx - 1);
            else return;
            e.preventDefault();
          }}
        >
          {idx < FRAME_COUNT - 2 && <span className={`${s.peek} ${s.peek2}`} aria-hidden />}
          {idx < FRAME_COUNT - 1 && <span className={`${s.peek} ${s.peek1}`} aria-hidden />}
          <AnimatePresence initial={false} custom={dir}>
            <FrameCard
              key={idx}
              index={idx}
              dir={dir}
              grid={grids[idx]}
              version={versions[idx]}
              cat={cat}
              reduce={reduce}
              canPrev={idx > 0}
              canNext={idx < FRAME_COUNT - 1}
              onStroke={onStroke}
              onChanged={recount}
              onSwipe={(d) => goTo(idx + d)}
              register={register}
            />
          </AnimatePresence>
          <div ref={thumbRef} className={s.thumb} data-state="off" aria-hidden />
        </div>

        <div className={s.tools} role="toolbar" aria-label="Paint what you see">
          {TOOLS.map((t) => {
            const active = kind === t.kind;
            const key =
              t.kind === "brood" ? (broodMode === CAPPED ? s.keyCapped : s.keyOpen) : t.kind === "honey" ? s.keyHoney : t.kind === "pollen" ? s.keyPollen : s.keyEmpty;
            return (
              <button
                key={t.kind}
                type="button"
                className={s.tool}
                aria-pressed={active}
                data-pulse={pulse === t.kind ? "1" : "0"}
                onClick={() => pickTool(t.kind)}
                aria-label={
                  t.kind === "brood"
                    ? `Brood, ${broodMode === CAPPED ? "capped" : "open and eggs"}, ${toolPct.brood}% of this frame${active ? ". Tap again to switch." : ""}`
                    : `${t.label}, ${toolPct[t.kind]}% of this frame`
                }
              >
                <span className={`${s.toolTop} ${key}`}>{t.label}</span>
                <span className={s.toolPct}>
                  {toolPct[t.kind]}
                  <small>%</small>
                </span>
                {t.kind === "brood" && (
                  <span className={s.toolMode}>{broodMode === CAPPED ? "Capped" : "Eggs"}</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            className={s.undo}
            onClick={doUndo}
            disabled={undoDepth === 0}
            aria-label="Undo last stroke"
          >
            <Icon name="undo" size={26} />
          </button>
        </div>
      </section>

      {/* ── colony ── */}
      <section className={s.colony} aria-labelledby="hive-colony">
        <h2 id="hive-colony" className={s.h2Big}>
          Colony
        </h2>

        <Field label="Queen seen">
          <Seg
            label="Queen seen"
            options={["Seen", "Not seen"]}
            value={queenSeen ? "Seen" : "Not seen"}
            onChange={(v) => {
              setQueenSeen(v === "Seen");
              touch();
            }}
          />
        </Field>

        <Field label="Eggs">
          <Seg
            label="Eggs"
            options={["Seen", "Not seen"]}
            value={eggsSeen ? "Seen" : "Not seen"}
            onChange={(v) => {
              setEggsSeen(v === "Seen");
              touch();
            }}
          />
        </Field>

        <div ref={queenCellsRef}>
          <Field label="Queen cells" aside={`was ${PREVIOUS.queenCells} on ${PREVIOUS.short}`}>
            <Seg
              label="Queen cells"
              options={["0", "1", "2+"]}
              value={queenCells}
              warn="2+"
              onChange={(v) => {
                setQueenCells(v as QueenCells);
                touch();
              }}
            />
          </Field>
          {swarm && (
            <p className={s.cellsNote}>
              <Icon name="alert" size={22} />
              Two or more cells: the colony is preparing to swarm. Split before the first cell is capped.
            </p>
          )}
        </div>

        <Field label="Temper">
          <Seg
            label="Temper"
            options={["Calm", "Nervous", "Defensive"]}
            value={temper}
            onChange={(v) => {
              setTemper(v as Temper);
              touch();
            }}
          />
        </Field>

        <Field label="Varroa" aside={`${WASH_BEES} bee wash`}>
          <div className={s.stepper} data-warn={mitePct > TREAT_AT ? "1" : "0"}>
            <button
              type="button"
              className={s.stepBtn}
              onClick={() => {
                setMites((m) => Math.max(0, m - 1));
                touch();
              }}
              disabled={mites === 0}
              aria-label="One fewer mite"
            >
              <Icon name="minus" size={28} />
            </button>
            <div className={s.stepVal} aria-live="polite">
              <span className={s.stepNum}>{mites}</span>
              <span className={s.stepUnit}>
                mites
                <b className={s.tnum}>{(mitePct * 100).toFixed(1)}%</b>
              </span>
            </div>
            <button
              type="button"
              className={s.stepBtn}
              onClick={() => {
                setMites((m) => Math.min(60, m + 1));
                touch();
              }}
              aria-label="One more mite"
            >
              <Icon name="plus" size={28} />
            </button>
          </div>
          <MiteScale value={mitePct} />
        </Field>
      </section>

      {/* ── summary ── */}
      <section className={s.summary} aria-labelledby="hive-since">
        <h2 id="hive-since" className={s.h2Big}>
          Since {PREVIOUS.label}
        </h2>
        <p className={s.sumSub}>
          {PREVIOUS.daysAgo} days ago. Counted in frames across the brood box; the super is not included.
        </p>

        <SumRow label="Brood" sw={s.swCapped} now={sum.brood} then={PREVIOUS.brood} />
        <SumRow label="Honey" sw={s.swHoney} now={sum.honey} then={PREVIOUS.honey} />
        <SumRow label="Pollen" sw={s.swPollen} now={sum.pollen} then={PREVIOUS.pollen} />
        <SumRow label="Empty comb" sw={s.swEmpty} now={sum.empty} then={PREVIOUS.empty} />

        <dl className={s.facts}>
          <div>
            <dt>Queen cells</dt>
            <dd data-warn={swarm ? "1" : "0"}>
              {queenCells} <small>was {PREVIOUS.queenCells}</small>
            </dd>
          </div>
          <div>
            <dt>Varroa</dt>
            <dd data-warn={mitePct > TREAT_AT ? "1" : "0"}>
              {(mitePct * 100).toFixed(1)}% <small>was {((PREVIOUS.mites / WASH_BEES) * 100).toFixed(1)}%</small>
            </dd>
          </div>
          <div>
            <dt>Queen and eggs</dt>
            <dd data-warn={!queenSeen && !eggsSeen ? "1" : "0"}>
              {queenSeen && eggsSeen ? "Both seen" : queenSeen ? "Queen only" : eggsSeen ? "Eggs only" : "Neither"}
            </dd>
          </div>
          <div>
            <dt>Temper</dt>
            <dd>{temper}</dd>
          </div>
        </dl>
      </section>

      {/* ── save ── */}
      <div className={s.saveBar}>
        <div className={s.saveRow}>
          <div className={s.tally} aria-live="off">
            <span>
              <b className={s.tnum}>{one(sum.brood)}</b> brood
            </span>
            <span>
              <b className={s.tnum}>{one(sum.honey)}</b> honey
            </span>
          </div>
          <button type="button" className={s.save} data-state={save} onClick={doSave} aria-live="polite">
            {save === "saving" ? (
              <>
                <span className={s.spinner} aria-hidden />
                Saving
              </>
            ) : save === "saved" ? (
              <>
                <Icon name="check" size={26} />
                Saved to phone
              </>
            ) : savedOnce ? (
              "Save changes"
            ) : (
              "Save inspection"
            )}
          </button>
        </div>
        {save === "saved" && (
          <p className={s.saveNote}>
            <Icon name="phone" size={16} />
            No signal. Syncs when back in range.
          </p>
        )}
        <span className={s.home} aria-hidden />
      </div>
    </div>
  );
}

/* ── small parts ─────────────────────────────────────────────────────────── */

function Field({ label, aside, children }: { label: string; aside?: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <div className={s.fieldHead}>
        <h3 className={s.fieldLabel}>{label}</h3>
        {aside && <span className={s.fieldAside}>{aside}</span>}
      </div>
      {children}
    </div>
  );
}

function Seg({
  label,
  options,
  value,
  warn,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  warn?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={s.seg} role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          data-warn={o === warn ? "1" : "0"}
          className={s.segBtn}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SumRow({ label, sw, now, then }: { label: string; sw: string; now: number; then: number }) {
  return (
    <div className={s.sumRow}>
      <div className={s.sumTop}>
        <span className={s.sumLabel}>
          <i className={`${s.swatch} ${sw}`} />
          {label}
        </span>
        <span className={s.sumNow}>
          <b className={s.tnum}>{one(now)}</b>
          <small>frames</small>
        </span>
        <span className={s.sumDelta}>{signed(Number(one(now)) - then)}</span>
      </div>
      <div className={s.sumTrack} aria-hidden>
        <span className={`${s.sumFill} ${sw}`} style={{ width: `${(now / FRAME_COUNT) * 100}%` }} />
        <span className={s.sumThen} style={{ left: `${(then / FRAME_COUNT) * 100}%` }}>
          <i>{one(then)}</i>
        </span>
      </div>
    </div>
  );
}

/** A real scale: 0–5 % infestation, treatment threshold marked. */
function MiteScale({ value }: { value: number }) {
  const max = 0.05;
  return (
    <div className={s.miteScale} aria-hidden>
      <span className={s.miteBand} style={{ left: `${(TREAT_AT / max) * 100}%` }} />
      <span className={s.miteMark} style={{ left: `${(Math.min(value, max) / max) * 100}%` }} />
      <span className={s.miteLabels}>
        <i>0%</i>
        <i style={{ left: `${(TREAT_AT / max) * 100}%` }}>Treat at 3%</i>
        <i>5%</i>
      </span>
    </div>
  );
}

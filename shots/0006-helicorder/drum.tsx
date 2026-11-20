"use client";

/* The drum. One Canvas 2D record, 24 lines of 30 minutes each, written live.
   Completed lines are rendered once into an offscreen sheet (the paper) and
   blitted every frame; only the line under the pen, the marks and the loupe
   are drawn per frame. When the pen reaches the end of a line the sheet is
   rebuilt one line on and slid up, which is the record advancing. */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import s from "./shot.module.css";
import {
  FS_DRUM,
  FS_FINE,
  LINES,
  LINE_S,
  STATIONS,
  dayLabel,
  detectT,
  eventsAround,
  fmtMl,
  hhmm,
  markOffset,
  sample,
  utc,
  type Ev,
} from "./data";

export type Clock = { t: number; rate: number };

/* Pen inks cycle by absolute line number, so a line keeps its colour as the
   record scrolls: black, red, blue, green, as the drum recorders did. */
export const INKS = ["#1f1d1a", "#ad291f", "#1e4896", "#21653a"];
const PAPER = "#f3e7c6";
const PAPER_RULE = "#d8c597";
const PRINT = "#6d6250";
const PRINT_STRONG = "#3b362d";
const GRAPHITE = "#38362f";
const VIOLET = "#5b3fa0";

const RULER_T = 24;
const RULER_B = 20;
const MARGIN_L = 62;
const MARGIN_R = 44;

type Geom = {
  w: number;
  h: number;
  paperY: number;
  paperH: number;
  sp: number;
  x0: number;
  tw: number;
};

function geom(w: number, h: number): Geom {
  const paperH = h - RULER_T - RULER_B;
  return { w, h, paperY: RULER_T, paperH, sp: paperH / LINES, x0: MARGIN_L, tw: w - MARGIN_L - MARGIN_R };
}

/* ── sample and envelope caches ─────────────────────────────────────────── */

const samples = new Map<string, Float32Array>();
function lineSamples(si: number, line: number) {
  const key = `${si}:${line}`;
  const hit = samples.get(key);
  if (hit) return hit;
  const n = LINE_S * FS_DRUM;
  const out = new Float32Array(n);
  const base = line * LINE_S;
  const evs = eventsAround(base, base + LINE_S);
  for (let k = 0; k < n; k++) out[k] = sample(si, base + k / FS_DRUM, evs);
  samples.set(key, out);
  return out;
}

type Env = { lo: Float32Array; hi: Float32Array; gap: Uint8Array; n: number };
const envs = new Map<string, Env>();
function envelope(si: number, line: number, n: number): Env {
  const key = `${si}:${line}:${n}`;
  const hit = envs.get(key);
  if (hit) return hit;
  const src = lineSamples(si, line);
  const lo = new Float32Array(n).fill(Infinity);
  const hi = new Float32Array(n).fill(-Infinity);
  const gap = new Uint8Array(n);
  const N = src.length;
  for (let k = 0; k < N; k++) {
    const c = ((k * n) / N) | 0;
    const v = src[k];
    if (v !== v) {
      gap[c] = 1;
      continue;
    }
    if (v < lo[c]) lo[c] = v;
    if (v > hi[c]) hi[c] = v;
  }
  const env = { lo, hi, gap, n };
  envs.set(key, env);
  return env;
}

function prune(first: number) {
  for (const k of samples.keys()) if (Number(k.split(":")[1]) < first - 2) samples.delete(k);
  for (const k of envs.keys()) if (Number(k.split(":")[1]) < first - 2) envs.delete(k);
}

/* ── drawing helpers ────────────────────────────────────────────────────── */

const ink = (line: number) => INKS[((line % 4) + 4) % 4];

/** Strokes one line of the record from its envelope, up to column `upto`. */
function strokeLine(
  ctx: CanvasRenderingContext2D,
  env: Env,
  upto: number,
  g: Geom,
  base: number,
  scale: number,
  clip: number,
  lineStart: number,
) {
  const colW = g.tw / env.n;
  const secPerCol = LINE_S / env.n;
  let down = false;
  ctx.beginPath();
  for (let c = 0; c < upto; c++) {
    if (env.gap[c] || env.lo[c] === Infinity) {
      down = false;
      continue;
    }
    const x = g.x0 + (c + 0.5) * colW;
    const ta = lineStart + c * secPerCol;
    // the recorder's minute pulse, where one falls inside this column
    const mk = Math.floor((ta + secPerCol) / 60) > Math.floor(ta / 60) || ta % 60 < 1.6 ? markOffset(Math.ceil(ta / 60) * 60) || 2.6 : 0;
    const top = base - Math.max(-clip, Math.min(clip, env.hi[c] * scale + mk));
    const bot = base - Math.max(-clip, Math.min(clip, env.lo[c] * scale));
    if (!down) {
      ctx.moveTo(x, top);
      down = true;
    } else ctx.lineTo(x, top);
    ctx.lineTo(x, bot);
  }
  ctx.stroke();
}

function buildSheet(
  sheet: HTMLCanvasElement,
  g: Geom,
  dpr: number,
  si: number,
  first: number,
  scale: number,
  mono: string,
) {
  sheet.width = Math.round(g.w * dpr);
  sheet.height = Math.round((g.paperH + g.sp) * dpr);
  const ctx = sheet.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.w, g.paperH + g.sp);
  const n = Math.round(g.tw * dpr);
  const clip = g.sp * 1.3;
  const st = STATIONS[si];

  ctx.lineJoin = "round";
  for (let r = -1; r < LINES; r++) {
    const line = first + r;
    if (line < 0) continue;
    const y0 = g.sp * (r + 1);
    const base = y0 + g.sp / 2;
    const start = line * LINE_S;

    // time labels printed in the left margin
    const onHour = start % 3600 === 0;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.font = `${onHour ? 500 : 400} 10.5px ${mono}`;
    ctx.fillStyle = onHour ? PRINT_STRONG : PRINT;
    ctx.fillText(hhmm(start), g.x0 - 10, base);
    if (start % 86400 === 8 * 3600) {
      ctx.font = `400 9px ${mono}`;
      ctx.fillStyle = PRINT;
      ctx.fillText(dayLabel(start).toUpperCase(), g.x0 - 10, base + 11);
    }

    if (r === LINES - 1) continue; // the live line is drawn per frame

    // a line of pure telemetry gap: the nominal baseline, dotted
    const gapFrom = st.offlineFrom;
    if (gapFrom !== undefined && gapFrom < start + LINE_S) {
      const gx = g.x0 + Math.max(0, (gapFrom - start) / LINE_S) * g.tw;
      ctx.save();
      ctx.setLineDash([1.5, 4]);
      ctx.strokeStyle = PAPER_RULE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx + 4, base);
      ctx.lineTo(g.x0 + g.tw, base);
      ctx.stroke();
      ctx.restore();
      if (gapFrom >= start) {
        ctx.font = `500 10px ${mono}`;
        ctx.textAlign = "left";
        ctx.fillStyle = PRINT_STRONG;
        ctx.fillText(`NO DATA FROM ${utc(gapFrom)}`, gx + 10, base - g.sp * 0.3);
        ctx.strokeStyle = PRINT_STRONG;
        ctx.beginPath();
        ctx.moveTo(gx + 0.5, base - g.sp * 0.42);
        ctx.lineTo(gx + 0.5, base + g.sp * 0.42);
        ctx.stroke();
      }
    }

    const env = envelope(si, line, n);
    ctx.strokeStyle = ink(line);
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 1;
    strokeLine(ctx, env, n, g, base, scale, clip, start);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ── the component ──────────────────────────────────────────────────────── */

type Props = {
  clock: MutableRefObject<Clock>;
  station: number;
  gain: number;
  selectedId: string | null;
  picked: ReadonlySet<string>;
  onPick: (id: string) => void;
  reduce: boolean;
  mono: string;
  sans: string;
};

const LOUPE_R = 78;
const ZX = 24;
const ZY = 1.5;

export function Drum(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  useLayoutEffect(() => {
    P.current = props;
  });

  const pointer = useRef({ x: 0, y: 0, inside: false });
  const kbd = useRef<string | null>(null);
  const hoverRef = useRef<() => Ev | null>(() => null);
  const touchedRef = useRef(false);
  const evsRef = useRef<Ev[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    const sheet = document.createElement("canvas");
    const size = { w: 0, h: 0, dpr: 1 };
    let built = { key: "", cur: -1 };
    let adv = { start: 0, active: false };
    const loupe = { x: 0, y: 0, a: 0, init: false };
    const seenAt = new Map<string, number>();
    let firstFrame = true;
    let introStart = 0;
    let fontsReady = false;
    let last = performance.now();
    let raf = 0;

    document.fonts.ready.then(() => {
      fontsReady = true;
      built = { key: "", cur: -1 };
    });

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      size.w = Math.round(width);
      size.h = Math.round(height);
      size.dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(size.w * size.dpr);
      cv.height = Math.round(size.h * size.dpr);
      built = { key: "", cur: -1 };
    });
    ro.observe(wrap);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const p = P.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      p.clock.current.t += dt * p.clock.current.rate;
      const t = p.clock.current.t;
      if (!size.w || !size.h) return;

      const g = geom(size.w, size.h);
      const { dpr } = size;
      const si = p.station;
      const st = STATIONS[si];
      const scale = (g.sp / 20) * st.view * p.gain;
      const clip = g.sp * 1.3;
      const cur = Math.floor(t / LINE_S);
      const first = cur - (LINES - 1);
      const curStart = cur * LINE_S;
      const key = `${si}|${p.gain}|${size.w}x${size.h}@${dpr}|${fontsReady}`;

      if (built.key !== key || built.cur !== cur) {
        const advanced = built.key === key && cur === built.cur + 1;
        buildSheet(sheet, g, dpr, si, first, scale, p.mono);
        prune(first);
        adv = advanced && !p.reduce ? { start: now, active: true } : { start: 0, active: false };
        built = { key, cur };
      }

      let off = 0;
      if (adv.active) {
        const k = Math.min(1, (now - adv.start) / 900);
        off = g.sp * Math.pow(1 - k, 3);
        if (k >= 1) adv.active = false;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);

      /* paper */
      ctx.fillStyle = PAPER;
      roundRect(ctx, 0, g.paperY, g.w, g.paperH, 3);
      ctx.fill();
      ctx.strokeStyle = PAPER_RULE;
      ctx.lineWidth = 1;
      for (const x of [g.x0 - 4.5, g.x0 + g.tw + 4.5]) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, g.paperY);
        ctx.lineTo(Math.round(x) + 0.5, g.paperY + g.paperH);
        ctx.stroke();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, g.paperY, g.w, g.paperH);
      ctx.clip();
      ctx.drawImage(sheet, 0, g.paperY - g.sp + off, g.w, g.paperH + g.sp);

      /* the live line */
      const n = Math.round(g.tw * dpr);
      const env = envelope(si, cur, n);
      const frac = Math.min(1, (t - curStart) / LINE_S);
      const upto = Math.min(n, Math.floor(frac * n));
      const baseOf = (row: number) => g.paperY + row * g.sp + g.sp / 2 + off;
      const liveBase = baseOf(LINES - 1);
      const offline = st.offlineFrom !== undefined && t >= st.offlineFrom;
      const penX = g.x0 + frac * g.tw;

      if (st.offlineFrom !== undefined && st.offlineFrom < curStart + LINE_S) {
        const gx = g.x0 + Math.max(0, (st.offlineFrom - curStart) / LINE_S) * g.tw;
        if (penX > gx + 4) {
          ctx.save();
          ctx.setLineDash([1.5, 4]);
          ctx.strokeStyle = PAPER_RULE;
          ctx.beginPath();
          ctx.moveTo(gx + 4, liveBase);
          ctx.lineTo(penX, liveBase);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.strokeStyle = ink(cur);
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      strokeLine(ctx, env, upto, g, liveBase, scale, clip, curStart);

      /* the pen: a carriage guide from the ruler, and the nib on the paper */
      const c = Math.max(0, upto - 1);
      const penY = offline || env.gap[c]
        ? liveBase
        : liveBase - Math.max(-clip, Math.min(clip, ((env.hi[c] + env.lo[c]) / 2) * scale));
      ctx.restore();

      ctx.strokeStyle = "rgba(56, 54, 47, 0.22)";
      ctx.beginPath();
      ctx.moveTo(Math.round(penX) + 0.5, g.paperY);
      ctx.lineTo(Math.round(penX) + 0.5, penY - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(penX, penY, 3, 0, Math.PI * 2);
      if (offline) {
        ctx.strokeStyle = GRAPHITE;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      } else {
        ctx.fillStyle = ink(cur);
        ctx.fill();
      }

      /* detections, tallies and picks */
      const winStart = first * LINE_S;
      const evs = eventsAround(winStart, t).filter((e) => detectT(e) <= t && e.t0 >= winStart - 60);
      const sel = p.selectedId;
      const tallies = new Array<number>(LINES).fill(0);
      const fresh: { id: string; row: number; k: number }[] = [];
      const posOf = (e: Ev) => {
        const tp = e.arr[si].tp;
        const line = Math.floor(tp / LINE_S);
        const row = line - first;
        return { row, x: g.x0 + ((tp - line * LINE_S) / LINE_S) * g.tw, base: baseOf(row) };
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, g.paperY, g.w, g.paperH);
      ctx.clip();

      const hover = hoverEvent();
      for (const e of evs) {
        const { row, x, base } = posOf(e);
        if (row < 0 || row >= LINES) continue;
        tallies[row]++;
        if (!seenAt.has(e.id)) seenAt.set(e.id, firstFrame ? -1e9 : now);
        const age = now - (seenAt.get(e.id) ?? 0);
        const k = p.reduce ? 1 : Math.min(1, age / 520);
        if (k < 1) fresh.push({ id: e.id, row, k });
        const isSel = e.id === sel;
        const isPicked = p.picked.has(e.id);
        const isHover = hover?.id === e.id || kbd.current === e.id;
        const ty = base - g.sp * 0.44 - (1 - k) * 8;
        const size2 = isHover ? 4.2 : 3.2;

        if (isSel || isPicked) {
          ctx.strokeStyle = VIOLET;
          ctx.lineWidth = isSel ? 1.5 : 1.25;
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, base - g.sp * (isSel ? 0.5 : 0.36));
          ctx.lineTo(Math.round(x) + 0.5, base + g.sp * (isSel ? 0.5 : 0.36));
          ctx.stroke();
        }
        ctx.globalAlpha = k;
        ctx.beginPath();
        ctx.moveTo(x - size2, ty - size2);
        ctx.lineTo(x + size2, ty - size2);
        ctx.lineTo(x, ty + size2 * 0.4);
        ctx.closePath();
        const noData = st.offlineFrom !== undefined && e.arr[si].tp >= st.offlineFrom;
        if (noData) {
          ctx.strokeStyle = GRAPHITE;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = isSel || isPicked ? VIOLET : GRAPHITE;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (!p.reduce && k < 1) {
          ctx.strokeStyle = `rgba(56, 54, 47, ${0.5 * (1 - k)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, ty - 1, 4 + k * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (isSel) {
          const label = `${e.kind} M${fmtMl(e.ml)}`;
          ctx.font = `500 10px ${p.mono}`;
          const w = ctx.measureText(label).width + 8;
          const lx = Math.min(x + 6, g.x0 + g.tw - w);
          const ly = base - g.sp * 0.5 + 1;
          ctx.fillStyle = VIOLET;
          roundRect(ctx, lx, ly, w, 13, 2);
          ctx.fill();
          ctx.fillStyle = "#f4f0fb";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(label, lx + 4, ly + 7);
        }
      }
      ctx.restore();

      /* right margin: a tally of detections per line, in fives */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, g.paperY, g.w, g.paperH);
      ctx.clip();
      ctx.strokeStyle = PRINT_STRONG;
      ctx.lineWidth = 1;
      const mx = g.x0 + g.tw + 11;
      for (let r = 0; r < LINES; r++) {
        const cnt = tallies[r];
        if (!cnt) continue;
        const base = baseOf(r);
        const h = Math.min(9, g.sp * 0.32);
        const freshHere = fresh.filter((f) => f.row === r);
        if (cnt > 10) {
          ctx.font = `500 10px ${p.mono}`;
          ctx.fillStyle = PRINT_STRONG;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(String(cnt), mx, base);
          continue;
        }
        for (let i = 0; i < cnt; i++) {
          const grp = Math.floor(i / 5);
          const j = i % 5;
          const gx = mx + grp * 16;
          const grow = i >= cnt - freshHere.length ? freshHere[i - (cnt - freshHere.length)].k : 1;
          ctx.beginPath();
          if (j < 4) {
            const x = Math.round(gx + j * 3) + 0.5;
            ctx.moveTo(x, base + h / 2);
            ctx.lineTo(x, base + h / 2 - h * grow);
          } else {
            ctx.moveTo(gx - 1.5, base + h / 2 - 1);
            ctx.lineTo(gx - 1.5 + 13 * grow, base - h / 2 + 1 + (1 - grow) * (h - 2));
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      /* paper curvature: the drum is a cylinder, darker where it turns away */
      const shade = ctx.createLinearGradient(0, g.paperY, 0, g.paperY + g.paperH);
      shade.addColorStop(0, "rgba(120, 92, 38, 0.13)");
      shade.addColorStop(0.07, "rgba(120, 92, 38, 0)");
      shade.addColorStop(0.93, "rgba(120, 92, 38, 0)");
      shade.addColorStop(1, "rgba(120, 92, 38, 0.15)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, g.paperY, g.w, g.paperH);

      /* rulers: minutes into the line, and the pen carriage */
      ctx.fillStyle = PRINT_STRONG;
      ctx.strokeStyle = PRINT;
      ctx.font = `400 10px ${p.mono}`;
      ctx.textBaseline = "alphabetic";
      for (let m = 0; m <= 30; m++) {
        const x = Math.round(g.x0 + (m / 30) * g.tw) + 0.5;
        const major = m % 5 === 0;
        ctx.beginPath();
        ctx.moveTo(x, g.paperY - (major ? 7 : 4));
        ctx.lineTo(x, g.paperY - 1);
        ctx.moveTo(x, g.paperY + g.paperH + 1);
        ctx.lineTo(x, g.paperY + g.paperH + (major ? 7 : 4));
        ctx.stroke();
        if (major) {
          ctx.textAlign = m === 0 ? "left" : m === 30 ? "right" : "center";
          ctx.fillText(m === 30 ? "30 min" : `${m}`, x, g.paperY - 10);
        }
      }
      ctx.textAlign = "right";
      ctx.fillText("UTC", g.x0 - 10, g.paperY - 10);
      ctx.beginPath();
      ctx.moveTo(penX, g.paperY - 1);
      ctx.lineTo(penX - 4.5, g.paperY - 8);
      ctx.lineTo(penX + 4.5, g.paperY - 8);
      ctx.closePath();
      ctx.fillStyle = GRAPHITE;
      ctx.fill();
      ctx.textAlign = "right";
      ctx.font = `400 9.5px ${p.sans}`;
      ctx.fillStyle = PRINT;
      ctx.fillText("Events", g.w - 2, g.paperY - 10);

      /* hover hairline and the loupe */
      const ptr = pointer.current;
      const kev = kbd.current ? evs.find((e) => e.id === kbd.current) : undefined;
      let target: { x: number; y: number } | null = null;
      // On arrival the lens rests on the selected event for a few seconds, so the
      // record introduces its own magnifier; any pointer or key takes over.
      if (!introStart) introStart = now;
      const intro = !p.reduce && !touchedRef.current && now - introStart > 500 && now - introStart < 6500;
      const iev = intro && sel ? evs.find((e) => e.id === sel) : undefined;
      if (ptr.inside) target = { x: ptr.x, y: ptr.y };
      else if (kev) {
        const q = posOf(kev);
        if (q.row >= 0) target = { x: q.x + 4, y: q.base };
      } else if (iev) {
        const q = posOf(iev);
        if (q.row >= 0) target = { x: q.x + 1.5, y: q.base };
      }
      if (target) {
        if (!loupe.init || p.reduce) {
          loupe.x = target.x;
          loupe.y = target.y;
          loupe.init = true;
        } else {
          const f = 1 - Math.pow(0.0015, dt);
          loupe.x += (target.x - loupe.x) * f;
          loupe.y += (target.y - loupe.y) * f;
        }
        loupe.a = p.reduce ? 1 : Math.min(1, loupe.a + dt * 7);
      } else {
        loupe.a = p.reduce ? 0 : Math.max(0, loupe.a - dt * 6);
        if (loupe.a === 0) loupe.init = false;
      }
      if (target && ptr.inside) {
        const row = Math.floor((target.y - g.paperY - off) / g.sp);
        if (row >= 0 && row < LINES) {
          ctx.strokeStyle = "rgba(56, 54, 47, 0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(target.x) + 0.5, baseOf(row) - g.sp / 2);
          ctx.lineTo(Math.round(target.x) + 0.5, baseOf(row) + g.sp / 2);
          ctx.stroke();
        }
      }
      if (loupe.a > 0.01) {
        drawLoupe(ctx, g, loupe.x, loupe.y, loupe.a, { si, first, t, off, scale, clip, mono: p.mono, sel, evs });
      }
      cv.style.cursor = ptr.inside ? (hover ? "pointer" : "crosshair") : "default";
      firstFrame = false;

      function hoverEvent(): Ev | null {
        const q = pointer.current;
        if (!q.inside) return null;
        const row = Math.floor((q.y - g.paperY - off) / g.sp);
        let best: Ev | null = null;
        let bd = 12;
        for (const e of evs) {
          const pos = posOf(e);
          if (pos.row !== row) continue;
          const tau = e.arr[si].tau;
          const tail = ((tau * 3 + (e.arr[si].ts - e.arr[si].tp || 0)) / LINE_S) * g.tw;
          const d = q.x < pos.x ? pos.x - q.x : q.x > pos.x + tail ? q.x - pos.x - tail : 0;
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        return best;
      }
      hoverRef.current = hoverEvent;
      evsRef.current = evs;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const inside = x >= MARGIN_L && x <= r.width - MARGIN_R && y >= RULER_T && y <= r.height - RULER_B;
    pointer.current = { x, y, inside };
    touchedRef.current = true;
    if (inside) kbd.current = null;
  };

  const onClick = () => {
    const ev = hoverRef.current();
    if (ev) P.current.onPick(ev.id);
  };

  const onKey = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const list = [...evsRef.current].sort((a, b) => a.t0 - b.t0);
    if (!list.length) return;
    const from = kbd.current ?? P.current.selectedId;
    const i = list.findIndex((x) => x.id === from);
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = i < 0 ? list.length - 1 : Math.max(0, i - 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = i < 0 ? list.length - 1 : Math.min(list.length - 1, i + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else if ((e.key === "Enter" || e.key === " ") && kbd.current) {
      e.preventDefault();
      P.current.onPick(kbd.current);
      return;
    } else if (e.key === "Escape") {
      kbd.current = null;
      return;
    }
    if (next !== null) {
      e.preventDefault();
      touchedRef.current = true;
      kbd.current = list[next].id;
      pointer.current.inside = false;
    }
  };

  return (
    <div ref={wrapRef} className={s.drumWrap}>
      <canvas
        ref={cvRef}
        className={s.drumCanvas}
        tabIndex={0}
        role="application"
        aria-roledescription="helicorder record"
        aria-label="Helicorder record, 24 lines of 30 minutes. Arrow keys step through detected events, Enter picks the focused event."
        onPointerMove={onMove}
        onPointerLeave={() => (pointer.current.inside = false)}
        onClick={onClick}
        onKeyDown={onKey}
        onBlur={() => (kbd.current = null)}
      />
    </div>
  );
}

/* ── the loupe ──────────────────────────────────────────────────────────── */

type LoupeCtx = {
  si: number;
  first: number;
  t: number;
  off: number;
  scale: number;
  clip: number;
  mono: string;
  sel: string | null;
  evs: Ev[];
};

function drawLoupe(ctx: CanvasRenderingContext2D, g: Geom, fx: number, fy: number, a: number, o: LoupeCtx) {
  const R = LOUPE_R * (0.86 + 0.14 * a);
  // The focus point (fx, fy) maps to the lens centre; near the bottom edge the
  // lens rides up so it is never cut off, but it still magnifies the focus.
  const cx = fx;
  const cy = Math.min(Math.max(fy, g.paperY + R * 0.4), g.h - R - 4);
  const lclip = R * 0.62;
  const secPerPx = LINE_S / g.tw; // drum seconds per css pixel
  const row = Math.floor((fy - g.paperY - o.off) / g.sp);
  const rowStart = (o.first + row) * LINE_S;
  const tCenter = rowStart + ((fx - g.x0) / g.tw) * LINE_S;

  ctx.save();
  ctx.globalAlpha = a;

  // the lens body
  ctx.shadowColor = "rgba(40, 30, 10, 0.28)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
  ctx.clip();

  // one-second ticks along the lens, magnified time
  ctx.strokeStyle = PAPER_RULE;
  ctx.lineWidth = 1;
  const s0 = Math.floor(tCenter - R / ZX * secPerPx);
  const s1 = Math.ceil(tCenter + R / ZX * secPerPx);
  for (let sec = s0; sec <= s1; sec++) {
    const x = cx + ((sec - tCenter) / secPerPx) * ZX;
    const tall = sec % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(x, cy + R - (tall ? 16 : 9));
    ctx.lineTo(x, cy + R);
    ctx.stroke();
  }

  // the record, re-sampled at 50 Hz rather than scaled up
  // Sample every visible line first, so the lens can set its own amplitude gain:
  // a clipped event is scaled down until its peak fits, the way an analyst
  // would turn the gain down to read an onset. Quiet record stays at ×1.5.
  type Col = { x: number; y1: number; y2: number } | null;
  const rows: { line: number; lb: number; cols: { lo: number; hi: number; mk: number }[]; focus: boolean }[] = [];
  const dts = secPerPx / ZX;
  let peak = 0;
  for (let r = row - 2; r <= row + 2; r++) {
    if (r < 0 || r >= LINES) continue;
    const line = o.first + r;
    const start = line * LINE_S;
    const base = g.paperY + r * g.sp + g.sp / 2 + o.off;
    const lb = cy + (base - fy) * ZY;
    if (Math.abs(lb - cy) > R + lclip) continue;
    const evs = eventsAround(start, start + LINE_S);
    const cols: { lo: number; hi: number; mk: number }[] = [];
    for (let u = -R; u <= R; u++) {
      const ta = start + ((fx + u / ZX - g.x0) / g.tw) * LINE_S;
      const tb = ta + dts;
      if (ta < start || tb > start + LINE_S || tb > o.t) {
        cols.push({ lo: NaN, hi: NaN, mk: 0 });
        continue;
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = Math.ceil(ta * FS_FINE); k <= tb * FS_FINE; k++) {
        const v = sample(o.si, k / FS_FINE, evs);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (lo === Infinity) lo = hi = sample(o.si, ta, evs);
      cols.push({ lo, hi, mk: markOffset(ta) });
      if (r === row && lo === lo) peak = Math.max(peak, Math.abs(lo) * o.scale, Math.abs(hi) * o.scale);
    }
    rows.push({ line, lb, cols, focus: r === row });
  }
  const amp = peak * ZY > lclip * 0.9 ? (lclip * 0.9) / peak : ZY;

  for (const rw of rows) {
    ctx.strokeStyle = ink(rw.line);
    ctx.lineWidth = rw.focus ? 1.25 : 1;
    ctx.globalAlpha = a * (rw.focus ? 1 : 0.55);
    ctx.beginPath();
    let down = false;
    rw.cols.forEach((c, i) => {
      const col: Col =
        c.lo !== c.lo
          ? null
          : {
              x: cx - R + i,
              y1: rw.lb - Math.max(-lclip, Math.min(lclip, c.hi * o.scale * amp + c.mk * ZY)),
              y2: rw.lb - Math.max(-lclip, Math.min(lclip, c.lo * o.scale * amp)),
            };
      if (!col) {
        down = false;
        return;
      }
      if (!down) {
        ctx.moveTo(col.x, col.y1);
        down = true;
      } else ctx.lineTo(col.x, col.y1);
      ctx.lineTo(col.x, col.y2);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = a;

  // the selected event's phase picks, resolved at this magnification
  const sel = o.sel ? o.evs.find((e) => e.id === o.sel) : undefined;
  if (sel) {
    const arr = sel.arr[o.si];
    const phases: [string, number][] = sel.kind === "VT" ? [["P", arr.tp], ["S", arr.ts]] : [["eP", arr.tp]];
    for (const [name, tt] of phases) {
      const line = Math.floor(tt / LINE_S);
      if (line - o.first !== row) continue;
      const x = cx + ((tt - tCenter) / secPerPx) * ZX;
      if (Math.abs(x - cx) > R) continue;
      ctx.strokeStyle = VIOLET;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, cy - R);
      ctx.lineTo(x, cy + R);
      ctx.stroke();
      ctx.font = `600 10.5px ${o.mono}`;
      const lw = ctx.measureText(name).width + 8;
      const ly = cy - R * 0.72 + (name === "S" ? 17 : 0);
      ctx.fillStyle = VIOLET;
      roundRect(ctx, x, ly, lw, 14, 2);
      ctx.fill();
      ctx.fillStyle = "#f4f0fb";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(name, x + 4, ly + 7.5);
    }
  }
  ctx.restore();

  // rim
  ctx.lineWidth = 2;
  ctx.strokeStyle = GRAPHITE;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 252, 240, 0.7)";
  ctx.beginPath();
  ctx.arc(cx, cy, R - 2.5, Math.PI * 1.08, Math.PI * 1.55);
  ctx.stroke();

  // readout
  if (row >= 0 && row < LINES && tCenter >= rowStart) {
    const label = `${utc(Math.min(tCenter, o.t))} UTC  ×${ZX}${amp < ZY ? `  gain ${(amp / ZY).toFixed(2)}` : ""}`;
    ctx.font = `500 10.5px ${o.mono}`;
    const w = ctx.measureText(label).width + 14;
    const below = cy + R + 26 < g.h;
    const ry = below ? cy + R + 6 : cy - R - 24;
    const rx = Math.max(2, Math.min(g.w - w - 2, cx - w / 2));
    ctx.fillStyle = GRAPHITE;
    roundRect(ctx, rx, ry, w, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#f4efe3";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rx + 7, ry + 9.5);
  }
  ctx.restore();
}


"use client";

/* The chart: one canvas, two panes sharing a time axis, both on a percentage
   scale measured from the first visible bar. Everything that moves per frame
   is drawn imperatively; React only owns the legends, which change per bar. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import s from "./shot.module.css";
import {
  WINDOW_START,
  firstIndexOnOrAfter,
  fmt,
  fmtSigned,
  fmtVol,
  rangeStart,
  type Bar,
  type Interval,
  type RangeId,
  type Spec,
} from "./data";
import { Glyph, Icon } from "./icons";

export type Tool =
  | "cross" | "trend" | "fib" | "pattern" | "forecast" | "brush"
  | "text" | "emoji" | "ai" | "measure" | "zoom";
export type Pt = { t: number; p: number };
export type Drawing = { kind: "trend"; a: Pt; b: Pt } | { kind: "brush"; pts: Pt[] };

type Props = {
  spec: Spec;
  bars: Bar[];
  compareSpec: Spec;
  compare: Bar[];
  interval: Interval;
  range: { id: RangeId | "default"; n: number };
  version: number;
  pre?: number;
  bid?: number;
  ask?: number;
  tool: Tool;
  setTool: (t: Tool) => void;
  magnet: boolean;
  hidden: boolean;
  drawings: Drawing[];
  addDrawing: (d: Drawing) => void;
  reduce: boolean;
};

const AXIS_W = 72;
const TIME_H = 28;
const RIGHT_PAD = 22;
const FONT = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

const UP = "#089981";
const DOWN = "#f23645";
const BLUE = "#2962ff";
const ORANGE = "#ff9800";
const VOL_UP = "rgba(8, 153, 129, 0.24)";
const VOL_DOWN = "rgba(242, 54, 69, 0.24)";
const GRID = "rgba(0, 0, 0, 0.16)";
const TEXT = "#131722";
const CROSS = "#9598a1";
const TAG = "#131722";

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type View = { end: number; spacing: number };
type Pane = { y: number; h: number };
type Scale = {
  y: (pct: number) => number;
  inv: (py: number) => number;
  ticks: { v: number; bold: boolean }[];
  base: number;
  pane: Pane;
};

type Pending =
  | { kind: "trend"; a: Pt }
  | { kind: "brush"; pts: Pt[] }
  | { kind: "measure"; a: { i: number; p: number }; b: { i: number; p: number }; done: boolean }
  | { kind: "zoom"; x0: number; x1: number }
  | null;

const pad2 = (n: number) => String(n).padStart(2, "0");

function geometry(W: number, H: number) {
  const plotW = W - AXIS_W;
  const paneH = H - TIME_H;
  const topH = Math.round(paneH / 3);
  return {
    plotW,
    paneH,
    top: { y: 0, h: topH } as Pane,
    main: { y: topH + 1, h: paneH - topH - 1 } as Pane,
  };
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function makeScale(
  bars: Bar[], i0: number, i1: number, base: number,
  kind: "candle" | "line", pane: Pane, mt: number, mb: number,
): Scale {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const b = bars[i];
    lo = Math.min(lo, ((kind === "candle" ? b.l : b.c) / base - 1) * 100);
    hi = Math.max(hi, ((kind === "candle" ? b.h : b.c) / base - 1) * 100);
  }
  if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
  if (hi - lo < 1e-6) { lo -= 0.5; hi += 0.5; }
  const top = pane.y + pane.h * mt;
  const k = (pane.h * (1 - mt - mb)) / (hi - lo);
  const y = (p: number) => top + (hi - p) * k;
  const inv = (py: number) => hi - (py - top) / k;
  const step = niceStep(30 / k);
  const ticks: Scale["ticks"] = [];
  const from = Math.ceil(inv(pane.y + pane.h) / step);
  const to = Math.floor(inv(pane.y) / step);
  for (let n = from; n <= to; n++) ticks.push({ v: n * step, bold: n % 5 === 0 });
  return { y, inv, ticks, base, pane };
}

type Mark = { i: number; x: number; w: number; cat: number; label: string };

/** Candidate labels weighted by how large a boundary they mark. The finest
    level whose marks all clear the gap wins, so the cadence stays even
    (every six months, every quarter) instead of filling odd leftover space. */
function timeMarks(bars: Bar[], i0: number, i1: number, xOf: (i: number) => number, plotW: number, intraday: boolean) {
  const cands: Mark[] = [];
  for (let i = Math.max(1, i0); i <= i1; i++) {
    const a = new Date(bars[i - 1].t);
    const b = new Date(bars[i].t);
    let w: number;
    let cat: number;
    let label: string;
    if (b.getUTCFullYear() !== a.getUTCFullYear()) {
      w = 100; cat = 4; label = String(b.getUTCFullYear());
    } else if (b.getUTCMonth() !== a.getUTCMonth()) {
      const m = b.getUTCMonth();
      w = m % 6 === 0 ? 60 : m % 3 === 0 ? 55 : 50; cat = 3; label = MONTHS[m];
    } else if (b.getUTCDate() !== a.getUTCDate()) {
      cat = 2; label = String(b.getUTCDate());
      w = intraday ? 45 : b.getUTCDay() < a.getUTCDay() ? 30 : 20;
    } else {
      const mins = b.getUTCHours() * 60 + b.getUTCMinutes();
      w = mins % 60 === 0 ? 28 : mins % 30 === 0 ? 24 : mins % 15 === 0 ? 20 : mins % 5 === 0 ? 14 : 10;
      cat = 1; label = `${pad2(b.getUTCHours())}:${pad2(b.getUTCMinutes())}`;
    }
    cands.push({ i, x: xOf(i), w, cat, label });
  }
  const gap = intraday ? 72 : 64;
  const inView = cands.filter((c) => c.x >= 14 && c.x <= plotW - 14);
  // A level fits when its own marks clear the gap from each other; where a
  // finer mark lands beside a coarser one, the coarser one simply wins below.
  const byW = new Map<number, Mark[]>();
  for (const c of inView) byW.set(c.w, [...(byW.get(c.w) ?? []), c]);
  const levels = [...byW.keys()].sort((a, b) => b - a);
  let minW = levels[0] ?? Infinity;
  for (const lv of levels) {
    const arr = byW.get(lv)!;
    if (!arr.every((c, k) => k === 0 || c.x - arr[k - 1].x >= gap)) break;
    minW = lv;
  }
  const placed: Mark[] = [];
  const ranked = inView.filter((c) => c.w >= minW).sort((a, b) => b.w - a.w || a.i - b.i);
  for (const c of ranked) if (placed.every((p) => Math.abs(p.x - c.x) >= gap)) placed.push(c);
  return placed;
}

function avgStep(interval: Interval) {
  return interval === "D" ? DAY * 1.4 : interval === "5" ? 300_000 : 60_000;
}

function indexOfTime(bars: Bar[], t: number, interval: Interval) {
  const n = bars.length;
  if (t <= bars[0].t) return (t - bars[0].t) / avgStep(interval);
  if (t >= bars[n - 1].t) return n - 1 + (t - bars[n - 1].t) / avgStep(interval);
  const j = firstIndexOnOrAfter(bars, t);
  const a = bars[j - 1];
  const b = bars[j];
  return j - 1 + (t - a.t) / (b.t - a.t);
}

function timeOfIndex(bars: Bar[], i: number, interval: Interval) {
  const n = bars.length;
  if (i <= 0) return bars[0].t + i * avgStep(interval);
  if (i >= n - 1) {
    const k = Math.round(i - (n - 1));
    if (interval !== "D") return bars[n - 1].t + (i - (n - 1)) * avgStep(interval);
    // Future daily bars skip weekends, the way a session calendar would.
    let t = bars[n - 1].t;
    for (let s = 0; s < k; s++) {
      t += DAY;
      while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY;
    }
    return t;
  }
  const j = Math.floor(i);
  return bars[j].t + (bars[j + 1].t - bars[j].t) * (i - j);
}

function crossLabel(t: number, interval: Interval) {
  const d = new Date(t);
  const date = `${DOW[d.getUTCDay()]} ${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  return interval === "D" ? date : `${date}   ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function spanLabel(ms: number, interval: Interval) {
  const abs = Math.abs(ms);
  if (interval === "D") {
    const days = Math.round(abs / DAY);
    const m = Math.floor(days / 30.44);
    const d = Math.round(days - m * 30.44);
    return m ? `${m}M${d ? ` ${d}d` : ""}` : `${days}d`;
  }
  const mins = Math.round(abs / 60_000);
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

const intervalLabel = (i: Interval) => (i === "D" ? "1D" : i);

export function Chart(props: Props) {
  const P = useRef(props);
  useLayoutEffect(() => {
    P.current = props;
  });

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topValueRef = useRef<HTMLSpanElement>(null);
  const size = useRef({ W: 0, H: 0, dpr: 1 });
  const view = useRef<View>({ end: 0, spacing: 1 });
  const ready = useRef(false);
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const drag = useRef<{ mode: "pan" | "axis"; x: number; t: number; v: number; moved: boolean } | null>(null);
  const pending = useRef<Pending>(null);
  const scales = useRef<{ main: Scale; top: Scale } | null>(null);
  const anim = useRef(0);
  const frame = useRef(0);
  const lastInterval = useRef(props.interval);

  const [hover, setHover] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [topH, setTopH] = useState(246);

  /* ── view helpers ─────────────────────────────────────────────────────── */

  const plotW = () => size.current.W - AXIS_W;

  const viewFor = useCallback((id: RangeId | "default"): View => {
    const { bars } = P.current;
    const n = bars.length;
    const from = id === "default" ? WINDOW_START : rangeStart(id, bars);
    const f = Math.min(n - 1, firstIndexOnOrAfter(bars, from));
    const spacing = (plotW() - RIGHT_PAD) / (n - f);
    return { spacing, end: n - 1 + (RIGHT_PAD + spacing / 2) / spacing };
  }, []);

  const clamp = useCallback((v: View): View => {
    const n = P.current.bars.length;
    const spacing = Math.min(48, Math.max(0.25, v.spacing));
    const w = plotW() / spacing;
    const end = Math.min(n - 1 + w * 0.7, Math.max(Math.min(w * 0.3, n * 0.5), v.end));
    return { spacing, end };
  }, []);

  /* ── drawing ──────────────────────────────────────────────────────────── */

  const draw = useCallback(() => {
    frame.current = 0;
    const cv = canvasRef.current;
    const { W, H, dpr } = size.current;
    if (!cv || !W || !H) return;
    const ctx = cv.getContext("2d")!;
    const p = P.current;
    const v = view.current;
    const g = geometry(W, H);
    const { bars, compare } = p;
    const n = bars.length;
    const xOf = (i: number) => g.plotW - (v.end - i) * v.spacing;
    const i0 = Math.max(0, Math.min(n - 1, Math.ceil(v.end - g.plotW / v.spacing)));
    const i1 = Math.max(i0, Math.min(n - 1, Math.floor(v.end)));
    const main = makeScale(bars, i0, i1, bars[i0].c, "candle", g.main, 0.12, 0.08);
    const top = makeScale(compare, i0, i1, compare[i0].c, "line", g.top, 0.1, 0.1);
    scales.current = { main, top };
    const pct = (sc: Scale, price: number) => (price / sc.base - 1) * 100;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.font = `12px ${FONT}`;
    ctx.textBaseline = "middle";

    const marks = timeMarks(bars, i0, i1, xOf, g.plotW, p.interval !== "D");
    const minCat = Math.min(...marks.map((m) => m.cat));

    // Grid: dotted, aligned to the labels that survived placement.
    ctx.save();
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    for (const m of marks) {
      const x = Math.round(m.x) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, g.top.h);
      ctx.moveTo(x, g.main.y); ctx.lineTo(x, g.paneH);
    }
    for (const sc of [top, main]) {
      for (const t of sc.ticks) {
        const y = Math.round(sc.y(t.v)) + 0.5;
        if (y < sc.pane.y + 2 || y > sc.pane.y + sc.pane.h - 2) continue;
        ctx.moveTo(0, y); ctx.lineTo(g.plotW, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Zero lines: solid, because the whole scale is read against them.
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (const sc of [top, main]) {
      const y = Math.round(sc.y(0));
      if (y > sc.pane.y && y < sc.pane.y + sc.pane.h) ctx.fillRect(0, y, g.plotW, 1);
    }

    // Pane separator.
    ctx.fillStyle = "#e3e3e3";
    ctx.fillRect(0, g.top.h, W, 1);

    /* main pane ─ volume, candles, price lines, drawings */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.main.y, g.plotW, g.main.h);
    ctx.clip();

    const sp = v.spacing;
    let bodyW = sp >= 3 ? Math.max(1, Math.floor(sp * 0.72)) : 1;
    if (bodyW > 2 && bodyW % 2 === 0) bodyW -= 1;
    const half = (bodyW - 1) / 2;
    const lo = Math.max(0, i0 - 1);
    const hi = Math.min(n - 1, i1 + 1);

    let vMax = 0;
    for (let i = i0; i <= i1; i++) vMax = Math.max(vMax, bars[i].v);
    if (vMax > 0) {
      const vh = g.main.h * 0.2;
      const vb = g.main.y + g.main.h;
      const vw = sp >= 3 ? bodyW : Math.max(1, Math.floor(sp));
      for (const up of [true, false]) {
        ctx.fillStyle = up ? VOL_UP : VOL_DOWN;
        for (let i = lo; i <= hi; i++) {
          const b = bars[i];
          if (b.c >= b.o !== up) continue;
          const h = Math.max(1, Math.round((b.v / vMax) * vh));
          ctx.fillRect(Math.round(xOf(i)) - (vw > 1 ? Math.floor(vw / 2) : 0), vb - h, vw, h);
        }
      }
    }

    for (const up of [true, false]) {
      ctx.fillStyle = up ? UP : DOWN;
      for (let i = lo; i <= hi; i++) {
        const b = bars[i];
        if (b.c >= b.o !== up) continue;
        const x = Math.round(xOf(i));
        const yh = Math.round(main.y(pct(main, b.h)));
        const yl = Math.round(main.y(pct(main, b.l)));
        ctx.fillRect(x, yh, 1, Math.max(1, yl - yh));
        if (bodyW > 1) {
          const yo = Math.round(main.y(pct(main, b.o)));
          const yc = Math.round(main.y(pct(main, b.c)));
          ctx.fillRect(x - half, Math.min(yo, yc), bodyW, Math.max(1, Math.abs(yc - yo)));
        }
      }
    }

    // Price lines.
    const last = bars[n - 1];
    const lastColor = last.c >= last.o ? UP : DOWN;
    const priceLine = (price: number, color: string) => {
      const y = Math.round(main.y(pct(main, price))) + 0.5;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.setLineDash([1, 2]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(g.plotW, y); ctx.stroke();
      ctx.restore();
    };
    if (p.pre !== undefined) priceLine(p.pre, ORANGE);
    priceLine(last.c, lastColor);

    // Drawings.
    const tx = (t: number) => xOf(indexOfTime(bars, t, p.interval));
    const py = (price: number) => main.y(pct(main, price));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (!p.hidden) {
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2;
      for (const d of p.drawings) {
        ctx.beginPath();
        if (d.kind === "trend") {
          ctx.moveTo(tx(d.a.t), py(d.a.p));
          ctx.lineTo(tx(d.b.t), py(d.b.p));
        } else {
          d.pts.forEach((q, k) => (k ? ctx.lineTo(tx(q.t), py(q.p)) : ctx.moveTo(tx(q.t), py(q.p))));
        }
        ctx.stroke();
      }
    }

    const pd = pending.current;
    const ptr = pointer.current;
    if (pd?.kind === "trend") {
      const ax = tx(pd.a.t);
      const ay = py(pd.a.p);
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2;
      if (ptr.inside) {
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ptr.x, ptr.y); ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ax, ay, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (pd?.kind === "brush" && pd.pts.length) {
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pd.pts.forEach((q, k) => (k ? ctx.lineTo(tx(q.t), py(q.p)) : ctx.moveTo(tx(q.t), py(q.p))));
      ctx.stroke();
    }
    if (pd?.kind === "measure") {
      const xa = xOf(pd.a.i);
      const xb = xOf(pd.b.i);
      const ya = py(pd.a.p);
      const yb = py(pd.b.p);
      const upMove = pd.b.p >= pd.a.p;
      const col = upMove ? BLUE : DOWN;
      ctx.fillStyle = upMove ? "rgba(41, 98, 255, 0.18)" : "rgba(242, 54, 69, 0.18)";
      ctx.fillRect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya));
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      const mx = Math.round((xa + xb) / 2) + 0.5;
      const my = Math.round((ya + yb) / 2) + 0.5;
      ctx.beginPath();
      ctx.moveTo(mx, ya); ctx.lineTo(mx, yb);
      ctx.moveTo(xa, my); ctx.lineTo(xb, my);
      const ah = 5;
      const dy = yb > ya ? 1 : -1;
      const dx = xb > xa ? 1 : -1;
      ctx.moveTo(mx - ah, yb - dy * ah); ctx.lineTo(mx, yb); ctx.lineTo(mx + ah, yb - dy * ah);
      ctx.moveTo(xb - dx * ah, my - ah); ctx.lineTo(xb, my); ctx.lineTo(xb - dx * ah, my + ah);
      ctx.stroke();
      const dP = pd.b.p - pd.a.p;
      const nBars = Math.round(pd.b.i) - Math.round(pd.a.i);
      const ms = timeOfIndex(bars, pd.b.i, p.interval) - timeOfIndex(bars, pd.a.i, p.interval);
      const l1 = `${fmtSigned(dP, p.spec.decimals)} (${fmtSigned((dP / pd.a.p) * 100)}%)`;
      const l2 = `${nBars} bars, ${spanLabel(ms, p.interval)}`;
      ctx.font = `12px ${FONT}`;
      const bw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 20;
      const bh = 40;
      const bx = mx - bw / 2;
      const by = upMove ? Math.min(ya, yb) - bh - 8 : Math.max(ya, yb) + 8;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(l1, mx, by + 13);
      ctx.fillText(l2, mx, by + 28);
      ctx.textAlign = "left";
    }
    ctx.restore();

    if (pd?.kind === "zoom") {
      ctx.fillStyle = "rgba(41, 98, 255, 0.12)";
      ctx.fillRect(Math.min(pd.x0, pd.x1), 0, Math.abs(pd.x1 - pd.x0), g.paneH);
    }

    /* top pane ─ the comparison line */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.top.y, g.plotW, g.top.h);
    ctx.clip();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = lo; i <= hi; i++) {
      const x = xOf(i);
      const y = top.y(pct(top, compare[i].c));
      if (i === lo) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    /* price axes */
    type TagT = { y: number; a: string; b: string; bg: string };
    const cmpLast = compare[n - 1].c;
    const topTags: TagT[] = [
      { y: top.y(pct(top, cmpLast)), a: p.compareSpec.id, b: `${fmtSigned(pct(top, cmpLast))}%`, bg: BLUE },
    ];
    const mainTags: TagT[] = [];
    if (p.pre !== undefined) mainTags.push({ y: py(p.pre), a: "Pre", b: fmt(p.pre, p.spec.decimals), bg: ORANGE });
    mainTags.push({ y: py(last.c), a: p.spec.id, b: `${fmtSigned(pct(main, last.c))}%`, bg: lastColor });
    // Stack tags that would overlap, keeping their order on the scale.
    for (const tags of [topTags, mainTags]) {
      tags.sort((a, b) => a.y - b.y);
      for (let k = 1; k < tags.length; k++) tags[k].y = Math.max(tags[k].y, tags[k - 1].y + 18);
    }

    ctx.textAlign = "left";
    for (const sc of [top, main]) {
      const tags = sc === top ? topTags : mainTags;
      for (const t of sc.ticks) {
        const y = Math.round(sc.y(t.v));
        if (y < sc.pane.y + 8 || y > sc.pane.y + sc.pane.h - 8) continue;
        if (tags.some((tg) => Math.abs(tg.y - y) < 15)) continue;
        ctx.font = `${t.bold ? "600 " : ""}12px ${FONT}`;
        ctx.fillStyle = TEXT;
        ctx.fillText(`${fmt(t.v)}%`, g.plotW + 6, y + 0.5);
      }
    }

    const split = g.plotW - 6;
    const drawTag = (tg: TagT, pane: Pane) => {
      const y = Math.round(Math.min(pane.y + pane.h - 9, Math.max(pane.y + 9, tg.y)));
      ctx.font = `12px ${FONT}`;
      const wa = ctx.measureText(tg.a).width + 10;
      const wb = ctx.measureText(tg.b).width + 12;
      ctx.fillStyle = tg.bg;
      ctx.beginPath(); ctx.roundRect(split - wa, y - 9, wa + wb, 18, 2); ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(split, y - 9, 1, 18);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tg.a, split - wa + 5, y + 0.5);
      ctx.fillText(tg.b, split + 6, y + 0.5);
    };
    topTags.forEach((tg) => drawTag(tg, g.top));
    mainTags.forEach((tg) => drawTag(tg, g.main));

    /* time axis */
    ctx.fillStyle = TEXT;
    ctx.textAlign = "center";
    for (const m of marks) {
      ctx.font = `${m.cat > minCat ? "600 " : ""}12px ${FONT}`;
      ctx.fillText(m.label, Math.round(m.x), g.paneH + TIME_H / 2 + 1);
    }
    ctx.textAlign = "left";

    /* crosshair */
    const overPlot = ptr.inside && ptr.x >= 0 && ptr.x < g.plotW && ptr.y >= 0 && ptr.y < g.paneH;
    let topValue = pct(top, cmpLast);
    if (overPlot) {
      const i = Math.round(v.end - (g.plotW - ptr.x) / v.spacing);
      const cx = Math.round(xOf(i)) + 0.5;
      const inTop = ptr.y < g.top.h;
      const sc = inTop ? top : main;
      const cy = Math.round(ptr.y) + 0.5;
      ctx.save();
      ctx.strokeStyle = CROSS;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, g.paneH);
      ctx.moveTo(0, cy); ctx.lineTo(g.plotW, cy);
      ctx.stroke();
      ctx.restore();

      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = TAG;
      ctx.beginPath(); ctx.roundRect(g.plotW + 1, cy - 10, AXIS_W - 2, 20, 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${fmt(sc.inv(ptr.y))}%`, g.plotW + 6, cy + 0.5);

      const label = crossLabel(timeOfIndex(bars, i, p.interval), p.interval);
      const lw = ctx.measureText(label).width + 16;
      const lx = Math.max(0, Math.min(g.plotW - lw, cx - lw / 2));
      ctx.fillStyle = TAG;
      ctx.beginPath(); ctx.roundRect(lx, g.paneH + 3, lw, 22, 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, lx + 8, g.paneH + 14.5);

      const ci = Math.max(0, Math.min(n - 1, i));
      topValue = pct(top, compare[ci].c);
    }
    if (topValueRef.current) {
      topValueRef.current.textContent = `${fmt(topValue)}%`;
    }
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  const syncHover = useCallback(() => {
    const ptr = pointer.current;
    const W = size.current.W;
    const g = geometry(W, size.current.H);
    if (!ptr.inside || ptr.x >= g.plotW || ptr.y >= g.paneH) {
      setHover(null);
      return;
    }
    const n = P.current.bars.length;
    const i = Math.round(view.current.end - (g.plotW - ptr.x) / view.current.spacing);
    setHover(Math.max(0, Math.min(n - 1, i)));
  }, []);

  const setView = useCallback((v: View) => {
    view.current = clamp(v);
    syncHover();
    schedule();
  }, [clamp, schedule, syncHover]);

  const tweenTo = useCallback((target: View) => {
    cancelAnimationFrame(anim.current);
    if (P.current.reduce) {
      setView(target);
      return;
    }
    const from = { ...view.current };
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 460);
      const e = 1 - Math.pow(1 - k, 4);
      setView({
        end: from.end + (target.end - from.end) * e,
        spacing: Math.exp(Math.log(from.spacing) + (Math.log(target.spacing) - Math.log(from.spacing)) * e),
      });
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, [setView]);

  /* ── sizing ───────────────────────────────────────────────────────────── */

  useLayoutEffect(() => {
    const wrap = wrapRef.current!;
    const cv = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const oldPlot = size.current.W - AXIS_W;
      size.current = { W: Math.round(r.width), H: Math.round(r.height), dpr };
      const newPlot = size.current.W - AXIS_W;
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.style.width = `${Math.round(r.width)}px`;
      cv.style.height = `${Math.round(r.height)}px`;
      setTopH(geometry(size.current.W, size.current.H).top.h);
      if (!ready.current) {
        ready.current = true;
        view.current = viewFor(P.current.range.id);
      } else {
        // Same dates on screen as the panel opens and closes: the bars widen
        // rather than the chart revealing empty space before its history.
        const k = oldPlot > 0 ? newPlot / oldPlot : 1;
        view.current = clamp({ ...view.current, spacing: view.current.spacing * k });
      }
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [clamp, draw, viewFor]);

  // Range buttons: tween within an interval, cut when the interval changes.
  useEffect(() => {
    if (!ready.current) return;
    const changed = lastInterval.current !== P.current.interval;
    lastInterval.current = P.current.interval;
    pending.current = null;
    const target = viewFor(P.current.range.id);
    if (changed) {
      cancelAnimationFrame(anim.current);
      setView(target);
    } else tweenTo(target);
  }, [props.range.n, setView, tweenTo, viewFor]);

  // Data, ticks and drawings all just redraw.
  useEffect(() => {
    schedule();
  }, [props.bars, props.compare, props.version, props.pre, props.drawings, props.hidden, schedule]);

  useEffect(() => {
    if (props.tool === "cross") pending.current = null;
    schedule();
  }, [props.tool, schedule]);

  useEffect(() => () => {
    cancelAnimationFrame(anim.current);
    cancelAnimationFrame(frame.current);
  }, []);

  /* ── input ────────────────────────────────────────────────────────────── */

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pointAt = useCallback((x: number, y: number, snap: boolean) => {
    const sc = scales.current!;
    const { bars, interval, magnet } = P.current;
    const fi = view.current.end - (plotW() - x) / view.current.spacing;
    let price = sc.main.base * (1 + sc.main.inv(y) / 100);
    let fIdx = fi;
    if (snap && magnet) {
      const i = Math.max(0, Math.min(bars.length - 1, Math.round(fi)));
      const b = bars[i];
      const best = [b.o, b.h, b.l, b.c].reduce((a, c) => (Math.abs(c - price) < Math.abs(a - price) ? c : a));
      const dy = Math.abs(sc.main.y((best / sc.main.base - 1) * 100) - y);
      if (dy < 40) { price = best; fIdx = i; }
    }
    return { t: timeOfIndex(bars, fIdx, interval), p: price, i: fIdx };
  }, []);

  useEffect(() => {
    const cv = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const v = view.current;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setView({ ...v, end: v.end + e.deltaX / v.spacing });
      } else {
        // Zoom from the right edge, so the latest bar stays put.
        setView({ ...v, spacing: v.spacing * Math.exp(-e.deltaY * 0.0022) });
      }
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [setView]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y } = local(e);
    const g = geometry(size.current.W, size.current.H);
    cancelAnimationFrame(anim.current);
    const { tool, setTool, addDrawing } = P.current;
    const inMain = x < g.plotW && y > g.main.y && y < g.paneH;
    const inPlot = x < g.plotW && y < g.paneH;

    if (y >= g.paneH || x >= g.plotW) {
      drag.current = { mode: "axis", x, t: performance.now(), v: 0, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "trend" && inMain) {
      const pt = pointAt(x, y, true);
      const pd = pending.current;
      if (pd?.kind === "trend") {
        addDrawing({ kind: "trend", a: pd.a, b: { t: pt.t, p: pt.p } });
        pending.current = null;
        setTool("cross");
      } else {
        pending.current = { kind: "trend", a: { t: pt.t, p: pt.p } };
      }
      schedule();
      return;
    }
    if (tool === "brush" && inMain) {
      const pt = pointAt(x, y, false);
      pending.current = { kind: "brush", pts: [{ t: pt.t, p: pt.p }] };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "measure" && inMain) {
      const pt = pointAt(x, y, true);
      const pd = pending.current;
      if (pd?.kind === "measure" && !pd.done) {
        pd.done = true;
        setTool("cross");
      } else {
        pending.current = { kind: "measure", a: { i: pt.i, p: pt.p }, b: { i: pt.i, p: pt.p }, done: false };
      }
      schedule();
      return;
    }
    if (tool === "zoom" && inPlot) {
      pending.current = { kind: "zoom", x0: x, x1: x };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (pending.current?.kind === "measure") {
      pending.current = null;
      schedule();
    }
    drag.current = { mode: "pan", x, t: performance.now(), v: 0, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    pointer.current = { x, y, inside: true };
    const d = drag.current;
    const pd = pending.current;
    if (d) {
      const dx = x - d.x;
      const now = performance.now();
      const dt = Math.max(1, now - d.t);
      if (Math.abs(dx) > 1) d.moved = true;
      const v = view.current;
      if (d.mode === "pan") {
        d.v = d.v * 0.6 + (dx / dt) * 0.4;
        setView({ ...v, end: v.end - dx / v.spacing });
      } else {
        setView({ ...v, spacing: v.spacing * Math.exp(dx * 0.006) });
      }
      d.x = x;
      d.t = now;
    } else if (pd?.kind === "brush") {
      const pt = pointAt(x, y, false);
      pd.pts.push({ t: pt.t, p: pt.p });
    } else if (pd?.kind === "measure" && !pd.done) {
      const pt = pointAt(x, y, true);
      pd.b = { i: pt.i, p: pt.p };
    } else if (pd?.kind === "zoom") {
      pd.x1 = Math.max(0, Math.min(plotW(), x));
    }
    syncHover();
    schedule();
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    const pd = pending.current;
    if (pd?.kind === "brush") {
      if (pd.pts.length > 1) P.current.addDrawing({ kind: "brush", pts: pd.pts });
      pending.current = null;
    }
    if (pd?.kind === "zoom") {
      pending.current = null;
      const a = Math.min(pd.x0, pd.x1);
      const b = Math.max(pd.x0, pd.x1);
      if (b - a > 8) {
        const v = view.current;
        const ia = v.end - (plotW() - a) / v.spacing;
        const ib = v.end - (plotW() - b) / v.spacing;
        const spacing = plotW() / (ib - ia);
        tweenTo({ spacing, end: ib });
      }
      P.current.setTool("cross");
    }
    // A flick keeps travelling and settles, like the chart has weight.
    if (d?.mode === "pan" && d.moved && Math.abs(d.v) > 0.08 && !P.current.reduce) {
      let vel = Math.max(-36, Math.min(36, d.v * 16));
      const step = () => {
        vel *= 0.92;
        const v = view.current;
        setView({ ...v, end: v.end - vel / v.spacing });
        if (Math.abs(vel) > 0.3) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    }
    schedule();
  };

  const onPointerLeave = () => {
    pointer.current.inside = false;
    syncHover();
    schedule();
  };

  /* ── legends ──────────────────────────────────────────────────────────── */

  const { spec, bars, compareSpec, interval, bid, ask, tool } = props;
  const n = bars.length;
  const bi = hover ?? n - 1;
  const bar = bars[bi];
  const prevC = bi > 0 ? bars[bi - 1].c : bar.o;
  const chg = bar.c - prevC;
  const up = bar.c >= bar.o;
  const valColor = { color: up ? UP : DOWN };
  const chgColor = { color: chg >= 0 ? UP : DOWN };
  const d = spec.decimals;

  const cursor =
    tool === "cross" ? "crosshair" : tool === "zoom" ? "zoom-in" : "crosshair";

  return (
    <div ref={wrapRef} className={s.chart}>
      <canvas
        ref={canvasRef}
        className={s.canvas}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={() => tweenTo(viewFor("default"))}
        aria-label={`${spec.name} price chart, ${intervalLabel(interval)} bars, compared with ${compareSpec.name}`}
        role="img"
      />

      <div className={s.legendTop}>
        <Badge spec={compareSpec} size={18} />
        <span>
          {compareSpec.name} · {compareSpec.exchange}
        </span>
        <span ref={topValueRef} className={s.legendBlue} />
      </div>

      <div className={s.legendMain} style={{ top: topH + 8 }}>
        <div className={s.legendTitle}>
          <Badge spec={spec} size={18} />
          <span className={s.legendName}>
            {spec.name} · {intervalLabel(interval)} · {spec.exchange}
          </span>
          {spec.status === "pre" ? (
            <>
              <span className={s.pillPre}>
                <Glyph name="sun" size={16} />
                Pre-market
              </span>
              <span className={s.pillLive}>
                <span aria-hidden>≈</span> 1s updates · Indicative data
              </span>
            </>
          ) : spec.status === "closed" ? (
            <span className={s.pillClosed}>Market closed</span>
          ) : null}
        </div>
        <div className={s.ohlc}>
          <span>O<b style={valColor}>{fmt(bar.o, d)}</b></span>
          <span>H<b style={valColor}>{fmt(bar.h, d)}</b></span>
          <span>L<b style={valColor}>{fmt(bar.l, d)}</b></span>
          <span>C<b style={valColor}>{fmt(bar.c, d)}</b></span>
          <b style={chgColor}>
            {fmtSigned(chg, d)} ({fmtSigned((chg / prevC) * 100)}%)
          </b>
        </div>
        {!collapsed && spec.group === "STOCKS" && bid !== undefined && ask !== undefined ? (
          <div className={s.tradeRow}>
            <button type="button" className={s.sell}>
              <span>{fmt(bid, d)}</span>
              <small>SELL</small>
            </button>
            <span className={s.spread}>{(ask - bid).toFixed(2)}</span>
            <button type="button" className={s.buy}>
              <span>{fmt(ask, d)}</span>
              <small>BUY</small>
            </button>
          </div>
        ) : null}
        {!collapsed && spec.volume ? (
          <div className={s.volRow}>
            Vol <b style={valColor}>{fmtVol(bar.v)}</b>
          </div>
        ) : null}
        <button
          type="button"
          className={s.collapse}
          aria-label={collapsed ? "Show legend details" : "Hide legend details"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <Glyph name={collapsed ? "chevDown" : "chevUp"} size={16} strokeWidth={1.4} />
        </button>
      </div>

      <div className={s.watermark} style={{ bottom: TIME_H + 10 }} aria-hidden>
        <svg width="26" height="18" viewBox="0 0 26 18">
          <rect x="0" y="9" width="5" height="9" rx="1" fill="currentColor" />
          <rect x="7" y="4" width="5" height="14" rx="1" fill="currentColor" />
          <rect x="14" y="0" width="5" height="18" rx="1" fill="currentColor" />
          <circle cx="23" cy="15" r="2.6" fill="currentColor" />
        </svg>
        dailyshots
      </div>

      <button type="button" className={s.axisSettings} style={{ height: TIME_H }} aria-label="Scale settings">
        <Icon name="settings" size={24} />
      </button>
    </div>
  );
}

export function Badge({ spec, size }: { spec: Spec; size: number }) {
  const { bg, fg, text, size: fs = 9 } = spec.badge;
  return (
    <span
      className={s.badge}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: fs * (size / 18) }}
      aria-hidden
    >
      {text}
    </span>
  );
}

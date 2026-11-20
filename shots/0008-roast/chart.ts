/* 0008 — Roast · the roast chart, Canvas 2D.
   Temperature on the left (50–250 °C), rate of rise on the right (0–40 °C/min),
   both sharing the same eight brass divisions so neither axis needs its own
   grid. Time runs 0–11 min. */

import { FC_AT, FC_WINDOW, X_MAX, type RoastEvent } from "./engine";
import { REF, REF_DROP, eventOf, phases, refAt, type Live } from "./live";
import { mmss } from "./data";

export const PAD = { l: 50, r: 46, t: 40, b: 26 } as const;
const T_MIN = 50;
const T_MAX = 250;
const R_MAX = 40;

export const INK = {
  well: "#0d3d2b",
  brass: "#c08a3e",
  brassHi: "#e3b872",
  cream: "#f4e9cc",
  creamDim: "#a9c6b1",
  et: "#93dccb",
  ror: "#ef7149",
  ground: "#12513a",
} as const;

export type ChartView = {
  live: Live;
  /** 0–1 position inside the current half-step, for a smooth pen */
  frac: number;
  /** the sync sweep: only history before this time is drawn */
  reveal: number;
  inspectT: number | null;
  pinned: boolean;
  /** seconds, for the pen halo */
  clock: number;
  playing: boolean;
  fonts: { sans: string; mono: string };
};

export type Geometry = { w: number; h: number };

export const xOf = (g: Geometry, t: number) => PAD.l + (t / X_MAX) * (g.w - PAD.l - PAD.r);
export const tOf = (g: Geometry, x: number) => ((x - PAD.l) / (g.w - PAD.l - PAD.r)) * X_MAX;
const yT = (g: Geometry, v: number) => PAD.t + (1 - (v - T_MIN) / (T_MAX - T_MIN)) * (g.h - PAD.t - PAD.b);
const yR = (g: Geometry, v: number) => PAD.t + (1 - v / R_MAX) * (g.h - PAD.t - PAD.b);

const LABEL: Record<RoastEvent, string> = {
  charge: "Charge",
  tp: "TP",
  dry: "Dry end",
  fc: "FC",
  drop: "Drop",
};

function alpha(hex: string, a: number) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

export function drawChart(ctx: CanvasRenderingContext2D, g: Geometry, v: ChartView) {
  const { live } = v;
  const { w, h } = g;
  const bottom = h - PAD.b;
  const right = w - PAD.r;
  ctx.clearRect(0, 0, w, h);

  const dropped = live.drop;
  const tipT = dropped
    ? dropped.t
    : Math.min(v.reveal, live.prev.t + (live.model.t - live.prev.t) * v.frac);
  const tipBt = dropped
    ? dropped.bt
    : v.reveal < live.model.t
      ? live.samples[Math.floor(v.reveal)]?.bt ?? live.model.bt
      : live.prev.bt + (live.model.bt - live.prev.bt) * v.frac;
  const tipEt = dropped
    ? live.samples[dropped.t].et
    : v.reveal < live.model.t
      ? live.samples[Math.floor(v.reveal)]?.et ?? live.model.et
      : live.prev.et + (live.model.et - live.prev.et) * v.frac;

  /* phase tints: development reads warmer, Maillard barely */
  const dry = eventOf(live, "dry");
  const fc = eventOf(live, "fc");
  if (dry && dry.t < tipT) {
    ctx.fillStyle = alpha(INK.cream, 0.025);
    ctx.fillRect(xOf(g, dry.t), PAD.t, xOf(g, fc ? fc.t : tipT) - xOf(g, dry.t), bottom - PAD.t);
  }
  if (fc && fc.t < tipT) {
    ctx.fillStyle = alpha(INK.brass, 0.085);
    ctx.fillRect(xOf(g, fc.t), PAD.t, xOf(g, tipT) - xOf(g, fc.t), bottom - PAD.t);
  }

  /* grid: eight shared divisions, and minutes */
  ctx.font = `400 11px ${v.fonts.mono}`;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;
  for (let k = 0; k <= 8; k++) {
    const temp = T_MIN + k * 25;
    const y = Math.round(yT(g, temp)) + 0.5;
    ctx.strokeStyle = alpha(INK.brass, temp % 50 === 0 ? 0.26 : 0.13);
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = INK.creamDim;
    ctx.textAlign = "right";
    ctx.fillText(String(temp), PAD.l - 10, y);
    ctx.fillStyle = alpha(INK.ror, 0.95);
    ctx.textAlign = "left";
    ctx.fillText(String(k * 5), right + 10, y);
  }
  ctx.textBaseline = "alphabetic";
  for (let m = 0; m <= 11; m++) {
    const x = Math.round(xOf(g, m * 60)) + 0.5;
    ctx.strokeStyle = alpha(INK.brass, 0.13);
    ctx.beginPath();
    ctx.moveTo(x, PAD.t);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.fillStyle = INK.creamDim;
    ctx.textAlign = m === 0 ? "left" : "center";
    ctx.fillText(m === 0 ? "0:00" : `${m}:00`, m === 0 ? x - 0.5 : x, bottom + 17);
  }
  // axis frame in brass, the one heavier line
  ctx.strokeStyle = alpha(INK.brass, 0.6);
  ctx.beginPath();
  ctx.moveTo(PAD.l + 0.5, PAD.t);
  ctx.lineTo(PAD.l + 0.5, bottom + 0.5);
  ctx.lineTo(right + 0.5, bottom + 0.5);
  ctx.lineTo(right + 0.5, PAD.t);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, PAD.t, right - PAD.l, bottom - PAD.t);
  ctx.clip();

  /* reference: a ±3 °C corridor, its centre line, and its RoR */
  const ref = REF.samples.slice(0, REF_DROP + 1);
  ctx.beginPath();
  ref.forEach((s, i) => (i === 0 ? ctx.moveTo(xOf(g, s.t), yT(g, s.bt + 3)) : ctx.lineTo(xOf(g, s.t), yT(g, s.bt + 3))));
  for (let i = ref.length - 1; i >= 0; i--) ctx.lineTo(xOf(g, ref[i].t), yT(g, ref[i].bt - 3));
  ctx.closePath();
  ctx.fillStyle = alpha(INK.cream, 0.075);
  ctx.fill();
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = alpha(INK.cream, 0.42);
  ctx.lineWidth = 1;
  strokeSeries(ctx, ref, (s) => xOf(g, s.t), (s) => yT(g, s.bt));
  const refTp = REF.events.find((e) => e.kind === "tp")!.t;
  const refRor = ref.filter((s) => s.t > refTp && s.ror > 0);
  ctx.strokeStyle = alpha(INK.ror, 0.45);
  strokeSeries(ctx, refRor, (s) => xOf(g, s.t), (s) => yR(g, s.ror));
  ctx.setLineDash([]);

  /* projection: where the bean goes if the current plan holds */
  if (!dropped && v.reveal >= live.model.t && live.proj.path.length > 1) {
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = alpha(INK.cream, 0.6);
    ctx.beginPath();
    ctx.moveTo(xOf(g, tipT), yT(g, tipBt));
    for (const p of live.proj.path) if (p.t > tipT) ctx.lineTo(xOf(g, p.t), yT(g, p.bt));
    ctx.stroke();
    ctx.setLineDash([]);
    if (live.proj.fc) {
      ctx.strokeStyle = INK.cream;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(xOf(g, live.proj.fc.t), yT(g, live.proj.fc.bt), 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* first crack threshold: appears as BT enters the window, breathing while it waits */
  const fcLine = !dropped && !fc && tipBt >= FC_WINDOW && v.reveal >= live.model.t;
  const breatheAt = v.playing ? 0.55 + 0.45 * Math.sin(v.clock * Math.PI * 1.6) : 1;
  if (fcLine) {
    const y = Math.round(yT(g, FC_AT)) + 0.5;
    const breathe = v.playing ? 0.55 + 0.45 * Math.sin(v.clock * Math.PI * 1.6) : 1;
    ctx.fillStyle = alpha(INK.brass, 0.1 * breathe);
    ctx.fillRect(PAD.l, y - 6, right - PAD.l, 12);
    ctx.strokeStyle = alpha(INK.brassHi, 0.45 + 0.45 * breathe);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const samples = live.samples.slice(0, Math.floor(Math.min(tipT, live.model.t)) + 1);

  /* ET */
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK.et;
  ctx.lineJoin = "round";
  ctx.beginPath();
  samples.forEach((s, i) => (i === 0 ? ctx.moveTo(xOf(g, s.t), yT(g, s.et)) : ctx.lineTo(xOf(g, s.t), yT(g, s.et))));
  ctx.lineTo(xOf(g, tipT), yT(g, tipEt));
  ctx.stroke();

  /* RoR, from the moment it turns positive after the turning point */
  const tp = eventOf(live, "tp");
  let tipRor = Number.NaN;
  if (tp) {
    const rs = samples.filter((s) => s.t > tp.t && s.ror > 0);
    if (rs.length > 1) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK.ror;
      strokeSeries(ctx, rs, (s) => xOf(g, s.t), (s) => yR(g, Math.min(R_MAX, s.ror)));
      tipRor = rs[rs.length - 1].ror;
    }
  }

  /* BT */
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK.cream;
  ctx.beginPath();
  samples.forEach((s, i) => (i === 0 ? ctx.moveTo(xOf(g, s.t), yT(g, s.bt)) : ctx.lineTo(xOf(g, s.t), yT(g, s.bt))));
  ctx.lineTo(xOf(g, tipT), yT(g, tipBt));
  ctx.stroke();

  ctx.restore();

  /* event marks: a diamond on BT, a dotted stem, a tag along the top */
  ctx.font = `500 11px ${v.fonts.mono}`;
  const placed: { x0: number; x1: number; row: number }[] = [];
  const tags: { t: number; bt: number; text: string; projected?: boolean; strong?: boolean }[] = [];
  for (const e of live.events) {
    if (e.t > tipT + 0.5) continue;
    tags.push({ t: e.t, bt: e.bt, text: `${LABEL[e.kind]} ${mmss(e.t)} · ${e.bt.toFixed(1)}°`, strong: e.kind === "fc" || e.kind === "drop" });
  }
  if (!dropped && v.reveal >= live.model.t) {
    if (live.proj.fc) tags.push({ t: live.proj.fc.t, bt: live.proj.fc.bt, text: `FC ≈ ${mmss(live.proj.fc.t)}`, projected: true });
    if (live.proj.drop) tags.push({ t: live.proj.drop.t, bt: live.proj.drop.bt, text: `Drop ≈ ${mmss(live.proj.drop.t)}`, projected: true });
  }
  for (const tag of tags) {
    const x = xOf(g, tag.t);
    const tw = ctx.measureText(tag.text).width + 14;
    let x0 = tag.t === 0 ? x : x - tw / 2;
    x0 = Math.min(Math.max(x0, PAD.l), right - tw);
    let row = 0;
    while (placed.some((p) => p.row === row && !(x0 + tw + 4 < p.x0 || x0 > p.x1 + 4))) row++;
    placed.push({ x0, x1: x0 + tw, row });
    const ty = 3 + row * 19;
    const yb = yT(g, tag.bt);

    ctx.strokeStyle = alpha(tag.projected ? INK.cream : INK.brass, tag.projected ? 0.4 : 0.7);
    ctx.lineWidth = 1;
    ctx.setLineDash(tag.projected ? [3, 4] : [1, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, ty + 17);
    ctx.lineTo(Math.round(x) + 0.5, tag.projected ? bottom : yb - 5);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!tag.projected) {
      ctx.fillStyle = INK.brassHi;
      ctx.beginPath();
      ctx.moveTo(x, yb - 5);
      ctx.lineTo(x + 5, yb);
      ctx.lineTo(x, yb + 5);
      ctx.lineTo(x - 5, yb);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK.well;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    roundRect(ctx, x0 + 0.5, ty + 0.5, tw, 17, 3);
    if (tag.projected) {
      ctx.fillStyle = INK.well;
      ctx.fill();
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = alpha(INK.cream, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = INK.cream;
    } else {
      ctx.fillStyle = tag.strong ? INK.brass : INK.well;
      ctx.fill();
      ctx.strokeStyle = INK.brass;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = tag.strong ? "#10301f" : INK.brassHi;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(tag.text, x0 + 7, ty + 9.5);
    ctx.textBaseline = "alphabetic";
  }

  /* now line and the pen */
  const tx = xOf(g, tipT);
  if (!dropped) {
    ctx.strokeStyle = alpha(INK.brassHi, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(tx) + 0.5, PAD.t);
    ctx.lineTo(Math.round(tx) + 0.5, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // elapsed time and phase ride the cursor along the time axis
  const ph = phases(live);
  const phaseName = dropped ? "Dropped" : v.reveal < live.model.t ? "Syncing" : ph[ph.length - 1].label;
  ctx.font = `500 12px ${v.fonts.mono}`;
  const nowText = mmss(tipT);
  const ntw = ctx.measureText(nowText).width;
  ctx.font = `650 11.5px ${v.fonts.sans}`;
  const phw = ctx.measureText(phaseName).width;
  const nw = ntw + phw + 26;
  const nx = Math.min(Math.max(tx - ntw / 2 - 7, PAD.l - 4), right - nw + 4);
  roundRect(ctx, nx, bottom + 4, nw, 19, 3);
  ctx.fillStyle = INK.brass;
  ctx.fill();
  ctx.fillStyle = INK.well;
  ctx.fillRect(nx + ntw + 13, bottom + 4, 1, 19);
  ctx.fillStyle = "#10301f";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `500 12px ${v.fonts.mono}`;
  ctx.fillText(nowText, nx + 7, bottom + 14);
  ctx.font = `650 11.5px ${v.fonts.sans}`;
  ctx.fillText(phaseName, nx + ntw + 20, bottom + 14);
  ctx.textBaseline = "alphabetic";

  const by = yT(g, tipBt);
  if (!dropped && v.playing) {
    const ph = (v.clock % 1.6) / 1.6;
    ctx.strokeStyle = alpha(INK.cream, 0.5 * (1 - ph));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tx, by, 4 + ph * 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  dot(ctx, tx, yT(g, tipEt), 3, INK.et);
  if (Number.isFinite(tipRor)) dot(ctx, tx, yR(g, Math.min(R_MAX, tipRor)), 3, INK.ror);
  dot(ctx, tx, by, 4.5, INK.cream);

  /* curve heads: the instrument. Brass leader tags carry the live values. */
  const warnRor = live.warn && (live.warn.kind === "crash" || live.warn.kind === "flick");
  const dRef = tipBt - refAt(tipT).bt;
  type Head = { y: number; y0: number; name: string; value: string; unit: string; color: string; big: boolean; note?: string; alarm?: boolean };
  const heads: Head[] = [
    { y: by, y0: by, name: "BT", value: tipBt.toFixed(1), unit: "°C", color: INK.cream, big: true, note: tipT > 90 ? `${dRef >= 0 ? "+" : "−"}${Math.abs(dRef).toFixed(1)} ref` : undefined },
    { y: yT(g, tipEt), y0: yT(g, tipEt), name: "ET", value: tipEt.toFixed(1), unit: "°C", color: INK.et, big: false },
  ];
  if (Number.isFinite(tipRor)) {
    const yr = yR(g, Math.min(R_MAX, tipRor));
    heads.push({ y: yr, y0: yr, name: "RoR", value: tipRor.toFixed(1), unit: "°/min", color: INK.ror, big: false, alarm: !!warnRor });
  }
  const hH = (h: Head) => (h.big ? 34 : 24);
  heads.sort((a, b) => a.y - b.y);
  for (let i = 1; i < heads.length; i++) {
    const gap = hH(heads[i - 1]) / 2 + hH(heads[i]) / 2 + 6;
    if (heads[i].y - heads[i - 1].y < gap) heads[i].y = heads[i - 1].y + gap;
  }
  const over = heads.length ? heads[heads.length - 1].y + hH(heads[heads.length - 1]) / 2 - (bottom - 4) : 0;
  if (over > 0) for (const h of heads) h.y -= over;
  for (const h of heads) {
    const vf = `400 ${h.big ? 22 : 14}px ${v.fonts.mono}`;
    const nf = `650 ${h.big ? 11.5 : 10.5}px ${v.fonts.sans}`;
    const uf = `400 ${h.big ? 11.5 : 10.5}px ${v.fonts.mono}`;
    ctx.font = nf;
    const nW = ctx.measureText(h.name).width;
    ctx.font = vf;
    const vW = ctx.measureText(h.value).width;
    ctx.font = uf;
    const uW = ctx.measureText(h.unit).width;
    const noteW = h.note ? (ctx.font = `400 11px ${v.fonts.mono}`, ctx.measureText(h.note).width + 10) : 0;
    const w = 10 + nW + 7 + vW + 3 + uW + noteW + 10;
    const hh = hH(h);
    const flip = tx + 22 + w > right - 2;
    const x0 = flip ? tx - 22 - w : tx + 22;
    const edge = flip ? x0 + w : x0;
    // leader: out from the pen, then to the tag
    ctx.strokeStyle = INK.brass;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx + (flip ? -6 : 6), h.y0);
    ctx.lineTo(tx + (flip ? -12 : 12), h.y0);
    ctx.lineTo(edge, h.y);
    ctx.stroke();
    roundRect(ctx, x0 + 0.5, h.y - hh / 2 + 0.5, w, hh, 4);
    ctx.fillStyle = h.alarm ? INK.ror : alpha(INK.well, 0.95);
    ctx.fill();
    ctx.strokeStyle = h.alarm ? INK.ror : INK.brass;
    ctx.stroke();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let x = x0 + 10;
    ctx.font = nf;
    ctx.fillStyle = h.alarm ? "#2a0d04" : INK.brassHi;
    ctx.fillText(h.name, x, h.y + 1);
    x += nW + 7;
    ctx.font = vf;
    ctx.fillStyle = h.alarm ? "#2a0d04" : h.color;
    ctx.fillText(h.value, x, h.y + 1);
    x += vW + 3;
    ctx.font = uf;
    ctx.fillStyle = h.alarm ? "#2a0d04" : INK.creamDim;
    ctx.fillText(h.unit, x, h.y + (h.big ? -3 : 1));
    if (h.note) {
      x += uW + 10;
      ctx.font = `400 11px ${v.fonts.mono}`;
      ctx.fillStyle = Math.abs(dRef) > 4 ? INK.ror : INK.brassHi;
      ctx.fillText(h.note, x, h.y + 1);
    }
  }
  ctx.textBaseline = "alphabetic";

  /* label for the first crack threshold, drawn over the curves */
  if (fcLine) {
    const y = yT(g, FC_AT);
    const text = "First crack ≈ 196°";
    ctx.font = `650 11.5px ${v.fonts.sans}`;
    const tw = ctx.measureText(text).width + 14;
    // 0:45–3:00 at 196 ° is the one stretch no curve ever crosses
    const lx = xOf(g, 45);
    roundRect(ctx, lx, y - 10, tw, 20, 3);
    ctx.fillStyle = INK.well;
    ctx.fill();
    ctx.strokeStyle = alpha(INK.brassHi, 0.45 + 0.45 * breatheAt);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = INK.brassHi;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, lx + 7, y + 1);
    ctx.textBaseline = "alphabetic";
  }

  /* the sync sweep's scan line */
  if (v.reveal < live.model.t) {
    ctx.fillStyle = alpha(INK.brassHi, 0.16);
    ctx.fillRect(tx, PAD.t, xOf(g, live.model.t) - tx, bottom - PAD.t);
  }

  /* inspector */
  if (v.inspectT !== null) {
    const t = Math.round(v.inspectT);
    const s = live.samples[t];
    const ix = Math.round(xOf(g, t)) + 0.5;
    ctx.strokeStyle = alpha(INK.cream, v.pinned ? 0.85 : 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ix, PAD.t);
    ctx.lineTo(ix, bottom);
    ctx.stroke();
    const r = REF.samples[Math.min(t, REF.samples.length - 1)];
    if (r) ring(ctx, ix, yT(g, r.bt), 3, alpha(INK.cream, 0.7));
    if (s && t <= tipT) {
      dot(ctx, ix, yT(g, s.et), 2.5, INK.et);
      if (tp && t > tp.t && s.ror > 0) dot(ctx, ix, yR(g, Math.min(R_MAX, s.ror)), 2.5, INK.ror);
      dot(ctx, ix, yT(g, s.bt), 3.5, INK.cream);
    }
  }
}

function strokeSeries<T>(ctx: CanvasRenderingContext2D, pts: readonly T[], fx: (p: T) => number, fy: (p: T) => number) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(fx(p), fy(p)) : ctx.lineTo(fx(p), fy(p))));
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = INK.well;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

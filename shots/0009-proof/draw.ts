/* 0009 — Proof · canvas
   The overview strip and the zoomed dock. Both are redrawn every frame from
   the engine's clocks; the overview's waveform is rasterised once per size
   and composited, so the per-frame cost is a blit and a few rectangles. */

import {
  CHAPTERS,
  CH3_END,
  CH3_START,
  EPISODE,
  OUTER_CUTS,
  OVERVIEW,
  REMOVED_BEFORE_CH3,
  TOKENS,
  ampAt,
  mmss,
  spanEnd,
} from "./data";
import { cutHolding, edToSrc, srcToEd, tokenAt, type LiveCut } from "./engine";

/* Canvas cannot read the module's custom properties, so the few colours it
   paints are repeated here. They are the same steps as shot.module.css. */
const C = {
  frame: "#2b3cff",
  well: "#1b29d6",
  lane: "#1520b4",
  laneLine: "rgba(201, 205, 255, 0.16)",
  host: "#c9cdff",
  guest: "#8e98ff",
  dim: "rgba(201, 205, 255, 0.32)",
  paper: "#f7f5ef",
  paperSoft: "rgba(247, 245, 239, 0.62)",
  paperFaint: "rgba(247, 245, 239, 0.16)",
  label: "#dfe2ff",
  hi: "#dcff3c",
  ink: "#12131d",
  overDim: "#7d88ff",
  overPlayed: "#e4e6ff",
  notch: "#1a27cf",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* ── dock ─────────────────────────────────────────────────────────────── */

export type DockFrame = {
  src: number;
  /** Sorted by s0, with p already resolved for this frame. */
  cuts: readonly LiveCut[];
  sel: readonly [number, number] | null;
  cur: number;
  family: string;
};

export const DOCK_PX_PER_SEC = 118;
export const DOCK_RULER = 24;
export const DOCK_WORDS = 30;
export const DOCK_PLAY_AT = 0.3;

export function drawDock(ctx: CanvasRenderingContext2D, W: number, H: number, f: DockFrame) {
  const PX = DOCK_PX_PER_SEC;
  const playX = Math.round(W * DOCK_PLAY_AT);
  const edPlay = srcToEd(f.cuts, f.src);
  const X = (te: number) => playX + (te - edPlay) * PX;
  const laneTop = DOCK_RULER;
  const laneH = (H - DOCK_RULER - DOCK_WORDS) / 2;
  const lanes = { host: laneTop + laneH / 2, guest: laneTop + laneH * 1.5 };

  ctx.clearRect(0, 0, W, H);

  // Lanes.
  ctx.fillStyle = C.lane;
  ctx.fillRect(0, laneTop, W, laneH - 1);
  ctx.fillRect(0, laneTop + laneH, W, laneH - 1);
  ctx.fillStyle = C.laneLine;
  ctx.fillRect(0, Math.round(lanes.host), W, 1);
  ctx.fillRect(0, Math.round(lanes.guest), W, 1);

  // Bars: one per 3px column, mirrored on the speaker's lane centre.
  const half = laneH / 2 - 5;
  for (let x = 1; x < W; x += 3) {
    const te = edPlay + (x - playX) / PX;
    const ts = edToSrc(f.cuts, te);
    if (ts < CH3_START || ts > CH3_END) continue;
    const a = ampAt(ts);
    const tok = TOKENS[tokenAt(ts)];
    const cy = lanes[tok.speaker];
    const h = Math.max(1, a * half);
    const closing = cutHolding(f.cuts, ts);
    const selected = f.sel && ts >= f.sel[0] && ts < f.sel[1];
    ctx.fillStyle = selected ? C.paper : closing ? C.dim : tok.speaker === "host" ? C.host : C.guest;
    ctx.fillRect(x, cy - h, 2, h * 2);
  }

  // Selection wash across both lanes.
  if (f.sel) {
    const x0 = X(srcToEd(f.cuts, f.sel[0]));
    const x1 = X(srcToEd(f.cuts, f.sel[1]));
    ctx.fillStyle = C.paperFaint;
    ctx.fillRect(x0, laneTop, x1 - x0, laneH * 2 - 1);
    ctx.fillStyle = C.paper;
    ctx.fillRect(x0, laneTop, 1, laneH * 2 - 1);
    ctx.fillRect(x1 - 1, laneTop, 1, laneH * 2 - 1);
  }

  // Cuts: brackets while a region slides shut, a seam once it has.
  ctx.font = `600 10px ${f.family}`;
  ctx.textBaseline = "middle";
  for (const c of f.cuts) {
    if (c.p <= 0) continue;
    const x0 = X(srcToEd(f.cuts, c.s0));
    const x1 = X(srcToEd(f.cuts, c.s1));
    if (x1 < -40 || x0 > W + 40) continue;
    if (c.p < 0.999) {
      ctx.fillStyle = "rgba(10, 16, 99, 0.35)";
      ctx.fillRect(x0, laneTop, x1 - x0, laneH * 2 - 1);
      ctx.fillStyle = C.paperSoft;
      ctx.fillRect(x0, laneTop, 1, laneH * 2 - 1);
      ctx.fillRect(x1 - 1, laneTop, 1, laneH * 2 - 1);
    }
    if (c.p > 0.6) {
      ctx.globalAlpha = (c.p - 0.6) / 0.4;
      const sx = Math.round(x0) + 0.5;
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, laneTop);
      ctx.lineTo(sx, laneTop + laneH * 2 - 1);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = `−${(c.s1 - c.s0).toFixed(1)}s`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = C.paper;
      roundRect(ctx, sx - tw / 2 - 5, 5, tw + 10, 15, 3);
      ctx.fill();
      ctx.fillStyle = C.frame;
      ctx.fillText(label, sx - tw / 2, 12.5);
      ctx.globalAlpha = 1;
    }
  }

  // Ruler, in the episode's edited time.
  const gOff = REMOVED_BEFORE_CH3;
  const tLeft = edPlay + (0 - playX) / PX;
  const tRight = edPlay + (W - playX) / PX;
  ctx.font = `500 10.5px ${f.family}`;
  for (let s = Math.floor((tLeft - gOff) * 2) / 2; s <= tRight - gOff; s += 0.5) {
    const x = Math.round(X(s + gOff)) + 0.5;
    const whole = Math.abs(s - Math.round(s)) < 1e-6;
    ctx.fillStyle = whole ? "rgba(201, 205, 255, 0.55)" : "rgba(201, 205, 255, 0.28)";
    ctx.fillRect(x - 0.5, DOCK_RULER - (whole ? 7 : 4), 1, whole ? 7 : 4);
    if (whole && Math.round(s) % 2 === 0) {
      ctx.fillStyle = C.label;
      ctx.fillText(mmss(s), x + 4, DOCK_RULER - 10);
    }
  }

  // Words, aligned to where they are spoken.
  const wy = H - DOCK_WORDS / 2;
  const first = tokenAt(edToSrc(f.cuts, tLeft - 1));
  const last = tokenAt(edToSrc(f.cuts, tRight + 1));
  let lastEnd = -Infinity;
  ctx.font = `500 11.5px ${f.family}`;
  for (let i = first; i <= last; i++) {
    const tok = TOKENS[i];
    const c = cutHolding(f.cuts, tok.start);
    if (c && c.p > 0.9) continue;
    const x0 = X(srcToEd(f.cuts, tok.start));
    const x1 = X(srcToEd(f.cuts, tok.end));
    const isCur = i === f.cur;
    if (tok.kind === "pause") {
      ctx.strokeStyle = isCur ? C.hi : "rgba(201, 205, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 + 2, wy - 4);
      ctx.lineTo(x0 + 2, wy + 4);
      ctx.moveTo(x0 + 2, wy);
      ctx.lineTo(x1 - 2, wy);
      ctx.moveTo(x1 - 2, wy - 4);
      ctx.lineTo(x1 - 2, wy + 4);
      ctx.stroke();
      const tw = ctx.measureText(tok.text).width;
      const mx = (x0 + x1) / 2;
      ctx.fillStyle = C.well;
      ctx.fillRect(mx - tw / 2 - 4, wy - 7, tw + 8, 14);
      ctx.fillStyle = isCur ? C.hi : C.label;
      ctx.fillText(tok.text, mx - tw / 2, wy);
      lastEnd = Math.max(lastEnd, x1);
      continue;
    }
    const text = tok.text;
    const tw = ctx.measureText(text).width;
    if (!isCur && x0 < lastEnd + 5) continue;
    if (isCur) {
      ctx.fillStyle = C.hi;
      roundRect(ctx, x0 - 4, wy - 9, Math.max(tw, x1 - x0) + 8, 18, 3);
      ctx.fill();
      ctx.fillStyle = C.ink;
    } else {
      ctx.fillStyle = c ? "rgba(201, 205, 255, 0.4)" : C.paper;
    }
    ctx.fillText(text, x0, wy);
    if (c) {
      ctx.fillRect(x0 - 1, wy, tw + 2, 1);
    } else if (tok.filler && !isCur) {
      ctx.fillStyle = C.label;
      for (let d = 0; d < tw; d += 3) ctx.fillRect(x0 + d, wy + 8, 1.4, 1.4);
    }
    lastEnd = x0 + tw;
  }

  // Playhead.
  ctx.fillStyle = C.hi;
  ctx.fillRect(playX - 1, DOCK_RULER - 2, 2, H - DOCK_RULER - DOCK_WORDS + 2);
  ctx.beginPath();
  ctx.moveTo(playX - 6, DOCK_RULER - 8);
  ctx.lineTo(playX + 6, DOCK_RULER - 8);
  ctx.lineTo(playX, DOCK_RULER - 1);
  ctx.closePath();
  ctx.fill();
}

/* ── overview ─────────────────────────────────────────────────────────── */

export const OV_LABELS = 18;

/** Rasterise the whole-episode waveform once, in two inks: ahead and played. */
export function buildOverview(W: number, H: number, dpr: number) {
  const make = (color: string) => {
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return cv;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = color;
    const top = OV_LABELS;
    const mid = top + (H - top) / 2;
    const half = (H - top) / 2 - 2;
    const perCol = OVERVIEW.length / W;
    for (let x = 0; x < W; x += 2) {
      let m = 0;
      const k0 = Math.floor(x * perCol);
      const k1 = Math.max(k0 + 1, Math.floor((x + 2) * perCol));
      for (let k = k0; k < k1; k++) m = Math.max(m, OVERVIEW[k] ?? 0);
      const h = Math.max(1, m * half);
      ctx.fillRect(x, mid - h, 1.5, h * 2);
    }
    return cv;
  };
  return { ahead: make(C.overDim), played: make(C.overPlayed) };
}

export type OverviewFrame = {
  src: number;
  cuts: readonly LiveCut[];
  view: readonly [number, number];
  hoverX: number | null;
  family: string;
  now: number;
};

export function drawOverview(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  base: { ahead: HTMLCanvasElement; played: HTMLCanvasElement },
  f: OverviewFrame,
) {
  const k = W / EPISODE.raw;
  const top = OV_LABELS;
  const px = f.src * k;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(base.ahead, 0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, px, H);
  ctx.clip();
  ctx.drawImage(base.played, 0, 0, W, H);
  ctx.restore();

  // Chapters: a rule and a label at each start.
  ctx.font = `600 10.5px ${f.family}`;
  ctx.textBaseline = "middle";
  for (const ch of CHAPTERS) {
    const x0 = Math.round(ch.start * k);
    const x1 = Math.round(ch.end * k);
    ctx.fillStyle = "rgba(201, 205, 255, 0.45)";
    if (ch.n > 1) ctx.fillRect(x0, 2, 1, H - 2);
    const full = `${ch.n}  ${ch.title}`;
    const room = x1 - x0 - 10;
    const label = ctx.measureText(full).width <= room ? full : String(ch.n);
    ctx.fillStyle = ch.start === CH3_START ? C.paper : C.label;
    ctx.fillText(label, x0 + (ch.n > 1 ? 6 : 0), 8);
  }

  // Cut notches: the earlier passes, then this session's, dropping in.
  const notch = (s0: number, s1: number, drop: number, alpha: number) => {
    const x0 = s0 * k;
    const w = Math.max(1.5, (s1 - s0) * k);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.notch;
    ctx.fillRect(x0, top, w, H - top);
    ctx.fillStyle = C.paper;
    const cx = x0 + w / 2;
    const y = H - 1 - drop;
    ctx.beginPath();
    ctx.moveTo(cx - 3, y);
    ctx.lineTo(cx + 3, y);
    ctx.lineTo(cx, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  for (const c of OUTER_CUTS) notch(c.s0, c.s1, 0, 0.85);
  for (const c of f.cuts) if (c.p > 0) notch(c.s0, c.s1, (1 - c.p) * 10, Math.min(1, c.p * 1.4));

  // The stretch of transcript currently on screen.
  const v0 = f.view[0] * k;
  const v1 = Math.max(v0 + 6, f.view[1] * k);
  ctx.fillStyle = "rgba(247, 245, 239, 0.12)";
  ctx.fillRect(v0, top - 2, v1 - v0, H - top + 2);
  ctx.strokeStyle = C.paper;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(v0) + 0.5, top - 1.5, Math.round(v1 - v0) - 1, H - top + 1);

  // Playhead.
  ctx.fillStyle = C.hi;
  ctx.fillRect(Math.round(px) - 1, top - 4, 2, H - top + 4);

  if (f.hoverX != null) {
    const t = f.hoverX / k;
    const ch = CHAPTERS.find((c) => t >= c.start && t < c.end) ?? CHAPTERS[CHAPTERS.length - 1];
    const inside = t >= CH3_START && t < spanEnd(TOKENS.length - 1);
    const label = inside ? `${mmss(t)} raw · click to play from here` : `${mmss(t)} raw · ch. ${ch.n} is not open`;
    ctx.fillStyle = C.paper;
    ctx.fillRect(Math.round(f.hoverX), top, 1, H - top);
    ctx.font = `500 10.5px ${f.family}`;
    const tw = ctx.measureText(label).width;
    const lx = Math.min(W - tw - 10, Math.max(0, f.hoverX + 6));
    ctx.fillStyle = C.paper;
    roundRect(ctx, lx, top + 3, tw + 10, 15, 3);
    ctx.fill();
    ctx.fillStyle = C.frame;
    ctx.fillText(label, lx + 5, top + 10.5);
  }
}

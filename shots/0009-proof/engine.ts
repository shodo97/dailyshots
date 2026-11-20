/* 0009 — Proof · engine
   Two clocks. Source time is the raw recording and never changes. Edited
   time is what the listener hears: source time minus every cut before it,
   each cut weighted by how far it has closed. Everything that moves when a
   cut lands (the dock, the runtime, the chapter starts) reads edited time
   from the same function, so they cannot disagree mid-animation. */

import { CH3_START, OUTER_CUTS, TOKENS } from "./data";

export type LiveCut = {
  id: number;
  s0: number;
  s1: number;
  /** performance.now() when the current motion began. */
  t0: number;
  /** 1 closing (or closed), -1 reopening. */
  dir: 1 | -1;
  /** 0 open … 1 closed, refreshed every frame. */
  p: number;
};

export const STRIKE_MS = 240;
export const CLOSE_MS = 560;

const easeOut = (u: number) => 1 - Math.pow(1 - u, 4);

export function progressOf(c: LiveCut, now: number) {
  const delay = c.dir === 1 ? STRIKE_MS : 0;
  const u = Math.min(1, Math.max(0, (now - c.t0 - delay) / CLOSE_MS));
  const e = easeOut(u);
  return c.dir === 1 ? e : 1 - e;
}

/** Index of the token whose span holds `src` (clamped to the chapter). */
export function tokenAt(src: number) {
  let lo = 0;
  let hi = TOKENS.length - 1;
  if (src <= TOKENS[0].start) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (TOKENS[mid].start <= src) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Seconds removed from chapter 3 before `ts`, cut-progress weighted. */
export function removedBefore(cuts: readonly LiveCut[], ts: number) {
  let r = 0;
  for (const c of cuts) {
    if (ts >= c.s1) r += (c.s1 - c.s0) * c.p;
    else if (ts > c.s0) r += (ts - c.s0) * c.p;
  }
  return r;
}

export const srcToEd = (cuts: readonly LiveCut[], ts: number) => ts - removedBefore(cuts, ts);

/** Inverse of srcToEd. `sorted` must be ordered by s0. */
export function edToSrc(sorted: readonly LiveCut[], te: number) {
  let acc = 0;
  for (const c of sorted) {
    const e0 = c.s0 - acc;
    if (te <= e0) return te + acc;
    const w = (c.s1 - c.s0) * (1 - c.p);
    if (te < e0 + w) return c.s0 + (te - e0) / (1 - c.p);
    acc += (c.s1 - c.s0) * c.p;
  }
  return te + acc;
}

/** The cut (if any) whose closing region holds `ts`. */
export function cutHolding(cuts: readonly LiveCut[], ts: number) {
  for (const c of cuts) if (ts >= c.s0 && ts < c.s1) return c;
  return null;
}

/** Removed anywhere in the episode before raw second `ts`. */
export function episodeRemovedBefore(cuts: readonly LiveCut[], ts: number) {
  let r = 0;
  for (const c of OUTER_CUTS) {
    if (ts >= c.s1) r += c.s1 - c.s0;
    else if (ts > c.s0) r += ts - c.s0;
  }
  return r + (ts > CH3_START ? removedBefore(cuts, ts) : 0);
}

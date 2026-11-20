/* Where everything is at time t into move m. Pure: the React tree renders the
   discrete state (which yard, which phase) and a rAF loop feeds these poses to
   the few things that move. */

import {
  BLOCK_BY_ID,
  G,
  MOVES,
  MOVE_MS,
  PHASES,
  STACK_BY_KEY,
  TOTAL,
  laneY,
  rowY,
  shipRowX,
  type Box,
  type PhaseKind,
} from "./data";

export type Frame = {
  m: number;
  t: number;
  ph: number;
  kind: PhaseKind | "done";
  /** Progress through the phase, 0..1. */
  p: number;
  /** Monotonic ms, for ambient traffic. */
  now: number;
  /** True when motion is reduced: poses settle instead of travelling. */
  settled: boolean;
};

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const outQuint = (k: number) => 1 - Math.pow(1 - k, 5);
/** Map p within [a, b] to 0..1. */
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function frameAt(m: number, t: number, now: number, settled: boolean): Frame {
  if (m >= TOTAL) return { m, t: 0, ph: 0, kind: "done", p: 1, now, settled };
  const phases = PHASES[m];
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    if (t < acc + phases[i].dur || i === phases.length - 1)
      return { m, t, ph: i, kind: phases[i].kind, p: clamp((t - acc) / phases[i].dur), now, settled };
    acc += phases[i].dur;
  }
  return { m, t, ph: 0, kind: "travel", p: 0, now, settled };
}

/** Elapsed ms in move m at the start of phase ph. */
export const phaseStart = (m: number, ph: number) =>
  PHASES[m].slice(0, ph).reduce((a, p) => a + p.dur, 0);

/** The frame a reduced-motion viewer sees for move m: the gantry already over its box. */
export const settledT = (m: number) => (m >= TOTAL ? 0 : PHASES[m][0].dur);

export { MOVE_MS };

/* ── the gantry and what hangs under it ─────────────────────────────────── */

export type Carried = { box: Box; x: number; y: number; hoist: number; row: number; tierY: number };

export type GantryPose = {
  block: string;
  x: number;
  y: number;
  /** Spreader height in tiers above ground. 6 = clear of a five-high stack. */
  hoist: number;
  carried: Carried | null;
};

const CLEAR = 6;

export function gantryPose(f: Frame): GantryPose | null {
  if (f.kind === "done") return null;
  const mv = MOVES[f.m];
  const b = BLOCK_BY_ID[mv.block];
  const ry = rowY(b, mv.row);
  const ly = laneY(b);
  const phase = PHASES[f.m][f.ph];
  const p = f.p;
  const base = { block: mv.block, x: mv.gantryTo };

  if (f.kind === "travel") {
    const k = ease(p);
    return { ...base, x: lerp(mv.gantryFrom, mv.gantryTo, k), y: lerp(mv.trolleyFrom, ry, k), hoist: CLEAR, carried: null };
  }

  if (f.kind === "rehandle") {
    const rh = mv.rehandles[phase.i!];
    const to = STACK_BY_KEY[rh.to];
    const ty = rowY(b, to.row);
    let y = ry;
    let hoist = CLEAR;
    let cy = ry;
    let ch = rh.fromTier - 1;
    if (p < 0.22) {
      hoist = lerp(CLEAR, rh.fromTier, ease(seg(p, 0, 0.22)));
    } else if (p < 0.42) {
      hoist = lerp(rh.fromTier, CLEAR, ease(seg(p, 0.22, 0.42)));
      ch = hoist - 1;
    } else if (p < 0.68) {
      y = cy = lerp(ry, ty, ease(seg(p, 0.42, 0.68)));
      ch = CLEAR - 1;
    } else if (p < 0.84) {
      y = cy = ty;
      hoist = lerp(CLEAR, rh.toTier, ease(seg(p, 0.68, 0.84)));
      ch = hoist - 1;
    } else {
      cy = ty;
      ch = rh.toTier - 1;
      y = lerp(ty, ry, ease(seg(p, 0.84, 1)));
      hoist = lerp(rh.toTier, CLEAR, ease(seg(p, 0.84, 1)));
    }
    const row = cy === ry ? mv.row : cy === ty ? to.row : -1;
    return { ...base, y, hoist, carried: { box: rh.box, x: mv.gantryTo, y: cy, hoist: ch, row, tierY: ch } };
  }

  if (f.kind === "lift") {
    let y = ry;
    let hoist = CLEAR;
    let ch = mv.tier - 1;
    if (p < 0.22) hoist = lerp(CLEAR, mv.tier, ease(seg(p, 0, 0.22)));
    else if (p < 0.45) {
      hoist = lerp(mv.tier, CLEAR, ease(seg(p, 0.22, 0.45)));
      ch = hoist - 1;
    } else if (p < 0.8) {
      y = lerp(ry, ly, ease(seg(p, 0.45, 0.8)));
      ch = CLEAR - 1;
    } else {
      y = ly;
      hoist = lerp(CLEAR, 1.2, ease(seg(p, 0.8, 1)));
      ch = hoist - 1;
    }
    return { ...base, y, hoist, carried: { box: mv.box, x: mv.gantryTo, y, hoist: ch, row: y === ry ? mv.row : -1, tierY: ch } };
  }

  // Haul and quay: the gantry has let go and rises back to clear height.
  return { ...base, y: ly, hoist: f.kind === "haul" ? lerp(1.2, CLEAR, ease(seg(p, 0, 0.3))) : CLEAR, carried: null };
}

/* ── trucks ──────────────────────────────────────────────────────────────── */

export type TruckPose = { x: number; y: number; angle: number; box: Box | null };

/** Distance along a polyline, with the heading eased through each corner. */
export function along(pts: [number, number][], d: number) {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const at = (s: number): [number, number] => {
    s = clamp(s, 0, total);
    for (let i = 0; i < lens.length; i++) {
      if (s <= lens[i] || i === lens.length - 1) {
        const k = lens[i] ? s / lens[i] : 0;
        return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
      }
      s -= lens[i];
    }
    return pts[pts.length - 1];
  };
  const [x, y] = at(d);
  const a = at(d - 9);
  const b = at(d + 9);
  const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return { x, y, angle, total };
}

export function routeOf(m: number): [number, number][] {
  const mv = MOVES[m];
  const b = BLOCK_BY_ID[mv.block];
  const ly = laneY(b);
  return [
    [mv.gantryTo, ly],
    [G.apronLaneX, ly],
    [G.apronLaneX, G.bay34Y],
  ];
}

const ENTRY_X = -60;

export function truckPose(f: Frame): TruckPose | null {
  if (f.kind === "done") return null;
  const mv = MOVES[f.m];
  const ly = laneY(BLOCK_BY_ID[mv.block]);
  const ph = PHASES[f.m];
  const liftIdx = ph.findIndex((q) => q.kind === "lift");
  const arriveBy = phaseStart(f.m, liftIdx) + ph[liftIdx].dur * 0.5;
  if (f.kind === "travel" || f.kind === "rehandle" || f.kind === "lift") {
    const k = outQuint(clamp(f.t / arriveBy));
    const loaded = f.kind === "lift" && f.p >= 0.999;
    return { x: lerp(ENTRY_X, mv.gantryTo, k), y: ly, angle: 0, box: loaded ? mv.box : null };
  }
  const route = routeOf(f.m);
  if (f.kind === "haul") {
    const total = along(route, 0).total;
    const pos = along(route, total * ease(f.p));
    return { x: pos.x, y: pos.y, angle: pos.angle, box: mv.box };
  }
  const end = route[2];
  const down = end[1] > route[1][1];
  return { x: end[0], y: end[1], angle: down ? 90 : -90, box: f.p < 0.18 ? mv.box : null };
}

/** The previous move's truck, pulling away from under the crane. */
export function departingTruck(f: Frame): TruckPose | null {
  if (f.m === 0 || f.m > TOTAL) return null;
  const prev = f.m - 1;
  const route = routeOf(prev);
  const end = route[2];
  const down = end[1] > route[1][1];
  const t = f.kind === "done" ? 99999 : f.t;
  const k = clamp(t / 2200);
  if (k >= 1) return null;
  // Carry on in the direction it arrived, then off the apron.
  const exitY = down ? G.H + 60 : -60;
  return { x: end[0], y: lerp(end[1], exitY, k * k), angle: down ? 90 : -90, box: null };
}

/* ── the quay crane ──────────────────────────────────────────────────────── */

export type QcPose = { trolleyX: number; box: Box | null; boxX: number; lift: number; landed: number };

export function qcPose(f: Frame): QcPose {
  const idle = { trolleyX: G.apronLaneX + 60, box: null, boxX: 0, lift: 0, landed: 0 };
  if (f.kind === "done") return idle;
  const mv = MOVES[f.m];
  const sx = shipRowX(mv.to.row);
  if (f.kind === "haul") {
    return { ...idle, trolleyX: lerp(G.apronLaneX + 60, G.apronLaneX, ease(seg(f.p, 0.4, 0.95))) };
  }
  if (f.kind !== "quay") return { ...idle, trolleyX: G.apronLaneX + 60 };
  const p = f.p;
  if (p < 0.18) return { trolleyX: G.apronLaneX, box: mv.box, boxX: G.apronLaneX, lift: ease(seg(p, 0, 0.18)), landed: 0 };
  if (p < 0.72) {
    const x = lerp(G.apronLaneX, sx, ease(seg(p, 0.18, 0.72)));
    return { trolleyX: x, box: mv.box, boxX: x, lift: 1, landed: 0 };
  }
  return { trolleyX: sx, box: mv.box, boxX: sx, lift: 1 - ease(seg(p, 0.72, 1)), landed: seg(p, 0.72, 1) };
}

/* ── ambient traffic: external trucks on their own business ─────────────── */

export const AMBIENT: { route: [number, number][]; speed: number; offset: number; feet: 0 | 20 | 40; op: string }[] = [
  { route: [[-80, 36 + 112 + 72 + 30], [G.serviceX, 36 + 112 + 72 + 30], [G.serviceX, -80]], speed: 0.052, offset: 0, feet: 20, op: "MRN" },
  { route: [[G.serviceX, G.H + 80], [G.serviceX, 36 + 224 + 72 + 30], [-80, 36 + 224 + 72 + 30]], speed: 0.047, offset: 7000, feet: 40, op: "HLX" },
  { route: [[-80, 36 + 72 + 30], [G.serviceX, 36 + 72 + 30], [G.serviceX, G.H + 80]], speed: 0.044, offset: 15000, feet: 0, op: "ARK" },
  { route: [[G.serviceX, -80], [G.serviceX, 36 + 336 + 72 + 26], [-80, 36 + 336 + 72 + 26]], speed: 0.05, offset: 3000, feet: 40, op: "KST" },
];

export function ambientPose(i: number, now: number) {
  const a = AMBIENT[i];
  const total = along(a.route, 0).total;
  const loop = total + 600; // a pause off the map between laps
  const d = ((now * a.speed + a.offset * a.speed) % loop) - 0;
  return along(a.route, d);
}

/* 0012 — Hive: the inspection being recorded.
   Hollins Orchard, Havelock North. Late spring in Hawke's Bay, peak swarm
   season. Hive 3 ("Marigold") is a ten-frame deep brood box under one super,
   and it is full: 6.5 frames of brood, 3.0 of honey and almost no empty comb,
   which is exactly the congestion that makes a colony start queen cells.

   Every frame is a coverage grid of GW × GH cells. The pre-filled grids are
   generated from the fractions below with a fixed seed, so the strip, the tool
   readouts and the summary all derive from the same cells and agree. */

export const GW = 44;
export const GH = 24;
export const CELLS = GW * GH;

/** Cell categories. The order is also the paint order in the strip bars. */
export const EMPTY = 0;
export const CAPPED = 1;
export const OPEN = 2;
export const HONEY = 3;
export const POLLEN = 4;
export type Cat = 0 | 1 | 2 | 3 | 4;

export const CAT_NAME: Record<Cat, string> = {
  0: "Empty comb",
  1: "Capped brood",
  2: "Open brood and eggs",
  3: "Honey",
  4: "Pollen",
};

/** Data colours, RGB. Kept here so the canvas and the CSS agree. */
export const CAT_RGB: Record<Cat, [number, number, number]> = {
  0: [61, 50, 36], // old drawn comb
  1: [178, 124, 64], // capped brood, biscuit tan
  2: [232, 216, 172], // open brood, pearly larvae on wax
  3: [244, 163, 16], // honey amber
  4: [226, 84, 28], // pollen orange
};

type FrameSpec = {
  capped: number;
  open: number;
  honey: number;
  pollen: number;
  empty: number;
  /** Centre of the brood nest on the face, 0–1. */
  cx: number;
  cy: number;
};

/* Fractions of the face. Brood sums to 6.50 frames, honey to 3.00, pollen to
   0.40 and empty to 0.10, ten frames in all. */
const SPECS: FrameSpec[] = [
  { capped: 0.06, open: 0.04, honey: 0.84, pollen: 0.06, empty: 0.0, cx: 0.56, cy: 0.9 },
  { capped: 0.36, open: 0.12, honey: 0.42, pollen: 0.06, empty: 0.04, cx: 0.52, cy: 0.72 },
  { capped: 0.62, open: 0.18, honey: 0.14, pollen: 0.04, empty: 0.02, cx: 0.5, cy: 0.6 },
  { capped: 0.72, open: 0.18, honey: 0.06, pollen: 0.03, empty: 0.01, cx: 0.49, cy: 0.58 },
  { capped: 0.76, open: 0.18, honey: 0.04, pollen: 0.02, empty: 0.0, cx: 0.5, cy: 0.56 },
  { capped: 0.74, open: 0.2, honey: 0.04, pollen: 0.02, empty: 0.0, cx: 0.51, cy: 0.56 },
  { capped: 0.7, open: 0.2, honey: 0.06, pollen: 0.03, empty: 0.01, cx: 0.5, cy: 0.58 },
  { capped: 0.62, open: 0.18, honey: 0.14, pollen: 0.04, empty: 0.02, cx: 0.48, cy: 0.6 },
  { capped: 0.38, open: 0.12, honey: 0.44, pollen: 0.06, empty: 0.0, cx: 0.47, cy: 0.72 },
  { capped: 0.1, open: 0.04, honey: 0.82, pollen: 0.04, empty: 0.0, cx: 0.44, cy: 0.9 },
];

export const FRAME_COUNT = SPECS.length;

/* ── seeded noise ─────────────────────────────────────────────────────────── */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a coarse lattice, sampled in 0–1 space. */
export function valueNoise(seed: number, cols: number, rows: number) {
  const rnd = mulberry32(seed);
  const lat = new Float32Array((cols + 1) * (rows + 1)).map(() => rnd() * 2 - 1);
  return (u: number, v: number) => {
    const x = Math.min(Math.max(u, 0), 0.9999) * cols;
    const y = Math.min(Math.max(v, 0), 0.9999) * rows;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    let fx = x - x0;
    let fy = y - y0;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const w = cols + 1;
    const a = lat[y0 * w + x0];
    const b = lat[y0 * w + x0 + 1];
    const c = lat[(y0 + 1) * w + x0];
    const d = lat[(y0 + 1) * w + x0 + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/* ── the pre-filled faces ─────────────────────────────────────────────────── */

function buildFrame(spec: FrameSpec, seed: number): Uint8Array {
  const grid = new Uint8Array(CELLS);
  const n1 = valueNoise(seed, 6, 4);
  const n2 = valueNoise(seed + 97, 9, 5);

  const score = new Float32Array(CELLS);
  const order: number[] = [];
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const u = (x + 0.5) / GW;
      const v = (y + 0.5) / GH;
      const i = y * GW + x;
      // The face is about 1.85 times wider than it is tall; the nest is an
      // ellipse a little flatter than the face, roughened by noise.
      score[i] = Math.hypot((u - spec.cx) * 1.25, v - spec.cy) + n1(u, v) * 0.11;
      order.push(i);
    }
  }
  order.sort((a, b) => score[a] - score[b]);

  const take = (f: number) => Math.round(f * CELLS);
  const nBrood = take(spec.capped + spec.open);
  const nOpen = take(spec.open);
  const nPollen = take(spec.pollen);
  const nEmpty = take(spec.empty);

  // Brood from the centre out. Within it, the open brood and eggs sit in
  // patches towards the rim, where the queen is laying into freed cells.
  const brood = order.slice(0, nBrood);
  const rim = [...brood].sort((a, b) => {
    const ka = score[a] + n2((a % GW) / GW, Math.floor(a / GW) / GH) * 0.3;
    const kb = score[b] + n2((b % GW) / GW, Math.floor(b / GW) / GH) * 0.3;
    return kb - ka;
  });
  for (const i of brood) grid[i] = CAPPED;
  for (const i of rim.slice(0, nOpen)) grid[i] = OPEN;

  // Then a band of pollen around the nest, a few empty cells, and honey in
  // everything left: the arch along the top bar and the upper corners.
  let k = nBrood;
  for (const i of order.slice(k, k + nPollen)) grid[i] = POLLEN;
  k += nPollen;
  for (const i of order.slice(k, k + nEmpty)) grid[i] = EMPTY;
  k += nEmpty;
  for (const i of order.slice(k)) grid[i] = HONEY;
  return grid;
}

export function buildGrids(): Uint8Array[] {
  return SPECS.map((spec, i) => buildFrame(spec, 1709 + i * 31));
}

/** Paint one cell; true when it changed. Grids are mutable on purpose: they are
    the record, and React only sees the counts derived from them. */
export function writeCell(grid: Uint8Array, i: number, c: Cat) {
  if (grid[i] === c) return false;
  grid[i] = c;
  return true;
}

export type Counts = [number, number, number, number, number];

export function countGrid(grid: Uint8Array): Counts {
  const c: Counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < grid.length; i++) c[grid[i]]++;
  return c;
}

/** Frame-equivalents across the box, from per-frame cell counts. */
export function totals(counts: Counts[]) {
  let brood = 0;
  let open = 0;
  let honey = 0;
  let pollen = 0;
  let empty = 0;
  for (const c of counts) {
    brood += (c[CAPPED] + c[OPEN]) / CELLS;
    open += c[OPEN] / CELLS;
    honey += c[HONEY] / CELLS;
    pollen += c[POLLEN] / CELLS;
    empty += c[EMPTY] / CELLS;
  }
  return { brood, open, honey, pollen, empty };
}

/* ── the scenario ─────────────────────────────────────────────────────────── */

export const APIARY = "Hollins Orchard";
export const HIVE = { number: 3, name: "Marigold", setup: "Deep brood box, 10 frames, 1 super" };

/** Lid came off at 10:38:00; the screen opens 4 min 12 s into the inspection. */
export const LID_OFF = { h: 10, m: 38 };
export const OPENED_AFTER_S = 4 * 60 + 12;
export const DATE_LABEL = "Thu 19 Nov";

export const WEATHER = { tempC: 22, sky: "Sunny", wind: "NW 9 km/h" };

export const PREVIOUS = {
  label: "7 November",
  short: "7 Nov",
  daysAgo: 12,
  brood: 5.0,
  honey: 2.4,
  pollen: 0.5,
  empty: 2.1,
  queenCells: "0" as QueenCells,
  mites: 2,
};

export type QueenCells = "0" | "1" | "2+";
export type Temper = "Calm" | "Nervous" | "Defensive";

/** Alcohol wash of a half cup of bees, about 300. */
export const WASH_BEES = 300;
export const TREAT_AT = 0.03;

export const START = {
  frame: 1,
  queenSeen: true,
  eggsSeen: true,
  queenCells: "2+" as QueenCells,
  temper: "Calm" as Temper,
  mites: 3,
};

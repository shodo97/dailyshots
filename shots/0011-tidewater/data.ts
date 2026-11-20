/* 0011 — Tidewater: the scenario, the tide model and the harbour.
   Everything is deterministic. Times are decimal hours on Saturday 21 Nov,
   heights are metres above chart datum, the chart is 1 px = 5 m. */

/* ── scenario ────────────────────────────────────────────────────────────── */

export const HARBOUR = "Port Ardlin";
export const DAY = "Saturday 21 November";
export const DAY_SHORT = "Sat 21 Nov";
export const BERTH = "C14";
export const NOW = 5 + 10 / 60; // 05:10
export const DRAUGHT = 1.6;
export const BAR_CHARTED = 0.8;
export const MARGIN = 0.5;
/** Tide height at which the bar gives the margin under the keel. */
export const THRESHOLD = DRAUGHT + MARGIN - BAR_CHARTED; // 1.3 m
/** Water depth the boat needs anywhere to keep the margin. */
export const SAFETY_DEPTH = DRAUGHT + MARGIN; // 2.1 m
export const SPEED_KN = 5;

/* ── tide ─────────────────────────────────────────────────────────────────
   A semidiurnal harmonic sum: M2, its shallow-water overtide M4 (which makes
   the flood shorter than the ebb) and a diurnal term that makes the morning
   high the larger of the two. Neaps, range about 2.1 m. */

const W2 = (2 * Math.PI) / 12.42;
const W1 = (2 * Math.PI) / 24.84;
const MSL = 1.002;
const T_HW = 8.34;

export function tide(t: number): number {
  return (
    MSL +
    0.98 * Math.cos(W2 * (t - T_HW)) +
    0.07 * Math.cos(2 * W2 * (t - T_HW) + 0.9) +
    0.13 * Math.cos(W1 * (t - T_HW))
  );
}

/** Clearance under the keel over the bar at time t. */
export const ukc = (t: number) => tide(t) + BAR_CHARTED - DRAUGHT;

export type Extreme = { t: number; h: number; kind: "HW" | "LW" };

function scanExtremes(from: number, to: number): Extreme[] {
  const out: Extreme[] = [];
  const dt = 1 / 120;
  for (let t = from + dt; t < to - dt; t += dt) {
    const a = tide(t - dt);
    const b = tide(t);
    const c = tide(t + dt);
    if ((b >= a && b > c) || (b <= a && b < c)) {
      // refine with a parabola through the three samples
      const off = ((a - c) / (2 * (a - 2 * b + c))) * dt;
      const tt = t + off;
      out.push({ t: tt, h: tide(tt), kind: b > a ? "HW" : "LW" });
    }
  }
  return out;
}

/** HW and LW across the visible span, including the edges of Fri and Sun. */
export const EXTREMES = scanExtremes(-5, 29);
export const DAY_EXTREMES = EXTREMES.filter((e) => e.t >= 0 && e.t < 24);

function bisect(f: (t: number) => number, a: number, b: number) {
  let fa = f(a);
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa < 0 === fm < 0) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

export type Window = { open: number; close: number };

function scanWindows(from: number, to: number): Window[] {
  const f = (t: number) => tide(t) - THRESHOLD;
  const out: Window[] = [];
  const dt = 1 / 30;
  let open: number | null = f(from) >= 0 ? from : null;
  for (let t = from + dt; t <= to; t += dt) {
    const a = f(t - dt);
    const b = f(t);
    if (a < 0 && b >= 0) open = bisect(f, t - dt, t);
    if (a >= 0 && b < 0 && open !== null) {
      out.push({ open, close: bisect(f, t - dt, t) });
      open = null;
    }
  }
  if (open !== null) out.push({ open, close: to });
  return out;
}

/** Windows where UKC over the bar is at least the margin. */
export const WINDOWS = scanWindows(-5, 29);
export const DAY_WINDOWS = WINDOWS.filter((w) => w.close > 0 && w.open < 24);
export const FIRST = DAY_WINDOWS.find((w) => w.close > NOW) ?? DAY_WINDOWS[0];
export const NEXT = DAY_WINDOWS.find((w) => w.open > FIRST.close);

/* ── formatting ───────────────────────────────────────────────────────────── */

export function hhmm(t: number): string {
  let m = Math.round(t * 60);
  m = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export const m2 = (v: number) => v.toFixed(2);

export function duration(hours: number): string {
  const m = Math.round(hours * 60);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}

export type Verdict = "clear" | "margin" | "aground";
export const verdictFor = (c: number): Verdict =>
  c >= MARGIN ? "clear" : c >= 0 ? "margin" : "aground";

/* ── wind, hourly, at the bar ─────────────────────────────────────────────
   A south-westerly ahead of a cold front that clears through mid afternoon,
   veering north-westerly and gusting hardest as it passes. Degrees are where
   the wind blows from. */

export type WindHour = { h: number; dir: number; kt: number; gust: number };

const WIND_RAW: Array<[number, number, number]> = [
  [205, 8, 13], [205, 9, 13], [210, 9, 14], [210, 10, 15], [215, 10, 15], [220, 11, 16],
  [220, 11, 17], [225, 12, 18], [230, 13, 19], [230, 13, 20], [235, 14, 21], [240, 15, 23],
  [245, 17, 25], [250, 18, 27], [265, 21, 30], [280, 20, 29], [290, 18, 26], [295, 16, 23],
  [300, 15, 21], [300, 14, 20], [305, 13, 18], [305, 12, 17], [310, 11, 16], [310, 10, 15],
];

export const WIND: WindHour[] = WIND_RAW.map(([dir, kt, gust], h) => ({ h, dir, kt, gust }));
export const GUST_WARN = 25;
export const FIRST_GUST = WIND.find((w) => w.gust >= GUST_WARN)!;

/** Wind interpolated between the hourly values (shortest way round). */
export function windAt(t: number): { dir: number; kt: number } {
  const c = Math.min(23, Math.max(0, t));
  const i = Math.min(22, Math.floor(c));
  const f = c - i;
  const a = WIND[i];
  const b = WIND[i + 1];
  let d = b.dir - a.dir;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return { dir: a.dir + d * f, kt: a.kt + (b.kt - a.kt) * f };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/* ── light, 56°N, 21 November ─────────────────────────────────────────────── */

export const SUN = {
  dawn: 7 + 41 / 60,
  rise: 8 + 22 / 60,
  set: 15 + 57 / 60,
  dusk: 16 + 38 / 60,
};

/* ── the harbour ──────────────────────────────────────────────────────────── */

export const CHART_W = 390;
/** The harbour was surveyed on a 390×340 sheet; the app shows it at 260 tall. */
const SHEET_H = 340;
export const CHART_H = 260;
export const SY = CHART_H / SHEET_H;
const sy = (v: number) => Math.round(v * SY * 10) / 10;
export const M_PER_PX = 5;

function lerpTable(table: Array<[number, number]>, v: number) {
  if (v <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (v <= x1) {
      const [x0, y0] = table[i - 1];
      const f = (v - x0) / (x1 - x0);
      const s = f * f * (3 - 2 * f);
      return y0 + (y1 - y0) * s;
    }
  }
  return table[table.length - 1][1];
}

/** Half-width of the bay and its centre line, by y. */
const BAY_W: Array<[number, number]> = [
  [0, 250], [50, 168], [96, 96], [122, 80], [152, 104], [200, 150], [250, 160], [290, 150], [330, 128],
];
const BAY_CX: Array<[number, number]> = [
  [0, 208], [120, 200], [200, 186], [260, 198], [330, 210],
];
/** Natural channel centre line, from sea to the marina. */
const CH_X: Array<[number, number]> = [
  [0, 208], [60, 202], [120, 197], [172, 190], [232, 206], [262, 236], [290, 250],
];
/** Charted depth along the channel floor (negative = below datum). */
const CH_E: Array<[number, number]> = [
  [0, -11], [55, -5], [92, -2.2], [110, -1.0], [121, -0.8], [132, -1.0], [150, -1.9], [210, -2.0], [270, -2.2],
];

export const chX = (y: number) => lerpTable(CH_X, y);
const shoreY = (x: number) => 324 + 7 * Math.sin(x / 37) + 4 * Math.sin(x / 13 + 1.3);

function hash(ix: number, iy: number) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
};
const smin = (a: number, b: number, k: number) => -smax(-a, -b, k);

/** Marina basin, dredged to 2.2 m. */
const BASIN = { x0: 236, x1: 334, y0: 266, y1: 310 };
/** The basin in display coordinates. */
export const BASIN_D = { ...BASIN, y0: sy(BASIN.y0), y1: sy(BASIN.y1) };

/**
 * Elevation above chart datum at a chart point, in metres. Negative values
 * are charted depths, 0–2.4 are drying heights, above 2.4 is land.
 */
export function elevation(x: number, yd: number): number {
  const y = yd / SY;
  const w = lerpTable(BAY_W, y);
  const cx = lerpTable(BAY_CX, y);
  const din = Math.min(w - Math.abs(x - cx), shoreY(x) - y);

  const shore = 2.9 - 0.058 * din;
  const floor = -2.3 - 0.115 * Math.max(0, 112 - y) - 0.0009 * Math.max(0, 112 - y) ** 2;
  let e = smax(shore, floor, 0.6);

  // Ardlin Sands: a broad drying bank in the south-west of the bay
  const sx = (x - 108) / 74;
  const sy = (y - 252) / 46;
  e = smax(e, 1.55 - 2.6 * (sx * sx + sy * sy), 0.5);

  // Kelp Spit, the smaller bank running off the east headland
  const kx = (x - 292) / 40;
  const ky = (y - 168) / 22;
  e = smax(e, 0.9 - 2.4 * (kx * kx + ky * ky), 0.4);

  // the bar: a sand ridge across the entrance, shoaling to the sides
  const cxh = chX(y);
  const dx = x - cxh;
  const bar = -0.8 + 0.00052 * dx * dx - 0.0105 * (y - 121) ** 2;
  e = smax(e, bar, 0.3);

  // Carrick Rock, dries 1.4 m
  const rx = x - 150;
  const ry = y - 104;
  e = smax(e, 1.4 - 0.065 * (rx * rx + ry * ry), 0.3);

  // natural texture, kept out of the channel so the bar stays at 0.8
  const fadeS = Math.min(1, Math.max(0, (y - 280) / 18));
  const chM = Math.exp(-((dx / 13) ** 2)) * (1 - fadeS * fadeS * (3 - 2 * fadeS));
  const n = (vnoise(x / 26, y / 26) - 0.5) * 0.7 + (vnoise(x / 9 + 40, y / 9) - 0.5) * 0.22;
  e += n * (1 - chM) * (e < 2.6 ? 1 : 0.3);

  // the channel floor
  const che = lerpTable(CH_E, y);
  e = e * (1 - chM) + Math.min(e, che) * chM;

  // dredged basin with soft edges
  const bx = Math.min(x - BASIN.x0, BASIN.x1 - x);
  const by = Math.min(y - BASIN.y0, BASIN.y1 - y);
  const bm = Math.min(1, Math.max(0, Math.min(bx, by) / 6 + 0.5));
  if (bm > 0) e = e * (1 - bm) + smin(e, -2.2, 0.2) * bm;

  return e;
}

export const LAND = 2.4; // MHWS, the coastline

/* ── what is drawn over the depth field ──────────────────────────────────── */

export type Mark = {
  id: string;
  kind: "port" | "stbd" | "north" | "pier";
  x: number;
  y: number;
  ch: string;
  colour: "R" | "G" | "W";
  /** label side */
  side: "l" | "r";
  /** phase offset so neighbouring lights do not fire together */
  phase: number;
};

export const MARKS: Mark[] = [
  { id: "no1", kind: "stbd", x: 176, y: sy(70), ch: "Fl G 3s", colour: "G", side: "l", phase: 0.2 },
  { id: "no2", kind: "port", x: 232, y: sy(80), ch: "Fl(2) R 6s", colour: "R", side: "r", phase: 1.1 },
  { id: "car", kind: "north", x: 150, y: sy(90), ch: "Q", colour: "W", side: "l", phase: 0 },
  { id: "no3", kind: "stbd", x: 168, y: sy(156), ch: "Fl(3) G 10s", colour: "G", side: "l", phase: 2.7 },
  { id: "no4", kind: "port", x: 218, y: sy(164), ch: "Fl R 4s", colour: "R", side: "r", phase: 0.6 },
  { id: "pier", kind: "pier", x: 270, y: sy(262), ch: "Oc R 4s", colour: "R", side: "l", phase: 1.9 },
];

/** Light on (1) or off (0) at time s seconds, from the characteristic. */
export function lit(ch: string, s: number): number {
  const m = ch.match(/^(Fl|Oc|Q)(?:\((\d)\))?\s*[A-Z]*\s*(?:([\d.]+)s)?$/);
  if (!m) return 1;
  const [, kind, group, per] = m;
  if (kind === "Q") return s % 1 < 0.3 ? 1 : 0;
  const p = Number(per);
  const u = ((s % p) + p) % p;
  if (kind === "Oc") return u < p - 1 ? 1 : 0;
  const n = Number(group ?? 1);
  for (let i = 0; i < n; i++) if (u >= i * 1.5 && u < i * 1.5 + 0.5) return 1;
  return 0;
}

/** Planned route from the berth to the fairway, in chart px. */
export const ROUTE: Array<[number, number]> = (
  [
    [289, 292], [262, 280], [222, 246], [194, 190], [193, 150], [197, 121], [202, 70], [208, 6],
  ] as Array<[number, number]>
).map(([x, y]) => [x, sy(y)]);
export const BERTH_XY = ROUTE[0];
export const BAR_XY: [number, number] = [197, sy(121)];

function routeLength(pts: Array<[number, number]>) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

const barIdx = ROUTE.findIndex(([x, y]) => x === BAR_XY[0] && y === BAR_XY[1]);
export const TO_BAR_NM = (routeLength(ROUTE.slice(0, barIdx + 1)) * M_PER_PX) / 1852;
export const TO_BAR_H = TO_BAR_NM / SPEED_KN;
export const SLIP = FIRST.open - TO_BAR_H;

/** Course of the last leg out over the bar, true. */
export const OUT_COURSE = (() => {
  const [x0, y0] = BAR_XY;
  const [x1, y1] = ROUTE[ROUTE.length - 1];
  return Math.round(((Math.atan2(x1 - x0, -(y1 - y0)) * 180) / Math.PI + 360) % 360);
})();

/** Places where the chart prints a sounding. */
const SOUNDING_AT: Array<[number, number]> = [
  [120, 18], [290, 24], [60, 40], [340, 52], [106, 60], [262, 104], [182, 102],
  [158, 128], [124, 168], [252, 186], [206, 196], [154, 214], [292, 214],
  [96, 222], [130, 268], [64, 284], [184, 280], [212, 300], [318, 198], [340, 236],
  [170, 248], [322, 296], [228, 222], [196, 160], [44, 120], [345, 120],
];

export type Sounding = { x: number; y: number; e: number };
export const SOUNDINGS: Sounding[] = SOUNDING_AT.map(([x, y0]) => {
  const y = sy(y0);
  return { x, y, e: elevation(x, y) };
}).filter(
  (s) => s.e < LAND - 0.1,
);

/** Chart sounding text: whole metres, then decimetres set small. */
export function soundingParts(e: number): { whole: string; dec: string; dries: boolean } {
  const v = Math.abs(e);
  const dries = e > 0;
  if (v >= 10) return { whole: String(Math.round(v)), dec: "", dries };
  const tenths = Math.round(v * 10);
  return { whole: String(Math.floor(tenths / 10)), dec: String(tenths % 10), dries };
}

/* ── palettes for the canvas ──────────────────────────────────────────────
   The S-52 night table, nudged for a phone screen: deep water darkest, shoal
   water the lightest blue, drying ground olive, land a dim ochre. The red
   table is the same luminances on the red channel only. */

export type Band = "land" | "dry" | "shoal" | "margin" | "safe" | "deep" | "deepest";
export const BANDS: Band[] = ["land", "dry", "shoal", "margin", "safe", "deep", "deepest"];

export type ChartPalette = Record<Band, string> & {
  contour: string;
  safety: string;
  coast: string;
  drycoast: string;
  particle: string;
};

export const NIGHT: ChartPalette = {
  land: "#2e2515",
  dry: "#2b361a",
  shoal: "#30608e",
  margin: "#1d4066",
  safe: "#0e2239",
  deep: "#091626",
  deepest: "#050c16",
  contour: "#3a5f86",
  safety: "#a9bfd6",
  coast: "#6b5631",
  drycoast: "#3b4a2c",
  particle: "150,172,196",
};

export const RED: ChartPalette = {
  land: "#2a0b04",
  dry: "#240804",
  shoal: "#64180a",
  margin: "#3e0f06",
  safe: "#1c0502",
  deep: "#120301",
  deepest: "#0b0101",
  contour: "#5a160a",
  safety: "#e0502e",
  coast: "#6e1c0c",
  drycoast: "#40100a",
  particle: "150,40,22",
};

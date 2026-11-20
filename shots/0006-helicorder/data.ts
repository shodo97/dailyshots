/* 0006 — Helicorder: the scenario.
   Kessel Volcano Observatory, night shift of 18–19 November 2026. Every
   number on screen comes out of this file, and all of it is seeded, so the
   server render, the client render and every reload agree.

   Time is kept in seconds after T0 = 18 Nov 2026 16:00:00 UTC, which is the
   start of the first line on the drum when the shift opens. */

export const TAU = Math.PI * 2;
export const T0_MS = Date.UTC(2026, 10, 18, 16, 0, 0);
export const LINE_S = 1800; // one drum line, 30 minutes
export const LINES = 24; // 12 hours on the drum
export const START_T = 11 * 3600 + 55 * 60 + 30; // 03:55:30 UTC, 19 Nov
export const START_LINE = Math.floor(START_T / LINE_S);
export const TREMOR_ON = 9 * 3600 + 12 * 60 + 40; // 01:12:40
export const GAP_ON = 9 * 3600 + 47 * 60 + 12; // 01:47:12, SWR radio link lost
export const HANDOVER_T = 9 * 3600 + 50 * 60; // 01:50, evening analyst signed off
export const FS_DRUM = 20; // Hz, what the drum is drawn from
export const FS_FINE = 50; // Hz, the loupe and the event view

/* ── seeded randomness ──────────────────────────────────────────────────── */

export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n: number) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Value noise in [-1, 1], linearly interpolated between hashed knots at `rate` Hz. */
function vnoise(seed: number, t: number, rate: number) {
  const u = t * rate;
  const i = Math.floor(u);
  const f = u - i;
  const a = hash(Math.imul(i, 0x9e3779b1) ^ seed) * 2 - 1;
  const b = hash(Math.imul(i + 1, 0x9e3779b1) ^ seed) * 2 - 1;
  return a + (b - a) * f;
}

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng());
}

function poisson(rng: () => number, lambda: number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > l);
  return k - 1;
}

/* ── the network ────────────────────────────────────────────────────────── */

export type Station = {
  code: string;
  sta: string;
  name: string;
  /** km east and north of the active vent; elevation in km a.s.l. */
  x: number;
  y: number;
  z: number;
  /** horizontal distance to the vent, km */
  dist: number;
  /** site amplification */
  site: number;
  /** display gain the drum applies to this channel, set per station by the network operator */
  view: number;
  micro: number;
  noise: number;
  trem: number;
  phase: number;
  seed: number;
  offlineFrom?: number;
};

const NET: Omit<Station, "dist" | "trem" | "phase" | "seed">[] = [
  { code: "KSL.SUM.EHZ", sta: "SUM", name: "Summit", x: 0.3, y: 0.5, z: 2.36, site: 1.0, view: 1.0, micro: 0.95, noise: 0.15 },
  { code: "KSL.CRT.EHZ", sta: "CRT", name: "Crater rim", x: 0.95, y: -0.35, z: 2.21, site: 1.1, view: 1.0, micro: 0.95, noise: 0.28 },
  { code: "KSL.NFL.EHZ", sta: "NFL", name: "North flank", x: -0.5, y: 3.1, z: 1.64, site: 0.9, view: 1.7, micro: 0.62, noise: 0.16 },
  { code: "KSL.EFL.EHZ", sta: "EFL", name: "East flank", x: 3.7, y: 0.6, z: 1.36, site: 1.0, view: 1.9, micro: 0.58, noise: 0.15 },
  { code: "KSL.SWR.EHZ", sta: "SWR", name: "Southwest ridge", x: -3.6, y: -2.8, z: 1.52, site: 0.95, view: 1.9, micro: 0.6, noise: 0.17, offlineFrom: GAP_ON },
  { code: "KSL.MHT.EHZ", sta: "MHT", name: "Moraine hut", x: -6.1, y: 1.7, z: 1.04, site: 1.3, view: 2.4, micro: 0.5, noise: 0.2 },
  { code: "KSL.KBD.BHZ", sta: "KBD", name: "Kessel Bad", x: 7.2, y: -6.3, z: 0.41, site: 0.8, view: 3.0, micro: 0.44, noise: 0.12 },
];

export const STATIONS: Station[] = NET.map((s, i) => {
  const dist = Math.hypot(s.x, s.y);
  return {
    ...s,
    dist,
    trem: 3.2 / (1 + Math.pow(dist, 1.5)),
    phase: 0.7 + i * 1.913,
    seed: 0x51a7 + i * 104729,
  };
});

/* ── the catalogue ──────────────────────────────────────────────────────── */

export type Kind = "VT" | "LP";
export type Arrival = { tp: number; ts: number; amp: number; tau: number; hyp: number };
export type Ev = {
  id: string;
  kind: Kind;
  /** origin time */
  t0: number;
  ml: number;
  /** km below sea level; negative is above it */
  depth: number;
  x: number;
  y: number;
  seed: number;
  line: number;
  arr: Arrival[];
};

type Seed = Omit<Ev, "id" | "arr" | "line">;

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz";
function eventId(seed: number) {
  let v = seed >>> 0;
  let s = "";
  for (let k = 0; k < 4; k++) {
    s += ID_ALPHABET[v % ID_ALPHABET.length];
    v = Math.floor(v / ID_ALPHABET.length);
  }
  return `ksl2026${s}`;
}

function arrivals(e: Seed): Arrival[] {
  return STATIONS.map((st) => {
    const hyp = Math.hypot(st.x - e.x, st.y - e.y, st.z + e.depth);
    const vt = e.kind === "VT";
    return {
      hyp,
      tp: e.t0 + hyp / (vt ? 3.4 : 2.1),
      ts: vt ? e.t0 + hyp / 1.95 : NaN,
      amp: (Math.pow(10, e.ml) * 6 * st.site) / Math.pow(Math.max(hyp, 1), 1.25),
      tau: vt ? 1.4 + 4.2 * Math.max(e.ml, 0.15) : 6.5 + 4 * e.ml,
    };
  });
}

/** The events that are written into the record just after the shift opens,
    so the first minute on screen always has something to detect. */
const SCRIPTED: Seed[] = [
  { kind: "VT", t0: START_T + 19, ml: 1.5, depth: 1.9, x: 0.42, y: 0.12, seed: 0x2a91f3 },
  { kind: "LP", t0: START_T + 102, ml: 0.9, depth: -0.55, x: 0.12, y: 0.04, seed: 0x1c07d5 },
  { kind: "VT", t0: START_T + 196, ml: 0.8, depth: 2.4, x: 0.08, y: -0.2, seed: 0x33b6e1 },
];

const lineCache = new Map<number, Ev[]>();

export function lineEvents(i: number): Ev[] {
  if (i < 0) return [];
  const hit = lineCache.get(i);
  if (hit) return hit;

  const rng = mulberry32(0x6b65 + i * 7919);
  const base = i * LINE_S;
  const h = Math.min((base + LINE_S / 2) / 3600, 15);
  let raw: Seed[] = [];

  const nVT = poisson(rng, (2 + 0.085 * h * h) / 2);
  for (let k = 0; k < nVT; k++) {
    raw.push({
      kind: "VT",
      t0: base + rng() * LINE_S,
      ml: Math.min(2.6, 0.05 + 0.035 * h + -Math.log10(1 - rng() * 0.999) / 1.2),
      depth: Math.min(9, Math.max(0.4, 5.6 - 0.3 * h + gauss(rng) * 0.75)),
      x: 0.25 + gauss(rng) * 0.8,
      y: gauss(rng) * 0.55,
      seed: Math.floor(rng() * 2 ** 30),
    });
  }
  if (h >= 4) {
    const nLP = poisson(rng, (0.25 + 0.07 * (h - 4)) / 2);
    for (let k = 0; k < nLP; k++) {
      raw.push({
        kind: "LP",
        t0: base + rng() * LINE_S,
        ml: 0.4 + rng() * 0.7,
        depth: -0.9 + rng() * 1.2,
        x: 0.1 + gauss(rng) * 0.3,
        y: gauss(rng) * 0.2,
        seed: Math.floor(rng() * 2 ** 30),
      });
    }
  }
  if (i === START_LINE) {
    raw = raw.filter((e) => e.t0 < START_T - 40);
    raw.push(...SCRIPTED);
  }

  raw.sort((a, b) => a.t0 - b.t0);
  const out: Ev[] = [];
  let last = -Infinity;
  for (const e of raw) {
    if (e.t0 - last < 25) continue; // the detector would merge them
    last = e.t0;
    out.push({ ...e, id: eventId(e.seed), line: i, arr: arrivals(e) });
  }
  lineCache.set(i, out);
  return out;
}

/** Every event whose waveform can reach into [a, b]. */
export function eventsAround(a: number, b: number): Ev[] {
  const out: Ev[] = [];
  const i0 = Math.max(0, Math.floor((a - 120) / LINE_S));
  const i1 = Math.floor(b / LINE_S);
  for (let i = i0; i <= i1; i++) out.push(...lineEvents(i));
  return out;
}

/** The network declares an event once the summit station has seen its P wave. */
export const detectT = (e: Ev) => e.arr[0].tp + 2.5;

/* ── the signal ─────────────────────────────────────────────────────────── */

export function tremorAmp(t: number) {
  if (t <= TREMOR_ON) return 0;
  const hrs = (t - TREMOR_ON) / 3600;
  const k = Math.min(1, hrs / 2.75);
  return Math.pow(k, 1.4) * (1 + 0.22 * Math.sin((TAU * t) / 530)) + 0.15 * Math.max(0, hrs - 2.75);
}

function tremor(st: Station, t: number) {
  const a = tremorAmp(t);
  if (a <= 0) return 0;
  // A gliding fundamental near 1.95 Hz with its overtones: harmonic tremor.
  const phi = TAU * (1.95 * t - ((0.22 * 900) / TAU) * Math.cos((TAU * t) / 900));
  return (
    st.trem *
    a *
    (Math.sin(phi) + 0.42 * Math.sin(2 * phi + 0.6) + 0.18 * Math.sin(3 * phi + 1.1)) *
    (0.85 + 0.15 * vnoise(st.seed + 7, t, 2))
  );
}

function eventWave(e: Ev, si: number, t: number) {
  const a = e.arr[si];
  const dp = t - a.tp;
  if (dp < 0) return 0;
  if (e.kind === "LP") {
    if (dp > a.tau * 7) return 0;
    const env = a.amp * (1 - Math.exp(-dp / 1.4)) * Math.exp(-dp / a.tau);
    return env * (0.85 * Math.sin(TAU * 1.35 * dp + (e.seed % 7)) + 0.25 * vnoise(e.seed, t, 12));
  }
  if (dp > a.ts - a.tp + a.tau * 8) return 0;
  let w =
    0.3 *
    a.amp *
    Math.exp(-dp / (a.tau * 0.5)) *
    (1 - Math.exp(-dp / 0.03)) *
    (0.75 * vnoise(e.seed, t, 50) + 0.4 * Math.sin(TAU * 9.1 * t + e.seed));
  const ds = t - a.ts;
  if (ds >= 0) {
    w +=
      a.amp *
      (1 - Math.exp(-ds / 0.12)) *
      Math.exp(-ds / a.tau) *
      (0.7 * vnoise(e.seed + 1, t, 50) + 0.45 * Math.sin(TAU * 6.3 * t + e.seed * 0.3));
  }
  return w;
}

/** Ground velocity at a station, in display units (the summit's background is about ±1). */
export function sample(si: number, t: number, evs: Ev[]): number {
  const st = STATIONS[si];
  if (st.offlineFrom !== undefined && t >= st.offlineFrom) return NaN;
  const p = st.phase;
  let v =
    st.micro *
    (0.6 * Math.sin(TAU * 0.168 * t + p) +
      0.42 * Math.sin(TAU * 0.231 * t + p * 1.7) +
      0.3 * Math.sin(TAU * 0.127 * t + p * 2.3)) *
    (0.8 + 0.22 * Math.sin((TAU * t) / 1300 + p));
  v += st.noise * vnoise(st.seed, t, 9);
  v += tremor(st, t);
  for (let k = 0; k < evs.length; k++) v += eventWave(evs[k], si, t);
  return v;
}

/** The recorder's own minute marks: a short pen offset at every minute, longer on the hour. Pixels. */
export function markOffset(t: number) {
  const m = ((t % 60) + 60) % 60;
  const h = ((t % 3600) + 3600) % 3600;
  if (h < 5) return 3.2;
  return m < 1.6 ? 2.6 : 0;
}

/* ── RSAM ───────────────────────────────────────────────────────────────── */

/** Real-time seismic amplitude: mean absolute amplitude over the last ten minutes, in counts. */
export function rsam(si: number, t: number): number | null {
  const st = STATIONS[si];
  if (st.offlineFrom !== undefined && t >= st.offlineFrom) return null;
  const evs = eventsAround(t - 600, t);
  let sum = 0;
  let n = 0;
  for (let u = t - 600; u <= t; u += 0.25) {
    sum += Math.abs(sample(si, u, evs));
    n++;
  }
  return Math.round((sum / n) * 100);
}

/** Alarm level: 2.5 times the pre-episode background measured at 16:40. */
export const RSAM_ALARM = STATIONS.map((_, i) => Math.round(((rsam(i, 40 * 60) ?? 0) * 2.5) / 10) * 10);
export const RSAM_BASE = STATIONS.map((_, i) => rsam(i, 40 * 60) ?? 1);

/** The last value a station sent before its telemetry dropped. */
export const LAST_RSAM = STATIONS.map((st, i) => (st.offlineFrom ? rsam(i, st.offlineFrom - 1) : null));

/* ── formatting ─────────────────────────────────────────────────────────── */

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function utc(t: number, frac = 0) {
  const ms = T0_MS + t * 1000;
  const d = new Date(ms);
  const base = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  if (!frac) return base;
  const f = Math.floor(((ms % 1000) + 1000) % 1000 / Math.pow(10, 3 - frac));
  return `${base}.${pad(f, frac)}`;
}

export const hhmm = (t: number) => utc(t).slice(0, 5);

export function dayLabel(t: number) {
  const d = new Date(T0_MS + t * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export function span(seconds: number) {
  const m = Math.max(0, Math.floor(seconds / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)} min` : `${m} min`;
}

export const fmtMl = (m: number) => (m < 0 ? "−" : "") + Math.abs(m).toFixed(1);
export const fmtDepth = (d: number) => (d < 0 ? "−" : "") + Math.abs(d).toFixed(1);

/* ── the cross-section ──────────────────────────────────────────────────── */

/** Kessel's W–E profile through the vent, km a.s.l. Summit 2.41 km on the crater rim. */
export function elevation(x: number) {
  return 0.38 + 2.1 * Math.exp(-((x / 3.1) ** 2)) - 0.14 * Math.exp(-((x / 0.34) ** 2)) + 0.05 * Math.sin(x * 1.7);
}

/* ── the shift ──────────────────────────────────────────────────────────── */

export const LEVELS = [
  { level: "NORMAL", code: "GREEN", hex: "#3f8a3b" },
  { level: "ADVISORY", code: "YELLOW", hex: "#e3b928" },
  { level: "WATCH", code: "ORANGE", hex: "#df7319" },
  { level: "WARNING", code: "RED", hex: "#c22f27" },
] as const;

export const CURRENT_LEVEL = 1;
export const LEVEL_SINCE = "14 Nov 09:20 UTC";

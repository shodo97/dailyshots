/* 0008 — Roast · the drum model
   A lumped heat model, small enough to run forward a few hundred steps on every
   simulated second, which is how the projection line is drawn.

   - The burner answers the gas valve with an 8 s lag.
   - ET (drum environment) relaxes toward a point between the beans and what the
     burner could sustain with an empty drum. More air pulls a little more heat
     through the drum, so ET sits higher on more air.
   - Beans heat by Newton's law toward ET, so RoR falls on its own as the gap
     closes. More air strips some of that heat away from the bean mass.
   - The probe reads the beans through its own lag, which is what makes the
     charge plunge and the turning point.
   - First crack is endothermic for a few degrees, then exothermic. A roaster
     who holds the gas through it gets a flick; one who kills it gets a crash.

   Nothing here touches the DOM. */

export type Controls = { gas: number; air: number };

export type ModelState = {
  /** roast seconds since charge */
  t: number;
  /** true bean mass temperature */
  tb: number;
  /** BT, what the probe reads */
  bt: number;
  et: number;
  /** drum wall, the heat store */
  drum: number;
  /** burner output, 0–1, lagging the valve */
  burner: number;
};

export type Sample = {
  t: number;
  bt: number;
  et: number;
  /** °C/min over a 30 s window; NaN until there is a window */
  ror: number;
  gas: number;
  air: number;
};

export type Cue = { t: number; gas: number; air: number };

export const DT = 0.5;
export const X_MAX = 660; // 11:00
export const CHARGE_TEMP = 200;
export const YELLOW_AT = 150;
export const FC_AT = 196;
export const FC_WINDOW = 189;
export const DTR_TARGET = 0.185;
export const COOL_SECONDS = 240;

const TAU_BURNER = 8;

/* Fitted offline against the reference batch's targets: charge 200 °C, turning
   point 90 °C near 1:07, yellow at 4:30, first crack near 8:14, drop near
   10:06 at about 209 °C with RoR falling the whole way. */
const P = {
  kBean: 0.00253, // air → beans
  kDrum: 0.00571, // drum wall → beans, by contact
  tauDrum: 260.5,
  drumToBeans: 0.01264,
  drumBase: 218.3,
  drumGain: 137.7, // per unit of burner
  etWeight: 0.5644,
  etAir: 0.1433,
  etBurner: 73.1,
  tauEt: 19.8,
  tauProbe: 34.56,
  crack: 196.7, // true bean temperature where the crack begins
};

function bump(x: number, a: number, b: number) {
  if (x <= a || x >= b) return 0;
  const u = (x - a) / (b - a);
  return Math.sin(Math.PI * u) ** 2;
}

/** One step of the drum. `jitter` is a seeded probe disturbance, in °C. */
export function step(s: ModelState, c: Controls, dt = DT, jitter = 0): ModelState {
  const burner = s.burner + ((c.gas / 100 - s.burner) * dt) / TAU_BURNER;
  const drumTarget = P.drumBase + P.drumGain * burner;
  const drum = s.drum + ((drumTarget - s.drum) / P.tauDrum - P.drumToBeans * (s.drum - s.tb)) * dt;
  const w = P.etWeight + P.etAir * (c.air / 100);
  const etTarget = s.tb + w * (drum + P.etBurner * burner - s.tb);
  const et = s.et + ((etTarget - s.et) * dt) / P.tauEt;
  const kb = P.kBean * (1.07 - 0.16 * (c.air / 100));
  const crack = -0.05 * bump(s.tb, P.crack, P.crack + 8) + 0.025 * bump(s.tb, P.crack + 7.5, P.crack + 22);
  const tb = s.tb + (kb * (et - s.tb) + P.kDrum * (drum - s.tb) + crack) * dt;
  const bt = s.bt + ((tb - s.bt) * dt) / P.tauProbe + jitter;
  return { t: s.t + dt, tb, bt, et, drum, burner };
}

export function chargeState(charge = CHARGE_TEMP, beans = 21, gas = 70): ModelState {
  return { t: 0, tb: beans, bt: charge, et: 217.8 + (charge - CHARGE_TEMP), drum: 235.4 + (charge - CHARGE_TEMP), burner: gas / 100 };
}

/** Rate of rise from a 1 Hz BT series, °C/min over a 30 s window. */
export function rorAt(bts: readonly number[], i: number): number {
  if (i < 30) return Number.NaN;
  // least-squares slope across the window: quieter than end-point difference
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  const n = 31;
  for (let k = 0; k < n; k++) {
    const x = k;
    const y = bts[i - 30 + k];
    sx += x; sy += y; sxy += x * y; sxx += x * x;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return slope * 60;
}

/** The reference batch's gas and air steps. Live batches follow them while cues are on. */
export const REFERENCE_CUES: readonly Cue[] = [
  { t: 0, gas: 70, air: 30 },
  { t: 255, gas: 60, air: 45 },
  { t: 420, gas: 45, air: 60 },
  { t: 495, gas: 30, air: 70 },
  { t: 560, gas: 25, air: 80 },
];

export function cueAt(cues: readonly Cue[], t: number): Cue {
  let c = cues[0];
  for (const q of cues) if (q.t <= t) c = q;
  return c;
}

export function nextCue(cues: readonly Cue[], t: number): Cue | undefined {
  return cues.find((q) => q.t > t);
}

/* ── seeded noise ──────────────────────────────────────────────────────────── */

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

/* ── reference run ─────────────────────────────────────────────────────────── */

export type RoastEvent = "charge" | "tp" | "dry" | "fc" | "drop";

export type EventMark = {
  kind: RoastEvent;
  t: number;
  bt: number;
  source: "auto" | "manual";
};

export type Run = {
  samples: Sample[];
  events: EventMark[];
};

/** Drop rule the reference used: hold development to the target ratio. */
export const dropTimeFor = (fc: number) => Math.round(fc / (1 - DTR_TARGET));

/** Full reference profile, computed once. */
export function runReference(): Run {
  let s = chargeState(CHARGE_TEMP, 21, REFERENCE_CUES[0].gas);
  const samples: Sample[] = [];
  const bts: number[] = [];
  const events: EventMark[] = [{ kind: "charge", t: 0, bt: s.bt, source: "auto" }];
  let fc = -1;
  let drop = Infinity;
  for (let sec = 0; sec <= X_MAX; sec++) {
    const c = cueAt(REFERENCE_CUES, sec);
    if (sec > 0) {
      s = step(s, c);
      s = step(s, c);
    }
    bts.push(s.bt);
    samples.push({ t: sec, bt: s.bt, et: s.et, ror: rorAt(bts, sec), gas: c.gas, air: c.air });
    const prev = samples[sec - 1];
    if (prev && !events.some((e) => e.kind === "tp") && s.bt > prev.bt && sec > 20)
      events.push({ kind: "tp", t: sec - 1, bt: prev.bt, source: "auto" });
    if (!events.some((e) => e.kind === "dry") && s.bt >= YELLOW_AT && sec > 60)
      events.push({ kind: "dry", t: sec, bt: s.bt, source: "auto" });
    if (fc < 0 && sec > 120 && s.bt >= FC_AT) {
      fc = sec;
      drop = dropTimeFor(fc);
      events.push({ kind: "fc", t: sec, bt: s.bt, source: "auto" });
    }
    if (sec >= drop) {
      events.push({ kind: "drop", t: sec, bt: s.bt, source: "auto" });
      break;
    }
  }
  return { samples, events };
}

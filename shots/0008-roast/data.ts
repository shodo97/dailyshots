/* 0008 — Roast · static content: the roastery, today's earlier batches, the
   bean colour ramp, and formatters. */

export const ROASTERY = "Ostler Coffee";
export const MACHINE = "Drum 1 · 15 kg";
export const COFFEE = "Ethiopia Guji, washed";
export const LOT = "Hambela Wamena · G1 · lot 26-114";
export const GREEN_KG = 12.0;
export const REFERENCE = "#0398 · Guji filter, City";
export const FIRST_BATCH = 412;
/** Charge of #0412 on the shop clock: 08:24:10, Thursday 19 November. */
export const CHARGED_AT = 8 * 3600 + 24 * 60 + 10;
/** Where the screen joins the batch in progress, seconds after charge. */
export const JOIN_AT = 450;

export type LoggedBatch = {
  id: number;
  charged: number; // seconds since midnight
  coffee: string;
  time: number; // roast seconds
  dropBt: number;
  dtr: number; // 0–1
  outKg: number;
};

export const EARLIER: readonly LoggedBatch[] = [
  { id: 408, charged: 6 * 3600 + 51 * 60 + 40, coffee: "Brazil Mogiana, natural", time: 612, dropBt: 211.4, dtr: 0.213, outKg: 10.18 },
  { id: 409, charged: 7 * 3600 + 14 * 60 + 55, coffee: "Brazil Mogiana, natural", time: 606, dropBt: 211.0, dtr: 0.208, outKg: 10.2 },
  { id: 410, charged: 7 * 3600 + 38 * 60 + 5, coffee: "Colombia Huila, washed", time: 591, dropBt: 208.2, dtr: 0.189, outKg: 10.31 },
  { id: 411, charged: 8 * 3600 + 1 * 60 + 20, coffee: "Colombia Huila, washed", time: 597, dropBt: 208.6, dtr: 0.191, outKg: 10.29 },
];

/** Bean colour by roast degree. Hexes sampled from roasted-bean reference cards. */
export const RAMP = [
  { name: "Green", hex: "#a2a77e", from: 20, to: 140 },
  { name: "Yellow", hex: "#d6bf78", from: 140, to: 168 },
  { name: "Cinnamon", hex: "#b57a46", from: 168, to: 196 },
  { name: "City", hex: "#8b5531", from: 196, to: 212 },
  { name: "Full city", hex: "#683b22", from: 212, to: 222 },
  { name: "Dark", hex: "#3c2318", from: 222, to: 235 },
] as const;

/** Target band on the ramp for this coffee: City, dropped between 207 and 210 °C. */
export const TARGET_DROP = { lo: 207, hi: 210 };

/** 0–1 position along the ramp for a bean temperature. */
export function rampPos(bt: number) {
  const n = RAMP.length;
  for (let i = 0; i < n; i++) {
    const r = RAMP[i];
    if (bt < r.to || i === n - 1) {
      const u = Math.min(1, Math.max(0, (bt - r.from) / (r.to - r.from)));
      return (i + u) / n;
    }
  }
  return 1;
}

function hexToRgb(h: string) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** The bean colour at a temperature, blended between neighbouring stops. */
export function beanColour(bt: number) {
  const p = rampPos(bt) * RAMP.length - 0.5;
  const i = Math.max(0, Math.min(RAMP.length - 2, Math.floor(p)));
  const u = Math.max(0, Math.min(1, p - i));
  const a = hexToRgb(RAMP[i].hex);
  const b = hexToRgb(RAMP[i + 1].hex);
  const c = a.map((x, k) => Math.round(x + (b[k] - x) * u));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/** Agtron-style whole-bean estimate. Rough, and labelled as an estimate. */
export function agtronEstimate(bt: number) {
  if (bt < 180) return null;
  return Math.round(Math.max(25, Math.min(95, 85 - (bt - 190) * 1.16)));
}

/** Weight loss from drop temperature and development, inside a typical band. */
export function lossFor(dropBt: number, dtr: number) {
  return 0.118 + (dropBt - 200) * 0.0029 + (dtr - 0.17) * 0.06;
}

/* ── formatting ───────────────────────────────────────────────────────────── */

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const clock = (secOfDay: number, withSeconds = false) => {
  const s = Math.floor(secOfDay);
  const h = String(Math.floor(s / 3600) % 24).padStart(2, "0");
  const m = String(Math.floor(s / 60) % 60).padStart(2, "0");
  return withSeconds ? `${h}:${m}:${String(s % 60).padStart(2, "0")}` : `${h}:${m}`;
};

export const deg = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");

export const signed = (v: number, d = 1) => {
  if (!Number.isFinite(v)) return "—";
  const r = Number(v.toFixed(d));
  if (r === 0) return (0).toFixed(d);
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(d)}`;
};

export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

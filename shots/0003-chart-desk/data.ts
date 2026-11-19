/* 0003 — Chart Desk: market data.
   Generated with a fixed seed, never fetched. Every series is pinned to the
   quotes in the watchlist (last, change, previous close) and, for the two
   symbols on screen at load, to the shape of the reference layout, so the
   numbers in the legend, the axis, the watchlist and the details panel all
   agree with each other. */

export type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type Interval = "1" | "5" | "D";
export type Status = "closed" | "pre" | "open";

export type Spec = {
  id: string;
  name: string;
  exchange: string;
  group: "INDICES" | "STOCKS";
  badge: { bg: string; fg: string; text: string; size?: number };
  last: number;
  chg: number;
  decimals: number;
  /** % move from the first bar of the default window to the last close. */
  windowPct: number;
  /** Shape pins inside the default window: [bar offset out of 674, %]. */
  anchors?: readonly (readonly [number, number])[];
  sigma: number;
  /** 0 = the instrument reports no volume. */
  volume: number;
  avgVolume: number;
  delayed?: boolean;
  status: Status;
  /** Pre-market print, stocks only. */
  pre?: number;
  /** Which number moves once a second. */
  live?: "last" | "pre";
  currency: string;
  sector: string;
  industry: string;
  about: string;
  lastBar?: { o: number; h: number; l: number };
};

export const SPECS: readonly Spec[] = [
  {
    id: "SPX",
    name: "S&P 500 Index",
    exchange: "SP",
    group: "INDICES",
    badge: { bg: "#c8102e", fg: "#ffffff", text: "500", size: 7.5 },
    last: 7323.63,
    chg: -16.9,
    decimals: 2,
    windowPct: 44.22,
    anchors: [
      [0, 0], [34, -1.4], [74, 9], [119, 13], [144, 9], [204, 27], [244, 23],
      [277, -1.4], [289, 16], [344, 27], [394, 36], [464, 37], [504, 35],
      [519, 26], [544, 46], [604, 53], [644, 51], [664, 50],
    ],
    sigma: 0.0062,
    volume: 0,
    avgVolume: 0,
    delayed: true,
    status: "closed",
    currency: "USD",
    sector: "Index",
    industry: "US large cap",
    about:
      "Tracks 500 of the largest companies listed in the US, weighted by free-float market value. It is the benchmark most US equity funds are measured against.",
  },
  {
    id: "NDQ",
    name: "US 100 Index",
    exchange: "NASDAQ",
    group: "INDICES",
    badge: { bg: "#0a7fa8", fg: "#ffffff", text: "100", size: 7.5 },
    last: 27116.26,
    chg: 114.47,
    decimals: 2,
    windowPct: 55.4,
    sigma: 0.011,
    volume: 0,
    avgVolume: 0,
    status: "closed",
    currency: "USD",
    sector: "Index",
    industry: "US large cap growth",
    about:
      "Holds the 100 largest non-financial companies listed on Nasdaq. Heavy in software, semiconductors and internet platforms, so it tends to move further than the broad market in both directions.",
  },
  {
    id: "DJI",
    name: "Dow Jones Industrial Average Index",
    exchange: "DJ",
    group: "INDICES",
    badge: { bg: "#1aa3dc", fg: "#ffffff", text: "30", size: 8 },
    last: 50203.03,
    chg: -561.06,
    decimals: 2,
    windowPct: 29.1,
    sigma: 0.008,
    volume: 0,
    avgVolume: 0,
    status: "closed",
    currency: "USD",
    sector: "Index",
    industry: "US blue chip",
    about:
      "A price-weighted average of 30 large US companies. Because it weights by share price rather than size, a single expensive stock can move it more than a much larger company.",
  },
  {
    id: "VIX",
    name: "CBOE Volatility Index",
    exchange: "CBOE",
    group: "INDICES",
    badge: { bg: "#2f9e44", fg: "#ffffff", text: "▶", size: 8 },
    last: 21.94,
    chg: -2.62,
    decimals: 2,
    windowPct: 62,
    sigma: 0.055,
    volume: 0,
    avgVolume: 0,
    delayed: true,
    status: "open",
    live: "last",
    currency: "USD",
    sector: "Index",
    industry: "Volatility",
    about:
      "The market's expectation of S&P 500 volatility over the next 30 days, implied from option prices. It usually rises when stocks fall, which is why it is read as a fear gauge.",
  },
  {
    id: "DXY",
    name: "U.S. Dollar Index",
    exchange: "ICEUS",
    group: "INDICES",
    badge: { bg: "#0f7a5a", fg: "#ffffff", text: "$", size: 10 },
    last: 103.722,
    chg: -0.092,
    decimals: 3,
    windowPct: -0.1,
    sigma: 0.004,
    volume: 0,
    avgVolume: 0,
    status: "open",
    live: "last",
    currency: "",
    sector: "Index",
    industry: "Currency basket",
    about:
      "Measures the dollar against six major currencies, with the euro making up more than half of the basket. It trades nearly around the clock, so it keeps moving while US stocks are shut.",
  },
  {
    id: "AAPL",
    name: "Apple Inc",
    exchange: "NASDAQ",
    group: "STOCKS",
    badge: { bg: "#111111", fg: "#ffffff", text: "A", size: 10 },
    last: 352.45,
    chg: 0.54,
    decimals: 2,
    windowPct: 94.62,
    anchors: [
      [0, 0], [39, -5.7], [49, 2], [94, 30], [144, 24], [206, 42], [244, 27],
      [274, -4], [289, 19], [314, 11], [354, 16], [389, 42], [439, 58],
      [474, 42], [519, 38], [559, 67], [579, 52], [601, 90], [624, 71],
      [644, 90], [664, 87],
    ],
    sigma: 0.016,
    volume: 34.21e6,
    avgVolume: 45.13e6,
    status: "pre",
    pre: 354.38,
    live: "pre",
    currency: "USD",
    sector: "Electronic Technology",
    industry: "Telecommunications Equipment",
    about:
      "Apple designs the iPhone, Mac, iPad and wearables, and earns a growing share of its revenue from services such as the App Store, iCloud and payments. Hardware still drives most sales, led by the iPhone.",
    lastBar: { o: 351.94, h: 356.42, l: 351.47 },
  },
  {
    id: "TSLA",
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    group: "STOCKS",
    badge: { bg: "#e31937", fg: "#ffffff", text: "T", size: 10 },
    last: 383.72,
    chg: 3.61,
    decimals: 2,
    windowPct: 88.3,
    sigma: 0.034,
    volume: 88.6e6,
    avgVolume: 97.2e6,
    status: "pre",
    pre: 386.1,
    live: "pre",
    currency: "USD",
    sector: "Consumer Durables",
    industry: "Motor Vehicles",
    about:
      "Tesla builds electric vehicles, stationary batteries and solar products. Vehicle sales are most of its revenue; energy storage is the fastest-growing segment.",
  },
  {
    id: "NFLX",
    name: "Netflix, Inc.",
    exchange: "NASDAQ",
    group: "STOCKS",
    badge: { bg: "#111111", fg: "#e50914", text: "N", size: 10 },
    last: 59.82,
    chg: 0.14,
    decimals: 2,
    windowPct: 46.2,
    sigma: 0.021,
    volume: 41.9e6,
    avgVolume: 38.4e6,
    status: "pre",
    pre: 60.05,
    live: "pre",
    currency: "USD",
    sector: "Technology Services",
    industry: "Internet Software/Services",
    about:
      "Netflix runs a subscription streaming service in more than 190 countries. Revenue comes from membership fees across several price tiers, including one supported by advertising.",
  },
  {
    id: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    group: "STOCKS",
    badge: { bg: "#76b900", fg: "#ffffff", text: "N", size: 10 },
    last: 196.42,
    chg: -1.18,
    decimals: 2,
    windowPct: 141.5,
    sigma: 0.029,
    volume: 162.4e6,
    avgVolume: 188.9e6,
    status: "pre",
    pre: 195.87,
    live: "pre",
    currency: "USD",
    sector: "Electronic Technology",
    industry: "Semiconductors",
    about:
      "NVIDIA designs graphics processors and the systems built around them. Data centre accelerators used to train and run AI models now account for most of its revenue.",
  },
  {
    id: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    group: "STOCKS",
    badge: { bg: "#737373", fg: "#ffffff", text: "M", size: 10 },
    last: 508.77,
    chg: 2.31,
    decimals: 2,
    windowPct: 22.9,
    sigma: 0.014,
    volume: 19.8e6,
    avgVolume: 21.6e6,
    status: "pre",
    pre: 509.4,
    live: "pre",
    currency: "USD",
    sector: "Technology Services",
    industry: "Packaged Software",
    about:
      "Microsoft sells cloud infrastructure, productivity software and operating systems. Azure and the Office subscription business are its two largest sources of growth.",
  },
  {
    id: "AMZN",
    name: "Amazon.com, Inc.",
    exchange: "NASDAQ",
    group: "STOCKS",
    badge: { bg: "#232f3e", fg: "#ff9900", text: "a", size: 11 },
    last: 231.56,
    chg: -0.84,
    decimals: 2,
    windowPct: 30.4,
    sigma: 0.019,
    volume: 37.5e6,
    avgVolume: 44.1e6,
    status: "pre",
    pre: 231.22,
    live: "pre",
    currency: "USD",
    sector: "Retail Trade",
    industry: "Internet Retail",
    about:
      "Amazon runs an online marketplace, a logistics network and AWS, its cloud computing arm. Retail drives most of the revenue, while AWS produces most of the operating profit.",
  },
];

export const specById = (id: string) => SPECS.find((s) => s.id === id)!;

/* ── seeded randomness ────────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function gaussian(r: () => number) {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/* ── the NYSE calendar ────────────────────────────────────────────────────── */

const HOLIDAYS = new Set([
  "2020-01-01", "2020-01-20", "2020-02-17", "2020-04-10", "2020-05-25", "2020-07-03", "2020-09-07", "2020-11-26", "2020-12-25",
  "2021-01-01", "2021-01-18", "2021-02-15", "2021-04-02", "2021-05-31", "2021-07-05", "2021-09-06", "2021-11-25", "2021-12-24",
  "2022-01-17", "2022-02-21", "2022-04-15", "2022-05-30", "2022-06-20", "2022-07-04", "2022-09-05", "2022-11-24", "2022-12-26",
  "2023-01-02", "2023-01-16", "2023-02-20", "2023-04-07", "2023-05-29", "2023-06-19", "2023-07-04", "2023-09-04", "2023-11-23", "2023-12-25",
  "2024-01-01", "2024-01-15", "2024-02-19", "2024-03-29", "2024-05-27", "2024-06-19", "2024-07-04", "2024-09-02", "2024-11-28", "2024-12-25",
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
]);

const DAY = 86_400_000;
const FIRST_DAY = Date.UTC(2020, 0, 2);
/** The last completed session. The page is set in Thursday's pre-market. */
export const LAST_SESSION = Date.UTC(2026, 10, 18);
export const WINDOW_START = Date.UTC(2024, 2, 1);

const SESSIONS: number[] = (() => {
  const out: number[] = [];
  for (let t = FIRST_DAY; t <= LAST_SESSION; t += DAY) {
    const d = new Date(t);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (HOLIDAYS.has(d.toISOString().slice(0, 10))) continue;
    out.push(t);
  }
  return out;
})();

export const firstIndexOnOrAfter = (bars: readonly Bar[], t: number) => {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/* ── series ───────────────────────────────────────────────────────────────── */

export type Series = { daily: Bar[]; m1: Bar[]; m5: Bar[] };

const OPEN_UTC = (14 * 60 + 30) * 60_000; // 09:30 New York in November
const SESSION_MIN = 390;
const INTRADAY_DAYS = 5;

function buildDaily(spec: Spec, r: () => number): Bar[] {
  const n = SESSIONS.length;
  const s = SESSIONS.findIndex((t) => t >= WINDOW_START);
  const last = n - 1;
  const prev = spec.last - spec.chg;
  const startClose = spec.last / (1 + spec.windowPct / 100);
  const span = last - s;

  // Log-price pins: the reference shape (or two random mid-points), then the
  // previous close and the last close, so the change column is exact.
  const pins: [number, number][] = [];
  const raw = spec.anchors ?? [
    [0, 0],
    [200 + Math.round(r() * 60), spec.windowPct * (0.25 + r() * 0.35)],
    [420 + Math.round(r() * 80), spec.windowPct * (0.45 + r() * 0.45)],
  ];
  for (const [k, pct] of raw) {
    const i = s + Math.round((k / 674) * span);
    if (i < last - 1) pins.push([i, Math.log(startClose * (1 + pct / 100))]);
  }
  pins.push([last - 1, Math.log(prev)], [last, Math.log(spec.last)]);

  const logc = new Array<number>(n);
  // Inside the window: a Brownian bridge between consecutive pins.
  for (let p = 0; p < pins.length - 1; p++) {
    const [ia, la] = pins[p];
    const [ib, lb] = pins[p + 1];
    const steps = ib - ia;
    const w = [0];
    for (let k = 1; k <= steps; k++) w.push(w[k - 1] + gaussian(r) * spec.sigma);
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      logc[ia + k] = la + (lb - la) * f + (w[k] - f * w[steps]);
    }
  }
  // Before the window: walk backwards with a gentle upward drift over time.
  const drift = Math.log(1 + spec.windowPct / 100) / span;
  for (let i = s - 1; i >= 0; i--) {
    logc[i] = logc[i + 1] - drift * 0.8 + gaussian(r) * spec.sigma;
  }

  const bars: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const c = Math.exp(logc[i]);
    const pc = i ? bars[i - 1].c : c * Math.exp(gaussian(r) * spec.sigma);
    const o = pc * Math.exp(gaussian(r) * spec.sigma * 0.3);
    const h = Math.max(o, c) * Math.exp(Math.abs(gaussian(r)) * spec.sigma * 0.45);
    const l = Math.min(o, c) * Math.exp(-Math.abs(gaussian(r)) * spec.sigma * 0.45);
    const move = Math.abs(Math.log(c / pc)) / spec.sigma;
    const v = spec.volume
      ? spec.avgVolume * Math.exp(gaussian(r) * 0.28) * (0.75 + 0.32 * move) * (r() < 0.02 ? 2.2 : 1)
      : 0;
    bars.push({ t: SESSIONS[i], o, h, l, c, v });
  }
  const lb = bars[last];
  if (spec.lastBar) Object.assign(lb, spec.lastBar);
  if (spec.volume) lb.v = spec.volume;
  return bars;
}

/** One-minute bars for the last five sessions, pinned to each daily candle. */
function buildMinutes(daily: Bar[], spec: Spec, r: () => number): Bar[] {
  const out: Bar[] = [];
  const sig = (spec.sigma / Math.sqrt(SESSION_MIN)) * 1.1;
  for (let d = daily.length - INTRADAY_DAYS; d < daily.length; d++) {
    const day = daily[d];
    const n = SESSION_MIN;
    const w = [0];
    for (let k = 1; k <= n; k++) w.push(w[k - 1] + gaussian(r) * sig);
    const lo = Math.log(day.o);
    const lc = Math.log(day.c);
    const path: number[] = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      path.push(lo + (lc - lo) * f + (w[k] - f * w[n]));
    }
    // Stretch the excursions so the session reaches the daily high and low.
    const lin = (k: number) => lo + (lc - lo) * (k / n);
    let kMax = 0;
    let kMin = 0;
    for (let k = 1; k < n; k++) {
      if (path[k] - lin(k) > path[kMax] - lin(kMax)) kMax = k;
      if (path[k] - lin(k) < path[kMin] - lin(kMin)) kMin = k;
    }
    const lh = Math.log(day.h);
    const ll = Math.log(day.l);
    const up = path[kMax] - lin(kMax) > 1e-9 ? (lh - lin(kMax)) / (path[kMax] - lin(kMax)) : 0;
    const dn = lin(kMin) - path[kMin] > 1e-9 ? (lin(kMin) - ll) / (lin(kMin) - path[kMin]) : 0;
    for (let k = 1; k < n; k++) {
      const res = path[k] - lin(k);
      path[k] = Math.min(lh, Math.max(ll, lin(k) + res * (res > 0 ? up : dn)));
    }
    const vMean = day.v / n;
    for (let k = 0; k < n; k++) {
      const o = Math.exp(path[k]);
      const c = Math.exp(path[k + 1]);
      const wig = Math.abs(gaussian(r)) * sig * 0.5;
      let h = Math.min(day.h, Math.max(o, c) * Math.exp(wig));
      let l = Math.max(day.l, Math.min(o, c) * Math.exp(-wig));
      if (k === kMax || (kMax === 0 && k === 0)) h = day.h;
      if (k === kMin || (kMin === 0 && k === 0)) l = day.l;
      h = Math.max(h, o, c);
      l = Math.min(l, o, c);
      // Volume is U-shaped through the session: heavy at the open and close.
      const x = k / (n - 1);
      const shape = 0.55 + 2.2 * Math.pow(x - 0.5, 2) * 4 * 0.5 + (k < 5 ? 2.5 : 0) + (k > n - 6 ? 1.8 : 0);
      const v = vMean ? vMean * shape * Math.exp(gaussian(r) * 0.35) * 0.62 : 0;
      out.push({ t: day.t + OPEN_UTC + k * 60_000, o, h, l, c, v });
    }
  }
  return out;
}

function aggregate(bars: Bar[], size: number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += size) {
    const g = bars.slice(i, i + size);
    out.push({
      t: g[0].t,
      o: g[0].o,
      h: Math.max(...g.map((b) => b.h)),
      l: Math.min(...g.map((b) => b.l)),
      c: g[g.length - 1].c,
      v: g.reduce((a, b) => a + b.v, 0),
    });
  }
  return out;
}

const cache = new Map<string, Series>();

export function seriesFor(id: string): Series {
  let s = cache.get(id);
  if (!s) {
    const spec = specById(id);
    const r = mulberry32(hash(id) ^ 0x5eed);
    const daily = buildDaily(spec, r);
    const m1 = buildMinutes(daily, spec, r);
    s = { daily, m1, m5: aggregate(m1, 5) };
    cache.set(id, s);
  }
  return s;
}

export const barsFor = (id: string, interval: Interval) => {
  const s = seriesFor(id);
  return interval === "D" ? s.daily : interval === "5" ? s.m5 : s.m1;
};

/** A tick for a live instrument folds into the last bar of every interval. */
export function applyTick(id: string, price: number) {
  const s = seriesFor(id);
  for (const bars of [s.daily, s.m5, s.m1]) {
    const b = bars[bars.length - 1];
    b.c = price;
    b.h = Math.max(b.h, price);
    b.l = Math.min(b.l, price);
  }
}

/* ── formatting ───────────────────────────────────────────────────────────── */

export const MINUS = "−";

export const fmt = (v: number, d = 2) =>
  (v < 0 ? MINUS : "") +
  Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtSigned = (v: number, d = 2) => (v > 0 ? "+" : "") + fmt(v, d);

export const fmtPct = (v: number) => fmt(v, 2) + "%";

export const fmtVol = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + " B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + " M";
  if (a >= 1e3) return (v / 1e3).toFixed(2) + " K";
  return v.toFixed(0);
};

export type RangeId = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
export const RANGES: readonly RangeId[] = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

export const intervalForRange = (r: RangeId): Interval => (r === "1D" ? "1" : r === "5D" ? "5" : "D");

/** First timestamp a range should show, measured back from the last session. */
export function rangeStart(r: RangeId, bars: readonly Bar[]): number {
  const end = new Date(LAST_SESSION);
  const back = (m: number) => Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - m, end.getUTCDate() + 1);
  switch (r) {
    case "1D":
      return LAST_SESSION;
    case "5D":
      return bars[0].t;
    case "1M":
      return back(1);
    case "3M":
      return back(3);
    case "6M":
      return back(6);
    case "YTD":
      return Date.UTC(end.getUTCFullYear(), 0, 1);
    case "1Y":
      return back(12);
    case "5Y":
      return back(60);
    case "All":
      return bars[0].t;
  }
}

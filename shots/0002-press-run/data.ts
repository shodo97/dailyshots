/**
 * Lindholm Spårväg, reliability reporting.
 *
 * Every figure on the screen is derived from the two tables below — the daily
 * series and the depot roll-up — so the arithmetic survives a reader who checks
 * it. Nothing here is randomised: a report that renders different numbers on
 * every refresh is a mock, not a tool.
 */

export type PeriodId = "7d" | "30d" | "quarter";

export type Day = {
  /** ISO date of the bar. Week bars carry the Monday. */
  readonly iso: string;
  /** Service kilometres lost to disruption. */
  readonly km: number;
  /** Trips cancelled outright. */
  readonly trips: number;
};

export type Depot = {
  readonly code: string;
  readonly name: string;
  /** Trips scheduled in the period. */
  readonly trips: number;
  /** Excess wait time, minutes, against the published headway. */
  readonly ewt: number;
  /** Share of incidents restored before the shift handover. */
  readonly restored: number;
};

export type Cause = { readonly name: string; readonly km: number };

type RawPeriod = {
  readonly id: PeriodId;
  readonly label: string;
  /** "week" draws one bar per Monday and labels the series accordingly. */
  readonly grain: "day" | "week";
  readonly start: string;
  readonly series: readonly [number, number][];
  readonly depots: readonly Depot[];
  readonly causes: readonly Cause[];
  /** Trips that ran to timetable. The rest were cancelled or ran late. */
  readonly onTime: number;
  /** Mean time to restore a disruption, minutes. */
  readonly mttr: number;
};

const DEPOT_NAMES = [
  ["VB", "Vallby"],
  ["SÖ", "Söder"],
  ["HM", "Hamnen"],
  ["KB", "Kronberg"],
  ["ÖD", "Ödegård"],
  ["BJ", "Björklund"],
] as const;

const depots = (rows: readonly [number, number, number][]): Depot[] =>
  rows.map(([trips, ewt, restored], i) => ({
    code: DEPOT_NAMES[i][0],
    name: DEPOT_NAMES[i][1],
    trips,
    ewt,
    restored,
  }));

const CAUSE_NAMES = [
  "Signal fault",
  "Road obstruction",
  "Vehicle defect",
  "Staff shortage",
  "Power supply",
] as const;

const causes = (km: readonly number[]): Cause[] =>
  CAUSE_NAMES.map((name, i) => ({ name, km: km[i] }));

const RAW: readonly RawPeriod[] = [
  {
    id: "7d",
    label: "Last 7 days",
    grain: "day",
    start: "2026-04-29",
    series: [
      [88, 8], [102, 9], [134, 12], [81, 7], [59, 5], [76, 7], [75, 7],
    ],
    depots: depots([
      [2290, 1.4, 97.4],
      [2130, 1.5, 96.2],
      [1970, 1.7, 95.8],
      [1710, 1.8, 95.0],
      [1450, 2.0, 93.1],
      [1290, 2.2, 92.0],
    ]),
    causes: causes([191, 163, 118, 86, 57]),
    onTime: 9874,
    mttr: 12,
  },
  {
    id: "30d",
    label: "Last 30 days",
    grain: "day",
    start: "2026-04-06",
    series: [
      [112, 7], [98, 6], [171, 11], [143, 9], [206, 13], [88, 6], [61, 4],
      [134, 9], [189, 12], [412, 27], [318, 21], [225, 15], [154, 10], [97, 6],
      [282, 18],
      [164, 15], [142, 13], [118, 11], [96, 9], [71, 6], [48, 4], [109, 10],
      [127, 12], [88, 8], [102, 9], [134, 12], [81, 7], [59, 5], [76, 7],
      [75, 7],
    ],
    depots: depots([
      [9840, 1.6, 96.8],
      [9120, 1.7, 95.1],
      [8460, 2.0, 94.4],
      [7330, 2.1, 93.9],
      [6210, 2.4, 91.2],
      [5550, 2.6, 90.3],
    ]),
    causes: causes([1384, 1003, 836, 585, 372]),
    onTime: 41207,
    mttr: 17,
  },
  {
    id: "quarter",
    label: "This quarter",
    grain: "week",
    start: "2026-02-02",
    series: [
      [1840, 131], [2210, 158], [1690, 121], [2480, 177], [3120, 223],
      [2640, 189], [2050, 146], [1920, 137], [2310, 165], [1580, 113],
      [1110, 79], [860, 61], [740, 53],
    ],
    depots: depots([
      [42600, 1.9, 95.2],
      [39480, 2.0, 94.0],
      [36620, 2.3, 92.8],
      [31740, 2.5, 92.1],
      [26890, 2.8, 89.4],
      [24100, 3.0, 88.1],
    ]),
    causes: causes([7610, 5890, 4910, 3680, 2460]),
    onTime: 174118,
    mttr: 21,
  },
];

const DAY_MS = 86_400_000;

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const sum = (ns: readonly number[]) => ns.reduce((a, b) => a + b, 0);

/** Largest-remainder, so the waffle always lands on exactly 100 cells. */
function allocate(values: readonly number[], total: number): number[] {
  const whole = values.map((v) => Math.floor((v / sum(values)) * total));
  const remainders = values
    .map((v, i) => ({ i, r: (v / sum(values)) * total - whole[i] }))
    .sort((a, b) => b.r - a.r);
  let left = total - sum(whole);
  for (const { i } of remainders) {
    if (left <= 0) break;
    whole[i] += 1;
    left -= 1;
  }
  return whole;
}

export type Half = {
  readonly label: string;
  readonly km: number;
  readonly trips: number;
  readonly days: number;
};

export type Period = {
  readonly id: PeriodId;
  readonly label: string;
  readonly grain: "day" | "week";
  readonly days: readonly Day[];
  readonly depots: readonly Depot[];
  readonly causes: readonly { name: string; km: number; share: number; cells: number }[];
  readonly km: number;
  readonly trips: number;
  readonly peak: number;
  readonly scheduled: number;
  readonly onTime: number;
  readonly punctuality: number;
  readonly ewt: number;
  readonly restored: number;
  readonly mttr: number;
  readonly first: Half;
  readonly second: Half;
  /** Index of the first bar belonging to the second half. */
  readonly split: number;
  readonly range: string;
};

const SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const dayLabel = (iso: string) => SHORT.format(new Date(`${iso}T00:00:00Z`));

export const weekday = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/** "6 – 20 Apr", collapsing the month when both ends share it. */
function span(a: string, b: string) {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  const month = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(d);
  const left =
    month(da) === month(db) ? String(da.getUTCDate()) : `${da.getUTCDate()} ${month(da)}`;
  return `${left} – ${db.getUTCDate()} ${month(db)}`;
}

function build(raw: RawPeriod): Period {
  const step = raw.grain === "week" ? 7 : 1;
  const days: Day[] = raw.series.map(([km, trips], i) => ({
    iso: addDays(raw.start, i * step),
    km,
    trips,
  }));

  const last = days[days.length - 1];
  const lastDay = raw.grain === "week" ? addDays(last.iso, 6) : last.iso;

  const split = Math.floor(days.length / 2);
  const half = (slice: readonly Day[]): Half => ({
    label: span(slice[0].iso, raw.grain === "week" ? addDays(slice[slice.length - 1].iso, 6) : slice[slice.length - 1].iso),
    km: sum(slice.map((d) => d.km)),
    trips: sum(slice.map((d) => d.trips)),
    days: slice.length,
  });

  const scheduled = sum(raw.depots.map((d) => d.trips));
  const weighted = (pick: (d: Depot) => number) =>
    sum(raw.depots.map((d) => pick(d) * d.trips)) / scheduled;

  const causeKm = raw.causes.map((c) => c.km);
  const cells = allocate(causeKm, 100);
  const totalKm = sum(causeKm);

  return {
    id: raw.id,
    label: raw.label,
    grain: raw.grain,
    days,
    depots: raw.depots,
    causes: raw.causes.map((c, i) => ({
      name: c.name,
      km: c.km,
      share: c.km / totalKm,
      cells: cells[i],
    })),
    km: sum(days.map((d) => d.km)),
    trips: sum(days.map((d) => d.trips)),
    peak: Math.max(...days.map((d) => d.km)),
    scheduled,
    onTime: raw.onTime,
    punctuality: raw.onTime / scheduled,
    ewt: weighted((d) => d.ewt),
    restored: weighted((d) => d.restored),
    mttr: raw.mttr,
    first: half(days.slice(0, split)),
    second: half(days.slice(split)),
    split,
    range: span(days[0].iso, lastDay),
  };
}

export const PERIODS: readonly Period[] = RAW.map(build);

export const periodById = (id: PeriodId) =>
  PERIODS.find((p) => p.id === id) ?? PERIODS[1];

/* Formatting. Figures are set in tabular numerals, so widths stay stable while
   a value ticks. */

export const km = (n: number) => `${Math.round(n).toLocaleString("en-GB")} km`;
export const int = (n: number) => Math.round(n).toLocaleString("en-GB");
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const min = (n: number) => `${n.toFixed(1)} min`;

/** Signed change, written the way an operator reads it: down is good here. */
export function delta(from: number, to: number) {
  const change = (to - from) / from;
  return {
    change,
    label: `${change < 0 ? "↓" : "↑"} ${Math.abs(Math.round(change * 100))}%`,
    better: change < 0,
  };
}

/** What the summary panel claims to have written. Templated off the figures
    above so a finding can never disagree with the chart beside it. */
export function findings(p: Period) {
  const kmDelta = delta(p.first.km, p.second.km);
  const tripDelta = delta(p.first.trips, p.second.trips);
  const top = [...p.causes].sort((a, b) => b.km - a.km)[0];
  const tail = [...p.depots].sort((a, b) => b.ewt - a.ewt)[0];
  const grain = p.grain === "week" ? "weeks" : "days";

  return [
    {
      head:
        kmDelta.change <= -0.4
          ? `Lost kilometres halved over the last ${p.second.days} ${grain}`
          : kmDelta.change < 0
            ? `Lost kilometres fell over the last ${p.second.days} ${grain}`
            : `Lost kilometres rose over the last ${p.second.days} ${grain}`,
      body: `${int(p.first.km)} → ${int(p.second.km)} km, while cancellations moved only ${Math.abs(Math.round(tripDelta.change * 100))}%. Disruptions are getting shorter, not rarer.`,
    },
    {
      head: `${top.name}s drive ${Math.round(top.share * 100)}% of the loss`,
      body: `${km(top.km)} across the period, concentrated on lines 3 and 7 where the interlocking is still relay-based.`,
    },
    {
      head: `${tail.name} carries the tail`,
      body: `${min(tail.ewt)} excess wait against a ${min(p.ewt)} network mean, on ${int(tail.trips)} trips.`,
    },
  ];
}

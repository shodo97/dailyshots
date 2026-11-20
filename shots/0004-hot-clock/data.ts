/* 0004 — Hot Clock: the 16:00 hour of Kestrel Drive, authored to the second.
   Every duration is real arithmetic: the played items sum to 21:31, the on-air
   track started at 16:21:31, and the scheduled hour lands 38 seconds past the
   17:00:00 news post. Nothing here is random. */

export type ItemType = "news" | "music" | "ad" | "jingle" | "talk" | "travel" | "legal";
export type Outro = "fade" | "cold";

export type Item = {
  id: string;
  type: ItemType;
  title: string;
  /** Short name for the wheel, where the full title will not fit. */
  dial?: string;
  /** Artist for music; owner or contents for everything else. */
  by: string;
  /** Seconds. */
  dur: number;
  /** Seconds of instrumental intro before the vocal: talk-over time. */
  ramp?: number;
  outro: Outro;
  /** Cannot move or be dropped. */
  pinned?: boolean;
  /** Second of the hour this item is booked for, with a tolerance. */
  due?: { at: number; within: number };
};

export const HOUR_START = 16 * 3600;
/** Seconds into the hour. The news at 17:00:00 is the hard post. */
export const POST = 3600;
/** Scenario "now": 16:21:40, nine seconds into Saltmarsh. */
export const SCENARIO_START = HOUR_START + 21 * 60 + 40;
/** Within this many seconds either side of the post the hour reads clean. */
export const CLEAN = 5;

export const TYPE_LABEL: Record<ItemType, string> = {
  music: "Music",
  talk: "Talk link",
  ad: "Ad break",
  jingle: "Jingle / ID",
  travel: "Travel",
  legal: "Legal ID",
  news: "News",
};

export const TYPE_ORDER: ItemType[] = ["music", "talk", "ad", "jingle", "travel", "legal", "news"];

export const ITEMS: Item[] = [
  // ── played ──────────────────────────────────────────────────────────────
  { id: "n16", type: "news", title: "Kestrel News at Four", dial: "News", by: "Newsroom · Dev Anand", dur: 180, outro: "cold", pinned: true },
  { id: "j01", type: "jingle", title: "Drive sweeper, sung", by: "Kestrel imaging · KST-J014", dur: 8, outro: "cold" },
  { id: "m01", type: "music", title: "Lowland Static", by: "The Marram Grass", dur: 221, ramp: 12, outro: "fade" },
  { id: "m02", type: "music", title: "Ferrous", by: "Holly Ashdown", dur: 238, ramp: 21, outro: "cold" },
  { id: "t01", type: "talk", title: "Back-announce, weather", by: "Ines Marlow · mic 1", dur: 72, outro: "cold" },
  { id: "a01", type: "ad", title: "Break 1 · 3 spots", by: "Halden Motors, Fen Valley Dairy, Corran Opticians", dur: 150, outro: "cold" },
  { id: "j02", type: "jingle", title: "Station ID, 94.2", by: "Kestrel imaging · KST-J002", dur: 6, outro: "cold" },
  { id: "m03", type: "music", title: "Night Bus to Cleethorpes", by: "Paper Lanterns", dur: 252, ramp: 9, outro: "cold" },
  { id: "t02", type: "talk", title: "Arts Week gig guide", by: "Ines Marlow · mic 1", dur: 154, outro: "cold" },
  { id: "j03", type: "jingle", title: "Kestrel Drive, short", by: "Kestrel imaging · KST-J021", dur: 10, outro: "cold" },
  // ── on air at 16:21:31 ──────────────────────────────────────────────────
  { id: "m04", type: "music", title: "Saltmarsh", by: "June Okafor", dur: 224, ramp: 18, outro: "fade" },
  // ── to come ─────────────────────────────────────────────────────────────
  { id: "m05", type: "music", title: "Quarter Light", by: "Tomas Weir & the Flatlands", dur: 192, ramp: 7, outro: "cold" },
  { id: "t03", type: "talk", title: "Back-announce, coming up", by: "Ines Marlow · mic 1", dur: 45, outro: "cold" },
  { id: "a02", type: "ad", title: "Break 2 · 4 spots", dial: "Break 2", by: "Wold Brewery, Ashby Lettings, Marsh & Co, Fen Valley Dairy", dur: 180, outro: "cold" },
  { id: "j04", type: "jingle", title: "Station ID, 94.2", by: "Kestrel imaging · KST-J002", dur: 6, outro: "cold" },
  { id: "m06", type: "music", title: "Hinterland", by: "Bea Corran", dur: 245, ramp: 14, outro: "fade" },
  { id: "m07", type: "music", title: "Oxbow", by: "The Spurn Point Choir", dur: 213, ramp: 11, outro: "cold" },
  { id: "t04", type: "talk", title: "Guest: Rafi Mensah, Arts Week", dial: "Rafi Mensah", by: "Ines Marlow · mic 1, 2", dur: 340, outro: "cold" },
  { id: "r01", type: "travel", title: "Travel and roads", by: "Kestrel travel desk · Pri Shah", dur: 90, outro: "cold", due: { at: 45 * 60, within: 60 } },
  { id: "a03", type: "ad", title: "Break 3 · 3 spots", by: "Corran Opticians, Halden Motors, Arts Week", dur: 140, outro: "cold" },
  { id: "j05", type: "jingle", title: "Kestrel Drive, sung", by: "Kestrel imaging · KST-J018", dur: 8, outro: "cold" },
  { id: "m08", type: "music", title: "Bright Fields, Low Sun", by: "Corrie & the Northern Line", dur: 230, ramp: 16, outro: "fade" },
  { id: "m09", type: "music", title: "Brass Weather", by: "Ottilie Vance", dur: 182, ramp: 10, outro: "cold" },
  { id: "t05", type: "talk", title: "Handover, headlines tease", by: "Ines Marlow · mic 1", dur: 60, outro: "cold" },
  { id: "m10", type: "music", title: "Tidewrack", by: "Hannah Pell", dur: 178, ramp: 8, outro: "fade" },
  { id: "l01", type: "legal", title: "Legal ID", by: "Radio Kestrel 94.2 FM · Ofcom licence AL 100492", dur: 14, outro: "cold", pinned: true },
];

/** The hard post. Always 17:00:00, never part of the running order. */
export const NEWS_17: Item = {
  id: "n17",
  type: "news",
  title: "Kestrel News at Five",
  by: "Newsroom · network join",
  dur: 180,
  outro: "cold",
  pinned: true,
};

/** Standby tracks of different lengths, kept for exactly this problem. */
export const SPARES: Item[] = [
  { id: "s01", type: "music", title: "Kingfisher", by: "Lowther", dur: 144, ramp: 6, outro: "cold" },
  { id: "s02", type: "music", title: "Quiet Roads (radio edit)", by: "Selma Ryder", dur: 199, ramp: 13, outro: "fade" },
  { id: "s03", type: "music", title: "Stillwater (short edit)", by: "The Marram Grass", dur: 118, ramp: 5, outro: "fade" },
];

export const ALL: Record<string, Item> = Object.fromEntries(
  [...ITEMS, ...SPARES, NEWS_17].map((i) => [i.id, i]),
);

/* ── carts ─────────────────────────────────────────────────────────────── */

export type CartType = "jingle" | "sting" | "bed" | "fx" | "promo";
export type Cart = { id: string; key: string; title: string; type: CartType; dur: number; code: string };

export const CART_LABEL: Record<CartType, string> = {
  jingle: "Jingle",
  sting: "Sting",
  bed: "Bed",
  fx: "FX",
  promo: "Promo",
};

export const CARTS: Cart[] = [
  { id: "c1", key: "1", title: "Kestrel ID, sung", type: "jingle", dur: 7, code: "J002" },
  { id: "c2", key: "2", title: "Drive sweeper", type: "jingle", dur: 9, code: "J014" },
  { id: "c3", key: "3", title: "Travel sting", type: "sting", dur: 4, code: "S007" },
  { id: "c4", key: "4", title: "Weather bed", type: "bed", dur: 60, code: "B003" },
  { id: "c5", key: "5", title: "Phone-in bed", type: "bed", dur: 120, code: "B011" },
  { id: "c6", key: "6", title: "Quiz fanfare", type: "fx", dur: 5, code: "X020" },
  { id: "c7", key: "7", title: "Quiz clock, 10s", type: "fx", dur: 10, code: "X021" },
  { id: "c8", key: "8", title: "Arts Week promo", type: "promo", dur: 30, code: "P118" },
  { id: "c9", key: "9", title: "Applause, small room", type: "fx", dur: 6, code: "X004" },
  { id: "c0", key: "0", title: "Dead-air pad", type: "bed", dur: 240, code: "B001" },
];

/* ── formatting ────────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** 16:25:15 from absolute seconds of the day. */
export function clock(abs: number) {
  const s = Math.floor(abs);
  return `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** 3:44 from a duration in seconds. */
export function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Countdown that never shows 0:00 until it is actually over. */
export function countdown(sec: number) {
  return mmss(Math.ceil(Math.max(0, sec)));
}

/* ── the running order ─────────────────────────────────────────────────── */

export type Placed = {
  id: string;
  item: Item;
  /** Seconds into the hour. Dropped items sit at their slot with zero width. */
  start: number;
  end: number;
  dropped: boolean;
};

export function place(order: string[], dropped: ReadonlySet<string>): Placed[] {
  let t = 0;
  return order.map((id) => {
    const item = ALL[id];
    const isDropped = dropped.has(id);
    const start = t;
    if (!isDropped) t += item.dur;
    return { id, item, start, end: t, dropped: isDropped };
  });
}

export type Phase = "played" | "onair" | "next" | "queued" | "dropped";

export type Schedule = {
  placed: Placed[];
  onAir?: Placed;
  next?: Placed;
  /** Signed seconds: positive means the hour runs past the post. */
  over: number;
  phase: Record<string, Phase>;
};

export function schedule(order: string[], dropped: ReadonlySet<string>, nowInHour: number): Schedule {
  const placed = place(order, dropped);
  const phase: Record<string, Phase> = {};
  let onAir: Placed | undefined;
  let next: Placed | undefined;
  for (const p of placed) {
    if (p.dropped) phase[p.id] = "dropped";
    else if (p.end <= nowInHour) phase[p.id] = "played";
    else if (p.start <= nowInHour) {
      phase[p.id] = "onair";
      onAir = p;
    } else if (!next) {
      phase[p.id] = "next";
      next = p;
    } else phase[p.id] = "queued";
  }
  const last = placed[placed.length - 1];
  return { placed, onAir, next, over: last ? last.end - POST : 0, phase };
}

export type State = "long" | "clean" | "short";
export const stateOf = (over: number): State => (over > CLEAN ? "long" : over < -CLEAN ? "short" : "clean");

/** Signed duration: +0:38, −0:19. */
export function signed(sec: number) {
  const r = Math.round(sec);
  if (r === 0) return "0:00";
  return `${r > 0 ? "+" : "−"}${mmss(Math.abs(r))}`;
}

export function dueDrift(p: Placed) {
  if (!p.item.due || p.dropped) return null;
  const drift = p.start - p.item.due.at;
  return { drift, ok: Math.abs(drift) <= p.item.due.within };
}

/* ── the fix the desk would suggest ────────────────────────────────────── */

export type Suggestion = { drop?: string; add?: string; over: number };

/** The single drop, single spare, or drop-and-spare that lands nearest the post
 *  without pushing a booked item out of its window. */
export function suggest(
  order: string[],
  dropped: ReadonlySet<string>,
  spares: string[],
  movable: (id: string) => boolean,
): Suggestion | null {
  const base = schedule(order, dropped, -1).over;
  if (Math.abs(base) <= CLEAN) return null;
  const candidates = order.filter((id) => movable(id) && !dropped.has(id));
  const legalAt = order.indexOf("l01");

  const score = (o: string[], d: ReadonlySet<string>) => {
    const sc = schedule(o, d, -1);
    const late = sc.placed.some((p) => {
      const dd = dueDrift(p);
      return dd ? !dd.ok : false;
    });
    return { over: sc.over, penalty: late ? 600 : 0 };
  };

  let best: (Suggestion & { cost: number }) | null = null;
  const consider = (s: Suggestion, cost: number) => {
    if (!best || cost < best.cost) best = { ...s, cost };
  };

  const withSpare = (add: string) => [...order.slice(0, legalAt), add, ...order.slice(legalAt)];

  for (const drop of candidates) {
    const d = new Set(dropped).add(drop);
    const a = score(order, d);
    consider({ drop, over: a.over }, Math.abs(a.over) + a.penalty);
    for (const add of spares) {
      const b = score(withSpare(add), d);
      consider({ drop, add, over: b.over }, Math.abs(b.over) + b.penalty + 1);
    }
  }
  for (const add of spares) {
    const c = score(withSpare(add), dropped);
    consider({ add, over: c.over }, Math.abs(c.over) + c.penalty);
  }
  const found = best as (Suggestion & { cost: number }) | null;
  if (!found || Math.abs(found.over) >= Math.abs(base)) return null;
  return { drop: found.drop, add: found.add, over: found.over };
}

/* ── deterministic noise for the meters ────────────────────────────────── */

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth value noise in 0..1. */
export function noise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/* ── format rules: the clock's own constraints, checked live ─────────────── */

export type Rule = { id: string; label: string; value: string; ok: boolean };

export function rules(placed: Placed[]): Rule[] {
  const live = placed.filter((p) => !p.dropped);
  const legal = live.find((p) => p.item.type === "legal");
  const travel = live.find((p) => p.item.due);
  const drift = travel ? dueDrift(travel) : null;
  const ads = live.filter((p) => p.item.type === "ad").reduce((t, p) => t + p.item.dur, 0);

  let run = 0;
  let maxRun = 0;
  for (const p of live) {
    run = p.item.type === "music" ? run + 1 : 0;
    maxRun = Math.max(maxRun, run);
  }

  const seen = new Map<string, number>();
  for (const p of live) if (p.item.type === "music") seen.set(p.item.by, (seen.get(p.item.by) ?? 0) + 1);
  const twice = [...seen].find(([, n]) => n > 1)?.[0];

  return [
    {
      id: "legal",
      label: "Legal ID in time",
      value: legal ? clock(16 * 3600 + legal.end) : "missing",
      ok: !!legal && legal.end <= POST,
    },
    {
      id: "travel",
      label: "Travel :45 ± 1:00",
      value: travel && drift ? (drift.drift === 0 ? "on time" : `${signed(drift.drift)}`) : "dropped",
      ok: !!drift?.ok,
    },
    { id: "ads", label: "Ads under 9:00", value: mmss(ads), ok: ads <= 540 },
    { id: "run", label: "Max 3 songs in a row", value: `${maxRun}`, ok: maxRun <= 3 },
    { id: "artist", label: "No repeat artist", value: twice ? "repeat" : "clear", ok: !twice },
  ];
}

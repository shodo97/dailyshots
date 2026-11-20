/* 0005 — Pass: the scenario.
   Friday service at Osteria Lume. The scenario clock starts at 20:14:00 and
   every time below is in seconds relative to that moment, so negative numbers
   are earlier in the evening. Nothing here reads the wall clock. */

export const SERVICE_START = 20 * 3600 + 14 * 60; // 20:14:00

export type StationId = "grill" | "garde" | "pasta" | "fry" | "pastry";

/** `slots` is how many things the station can have on the heat at once. */
export type Station = { id: StationId; name: string; slots: number };

export const STATIONS: Station[] = [
  { id: "grill", name: "Grill", slots: 6 },
  { id: "garde", name: "Garde manger", slots: 2 },
  { id: "pasta", name: "Pasta", slots: 6 },
  { id: "fry", name: "Fry", slots: 4 },
  { id: "pastry", name: "Pastry", slots: 2 },
];

export type MenuItem = { id: string; name: string; station: StationId; cook: number };

/** Cook times in seconds, from fire to plate at the pass. */
export const MENU: Record<string, MenuItem> = {
  bistecca: { id: "bistecca", name: "BISTECCA", station: "grill", cook: 840 },
  branzino: { id: "branzino", name: "BRANZINO", station: "grill", cook: 600 },
  pollo: { id: "pollo", name: "POLLO DIAVOLA", station: "grill", cook: 720 },
  ossobuco: { id: "ossobuco", name: "OSSOBUCO", station: "grill", cook: 480 },
  crudo: { id: "crudo", name: "CRUDO", station: "garde", cook: 240 },
  burrata: { id: "burrata", name: "BURRATA", station: "garde", cook: 180 },
  carpaccio: { id: "carpaccio", name: "CARPACCIO", station: "garde", cook: 240 },
  panzanella: { id: "panzanella", name: "PANZANELLA", station: "garde", cook: 180 },
  risotto: { id: "risotto", name: "RISOTTO AL LIMONE", station: "pasta", cook: 540 },
  cacio: { id: "cacio", name: "CACIO E PEPE", station: "pasta", cook: 420 },
  tagliatelle: { id: "tagliatelle", name: "TAGLIATELLE RAGÙ", station: "pasta", cook: 480 },
  agnolotti: { id: "agnolotti", name: "AGNOLOTTI", station: "pasta", cook: 420 },
  fritto: { id: "fritto", name: "FRITTO MISTO", station: "fry", cook: 300 },
  arancini: { id: "arancini", name: "ARANCINI", station: "fry", cook: 300 },
  tiramisu: { id: "tiramisu", name: "TIRAMISU", station: "pastry", cook: 120 },
  pannacotta: { id: "pannacotta", name: "PANNA COTTA", station: "pastry", cook: 120 },
  affogato: { id: "affogato", name: "AFFOGATO", station: "pastry", cook: 90 },
};

/** Sold out since the first seating. */
export const EIGHTY_SIXED = ["AGNELLO", "FIORI FRITTI", "BOMBOLONI"];

/** Portions of bistecca left uncommitted at 20:14, after the open tickets. */
export const BISTECCA_LEFT = 3;

export type Line = {
  item: keyof typeof MENU;
  qty: number;
  seats: number[];
  mod?: { seat?: number; text: string };
  allergy?: { seat: number; text: string };
};

export type CourseName = "APPS" | "MAINS" | "DOLCI";
export type CourseState = "sent" | "fired" | "away" | "hold";

export type Course = {
  name: CourseName;
  state: CourseState;
  /** When it was fired, called away, or sent from the pass. */
  at?: number;
  lines: Line[];
  /** Fired from this screen, so it carries the expediter's stamp. */
  stamped?: boolean;
};

export type Ticket = {
  id: string;
  table: number;
  covers: number;
  server: string;
  check: string;
  /** Order sequence, which is also its place on the rail. */
  seq: number;
  sentAt: number;
  courses: Course[];
};

export const OPEN: Ticket[] = [
  {
    id: "t12",
    table: 12,
    covers: 4,
    server: "MARTA",
    check: "0418",
    seq: 418,
    sentAt: -1310,
    courses: [
      { name: "APPS", state: "sent", at: -930, lines: [] },
      {
        name: "MAINS",
        state: "fired",
        at: -860,
        lines: [
          { item: "bistecca", qty: 1, seats: [1], mod: { text: "MED RARE" } },
          { item: "risotto", qty: 2, seats: [2, 4], mod: { seat: 4, text: "NO GARLIC" } },
          { item: "branzino", qty: 1, seats: [3], allergy: { seat: 3, text: "SESAME" } },
        ],
      },
    ],
  },
  {
    id: "t15",
    table: 15,
    covers: 2,
    server: "NICO",
    check: "0419",
    seq: 419,
    sentAt: -1500,
    courses: [
      { name: "APPS", state: "sent", at: -540, lines: [] },
      {
        name: "MAINS",
        state: "away",
        at: -115,
        lines: [
          { item: "bistecca", qty: 1, seats: [1], mod: { text: "RARE" } },
          { item: "cacio", qty: 1, seats: [2] },
        ],
      },
    ],
  },
  {
    id: "t4",
    table: 4,
    covers: 2,
    server: "LUCA",
    check: "0421",
    seq: 421,
    sentAt: -690,
    courses: [
      {
        name: "APPS",
        state: "fired",
        at: -650,
        lines: [
          { item: "burrata", qty: 1, seats: [1] },
          { item: "fritto", qty: 1, seats: [2] },
        ],
      },
      {
        name: "MAINS",
        state: "hold",
        lines: [
          { item: "tagliatelle", qty: 1, seats: [1], allergy: { seat: 1, text: "NUTS" } },
          { item: "pollo", qty: 1, seats: [2], mod: { text: "SAUCE ON SIDE" } },
        ],
      },
    ],
  },
  {
    id: "t21",
    table: 21,
    covers: 6,
    server: "GIO",
    check: "0424",
    seq: 424,
    sentAt: -500,
    courses: [
      {
        name: "APPS",
        state: "fired",
        at: -476,
        lines: [
          { item: "carpaccio", qty: 2, seats: [1, 2] },
          { item: "arancini", qty: 2, seats: [3, 5] },
          { item: "burrata", qty: 2, seats: [4, 6] },
        ],
      },
      {
        name: "MAINS",
        state: "hold",
        lines: [
          { item: "risotto", qty: 3, seats: [1, 2, 6] },
          { item: "cacio", qty: 2, seats: [3, 4] },
          { item: "ossobuco", qty: 1, seats: [5], allergy: { seat: 5, text: "CELERY" } },
        ],
      },
    ],
  },
];

/** Orders the servers have already rung in; they print one after another. */
export const INCOMING: Ticket[] = [
  {
    id: "t9",
    table: 9,
    covers: 2,
    server: "LUCA",
    check: "0433",
    seq: 433,
    sentAt: 0,
    courses: [
      {
        name: "APPS",
        state: "fired",
        lines: [
          { item: "panzanella", qty: 1, seats: [1] },
          { item: "arancini", qty: 1, seats: [2] },
        ],
      },
      {
        name: "MAINS",
        state: "hold",
        lines: [
          { item: "bistecca", qty: 1, seats: [1], mod: { text: "MEDIUM" } },
          { item: "agnolotti", qty: 1, seats: [2], mod: { text: "NO PARM" } },
        ],
      },
    ],
  },
  {
    id: "t26",
    table: 26,
    covers: 4,
    server: "PIA",
    check: "0434",
    seq: 434,
    sentAt: 0,
    courses: [
      { name: "MAINS", state: "sent", at: -260, lines: [] },
      {
        name: "DOLCI",
        state: "fired",
        lines: [
          { item: "tiramisu", qty: 2, seats: [1, 3] },
          { item: "pannacotta", qty: 1, seats: [2] },
          { item: "affogato", qty: 1, seats: [4], allergy: { seat: 4, text: "NUTS" } },
        ],
      },
    ],
  },
  {
    id: "t2",
    table: 2,
    covers: 2,
    server: "MARTA",
    check: "0436",
    seq: 436,
    sentAt: 0,
    courses: [
      { name: "APPS", state: "sent", at: -300, lines: [] },
      {
        name: "MAINS",
        state: "fired",
        lines: [
          { item: "branzino", qty: 1, seats: [1] },
          { item: "risotto", qty: 1, seats: [2], mod: { text: "NO GARLIC" } },
        ],
      },
    ],
  },
  {
    id: "t18",
    table: 18,
    covers: 3,
    server: "GIO",
    check: "0437",
    seq: 437,
    sentAt: 0,
    courses: [
      {
        name: "APPS",
        state: "fired",
        lines: [
          { item: "crudo", qty: 2, seats: [1, 3], allergy: { seat: 3, text: "SHELLFISH" } },
          { item: "fritto", qty: 1, seats: [2] },
        ],
      },
      {
        name: "MAINS",
        state: "hold",
        lines: [
          { item: "bistecca", qty: 1, seats: [1] },
          { item: "branzino", qty: 2, seats: [2, 3] },
        ],
      },
    ],
  },
];

/** Seconds after load at which each incoming ticket starts to print. */
export const PRINT_AT = [1.1, 17, 33, 49];

export type Bumped = { ticket: Ticket; at: number };

/** Already off the rail before 20:14, so recall has something to give back. */
export const BUMPED: Bumped[] = [
  {
    at: -160,
    ticket: {
      id: "t3",
      table: 3,
      covers: 2,
      server: "GIO",
      check: "0415",
      seq: 415,
      sentAt: -1720,
      courses: [
        { name: "APPS", state: "sent", at: -1080, lines: [] },
        {
          name: "MAINS",
          state: "fired",
          at: -720,
          lines: [
            { item: "pollo", qty: 1, seats: [1] },
            { item: "tagliatelle", qty: 1, seats: [2] },
          ],
        },
      ],
    },
  },
  {
    at: -80,
    ticket: {
      id: "t17",
      table: 17,
      covers: 4,
      server: "LUCA",
      check: "0412",
      seq: 412,
      sentAt: -2040,
      courses: [
        { name: "MAINS", state: "sent", at: -700, lines: [] },
        {
          name: "DOLCI",
          state: "fired",
          at: -250,
          lines: [
            { item: "tiramisu", qty: 2, seats: [1, 2] },
            { item: "affogato", qty: 2, seats: [3, 4] },
          ],
        },
      ],
    },
  },
];

/* ── derivations ──────────────────────────────────────────────────────────── */

export const AMBER_AT = 8 * 60;
export const LATE_AT = 14 * 60;

/** The course the clock is running on: the last one fired or called away. */
export function activeCourse(t: Ticket): Course | undefined {
  for (let i = t.courses.length - 1; i >= 0; i--) {
    const c = t.courses[i];
    if (c.state === "fired" || c.state === "away") return c;
  }
  return undefined;
}

/** The next course the expediter can fire. */
export function nextToFire(t: Ticket): Course | undefined {
  return t.courses.find((c) => c.state === "away" || c.state === "hold");
}

export function elapsed(t: Ticket, now: number) {
  const c = activeCourse(t);
  return Math.max(0, now - (c?.at ?? t.sentAt));
}

export type Age = "ok" | "amber" | "late";
export const ageOf = (secs: number): Age =>
  secs >= LATE_AT ? "late" : secs >= AMBER_AT ? "amber" : "ok";

export const mmss = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const clock = (rel: number, seconds = false) => {
  const t = SERVICE_START + Math.floor(rel);
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor(t / 60) % 60;
  const s = t % 60;
  const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return seconds ? `${hm}:${String(s).padStart(2, "0")}` : hm;
};

export const itemCount = (t: Ticket) =>
  t.courses.reduce((n, c) => n + (c.state === "sent" ? 0 : c.lines.reduce((a, l) => a + l.qty, 0)), 0);

export type StationLoad = {
  station: Station;
  cooking: number;
  held: number;
  /** Seconds until everything on the board for this station is plated. */
  clear: number;
};

export const BEHIND_AT = 10 * 60;
export const SLAMMED_AT = 15 * 60;

/**
 * Fired items count down from their cook time; held and called items count in
 * full, because they are coming. A station clears no faster than its longest
 * item, and no faster than its slots can turn the whole queue over.
 */
export function stationLoads(tickets: Ticket[], now: number): StationLoad[] {
  return STATIONS.map((station) => {
    let cooking = 0;
    let held = 0;
    let work = 0;
    let longest = 0;
    for (const t of tickets) {
      for (const c of t.courses) {
        if (c.state === "sent") continue;
        for (const l of c.lines) {
          const m = MENU[l.item];
          if (m.station !== station.id) continue;
          let remaining = m.cook;
          if (c.state === "fired") {
            cooking += l.qty;
            // Food past its cook time is plating: allow half a minute each.
            remaining = Math.max(30, m.cook - (now - (c.at ?? now)));
          } else held += l.qty;
          work += remaining * l.qty;
          longest = Math.max(longest, remaining);
        }
      }
    }
    const clear = Math.ceil(Math.max(longest, work / station.slots));
    return { station, cooking, held, clear };
  });
}

export type AllDayRow = { id: string; name: string; station: StationId; qty: number };

/** Every item on every open ticket, summed. Sent courses have left the pass. */
export function allDay(tickets: Ticket[]): AllDayRow[] {
  const rows = new Map<string, AllDayRow>();
  for (const t of tickets)
    for (const c of t.courses) {
      if (c.state === "sent") continue;
      for (const l of c.lines) {
        const m = MENU[l.item];
        const row = rows.get(m.id) ?? { id: m.id, name: m.name, station: m.station, qty: 0 };
        row.qty += l.qty;
        rows.set(m.id, row);
      }
    }
  const order = STATIONS.map((s) => s.id);
  return [...rows.values()].sort(
    (a, b) => b.qty - a.qty || order.indexOf(a.station) - order.indexOf(b.station) || a.name.localeCompare(b.name),
  );
}

export const countItem = (t: Ticket, item: string) =>
  t.courses.reduce(
    (n, c) => n + c.lines.reduce((a, l) => a + (l.item === item ? l.qty : 0), 0),
    0,
  );

/* ── deterministic paper ──────────────────────────────────────────────────── */

export function seeded(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** A torn bottom edge: uneven teeth, generated once per ticket from its id. */
export function tearPath(id: string) {
  const r = seeded(id + "tear");
  const teeth = 15;
  const pts: string[] = ["0 0", "100% 0"];
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100 + (i > 0 && i < teeth ? (r() - 0.5) * 2.4 : 0);
    const deep = i % 2 === 0;
    const y = deep ? 11 + r() * 3 : 1 + r() * 3;
    pts.push(`${x.toFixed(2)}% calc(100% - ${y.toFixed(1)}px)`);
  }
  return `polygon(${pts.join(", ")})`;
}

export const tiltOf = (id: string) => (seeded(id + "tilt")() - 0.5) * 1.4;

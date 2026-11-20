/* 0007 — Yard: the scenario.
   Halden Container Terminal, berth 4. QC 03 is working bay 34 of NORDLYS
   EXPRESS, voyage 214E. The hold of bay 34 is closed; the deck is 17 moves
   into a 48-move plan. Everything below is seeded, so server and client
   build the same yard. */

/* ── seeded randomness ───────────────────────────────────────────────────── */

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── operators: paint, not brand ─────────────────────────────────────────── */

export type OpId = "KST" | "OST" | "VRD" | "HLX" | "ARK" | "MRN";
export type Operator = {
  id: OpId;
  prefix: string;
  name: string;
  paint: string;
  /** Lettering colour painted on the doors. */
  ink: string;
};

export const OPS: Record<OpId, Operator> = {
  KST: { id: "KST", prefix: "KSTU", name: "Kestrel Line", paint: "#1f4a9c", ink: "#eef0ea" },
  OST: { id: "OST", prefix: "OSTU", name: "Østvær Shipping", paint: "#a63c24", ink: "#f3ece4" },
  VRD: { id: "VRD", prefix: "VRDU", name: "Verdal Feeder", paint: "#2e5a30", ink: "#eef0e6" },
  HLX: { id: "HLX", prefix: "HLXU", name: "Helix Container Line", paint: "#dd6a1e", ink: "#1f1712" },
  ARK: { id: "ARK", prefix: "ARKU", name: "Arken Leasing", paint: "#d8d4c8", ink: "#24262a" },
  MRN: { id: "MRN", prefix: "MRNU", name: "Morena Lines", paint: "#108089", ink: "#eef4f2" },
};
export const OP_ORDER: OpId[] = ["KST", "OST", "VRD", "HLX", "ARK", "MRN"];

/* ── ISO 6346 ────────────────────────────────────────────────────────────── */

const LETTER: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let v = 10;
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (v % 11 === 0) v++;
    out[c] = v++;
  }
  return out;
})();

export function checkDigit(owner: string, serial: string) {
  const chars = owner + serial;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = chars[i];
    const val = c >= "0" && c <= "9" ? Number(c) : LETTER[c];
    sum += val * 2 ** i;
  }
  return (sum % 11) % 10;
}

/* ── boxes ───────────────────────────────────────────────────────────────── */

export type Imdg = { cls: string; un: string; name: string };

export type Box = {
  /** "KSTU 482911 3" */
  id: string;
  owner: string;
  serial: string;
  check: number;
  op: OpId;
  feet: 20 | 40;
  iso: string;
  kind: string;
  /** Verified gross mass, tonnes. */
  vgm: number;
  pod: string;
  vessel: string;
  reefer?: { set: number };
  imdg?: Imdg;
  ow?: boolean;
};

export const IMDG: Record<string, Imdg> = {
  "3": { cls: "3", un: "1263", name: "Paint, flammable liquid" },
  "8": { cls: "8", un: "1789", name: "Hydrochloric acid" },
  "9": { cls: "9", un: "3077", name: "Env. hazardous substance, solid" },
  "2.1": { cls: "2.1", un: "1950", name: "Aerosols, flammable" },
  "5.1": { cls: "5.1", un: "1942", name: "Ammonium nitrate" },
};

export const PORTS: Record<string, string> = {
  SEGOT: "Gothenburg",
  DKAAR: "Aarhus",
  PLGDN: "Gdańsk",
  LTKLJ: "Klaipėda",
  DEHAM: "Hamburg",
  NLRTM: "Rotterdam",
  GBFXT: "Felixstowe",
  FIHEL: "Helsinki",
  EETLL: "Tallinn",
};

export const VESSEL = "NORDLYS EXPRESS";
export const VOYAGE = "214E";
const OTHER_VESSELS: { name: string; pods: string[] }[] = [
  { name: "SKAGEN TRADER 088W", pods: ["NLRTM", "GBFXT", "DEHAM"] },
  { name: "AURORA BALTICA 031N", pods: ["FIHEL", "EETLL"] },
  { name: "NORDLYS EXPRESS 214E", pods: ["SEGOT", "DKAAR", "PLGDN"] },
];

const usedSerials = new Set<string>();
function makeBox(
  r: () => number,
  o: {
    op: OpId;
    feet: 20 | 40;
    reefer?: boolean;
    vgm?: number;
    pod?: string;
    vessel?: string;
    imdg?: string;
  },
): Box {
  const op = OPS[o.op];
  let serial = "";
  do serial = String(Math.floor(r() * 900000) + 100000);
  while (usedSerials.has(op.prefix + serial));
  usedSerials.add(op.prefix + serial);
  const check = checkDigit(op.prefix, serial);
  const hc = r() < 0.62;
  const iso = o.reefer ? (o.feet === 40 ? "45R1" : "22R1") : o.feet === 40 ? (hc ? "45G1" : "42G1") : "22G1";
  const kind = o.reefer
    ? `${o.feet}′ reefer${o.feet === 40 ? ", high cube" : ""}`
    : o.feet === 40
      ? hc
        ? "40′ dry, high cube"
        : "40′ dry"
      : "20′ dry";
  const max = o.feet === 40 ? 30.4 : 27.6;
  const vgm = o.vgm ?? Math.round((5.5 + r() * (max - 5.5)) * 10) / 10;
  let vessel = o.vessel;
  let pod = o.pod;
  if (!vessel || !pod) {
    const v = OTHER_VESSELS[Math.floor(r() * OTHER_VESSELS.length)];
    vessel = vessel ?? v.name;
    pod = pod ?? v.pods[Math.floor(r() * v.pods.length)];
  }
  const sets = [-18, -25, 2, 13.3, -1.5, 5];
  const box: Box = {
    id: `${op.prefix} ${serial} ${check}`,
    owner: op.prefix,
    serial,
    check,
    op: o.op,
    feet: o.feet,
    iso,
    kind,
    vgm,
    pod,
    vessel,
  };
  if (o.reefer) box.reefer = { set: sets[Math.floor(r() * sets.length)] };
  if (o.imdg) box.imdg = IMDG[o.imdg];
  if (vgm > (o.feet === 40 ? 30 : 27)) box.ow = true;
  return box;
}

function pickOp(r: () => number, weights: number[] = [3, 3, 2, 3, 2, 2]): OpId {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < OP_ORDER.length; i++) {
    x -= weights[i];
    if (x < 0) return OP_ORDER[i];
  }
  return OP_ORDER[0];
}

/* ── geometry (plan units; a 20′ box is 28 long) ─────────────────────────── */

export const G = {
  W: 1064,
  H: 478,
  slot: 30,
  row: 12,
  boxW: 10.4,
  blockW: 180,
  blockH: 72,
  apronLaneX: 854,
  railA: 838,
  railB: 896,
  serviceX: 824,
  quayEdge: 906,
  hullX0: 916,
  hullX1: 1062,
  shipRow0: 925,
  shipPitch: 10.6,
  bayPitch: 62,
  bay34Y: 240,
} as const;

export const BLOCK_ROWS = ["A", "B", "C", "D"] as const;
export const BLOCK_COLS = [1, 2, 3, 4] as const;
export const ROWS = [1, 2, 3, 4, 5, 6] as const;

export type Block = { id: string; r: number; c: number; x: number; y: number; groups: (20 | 40)[] };

export const blockX = (c: number) => 24 + (c - 1) * 202;
export const blockY = (r: number) => 36 + r * 112;
/** The cantilever truck lane on the south side of a block. */
export const laneY = (b: Block) => b.y + G.blockH + 13;
export const rowY = (b: Block, row: number) => b.y + (row - 1) * G.row + G.row / 2;
/** Centre x of a bay: odd bays are 20′ slots, even bays straddle two of them. */
export const bayX = (b: Block, bay: number) =>
  bay % 2 === 1 ? b.x + ((bay - 1) / 2) * G.slot + G.slot / 2 : b.x + ((bay - 2) / 4) * 60 + 30;

export const pad2 = (n: number) => String(n).padStart(2, "0");

export type Stack = { key: string; block: string; bay: number; row: number; feet: 20 | 40 };

/* ── the ship ────────────────────────────────────────────────────────────── */

/** Rows as seen from aft: port on the left, which is also the quay side. */
export const SHIP_ROWS = [12, 10, 8, 6, 4, 2, 1, 3, 5, 7, 9, 11] as const;
export const HOLD_TIERS = [10, 8, 6, 4, 2] as const;
export const DECK_TIERS = [88, 86, 84, 82] as const;
/** Rows a hold tier reaches; the hull narrows towards the keel. */
export const holdRows = (tier: number) => (tier === 2 ? 6 : tier === 4 ? 8 : 10);
export const rowInHold = (tier: number, row: number) => row <= holdRows(tier);
export const shipRowX = (row: number) => G.shipRow0 + SHIP_ROWS.indexOf(row as never) * G.shipPitch + G.shipPitch / 2;
export const shipBayY = (bay: number) => G.bay34Y + ((bay - 34) / 4) * G.bayPitch;

/* ── the yard ────────────────────────────────────────────────────────────── */

export type Yard = Record<string, Record<string, Box[]>>;

export type Rehandle = { box: Box; from: string; to: string; fromTier: number; toTier: number };

export type Move = {
  n: number;
  box: Box;
  block: string;
  bay: number;
  row: number;
  key: string;
  /** Tier the box is dug out of, counted from the ground. */
  tier: number;
  from: string;
  to: { bay: 34; row: number; tier: number };
  toLabel: string;
  rehandles: Rehandle[];
  gantryFrom: number;
  gantryTo: number;
  trolleyFrom: number;
  truck: string;
  /** Cycle time on the scenario clock, minutes. */
  cycle: number;
  /** Completion time on the scenario clock, minutes after midnight. */
  done: number;
};

const r = mulberry(0x0be27);

export const BLOCKS: Block[] = [];
for (let ri = 0; ri < 4; ri++)
  for (const c of BLOCK_COLS) {
    const groups: (20 | 40)[] = [0, 1, 2].map(() => (r() < 0.62 ? 40 : 20));
    if (c === 4) groups[2] = 40;
    BLOCKS.push({ id: `${BLOCK_ROWS[ri]}${c}`, r: ri, c, x: blockX(c), y: blockY(ri), groups });
  }
// Make sure the plan has enough 40′ ground to stage a 48-move deck.
BLOCKS.forEach((b, i) => {
  if (i % 3 === 0) b.groups[1] = 40;
});
export const BLOCK_BY_ID: Record<string, Block> = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));

export const STACKS: Stack[] = [];
for (const b of BLOCKS)
  b.groups.forEach((feet, g) => {
    const bays = feet === 40 ? [g * 4 + 2] : [g * 4 + 1, g * 4 + 3];
    for (const bay of bays)
      for (const row of ROWS)
        STACKS.push({ key: `${b.id}-${pad2(bay)}-${pad2(row)}`, block: b.id, bay, row, feet });
  });
export const STACK_BY_KEY: Record<string, Stack> = Object.fromEntries(STACKS.map((s) => [s.key, s]));

/** Reefer racks: rows 1 and 2 of the column-1 blocks, nearest the substation. */
export const isReeferRow = (s: Stack) => s.block.endsWith("1") && s.row <= 2;

/* ── the plan: 48 deck moves for bay 34 ──────────────────────────────────── */

export const TOTAL = 48;
export const DONE_AT_START = 17;
/** Scenario clock: the sequence started at 13:22. */
export const SEQ_START = 13 * 60 + 22;

type Target = { row: number; tier: number; op: OpId; vgm: number; pod: string; reefer?: boolean; imdg?: string };
const targets: Target[] = [];
for (const tier of [82, 84, 86, 88]) {
  for (const row of SHIP_ROWS) {
    const band =
      tier === 82 ? [22, 29.4] : tier === 84 ? [17, 26] : tier === 86 ? [12, 21] : [6.5, 15.5];
    const pod =
      tier === 82 ? "PLGDN" : tier === 84 ? (row > 6 ? "DKAAR" : "PLGDN") : tier === 86 ? "DKAAR" : "SEGOT";
    targets.push({
      row,
      tier,
      op: pickOp(r, [3, 3, 2, 3, 1, 2]),
      vgm: Math.round((band[0] + r() * (band[1] - band[0])) * 10) / 10,
      pod,
      reefer: (tier === 82 || tier === 84) && row <= 4,
    });
  }
}
// The cases a planner actually has to look at.
targets[4].vgm = 31.2; // overweight, bottom of the deck stack
targets[6].vgm = 30.6;
targets[23].imdg = "3"; // 84-11, outboard, away from the reefers
targets[33].imdg = "9";
targets[36].imdg = "8"; // 88-12
targets[41].imdg = "2.1";

/** 1-based move numbers whose box is buried, and by how many. */
const BURIED: Record<number, number> = { 22: 1, 29: 2, 37: 1, 44: 1 };

// Fill the ground first.
const yard0: Yard = {};
for (const b of BLOCKS) yard0[b.id] = {};
const heightOf = () => {
  const x = r();
  return x < 0.06 ? 0 : x < 0.16 ? 1 : x < 0.34 ? 2 : x < 0.62 ? 3 : x < 0.86 ? 4 : 5;
};
for (const s of STACKS) {
  const reefer = isReeferRow(s);
  const h = heightOf();
  yard0[s.block][s.key] = Array.from({ length: h }, () =>
    makeBox(r, {
      op: reefer ? pickOp(r, [1, 1, 1, 1, 4, 2]) : pickOp(r),
      feet: s.feet,
      reefer,
      imdg: !reefer && r() < 0.035 ? ["3", "8", "9", "2.1"][Math.floor(r() * 4)] : undefined,
    }),
  );
}

// Then stage each target in its own 40′ stack, spread across the blocks.
const forty = STACKS.filter((s) => s.feet === 40);
const shuffled = [...forty];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
const taken = new Set<string>();
const targetStack: string[] = [];
const targetBox: Box[] = [];
let lastBlock = "";
for (let i = 0; i < TOTAL; i++) {
  const t = targets[i];
  const need = BURIED[i + 1] ?? 0;
  const pick = shuffled.find(
    (s) => !taken.has(s.key) && isReeferRow(s) === !!t.reefer && s.block !== lastBlock && s.row !== 1,
  ) ??
    shuffled.find((s) => !taken.has(s.key) && isReeferRow(s) === !!t.reefer)!;
  taken.add(pick.key);
  lastBlock = pick.block;
  targetStack.push(pick.key);
  const box = makeBox(r, {
    op: t.op,
    feet: 40,
    reefer: t.reefer,
    vgm: t.vgm,
    pod: t.pod,
    vessel: `${VESSEL} ${VOYAGE}`,
    imdg: t.imdg,
  });
  targetBox.push(box);
  const stack = yard0[pick.block][pick.key];
  const below = stack.slice(0, Math.min(stack.length, 4 - need));
  const above =
    i + 1 === 29
      ? (["HLX", "OST"] as OpId[]).reverse().map((op) => makeBox(r, { op, feet: 40, reefer: !!t.reefer }))
      : Array.from({ length: need }, () => makeBox(r, { op: pickOp(r), feet: 40, reefer: !!t.reefer }));
  yard0[pick.block][pick.key] = [...below, box, ...above];
}

/* ── hold of bay 34, already loaded ─────────────────────────────────────── */

export type ShipSlot = { row: number; tier: number; box: Box };
export const HOLD: ShipSlot[] = [];
for (const tier of [2, 4, 6, 8, 10])
  for (const row of SHIP_ROWS)
    if (rowInHold(tier, row))
      HOLD.push({
        row,
        tier,
        box: makeBox(r, {
          op: pickOp(r, [3, 3, 2, 3, 2, 2]),
          feet: 40,
          vgm: Math.round((tier <= 4 ? 24 + r() * 6 : 14 + r() * 12) * 10) / 10,
          pod: tier <= 6 ? "LTKLJ" : "PLGDN",
          vessel: `${VESSEL} ${VOYAGE}`,
        }),
      });

/** Neighbouring bays on deck, for the top-down ship. One entry per row, top box only. */
export const OTHER_BAYS: { bay: number; tops: (OpId | null)[] }[] = [18, 22, 26, 30, 38, 42, 46, 50].map(
  (bay) => ({
    bay,
    tops: SHIP_ROWS.map(() => (r() < 0.12 ? null : pickOp(r))),
  }),
);

/* ── replay the plan once, so every state is a lookup ───────────────────── */

const cloneBlock = (y: Yard, block: string): Yard => ({ ...y, [block]: { ...y[block] } });

export const MOVES: Move[] = [];
/** SNAP[m] is the yard before move m (0-based). SNAP[TOTAL] is the yard after the last. */
export const SNAP: Yard[] = [];
/** Gantry x per block before move m. */
export const GANTRY: Record<string, number>[] = [];
export const TROLLEY: Record<string, number>[] = [];

{
  let y = yard0;
  const gx: Record<string, number> = {};
  const ty: Record<string, number> = {};
  for (const b of BLOCKS) {
    gx[b.id] = b.x + 15 + Math.floor(r() * 6) * 30;
    ty[b.id] = b.y + G.blockH / 2;
  }
  let clock = SEQ_START;
  const trucks = ["TT 11", "TT 14", "TT 07", "TT 19", "TT 03", "TT 16"];
  for (let i = 0; i < TOTAL; i++) {
    SNAP.push(y);
    GANTRY.push({ ...gx });
    TROLLEY.push({ ...ty });
    const key = targetStack[i];
    const st = STACK_BY_KEY[key];
    const b = BLOCK_BY_ID[st.block];
    const t = targets[i];
    y = cloneBlock(y, st.block);
    const blockStacks = y[st.block];
    const stack = [...blockStacks[key]];
    const idx = stack.indexOf(targetBox[i]);
    const box = stack[idx];
    const rehandles: Rehandle[] = [];
    // Dig: top first, each to the nearest row in the same bay with room that no later move needs.
    for (let k = stack.length - 1; k > idx; k--) {
      const over = stack[k];
      const candidates = ROWS.filter((row) => row !== st.row)
        .map((row) => `${st.block}-${pad2(st.bay)}-${pad2(row)}`)
        .filter((ck) => !targetStack.slice(i + 1).includes(ck) && (blockStacks[ck]?.length ?? 0) < 5)
        .sort(
          (a, c) =>
            Math.abs(STACK_BY_KEY[a].row - st.row) - Math.abs(STACK_BY_KEY[c].row - st.row) ||
            STACK_BY_KEY[a].row - STACK_BY_KEY[c].row,
        );
      const to = candidates[0];
      const dest = [...blockStacks[to], over];
      blockStacks[to] = dest;
      rehandles.push({ box: over, from: key, to, fromTier: k + 1, toTier: dest.length });
    }
    blockStacks[key] = stack.slice(0, idx);
    const cycle = Math.round((1.75 + r() * 0.55 + rehandles.length * 1.35) * 100) / 100;
    clock += cycle;
    const bx = bayX(b, st.bay);
    MOVES.push({
      n: i + 1,
      box,
      block: st.block,
      bay: st.bay,
      row: st.row,
      key,
      tier: idx + 1,
      from: `${key}-${idx + 1}`,
      to: { bay: 34, row: t.row, tier: t.tier },
      toLabel: `34-${pad2(t.row)}-${t.tier}`,
      rehandles,
      gantryFrom: gx[st.block],
      gantryTo: bx,
      trolleyFrom: ty[st.block],
      truck: trucks[i % trucks.length],
      cycle,
      done: clock,
    });
    gx[st.block] = bx;
    ty[st.block] = laneY(b);
  }
  SNAP.push(y);
  GANTRY.push({ ...gx });
  TROLLEY.push({ ...ty });
}

/* ── phases of one move (ms at 1×) ───────────────────────────────────────── */

export type PhaseKind = "travel" | "rehandle" | "lift" | "haul" | "quay";
export type Phase = { kind: PhaseKind; dur: number; i?: number };

export const PHASE_LABEL: Record<PhaseKind, string> = {
  travel: "Gantry travelling",
  rehandle: "Rehandling",
  lift: "Lifting",
  haul: "Hauling to quay",
  quay: "QC 03 loading",
};

export function phasesOf(m: Move): Phase[] {
  return [
    { kind: "travel", dur: 1150 },
    ...m.rehandles.map((_, i) => ({ kind: "rehandle" as const, dur: 1500, i })),
    { kind: "lift", dur: 1300 },
    { kind: "haul", dur: 2100 },
    { kind: "quay", dur: 1400 },
  ];
}
export const PHASES = MOVES.map(phasesOf);
export const MOVE_MS = PHASES.map((ps) => ps.reduce((a, p) => a + p.dur, 0));

/** Yard as drawn during phase `ph` of move `m`: anything in the air is left out. */
const yardCache = new Map<string, Yard>();
export function yardAt(m: number, ph: number): Yard {
  if (m >= TOTAL) return SNAP[TOTAL];
  const k = `${m}:${ph}`;
  const hit = yardCache.get(k);
  if (hit) return hit;
  const mv = MOVES[m];
  const phase = PHASES[m][ph];
  let y = SNAP[m];
  if (phase.kind !== "travel") {
    y = cloneBlock(y, mv.block);
    const bs = y[mv.block];
    const done = phase.kind === "rehandle" ? phase.i! : mv.rehandles.length;
    const src = [...SNAP[m][mv.block][mv.key]];
    // Source loses the target and everything above it that has been lifted.
    const keep = phase.kind === "rehandle" ? src.length - done - 1 : mv.tier - 1;
    bs[mv.key] = src.slice(0, keep);
    for (let j = 0; j < done; j++) {
      const rh = mv.rehandles[j];
      bs[rh.to] = [...bs[rh.to], rh.box];
    }
  }
  yardCache.set(k, y);
  return y;
}

/** Where a box is in a yard, if it is there at all. */
export function locate(y: Yard, id: string) {
  for (const block in y)
    for (const key in y[block]) {
      const i = y[block][key].findIndex((b) => b.id === id);
      if (i >= 0) return { key, tier: i + 1, height: y[block][key].length };
    }
  return null;
}

export const MOVE_BY_BOX: Record<string, number> = Object.fromEntries(MOVES.map((m, i) => [m.box.id, i]));

/* ── formatting ──────────────────────────────────────────────────────────── */

export const hhmm = (min: number) => {
  const m = Math.floor(min) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};
export const tonnes = (t: number) => t.toFixed(1);

/* ── colour ──────────────────────────────────────────────────────────────── */

function hex(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Seen from above: a five-high stack catches the light, a one-high sits in the shade of its neighbours. */
export function shade(paint: string, tier: number) {
  const [r0, g0, b0] = hex(paint);
  const [r1, g1, b1] = [38, 40, 42];
  const k = [0.6, 0.43, 0.27, 0.13, 0][Math.max(0, Math.min(4, tier - 1))];
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  return `rgb(${mix(r0, r1)} ${mix(g0, g1)} ${mix(b0, b1)})`;
}

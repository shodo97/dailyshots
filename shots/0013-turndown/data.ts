/* 0013 Turndown: the scenario.
   Hotel Meridiana, Thursday 19 November, 11:20. Heavy checkout day: 112 rooms
   over eight guest floors, six attendants on, one called in sick, and fifteen
   arrivals, seven of them asking for early check-in before 15:00. */

export type Status = "occ" | "vd" | "cln" | "vc" | "vi" | "ooo" | "dnd";

export const STATUS_ORDER: Status[] = ["vi", "vc", "cln", "vd", "occ", "dnd", "ooo"];

export const STATUS: Record<Status, { code: string; label: string; short: string; legend: string }> = {
  vi: { code: "VI", label: "Inspected, ready", short: "ready", legend: "Inspected" },
  vc: { code: "VC", label: "Clean, to inspect", short: "clean, to inspect", legend: "To inspect" },
  cln: { code: "CLN", label: "Cleaning", short: "cleaning", legend: "Cleaning" },
  vd: { code: "VD", label: "Vacant dirty", short: "vacant dirty", legend: "Vacant dirty" },
  occ: { code: "OCC", label: "Occupied", short: "occupied", legend: "Occupied" },
  dnd: { code: "DND", label: "Do not disturb", short: "do not disturb", legend: "Do not disturb" },
  ooo: { code: "OOO", label: "Out of order", short: "out of order", legend: "Out of order" },
};

/** Sim time is minutes after midnight. */
export const START = 11 * 60 + 20;
export const CHECKIN = 15 * 60;

export const MIN_PER_CREDIT = 30;
export const INSPECT_EVERY = 6;

export const hhmm = (t: number) => {
  const m = Math.floor(t + 1e-6);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const credit = (n: number) => n.toFixed(1);

export type RoomType = "Corner Suite" | "Deluxe King" | "Classic Double" | "Twin" | "Junior Suite";

export type Room = {
  id: number;
  floor: number;
  col: number;
  type: RoomType;
  status: Status;
  /** Status the blind rolls down over; "glass" before the board opens. */
  prev: Status | "glass";
  /** Bumped on every status change, so the blind remounts and rolls again. */
  rev: number;
  /** Occupied rooms: is the guest staying tonight, or leaving today. */
  stay: "stayover" | "dueout" | null;
  serviced: boolean;
  departAt: number | null;
  departedAt: number | null;
  guest: string | null;
  dndUntil: number | null;
  /** Cleaning progress 0..1, and the credit the job is worth. */
  progress: number;
  job: number;
  assignee: number | null;
  arrival: number | null;
  notes: string[];
  cleanedAt: number | null;
  ooo: string | null;
};

export type Arrival = {
  i: number;
  name: string;
  party: string;
  eta: number;
  room: number;
  early: boolean;
};

export type Shape = "circle" | "triangle" | "square" | "diamond" | "hexagon" | "half";

export type Attendant = {
  id: number;
  name: string;
  first: string;
  section: string;
  color: string;
  shape: Shape;
  done: number;
  breakUntil: number | null;
};

const t = (h: number, m: number) => h * 60 + m;

export const ATTENDANTS: Attendant[] = [
  { id: 1, name: "Rosa Ferreira", first: "Rosa", section: "Floors 2–3", color: "#cdb8ea", shape: "circle", done: 5.5, breakUntil: null },
  { id: 2, name: "Ama Owusu", first: "Ama", section: "Floor 4", color: "#f6bf94", shape: "triangle", done: 6, breakUntil: null },
  { id: 3, name: "Marek Novák", first: "Marek", section: "Floor 5", color: "#cfe39f", shape: "square", done: 5, breakUntil: null },
  { id: 4, name: "Lin Yao", first: "Lin", section: "Floor 6", color: "#f3b5c8", shape: "diamond", done: 4.5, breakUntil: null },
  { id: 5, name: "Dolores Ruiz", first: "Dolores", section: "Floor 7", color: "#a6d8ea", shape: "hexagon", done: 5.5, breakUntil: null },
  { id: 6, name: "Teo Marchetti", first: "Teo", section: "Floater", color: "#e9d29a", shape: "half", done: 3, breakUntil: t(11, 45) },
];

export const ARRIVALS: Arrival[] = [
  { name: "Lindqvist", party: "2 adults", eta: t(12, 0), room: 207 },
  { name: "Moreau", party: "1 adult", eta: t(12, 45), room: 811 },
  { name: "Okafor", party: "2 adults, 1 child", eta: t(13, 0), room: 512 },
  { name: "Takahashi", party: "2 adults", eta: t(13, 30), room: 903 },
  { name: "Brennan", party: "1 adult", eta: t(14, 0), room: 406 },
  { name: "Salazar", party: "2 adults", eta: t(14, 15), room: 610 },
  { name: "Achterberg", party: "2 adults", eta: t(14, 30), room: 312 },
  { name: "Petrov", party: "1 adult", eta: t(15, 0), room: 714 },
  { name: "Nakamura", party: "2 adults", eta: t(15, 30), room: 209 },
  { name: "Esposito", party: "3 adults", eta: t(16, 0), room: 905 },
  { name: "Wright", party: "2 adults", eta: t(16, 30), room: 508 },
  { name: "Dubois", party: "1 adult", eta: t(17, 15), room: 613 },
  { name: "Kowalczyk", party: "2 adults", eta: t(18, 0), room: 304 },
  { name: "Oyelaran", party: "2 adults", eta: t(19, 30), room: 813 },
  { name: "Fitzgerald", party: "1 adult", eta: t(21, 0), room: 402 },
].map((a, i) => ({ ...a, i, early: a.eta < CHECKIN }));

/* One letter per room, 01 to 14.
   I inspected · C clean · D vacant dirty · O stayover · S stayover serviced
   U occupied, due out · N do not disturb · X out of order · K being cleaned */
const FLOORS: Record<number, string> = {
  9: "IODODUIDOIDOIS",
  8: "DOIDOODINODIDC",
  7: "OSKIDOIUDSIOXD",
  6: "IDOSNDIOSCDIDO",
  5: "SODIOKDCIUODSI",
  4: "IUSDOKIDSCODIX",
  3: "ODSINODKIUSDOI",
  2: "ISISIDISISICDI",
};

const DEPARTURES: Record<number, number> = {
  310: t(11, 22),
  510: t(11, 50),
  906: t(12, 0),
  708: t(12, 10),
  402: t(13, 0),
};

const OOO: Record<number, string> = {
  414: "AC compressor. Engineering back 14:00",
  713: "Ceiling water damage. Closed to Monday",
};

const DND_UNTIL: Record<number, number | null> = {
  305: t(12, 40),
  605: null,
  809: t(13, 15),
};

const NOTES: Record<number, string[]> = {
  512: ["Reopened 11:05, early departure", "Cot for 1 child"],
  811: ["Feather-free bedding"],
  903: ["Extra pillows", "Anniversary card on desk"],
  207: ["Ground-floor parking pass"],
  406: ["Late arrival of luggage"],
  610: ["Pet: small dog, bring bowl and mat"],
  312: ["Twin beds split, not joined"],
  714: ["Hypoallergenic pillows"],
  905: ["Connecting door to 904 locked"],
  402: ["Late checkout 13:00"],
  906: ["Late checkout 12:00"],
  308: ["Pet: small dog, deep-clean upholstery"],
  604: ["No housekeeping before 12:00"],
  706: ["Guest asked for towels only"],
  210: ["Extra pillows"],
  813: ["Baby bath requested"],
  908: ["Minibar restock"],
  502: ["Extra pillows"],
  611: ["Spill on carpet, flag to engineering"],
  805: ["Pet: cat, keep door closed"],
  912: ["Fragrance-free products"],
};

const GUESTS = [
  "Hartmann", "Silva", "Ivanova", "Becker", "Rossi", "Laurent", "Jansen", "Kaur", "Moretti", "Nilsen",
  "Duarte", "Weber", "Castillo", "Horvat", "Sato", "Bianchi", "Murphy", "Lund", "Ferraro", "Adeyemi",
  "Vogel", "Romano", "Costa", "Novak", "Fischer", "Greco", "Haas", "Park", "Quinn", "Ricci",
];

function roomType(floor: number, col: number): RoomType {
  if (col === 1 || col === 14) return floor === 9 ? "Junior Suite" : "Corner Suite";
  if (floor === 9) return col % 3 === 0 ? "Deluxe King" : "Junior Suite";
  if (col === 7 || col === 8) return "Twin";
  return col % 2 === 0 ? "Deluxe King" : "Classic Double";
}

/** Initial jobs in hand: who is cleaning what at 11:20, and how far along. */
export const IN_HAND: Record<number, { room: number; progress: number } | null> = {
  1: { room: 308, progress: 0.42 },
  2: { room: 406, progress: 0.95 },
  3: { room: 506, progress: 0.2 },
  4: null,
  5: { room: 703, progress: 0.8 },
  6: null,
};

/** Each attendant's queue at 11:20, as the morning board was written. */
export const QUEUES: Record<number, number[]> = {
  1: [312, 302, 307, 206, 213, 310, 301, 306, 313, 305],
  2: [404, 408, 412, 402, 405, 411],
  3: [503, 507, 510, 502, 505, 511],
  4: [611, 602, 606, 613, 603, 608, 614, 605],
  5: [714, 705, 709, 708, 701, 706, 712],
  6: [],
};

export function buildRooms(): Room[] {
  const rooms: Room[] = [];
  let g = 0;
  const arrivalByRoom = new Map(ARRIVALS.map((a) => [a.room, a.i]));
  for (let floor = 9; floor >= 2; floor--) {
    const row = FLOORS[floor];
    for (let col = 1; col <= 14; col++) {
      const id = floor * 100 + col;
      const ch = row[col - 1];
      const guest = GUESTS[(g++ * 7 + floor) % GUESTS.length];
      const base: Room = {
        id,
        floor,
        col,
        type: roomType(floor, col),
        status: "vi",
        prev: "glass",
        rev: 0,
        stay: null,
        serviced: false,
        departAt: null,
        departedAt: null,
        guest: null,
        dndUntil: null,
        progress: 0,
        job: 0,
        assignee: null,
        arrival: arrivalByRoom.get(id) ?? null,
        notes: NOTES[id] ?? [],
        cleanedAt: null,
        ooo: null,
      };
      switch (ch) {
        case "I":
          base.status = "vi";
          base.cleanedAt = t(8, 30) + ((id * 13) % 150);
          break;
        case "C":
          base.status = "vc";
          base.cleanedAt = t(10, 20) + ((id * 7) % 55);
          break;
        case "D":
          base.status = "vd";
          base.guest = guest;
          base.departedAt = t(8, 40) + ((id * 11) % 140);
          break;
        case "O":
          base.status = "occ";
          base.stay = "stayover";
          base.guest = guest;
          break;
        case "S":
          base.status = "occ";
          base.stay = "stayover";
          base.serviced = true;
          base.guest = guest;
          break;
        case "U":
          base.status = "occ";
          base.stay = "dueout";
          base.guest = guest;
          base.departAt = DEPARTURES[id] ?? null;
          break;
        case "N":
          base.status = "dnd";
          base.stay = "stayover";
          base.guest = guest;
          base.dndUntil = DND_UNTIL[id] ?? null;
          break;
        case "X":
          base.status = "ooo";
          base.ooo = OOO[id] ?? "Engineering hold";
          break;
        case "K":
          base.status = "cln";
          base.guest = guest;
          base.stay = id === 506 ? "stayover" : null;
          base.departedAt = id === 506 ? null : t(9, 50) + ((id * 3) % 40);
          base.job = id === 506 ? 0.5 : 1;
          break;
      }
      if (id === 512) base.departedAt = t(11, 5);
      rooms.push(base);
    }
  }
  return rooms;
}

/* ── facade geometry, in grid units ───────────────────────────────────────── */

export const END = 0.6;
export const CORE = 1.3;
export const SPAN = END * 2 + 14 + CORE;
export const CORE_X = END + 7 + CORE / 2;
export const colX = (col: number) => (col <= 7 ? END + col - 0.5 : END + 7 + CORE + (col - 7) - 0.5);

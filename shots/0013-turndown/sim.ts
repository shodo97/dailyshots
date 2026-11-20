/* The board's engine: scenario time, carts, cleaning, departures, inspection.
   Everything is deterministic from 11:20, so the poster frame and the hover
   loop always show the same morning. */

import {
  ARRIVALS,
  ATTENDANTS,
  CHECKIN,
  CORE_X,
  INSPECT_EVERY,
  IN_HAND,
  MIN_PER_CREDIT,
  QUEUES,
  START,
  STATUS,
  buildRooms,
  colX,
  credit,
  hhmm,
  type Attendant,
  type Room,
  type Status,
} from "./data";

export type Pos = { f: number; x: number };
export type Phase = "idle" | "wait" | "travel" | "clean" | "break";

export type Crew = Attendant & {
  queue: number[];
  current: number | null;
  phase: Phase;
  pos: Pos;
  path: Pos[];
};

export type Tone = "info" | "good" | "warn" | "error";
export type LogItem = { id: number; t: number; text: string; tone: Tone };

/** Minutes of scenario time per grid unit along a corridor, and per floor in the lift. */
const WALK = 0.2;
const LIFT = 0.45;
const GROUND: Pos = { f: 1, x: CORE_X };

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export const roomPos = (r: Room): Pos => ({ f: r.floor, x: colX(r.col) });

const inShaft = (p: Pos) => Math.abs(p.x - CORE_X) < 1e-4;

function route(from: Pos, to: Pos): Pos[] {
  if (!inShaft(from) && Math.abs(from.f - to.f) < 1e-4) return [to];
  const pts: Pos[] = [];
  if (!inShaft(from)) pts.push({ f: from.f, x: CORE_X });
  pts.push({ f: to.f, x: CORE_X });
  if (!inShaft(to)) pts.push(to);
  return pts;
}

function travelTime(from: Pos, path: Pos[]) {
  let m = 0;
  let p = from;
  for (const q of path) {
    m += Math.abs(q.x - p.x) * WALK + Math.abs(q.f - p.f) * LIFT;
    p = q;
  }
  return m;
}

/** Credit a room is worth as a job: checkout 1.0, stayover 0.5, nothing if there is nothing to do. */
export function jobCredit(r: Room) {
  if (r.status === "vd") return 1;
  if (r.status === "occ" && r.stay === "dueout") return 1;
  if ((r.status === "occ" || r.status === "dnd") && r.stay === "stayover" && !r.serviced) return 0.5;
  return 0;
}

const workable = (r: Room) => r.status === "vd" || (r.status === "occ" && r.stay === "stayover" && !r.serviced);

/** Lower is sooner. Early check-ins by ETA, then later arrivals, then everything else. */
export function rank(r: Room) {
  const a = r.arrival == null ? null : ARRIVALS[r.arrival];
  if (a) return (a.early ? 0 : 2000) + a.eta;
  return r.status === "vd" || r.stay === "dueout" ? 5000 : 6000;
}

export type Result = { ok: boolean; text: string };

export class Sim {
  t = START;
  rooms: Room[];
  byId = new Map<number, Room>();
  crew: Crew[];
  log: LogItem[] = [];
  private seq = 0;
  private inspectAcc = INSPECT_EVERY - 3;

  constructor() {
    this.rooms = buildRooms();
    for (const r of this.rooms) this.byId.set(r.id, r);
    this.crew = ATTENDANTS.map((a) => {
      const hand = IN_HAND[a.id];
      const queue = [...QUEUES[a.id]];
      const c: Crew = { ...a, queue, current: null, phase: "idle", pos: { ...GROUND }, path: [] };
      if (hand) {
        const r = this.room(hand.room);
        c.current = r.id;
        c.phase = "clean";
        c.pos = roomPos(r);
        r.progress = hand.progress;
        r.assignee = a.id;
      }
      for (const id of queue) this.room(id).assignee = a.id;
      return c;
    });
    // Lin is already in the lift on her way up to 611.
    const lin = this.crew[3];
    lin.pos = { f: 3.3, x: CORE_X };
    lin.current = lin.queue.shift()!;
    lin.phase = "travel";
    lin.path = route(lin.pos, roomPos(this.room(lin.current)));
    const teo = this.crew[5];
    teo.phase = "break";
    this.push("Teo on break until 11:45. Nadia Haddad off sick, floors 8–9 uncovered", "warn");
  }

  room(id: number) {
    return this.byId.get(id)!;
  }

  private push(text: string, tone: Tone = "info") {
    this.log.unshift({ id: ++this.seq, t: this.t, text, tone });
    if (this.log.length > 40) this.log.pop();
  }

  private setStatus(r: Room, s: Status) {
    if (r.status === s) return;
    r.prev = r.status;
    r.status = s;
    r.rev++;
  }

  get done() {
    return this.t >= CHECKIN;
  }

  /** Advance by `dm` scenario minutes. Returns true when something discrete changed. */
  step(dm: number): boolean {
    if (this.done) return false;
    let dirty = false;
    const before = Math.floor(this.t);
    this.t = Math.min(CHECKIN, this.t + dm);
    if (Math.floor(this.t) !== before) dirty = true;

    for (const r of this.rooms) {
      if (r.status === "occ" && r.stay === "dueout" && r.departAt != null && this.t >= r.departAt) {
        this.setStatus(r, "vd");
        r.stay = null;
        r.departedAt = r.departAt;
        r.departAt = null;
        this.push(`${r.id} checked out, ${r.guest}. Vacant dirty`, "info");
        dirty = true;
      }
      if (r.status === "dnd" && r.dndUntil != null && this.t >= r.dndUntil) {
        this.setStatus(r, "occ");
        r.dndUntil = null;
        this.push(`${r.id} released Do Not Disturb`, "info");
        dirty = true;
      }
    }

    this.inspectAcc += dm;
    if (this.inspectAcc >= INSPECT_EVERY) {
      const pending = this.rooms.filter((r) => r.status === "vc").sort((a, b) => rank(a) - rank(b) || (a.cleanedAt ?? 0) - (b.cleanedAt ?? 0));
      if (pending.length) {
        const r = pending[0];
        this.setStatus(r, "vi");
        const a = r.arrival == null ? null : ARRIVALS[r.arrival];
        this.push(`Giulia inspected ${r.id}. Ready${a ? ` for ${a.name}, ${hhmm(a.eta)}` : ""}`, "good");
        this.inspectAcc = 0;
        dirty = true;
      } else {
        this.inspectAcc = INSPECT_EVERY - 2;
      }
    }

    for (const c of this.crew) if (this.advance(c, dm)) dirty = true;
    return dirty;
  }

  private advance(c: Crew, dm: number): boolean {
    let dirty = false;
    let left = dm;
    if (c.phase === "break") {
      if (c.breakUntil != null && this.t >= c.breakUntil) {
        c.breakUntil = null;
        c.phase = "idle";
        this.push(`${c.first} back from break${c.queue.length ? "" : ", nothing assigned"}`, c.queue.length ? "info" : "warn");
        dirty = true;
      } else return false;
    }
    if (c.phase === "idle" || c.phase === "wait") {
      if (this.pick(c)) dirty = true;
    }
    if (c.phase === "travel") {
      while (left > 0 && c.path.length) {
        const q = c.path[0];
        const cost = Math.abs(q.x - c.pos.x) * WALK + Math.abs(q.f - c.pos.f) * LIFT;
        if (cost <= left) {
          c.pos = { ...q };
          c.path.shift();
          left -= cost;
        } else {
          const k = left / cost;
          c.pos = { f: c.pos.f + (q.f - c.pos.f) * k, x: c.pos.x + (q.x - c.pos.x) * k };
          left = 0;
        }
      }
      if (!c.path.length && c.current != null) {
        const r = this.room(c.current);
        r.job = jobCredit(r);
        r.progress = 0;
        this.setStatus(r, "cln");
        c.phase = "clean";
        dirty = true;
      }
    }
    if (c.phase === "clean" && c.current != null && left > 0) {
      const r = this.room(c.current);
      r.progress = Math.min(1, r.progress + left / (r.job * MIN_PER_CREDIT));
      if (r.progress >= 1) {
        c.done += r.job;
        r.assignee = null;
        r.cleanedAt = this.t;
        if (r.stay === "stayover") {
          r.serviced = true;
          this.setStatus(r, "occ");
          this.push(`${c.first} serviced stayover ${r.id}`, "info");
        } else {
          this.setStatus(r, "vc");
          this.push(`${c.first} finished ${r.id}. Clean, to inspect`, "good");
        }
        r.progress = 0;
        c.current = null;
        c.phase = "idle";
        this.pick(c);
        dirty = true;
      }
    }
    return dirty;
  }

  /** Take the first job in the queue that can be started now. */
  private pick(c: Crew): boolean {
    const i = c.queue.findIndex((id) => workable(this.room(id)));
    const was = c.phase;
    if (i < 0) {
      c.phase = c.queue.length ? "wait" : "idle";
      return was !== c.phase;
    }
    const id = c.queue.splice(i, 1)[0];
    c.current = id;
    c.phase = "travel";
    c.path = route(c.pos, roomPos(this.room(id)));
    return true;
  }

  /* ── supervisor actions ─────────────────────────────────────────────────── */

  assign(roomId: number, crewId: number): Result {
    const r = this.room(roomId);
    const c = this.crew[crewId - 1];
    const fail = (text: string): Result => {
      this.push(text, "error");
      return { ok: false, text };
    };
    if (r.status === "ooo") return fail(`${r.id} is out of order: ${r.ooo}`);
    if (r.status === "dnd") return fail(`${r.id} is on Do Not Disturb. Assign it once the guest releases it`);
    if (r.status === "cln") {
      const by = this.crew.find((k) => k.current === r.id);
      return fail(`${r.id} is already being cleaned by ${by?.first ?? "someone"}, ${Math.round(r.progress * 100)}%`);
    }
    if (r.status === "vc" || r.status === "vi") return fail(`${r.id} is already clean (${STATUS[r.status].code})`);
    if (r.status === "occ" && r.serviced) return fail(`${r.id} was serviced at ${hhmm(r.cleanedAt ?? START)}`);
    if (r.assignee === c.id) return fail(`${r.id} is already with ${c.first}`);

    // Take it away from whoever had it.
    const from = r.assignee == null ? null : this.crew[r.assignee - 1];
    if (from) {
      from.queue = from.queue.filter((id) => id !== r.id);
      if (from.current === r.id) {
        from.current = null;
        from.phase = "idle";
        from.path = [];
        this.pick(from);
      }
    }

    const rk = rank(r);
    let at = c.queue.findIndex((id) => rank(this.room(id)) > rk);
    if (at < 0) at = c.queue.length;
    c.queue.splice(at, 0, r.id);
    r.assignee = c.id;

    let rerouted = false;
    if (c.phase === "travel" && c.current != null && rank(this.room(c.current)) > rk && workable(r)) {
      c.queue.splice(at, 1);
      c.queue.unshift(c.current);
      c.current = r.id;
      c.path = route(c.pos, roomPos(r));
      rerouted = true;
    } else if (c.phase === "idle" || c.phase === "wait") {
      this.pick(c);
      rerouted = c.current === r.id;
    }

    const a = r.arrival == null ? null : ARRIVALS[r.arrival];
    const why = a ? `${a.early ? "Early check-in" : "Arrival"} ${a.name}, ${hhmm(a.eta)}` : `${credit(jobCredit(r))} cr`;
    const where = c.current === r.id ? (rerouted ? "cart rerouted" : "next") : `${ordinal(c.queue.indexOf(r.id) + 1)} in queue`;
    const text = `${r.id} to ${c.first}${from ? ` from ${from.first}` : ""}, ${where}. ${why}`;
    this.push(text, "good");
    return { ok: true, text };
  }

  inspect(roomId: number): Result {
    const r = this.room(roomId);
    if (r.status !== "vc") {
      const text = `${r.id} is ${STATUS[r.status].short}, nothing to inspect`;
      this.push(text, "error");
      return { ok: false, text };
    }
    this.setStatus(r, "vi");
    const text = `You inspected ${r.id}. Ready`;
    this.push(text, "good");
    return { ok: true, text };
  }

  /* ── forecast ───────────────────────────────────────────────────────────── */

  forecast() {
    const cleanAt = new Map<number, number>();
    const finish = new Map<number, number>();
    for (const c of this.crew) {
      let tt = Math.max(this.t, c.breakUntil ?? 0);
      let pos = c.pos;
      if (c.current != null) {
        const r = this.room(c.current);
        const job = c.phase === "clean" ? r.job : jobCredit(r);
        const travel = c.phase === "travel" ? travelTime(c.pos, c.path) : 0;
        tt += travel + job * MIN_PER_CREDIT * (1 - (c.phase === "clean" ? r.progress : 0));
        cleanAt.set(r.id, tt);
        pos = roomPos(r);
      }
      for (const id of c.queue) {
        const r = this.room(id);
        let start = tt;
        if (r.status === "occ" && r.stay === "dueout" && r.departAt != null) start = Math.max(tt, r.departAt);
        // A DND room waits for its release and is not on the critical path.
        if (r.status === "dnd") continue;
        const to = roomPos(r);
        tt = start + travelTime(pos, route(pos, to)) + jobCredit(r) * MIN_PER_CREDIT;
        pos = to;
        cleanAt.set(id, tt);
      }
      finish.set(c.id, tt);
    }
    return { cleanAt, finish };
  }

  /** When the room will be inspected and sellable, or null if nobody has it. */
  readyAt(r: Room, cleanAt: Map<number, number>): number | null {
    if (r.status === "vi") return this.t;
    if (r.status === "vc") return this.t + INSPECT_EVERY;
    const c = cleanAt.get(r.id);
    return c == null ? null : c + INSPECT_EVERY;
  }

  crewLoad(c: Crew) {
    const cur = c.current == null ? null : this.room(c.current);
    const curJob = cur ? (c.phase === "clean" ? cur.job : jobCredit(cur)) : 0;
    const curDone = cur && c.phase === "clean" ? cur.job * cur.progress : 0;
    const queued = c.queue.reduce((n, id) => n + jobCredit(this.room(id)), 0);
    return { done: c.done + curDone, total: c.done + curJob + queued, queued, curJob };
  }
}

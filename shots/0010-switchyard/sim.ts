/* The timetable. Every train position is a pure function of time and the
   run's legs, so the server render (t = 0) and the first client render agree,
   and a retry is just a new leg departing from the station that failed. */

import {
  FIRST_DEPARTURE,
  HEADWAY,
  LINE,
  ORDER,
  QUEUE,
  SEEDS,
  SPEED,
  stationIndex,
  type Commit,
  type LineId,
} from "./data";

type Leg = {
  from: number;
  t0: number;
  fail?: { at: number; after: number };
  /** Dwell override for the first station of the leg (a re-run job). */
  firstDwell?: number;
};

export type Run = Commit & {
  id: string;
  line: LineId;
  legs: Leg[];
  /** Number of stations this run calls at, from the origin. */
  stops: number;
  startedAt: number;
  attempt: number;
  tests?: number;
  spawned: boolean;
};

type Entry = { i: number; arrive: number; depart: number; failed: boolean };

const cache = new WeakMap<Leg, Entry[]>();

function schedule(run: Run, leg: Leg): Entry[] {
  const hit = cache.get(leg);
  if (hit) return hit;
  const line = LINE[run.line];
  const out: Entry[] = [];
  let c = leg.t0;
  for (let i = leg.from; i < run.stops; i++) {
    const s = line.stations[i];
    if (i > leg.from) c += (s.len - line.stations[i - 1].len) / SPEED;
    const dwell = i === leg.from && leg.firstDwell ? leg.firstDwell : s.dwell;
    if (leg.fail && leg.fail.at === i) {
      out.push({ i, arrive: c, depart: c + leg.fail.after, failed: true });
      break;
    }
    out.push({ i, arrive: c, depart: c + dwell, failed: false });
    c += dwell;
  }
  cache.set(leg, out);
  return out;
}

export type Loc =
  | { phase: "queued"; eta: number }
  | { phase: "dwell"; i: number; len: number; progress: number; since: number }
  | { phase: "move"; i: number; len: number }
  | { phase: "failed"; i: number; len: number; at: number }
  | { phase: "done"; i: number; len: number; at: number };

export function locate(run: Run, t: number): Loc {
  const line = LINE[run.line];
  const entries = schedule(run, run.legs[run.legs.length - 1]);
  for (let k = 0; k < entries.length; k++) {
    const e = entries[k];
    const s = line.stations[e.i];
    if (t < e.arrive) {
      if (k === 0) return { phase: "queued", eta: e.arrive - t };
      const prev = entries[k - 1];
      const from = line.stations[prev.i];
      return { phase: "move", i: prev.i, len: from.len + (t - prev.depart) * SPEED };
    }
    if (t < e.depart) {
      return { phase: "dwell", i: e.i, len: s.len, progress: (t - e.arrive) / (e.depart - e.arrive), since: e.arrive };
    }
    if (e.failed) return { phase: "failed", i: e.i, len: s.len, at: e.depart };
    if (k === entries.length - 1) return { phase: "done", i: e.i, len: s.len, at: e.depart };
  }
  return { phase: "queued", eta: 0 };
}

export type Visit =
  | { state: "pending"; eta: number }
  | { state: "blocked" }
  | { state: "running"; start: number; end: number; progress: number }
  | { state: "passed" | "failed"; start: number; end: number };

/** What one run did, or will do, at one station. */
export function visit(run: Run, i: number, t: number): Visit | null {
  if (i >= run.stops) return null;
  let leg = run.legs[0];
  for (const l of run.legs) if (l.from <= i) leg = l;
  const e = schedule(run, leg).find((x) => x.i === i);
  if (!e) return { state: "blocked" };
  if (t < e.arrive) return { state: "pending", eta: e.arrive - t };
  if (t < e.depart) return { state: "running", start: e.arrive, end: e.depart, progress: (t - e.arrive) / (e.depart - e.arrive) };
  return { state: e.failed ? "failed" : "passed", start: e.arrive, end: e.depart };
}

export type RunStatus = "queued" | "running" | "failed" | "passed";

export const statusOf = (loc: Loc): RunStatus =>
  loc.phase === "queued" ? "queued" : loc.phase === "failed" ? "failed" : loc.phase === "done" ? "passed" : "running";

function makeRun(line: LineId, c: Commit, id: string, t0: number): Run {
  const stops = stationIndex(line, LINE[line].until) + 1;
  return { ...c, id, line, legs: [{ from: 0, t0 }], stops, startedAt: t0, attempt: 1, spawned: false };
}

export class Yard {
  runs: Run[] = [];
  private next: Record<LineId, number> = { web: 0, api: 0, workers: 0, mobile: 0, infra: 0, docs: 0 };
  /** Bumped on every structural change, so React can memo on it. */
  version = 0;

  constructor() {
    for (const seed of SEEDS) {
      const probe = makeRun(seed.line, seed, seed.id, 0);
      const at = stationIndex(seed.line, seed.at);
      const arrive = schedule(probe, probe.legs[0]).find((e) => e.i === at)!.arrive;
      const t0 = -(arrive + seed.elapsed);
      const run = makeRun(seed.line, seed, seed.id, t0);
      if (seed.fail) {
        run.legs[0].fail = { at: stationIndex(seed.line, seed.fail.at), after: seed.fail.after };
        run.tests = seed.fail.tests;
      }
      this.runs.push(run);
    }
    for (const line of ORDER) {
      const first = FIRST_DEPARTURE[line];
      if (first !== undefined) this.spawn(line, first);
    }
  }

  private spawn(line: LineId, t0: number) {
    const q = QUEUE[line];
    const n = this.next[line];
    if (n >= q.length) return;
    this.next[line] = n + 1;
    this.runs.push(makeRun(line, q[n], `r-${line}-${q[n].sha}`, t0));
    this.version++;
  }

  /** Advance the timetable: finished trains release the next commit in the queue. */
  step(t: number) {
    for (const run of this.runs) {
      if (run.spawned) continue;
      const loc = locate(run, t);
      if (loc.phase === "done") {
        run.spawned = true;
        this.version++;
        this.spawn(run.line, loc.at + HEADWAY);
      }
    }
  }

  retry(id: string, t: number) {
    const run = this.runs.find((r) => r.id === id);
    if (!run) return;
    const loc = locate(run, t);
    if (loc.phase !== "failed") return;
    run.legs = [...run.legs, { from: loc.i, t0: t, firstDwell: 4.2 }];
    run.attempt += 1;
    this.version++;
  }
}

/* 0008 — Roast · the live batch
   Owns one roast: steps the drum model in half-second ticks, samples at 1 Hz,
   detects events and RoR trouble, follows or abandons the reference cues, and
   runs the projection forward every simulated second. Plain mutable state held
   in a ref; React only ever sees `snapshot()`. */

import {
  COOL_SECONDS,
  DT,
  DTR_TARGET,
  FC_AT,
  FC_WINDOW,
  REFERENCE_CUES,
  X_MAX,
  YELLOW_AT,
  chargeState,
  cueAt,
  dropTimeFor,
  mulberry32,
  nextCue,
  rorAt,
  runReference,
  step,
  type Controls,
  type Cue,
  type EventMark,
  type ModelState,
  type RoastEvent,
  type Run,
  type Sample,
} from "./engine";
import { lossFor, GREEN_KG } from "./data";

export type WarnKind = "crash" | "flick" | "above" | "below";
export type Warn = { kind: WarnKind; title: string; hint: string } | null;

export type Projection = {
  path: { t: number; bt: number }[];
  fc: { t: number; bt: number } | null;
  drop: { t: number; bt: number } | null;
};

export type Stage = "roasting" | "cooling" | "ready";

export type Live = {
  batch: number;
  model: ModelState;
  prev: ModelState;
  samples: Sample[];
  bts: number[];
  events: EventMark[];
  controls: Controls;
  cuesOn: boolean;
  manualAt: number | null;
  stage: Stage;
  /** roast seconds pending, below one half-step */
  pending: number;
  rng: () => number;
  crackHeard: number | null;
  warn: Warn;
  warnRun: { kind: WarnKind | null; n: number };
  proj: Projection;
  cool: number;
  drop: { t: number; bt: number; dtr: number } | null;
};

export const REF: Run = runReference();
export const REF_DROP = REF.events.find((e) => e.kind === "drop")!.t;

export const refAt = (t: number) => {
  const s = REF.samples;
  const i = Math.max(0, Math.min(s.length - 1, Math.round(t)));
  return s[i];
};

export function newBatch(batch: number, seed: number): Live {
  const rng = mulberry32(seed);
  const charge = 199.2 + rng() * 2.4;
  const beans = 18.5 + rng() * 3;
  const c0 = REFERENCE_CUES[0];
  const model = chargeState(charge, beans, c0.gas);
  const live: Live = {
    batch,
    model,
    prev: model,
    samples: [],
    bts: [],
    events: [{ kind: "charge", t: 0, bt: charge, source: "auto" }],
    controls: { gas: c0.gas, air: c0.air },
    cuesOn: true,
    manualAt: null,
    stage: "roasting",
    pending: 0,
    rng,
    crackHeard: null,
    warn: null,
    warnRun: { kind: null, n: 0 },
    proj: { path: [], fc: null, drop: null },
    cool: 0,
    drop: null,
  };
  record(live);
  project(live);
  return live;
}

/** Deterministic batch already running when the screen opens. */
export function joinBatch(batch: number, seed: number, at: number): Live {
  const live = newBatch(batch, seed);
  while (live.model.t < at - 1e-6) advance(live, DT);
  live.prev = live.model;
  return live;
}

export const has = (live: Live, kind: RoastEvent) => live.events.some((e) => e.kind === kind);
export const eventOf = (live: Live, kind: RoastEvent) => live.events.find((e) => e.kind === kind);

function record(live: Live) {
  const t = Math.round(live.model.t);
  // probe noise is white and small: a real thermocouple reads to about ±0.1 °C
  const bt = live.model.bt + (live.rng() - 0.5) * 0.16;
  live.bts[t] = bt;
  live.samples[t] = {
    t,
    bt,
    et: live.model.et + (live.rng() - 0.5) * 0.3,
    ror: rorAt(live.bts, t),
    gas: live.controls.gas,
    air: live.controls.air,
  };
}

/** Advance the roast by `sec` roast seconds. Returns true when a whole second was crossed. */
export function advance(live: Live, sec: number): boolean {
  if (live.stage !== "roasting") {
    const before = Math.floor(live.cool);
    live.cool = Math.min(COOL_SECONDS, live.cool + sec);
    if (live.cool >= COOL_SECONDS) live.stage = "ready";
    return Math.floor(live.cool) !== before;
  }
  live.pending += sec;
  let crossed = false;
  while (live.pending >= DT && live.stage === "roasting") {
    live.pending -= DT;
    if (live.cuesOn) {
      const c = cueAt(REFERENCE_CUES, live.model.t);
      live.controls = { gas: c.gas, air: c.air };
    }
    live.prev = live.model;
    live.model = step(live.model, live.controls);
    if (Math.abs(live.model.t - Math.round(live.model.t)) < 1e-6) {
      record(live);
      perSecond(live);
      crossed = true;
    }
  }
  return crossed;
}

function perSecond(live: Live) {
  const t = Math.round(live.model.t);
  const s = live.samples;
  const bt = s[t].bt;

  if (!has(live, "tp") && t > 20 && s[t - 1].bt > s[t - 2].bt && s[t].bt > s[t - 1].bt) {
    let i = t - 2;
    while (i > 1 && s[i - 1].bt < s[i].bt) i--;
    live.events.push({ kind: "tp", t: i, bt: s[i].bt, source: "auto" });
  }
  if (!has(live, "dry") && t > 60 && bt >= YELLOW_AT)
    live.events.push({ kind: "dry", t, bt, source: "auto" });

  if (live.crackHeard === null && t > 120 && bt >= FC_AT) live.crackHeard = t;
  // the roaster's ear lags the crack by a few seconds; cues mark it for them
  if (live.cuesOn && !has(live, "fc") && live.crackHeard !== null && t >= live.crackHeard + 4)
    live.events.push({ kind: "fc", t, bt, source: "auto" });

  const fc = eventOf(live, "fc");
  if (fc && live.cuesOn && t >= dropTimeFor(fc.t)) markDrop(live, "auto");
  else if (t >= X_MAX) markDrop(live, "auto");

  detectWarn(live, t);
  project(live);
}

function detectWarn(live: Live, t: number) {
  const s = live.samples;
  let kind: WarnKind | null = null;
  if (t > 240 && live.stage === "roasting") {
    const r = s[t].ror;
    const d30 = r - s[t - 30].ror;
    const fc = has(live, "fc");
    if (d30 < -2.7 || (fc && r < 3)) kind = "crash";
    else if (d30 > 0.3) kind = "flick";
    else {
      const ref = refAt(t);
      if (t < REF_DROP) {
        if (s[t].bt - ref.bt > 4) kind = "above";
        else if (s[t].bt - ref.bt < -4) kind = "below";
      }
    }
  }
  const run = live.warnRun;
  if (kind === run.kind) run.n++;
  else {
    run.kind = kind;
    run.n = 1;
  }
  if (kind && run.n >= 3) live.warn = describe(kind, live, t);
  else if (!kind && run.n >= 5) live.warn = null;
  else if (live.warn && kind && live.warn.kind === kind) live.warn = describe(kind, live, t);
}

function describe(kind: WarnKind, live: Live, t: number): Warn {
  const s = live.samples;
  const d30 = s[t].ror - s[t - 30].ror;
  const dRef = s[t].bt - refAt(t).bt;
  switch (kind) {
    case "crash":
      return {
        kind,
        title: `RoR crash · ${Math.abs(d30).toFixed(1)} lost in 30 s`,
        hint: "Add gas or close the air, now.",
      };
    case "flick":
      return {
        kind,
        title: `RoR flick · up ${d30.toFixed(1)} in 30 s`,
        hint: "Cut gas or open the air.",
      };
    case "above":
      return { kind, title: `BT ${dRef.toFixed(1)}° above reference`, hint: "Ease gas to rejoin the curve." };
    case "below":
      return { kind, title: `BT ${Math.abs(dRef).toFixed(1)}° below reference`, hint: "Add gas to rejoin the curve." };
  }
}

/** Forward run from the current state: cues if they are on, otherwise the settings held. */
export function project(live: Live) {
  let m = live.model;
  const fcMark = eventOf(live, "fc");
  let fc: { t: number; bt: number } | null = fcMark ? { t: fcMark.t, bt: fcMark.bt } : null;
  let drop = fc ? dropTimeFor(fc.t) : Infinity;
  const path: { t: number; bt: number }[] = [{ t: m.t, bt: m.bt }];
  let held = live.controls;
  let guard = 0;
  while (m.t < Math.min(drop, X_MAX) && guard++ < 2000) {
    const c = live.cuesOn ? cueAt(REFERENCE_CUES, m.t) : held;
    held = c;
    m = step(m, c);
    if (!fc && m.t > 120 && m.bt >= FC_AT) {
      fc = { t: m.t, bt: m.bt };
      drop = dropTimeFor(m.t);
    }
    if (Math.abs(m.t % 2) < 1e-6) path.push({ t: m.t, bt: m.bt });
  }
  path.push({ t: m.t, bt: m.bt });
  live.proj = {
    path,
    fc: fcMark ? null : fc,
    drop: Number.isFinite(drop) && drop <= X_MAX ? { t: drop, bt: m.bt } : null,
  };
}

export function setControls(live: Live, c: Partial<Controls>) {
  if (live.stage !== "roasting") return;
  const next = {
    gas: clamp(Math.round(c.gas ?? live.controls.gas), 0, 100),
    air: clamp(Math.round(c.air ?? live.controls.air), 0, 100),
  };
  if (next.gas === live.controls.gas && next.air === live.controls.air) return;
  live.controls = next;
  if (live.cuesOn) {
    live.cuesOn = false;
    live.manualAt = live.model.t;
  }
  project(live);
}

export function resumeCues(live: Live) {
  if (live.stage !== "roasting") return;
  live.cuesOn = true;
  live.manualAt = null;
  const c = cueAt(REFERENCE_CUES, live.model.t);
  live.controls = { gas: c.gas, air: c.air };
  project(live);
}

/** What a manual press of an event key does. Returns false when it is not allowed yet. */
export function canMark(live: Live, kind: RoastEvent) {
  if (live.stage !== "roasting" || has(live, kind)) return false;
  const t = live.model.t;
  switch (kind) {
    case "charge":
      return false;
    case "tp":
      return t > 20;
    case "dry":
      return has(live, "tp") && live.model.bt > 120;
    case "fc":
      return has(live, "dry");
    case "drop":
      return has(live, "dry");
  }
}

export function mark(live: Live, kind: RoastEvent) {
  if (!canMark(live, kind)) return false;
  if (kind === "drop") return markDrop(live, "manual");
  const t = Math.round(live.model.t);
  live.events.push({ kind, t, bt: live.samples[t]?.bt ?? live.model.bt, source: "manual" });
  project(live);
  return true;
}

function markDrop(live: Live, source: "auto" | "manual") {
  if (has(live, "drop")) return false;
  const t = Math.round(live.model.t);
  const bt = live.samples[t]?.bt ?? live.model.bt;
  live.events.push({ kind: "drop", t, bt, source });
  const fc = eventOf(live, "fc");
  live.drop = { t, bt, dtr: fc ? (t - fc.t) / t : 0 };
  live.stage = "cooling";
  live.cool = 0;
  live.warn = null;
  live.proj = { path: [], fc: null, drop: null };
  return true;
}

/* ── derived values for the DOM ───────────────────────────────────────────── */

export type Phase = { key: "drying" | "maillard" | "dev"; label: string; from: number; to: number; open: boolean };

export function phases(live: Live): Phase[] {
  const now = live.drop?.t ?? live.model.t;
  const dry = eventOf(live, "dry")?.t;
  const fc = eventOf(live, "fc")?.t;
  const out: Phase[] = [{ key: "drying", label: "Drying", from: 0, to: dry ?? now, open: dry === undefined }];
  if (dry !== undefined) out.push({ key: "maillard", label: "Maillard", from: dry, to: fc ?? now, open: fc === undefined });
  if (fc !== undefined) out.push({ key: "dev", label: "Development", from: fc, to: now, open: !live.drop });
  return out;
}

export type Snapshot = {
  batch: number;
  t: number;
  stage: Stage;
  bt: number;
  et: number;
  ror: number;
  refBt: number;
  refRor: number;
  gas: number;
  air: number;
  burner: number;
  cuesOn: boolean;
  manualAt: number | null;
  cueNow: Cue;
  cueNext: Cue | undefined;
  events: EventMark[];
  phases: Phase[];
  warn: Warn;
  projFc: { t: number; bt: number } | null;
  projDrop: { t: number; bt: number } | null;
  fcWindow: boolean;
  allowed: Record<RoastEvent, boolean>;
  cool: number;
  tray: number;
  preheat: number;
  drop: Live["drop"];
  outKg: number | null;
};

export function snapshot(live: Live): Snapshot {
  const t = live.drop ? live.drop.t : Math.round(live.model.t);
  const s = live.samples[t] ?? live.samples[live.samples.length - 1];
  const ref = refAt(t);
  const cueNow = cueAt(REFERENCE_CUES, t);
  const c = live.cool;
  const drop = live.drop;
  const tray = drop ? 27 + (drop.bt - 27) * Math.exp(-c / 62) : 0;
  const preheat = drop ? 200.6 - (200.6 - 171) * Math.exp(-c / 58) : 0;
  return {
    batch: live.batch,
    t,
    stage: live.stage,
    bt: s.bt,
    et: s.et,
    ror: s.ror,
    refBt: ref.bt,
    refRor: ref.ror,
    gas: live.controls.gas,
    air: live.controls.air,
    burner: live.model.burner * 100,
    cuesOn: live.cuesOn,
    manualAt: live.manualAt,
    cueNow,
    cueNext: nextCue(REFERENCE_CUES, t),
    events: [...live.events],
    phases: phases(live),
    warn: live.warn,
    projFc: live.proj.fc,
    projDrop: live.proj.drop,
    fcWindow: live.stage === "roasting" && !has(live, "fc") && s.bt >= FC_WINDOW,
    allowed: {
      charge: false,
      tp: canMark(live, "tp"),
      dry: canMark(live, "dry"),
      fc: canMark(live, "fc"),
      drop: canMark(live, "drop"),
    },
    cool: c,
    tray,
    preheat,
    drop,
    outKg: drop && live.stage === "ready" ? +(GREEN_KG * (1 - lossFor(drop.bt, drop.dtr))).toFixed(2) : null,
  };
}

export const DTR = DTR_TARGET;

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

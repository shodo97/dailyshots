"use client";

/* 0008 — Roast
   A roast logger for a small roastery's 15 kg drum, open on batch #0412 while
   it runs. The head roaster stands at the machine and glances across: the
   chart and the BT readout have to answer at a distance, the event keys have
   to work without looking, and first crack has to announce itself. */

import { Fragment_Mono, Hanken_Grotesk } from "next/font/google";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import s from "./shot.module.css";
import { Icon, type IconName } from "./icons";
import { drawChart, PAD, tOf, xOf, type Geometry } from "./chart";
import { COOL_SECONDS, DTR_TARGET, FC_AT, X_MAX, type RoastEvent } from "./engine";
import {
  advance,
  joinBatch,
  mark,
  newBatch,
  refAt,
  resumeCues,
  setControls,
  snapshot,
  type Live,
  type Snapshot,
} from "./live";
import {
  CHARGED_AT,
  COFFEE,
  EARLIER,
  FIRST_BATCH,
  GREEN_KG,
  JOIN_AT,
  LOT,
  MACHINE,
  RAMP,
  REFERENCE,
  ROASTERY,
  TARGET_DROP,
  agtronEstimate,
  beanColour,
  clock,
  deg,
  lossFor,
  mmss,
  pct,
  rampPos,
  signed,
  type LoggedBatch,
} from "./data";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const mono = Fragment_Mono({ subsets: ["latin"], weight: "400", variable: "--font-fragment" });

const SPEEDS = [1, 6, 12] as const;
const SWEEP_SECONDS = 1.4;
/** Batches start 23 minutes apart on the shop clock. */
const BATCH_GAP = 23 * 60;

const EVENT_ROWS: { kind: RoastEvent; label: string; key?: string }[] = [
  { kind: "charge", label: "Charge" },
  { kind: "tp", label: "Turning point", key: "T" },
  { kind: "dry", label: "Dry end", key: "D" },
  { kind: "fc", label: "First crack", key: "F" },
  { kind: "drop", label: "Drop", key: "X" },
];

type Inspect = { t: number; pinned: boolean } | null;

export default function Roast() {
  const reduced = useReducedMotion();

  const [live, setLive] = useState<Live>(() => joinBatch(FIRST_BATCH, FIRST_BATCH, JOIN_AT));
  const [snap, setSnap] = useState<Snapshot>(() => snapshot(live));
  const [log, setLog] = useState<LoggedBatch[]>(() => [...EARLIER]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(6);
  const [syncing, setSyncing] = useState(true);
  const [inspect, setInspect] = useState<Inspect>(null);
  const [size, setSize] = useState<Geometry>({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const geo = useRef<Geometry>({ w: 0, h: 0 });
  const ctl = useRef({ playing: true, speed: 6, inspect: null as Inspect, dirty: true });

  // reduced motion: no sweep, no autoplay; the batch waits at the join point
  useEffect(() => {
    if (reduced) {
      ctl.current.playing = false;
      const id = requestAnimationFrame(() => {
        setPlaying(false);
        setSyncing(false);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [reduced]);

  useEffect(() => {
    ctl.current.playing = playing;
    ctl.current.speed = speed;
    ctl.current.inspect = inspect;
    ctl.current.dirty = true;
  }, [playing, speed, inspect]);

  const refresh = useCallback(() => {
    setSnap(snapshot(live));
    ctl.current.dirty = true;
  }, [live]);

  /* canvas sizing */
  useEffect(() => {
    const well = wellRef.current;
    const canvas = canvasRef.current;
    if (!well || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = well.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      geo.current = { w: r.width, h: r.height };
      ctl.current.dirty = true;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(well);
    document.fonts?.ready.then(() => (ctl.current.dirty = true));
    return () => ro.disconnect();
  }, []);

  /* the loop: sweep in, then step the drum and draw */
  useEffect(() => {
    if (reduced === null) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const fonts = { sans: sans.style.fontFamily, mono: mono.style.fontFamily };
    const start = performance.now();
    const joinedAt = live.model.t;
    let sweep = reduced || live.model.t < 1 ? 1 : 0;
    let last = start;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = ctl.current;
      if (sweep < 1) {
        sweep = Math.min(1, (now - start) / 1000 / SWEEP_SECONDS);
        c.dirty = true;
        if (sweep >= 1) setSyncing(false);
      } else if (c.playing) {
        if (advance(live, dt * c.speed)) setSnap(snapshot(live));
        c.dirty = true;
      }
      if (c.dirty && geo.current.w > 0) {
        const dpr = canvas.width / geo.current.w;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const eased = 1 - Math.pow(1 - sweep, 3);
        drawChart(ctx, geo.current, {
          live,
          frac: Math.min(1, live.pending / 0.5),
          reveal: sweep < 1 ? eased * joinedAt : Infinity,
          inspectT: c.inspect?.t ?? null,
          pinned: !!c.inspect?.pinned,
          clock: now / 1000,
          playing: c.playing && !reduced && sweep >= 1,
          fonts,
        });
        c.dirty = c.playing || sweep < 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, reduced]);

  /* actions */
  const markEvent = useCallback(
    (kind: RoastEvent) => {
      if (mark(live, kind)) refresh();
    },
    [live, refresh],
  );

  const nudge = useCallback(
    (which: "gas" | "air", by: number) => {
      setControls(live, { [which]: live.controls[which] + by });
      refresh();
    },
    [live, refresh],
  );

  const setValue = useCallback(
    (which: "gas" | "air", v: number) => {
      setControls(live, { [which]: v });
      refresh();
    },
    [live, refresh],
  );

  const cues = useCallback(() => {
    resumeCues(live);
    refresh();
  }, [live, refresh]);

  const nextBatch = useCallback(() => {
    if (live.stage !== "ready" || !live.drop) return;
    const d = live.drop;
    const done: LoggedBatch = {
      id: live.batch,
      charged: CHARGED_AT + (live.batch - FIRST_BATCH) * BATCH_GAP,
      coffee: COFFEE,
      time: d.t,
      dropBt: d.bt,
      dtr: d.dtr,
      outKg: +(GREEN_KG * (1 - lossFor(d.bt, d.dtr))).toFixed(2),
    };
    setLog((l) => [...l, done]);
    const next = newBatch(live.batch + 1, live.batch + 1);
    setLive(next);
    setSnap(snapshot(next));
    setInspect(null);
    setPlaying(true);
  }, [live]);

  /* keys: the roaster's hands are busy, so every action has one */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const inRange = el instanceof HTMLInputElement;
      const k = e.key.toLowerCase();
      if (k === " " && !(el instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (k === "t") markEvent("tp");
      else if (k === "d") markEvent("dry");
      else if (k === "f") markEvent("fc");
      else if (k === "x") markEvent("drop");
      else if (k === "c") cues();
      else if (k === "n") nextBatch();
      else if (!inRange && (k === "arrowup" || k === "arrowdown")) {
        e.preventDefault();
        nudge("gas", k === "arrowup" ? 5 : -5);
      } else if (!inRange && (k === "arrowleft" || k === "arrowright")) {
        e.preventDefault();
        nudge("air", k === "arrowright" ? 5 : -5);
      } else if (k === "," || k === ".") {
        const max = live.drop?.t ?? Math.floor(live.model.t);
        setInspect((cur) => {
          const from = cur?.t ?? max;
          return { t: Math.max(0, Math.min(max, from + (k === "," ? -5 : 5))), pinned: true };
        });
      } else if (k === "escape") setInspect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cues, live, markEvent, nextBatch, nudge]);

  /* chart pointer: hover inspects, click pins */
  const tAt = (e: ReactPointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = tOf(geo.current, e.clientX - r.left);
    const max = live.drop?.t ?? Math.floor(live.model.t);
    return Math.round(Math.max(0, Math.min(max, t)));
  };
  const onMove = (e: ReactPointerEvent) => {
    if (inspect?.pinned) return;
    setInspect({ t: tAt(e), pinned: false });
  };
  const onLeave = () => {
    if (!inspect?.pinned) setInspect(null);
  };
  const onDown = (e: ReactPointerEvent) => {
    const t = tAt(e);
    setInspect((cur) => (cur?.pinned && Math.abs(cur.t - t) < 4 ? { t, pinned: false } : { t, pinned: true }));
  };

  const wall = CHARGED_AT + (snap.batch - FIRST_BATCH) * BATCH_GAP + snap.t + (snap.stage === "roasting" ? 0 : snap.cool);

  return (
    <div
      className={`${s.root} ${sans.variable} ${mono.variable}`}
      style={
        {
          "--shot-sans": "var(--font-hanken)",
          "--shot-display": "var(--font-hanken)",
          "--shot-mono": "var(--font-fragment)",
        } as CSSProperties
      }
    >
      <Header snap={snap} wall={wall} syncing={syncing} paused={!playing} />

      <main className={s.chartPanel}>
        <div className={s.chartHead}>
          <ul className={s.legend} aria-label="Chart key">
            <li><i className={s.swBt} />BT</li>
            <li><i className={s.swEt} />ET</li>
            <li><i className={s.swRor} />RoR <span className={s.unit}>right axis</span></li>
            <li title={`Reference ${REFERENCE}`}><i className={s.swRef} />Reference</li>
            <li><i className={s.swProj} />Projection</li>
          </ul>
          <Warning snap={snap} />
          <div className={s.transport}>
            <button
              type="button"
              className={s.play}
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause replay" : "Resume replay"}
              disabled={snap.stage === "ready"}
            >
              <Icon name={playing ? "pause" : "play"} />
              <span>{playing ? "Pause" : "Play"}</span>
              <kbd className={s.key}>Space</kbd>
            </button>
            <div className={s.speeds} role="radiogroup" aria-label="Replay speed">
              {SPEEDS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={speed === v}
                  className={s.speed}
                  onClick={() => setSpeed(v)}
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>
        </div>

        <PhaseBand snap={snap} />

        <div
          ref={wellRef}
          className={s.well}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onPointerDown={onDown}
          data-fc-window={snap.fcWindow || undefined}
        >
          <canvas ref={canvasRef} className={s.canvas} role="img" aria-label={`Roast chart, batch ${snap.batch}: BT ${deg(snap.bt)} °C at ${mmss(snap.t)}`} />
          {inspect && <Inspector live={live} t={inspect.t} pinned={inspect.pinned} geo={size} />}
        </div>
      </main>

      <aside className={s.rail} aria-label="Batch controls">
        {snap.stage === "roasting" ? (
          <Controls snap={snap} nudge={nudge} setValue={setValue} resume={cues} />
        ) : (
          <Cooling snap={snap} onNext={nextBatch} />
        )}
        <Events snap={snap} onMark={markEvent} />
        <p className={s.shortcuts}>
          <span><kbd className={s.keyDim}>↑</kbd><kbd className={s.keyDim}>↓</kbd> gas</span>
          <span><kbd className={s.keyDim}>←</kbd><kbd className={s.keyDim}>→</kbd> air</span>
          <span><kbd className={s.keyDim}>,</kbd><kbd className={s.keyDim}>.</kbd> scrub</span>
          <span><kbd className={s.keyDim}>Esc</kbd> unpin</span>
        </p>
      </aside>

      <footer className={s.strip}>
        <Ramp snap={snap} />
        <BatchLog log={log} snap={snap} />
      </footer>
    </div>
  );
}

/* ── header ──────────────────────────────────────────────────────────────── */

function Header({ snap, wall, syncing, paused }: { snap: Snapshot; wall: number; syncing: boolean; paused: boolean }) {
  const status =
    snap.stage === "roasting" ? (syncing ? "Syncing probe log" : paused ? "Replay paused" : "Roasting") : snap.stage === "cooling" ? "Cooling" : "Drum ready";
  return (
    <header className={s.header}>
      <div className={s.house}>
        <span className={s.houseMark}>
          <Icon name="drum" />
        </span>
        <span>
          <strong>{ROASTERY}</strong>
          <span className={s.houseSub}>{MACHINE}</span>
        </span>
      </div>
      <div className={s.batchId}>
        <h1 className={s.batchTitle}>
          Batch <span className={s.num}>#{String(snap.batch).padStart(4, "0")}</span>
          <span className={s.coffee}>{COFFEE}</span>
        </h1>
        <p className={s.batchMeta}>
          <span className={s.num}>{GREEN_KG.toFixed(1)} kg</span> green · {LOT} · ref {REFERENCE}
        </p>
      </div>
      <div className={s.status} data-stage={snap.stage} data-syncing={syncing || undefined}>
        <span className={s.statusDot} aria-hidden />
        {status}
        <span className={s.clock}>{clock(wall, true)}</span>
      </div>
    </header>
  );
}

/* ── chart furniture ─────────────────────────────────────────────────────── */

function PhaseBand({ snap }: { snap: Snapshot }) {
  const total = snap.drop?.t ?? snap.t;
  const dropAt = snap.drop?.t ?? snap.projDrop?.t;
  return (
    <div className={s.phaseBand} style={{ marginLeft: PAD.l, marginRight: PAD.r }} aria-label="Roast phases">
      {snap.phases.map((p) => {
        const dur = p.to - p.from;
        return (
          <div
            key={p.key}
            className={s.phase}
            data-phase={p.key}
            data-open={p.open || undefined}
            style={{ left: `${(p.from / X_MAX) * 100}%`, width: `${(dur / X_MAX) * 100}%` }}
          >
            <span className={s.phaseName}>{p.label}</span>
            <span className={s.phaseNums}>
              {mmss(dur)} · {total > 0 ? pct(dur / total) : "—"}
            </span>
          </div>
        );
      })}
      {dropAt !== undefined && (
        <div className={s.dtrMark} data-flip={dropAt > X_MAX * 0.9 || undefined} style={{ left: `${(dropAt / X_MAX) * 100}%` }}>
          <span>
            {snap.drop
              ? `DTR ${pct(snap.drop.dtr)}`
              : snap.events.some((e) => e.kind === "fc")
                ? `DTR target ${pct(DTR_TARGET)}`
                : `DTR ≈${pct(DTR_TARGET)} proj.`}
          </span>
        </div>
      )}
    </div>
  );
}

function FcCue({ snap }: { snap: Snapshot }) {
  const toGo = FC_AT - snap.bt;
  return (
    <div className={s.fcCue} role="status">
      <span className={s.fcRing} aria-hidden />
      <span>
        <strong>First crack</strong>
        {toGo > 0 ? ` · ${toGo.toFixed(1)}° to go` : " · listen for it"}
      </span>
      <kbd className={s.key}>F</kbd>
    </div>
  );
}

function Warning({ snap }: { snap: Snapshot }) {
  if (!snap.warn) return <div className={s.warnSlot}>{snap.fcWindow && <FcCue snap={snap} />}</div>;
  return (
    <div className={s.warnSlot}>
      <div className={s.warn} role="alert" data-kind={snap.warn.kind}>
        <Icon name="warn" />
        <span>
          <strong>{snap.warn.title}</strong>
          <span className={s.warnHint}>{snap.warn.hint}</span>
        </span>
      </div>
    </div>
  );
}

function Inspector({ live, t, pinned, geo }: { live: Live; t: number; pinned: boolean; geo: Geometry }) {
  const smp = live.samples[t];
  const ref = refAt(t);
  if (!smp) return null;
  const x = xOf(geo, t);
  const left = x > geo.w - 230 ? x - 214 : x + 14;
  return (
    <div className={s.inspector} style={{ left, top: PAD.t + 30 }} data-pinned={pinned || undefined}>
      <div className={s.inspHead}>
        <span className={s.num}>{mmss(t)}</span>
        <span>{pinned ? "Pinned · Esc to release" : "Hover · click to pin"}</span>
      </div>
      <dl className={s.inspGrid}>
        <dt>BT</dt>
        <dd>{deg(smp.bt)}°</dd>
        <dt>Ref</dt>
        <dd>
          {deg(ref.bt)}° <span className={s.delta}>{signed(smp.bt - ref.bt)}</span>
        </dd>
        <dt>ET</dt>
        <dd>{deg(smp.et)}°</dd>
        <dt>RoR</dt>
        <dd>{Number.isFinite(smp.ror) && t > 60 ? deg(smp.ror) : "—"}</dd>
        <dt>Gas · air</dt>
        <dd>
          {smp.gas}% · {smp.air}%
        </dd>
      </dl>
    </div>
  );
}

/* ── rail ────────────────────────────────────────────────────────────────── */

function Controls({
  snap,
  nudge,
  setValue,
  resume,
}: {
  snap: Snapshot;
  nudge: (w: "gas" | "air", by: number) => void;
  setValue: (w: "gas" | "air", v: number) => void;
  resume: () => void;
}) {
  return (
    <section className={s.controls} aria-label="Burner and airflow">
      <Lever
        which="gas"
        icon="flame"
        label="Gas"
        value={snap.gas}
        actual={snap.burner}
        cue={snap.cueNow.gas}
        nudge={nudge}
        setValue={setValue}
        note={`burner ${Math.round(snap.burner)}%`}
      />
      <Lever
        which="air"
        icon="fan"
        label="Air"
        value={snap.air}
        cue={snap.cueNow.air}
        nudge={nudge}
        setValue={setValue}
        note="damper"
      />
      <div className={s.cueLine} data-manual={!snap.cuesOn || undefined}>
        {snap.cuesOn ? (
          <>
            <Icon name="cue" />
            <span>
              Cues on
              {snap.cueNext ? (
                <>
                  {" "}· next at <span className={s.num}>{mmss(snap.cueNext.t)}</span>: gas {snap.cueNext.gas}, air {snap.cueNext.air}
                </>
              ) : (
                " · final step applied"
              )}
            </span>
          </>
        ) : (
          <>
            <Icon name="hand" />
            <span>
              Manual since <span className={s.num}>{mmss(snap.manualAt ?? 0)}</span>. Crack and drop are yours.
            </span>
            <button type="button" className={s.resume} onClick={resume}>
              Resume cues <kbd className={s.keyDim}>C</kbd>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function Lever({
  which,
  icon,
  label,
  value,
  actual,
  cue,
  nudge,
  setValue,
  note,
}: {
  which: "gas" | "air";
  icon: IconName;
  label: string;
  value: number;
  actual?: number;
  cue: number;
  nudge: (w: "gas" | "air", by: number) => void;
  setValue: (w: "gas" | "air", v: number) => void;
  note: string;
}) {
  return (
    <div className={s.lever}>
      <div className={s.leverHead}>
        <Icon name={icon} />
        <label htmlFor={`lever-${which}`}>{label}</label>
        <span className={s.leverNote}>
          {note}
          {cue !== value ? ` · ref ${cue}%` : ""}
        </span>
        <output className={s.leverValue} htmlFor={`lever-${which}`}>
          {value}
          <small>%</small>
        </output>
      </div>
      <div className={s.leverBody}>
        <button type="button" className={s.step} onClick={() => nudge(which, -5)} aria-label={`${label} down 5%`} disabled={value <= 0}>
          <Icon name="minus" />
        </button>
        <div className={s.track}>
          <div className={s.ticks} aria-hidden>
            {Array.from({ length: 11 }, (_, i) => (
              <i key={i} data-major={i % 5 === 0 || undefined} />
            ))}
          </div>
          {actual !== undefined && <div className={s.burnerFill} style={{ width: `${actual}%` }} aria-hidden />}
          <div className={s.cueTick} style={{ left: `${cue}%` }} aria-hidden title={`Reference ${cue}%`} />
          <input
            id={`lever-${which}`}
            className={s.range}
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(e) => setValue(which, Number(e.target.value))}
            aria-valuetext={`${value}%`}
          />
        </div>
        <button type="button" className={s.step} onClick={() => nudge(which, 5)} aria-label={`${label} up 5%`} disabled={value >= 100}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

function Events({ snap, onMark }: { snap: Snapshot; onMark: (k: RoastEvent) => void }) {
  const fcDone = snap.events.some((e) => e.kind === "fc");
  return (
    <section className={s.events} aria-label="Roast events">
      {EVENT_ROWS.map((row) => {
        const ev = snap.events.find((e) => e.kind === row.kind);
        const primary =
          snap.stage === "roasting" &&
          ((row.kind === "fc" && snap.fcWindow) || (row.kind === "drop" && fcDone && !ev));
        let detail: string;
        if (ev) detail = `${mmss(ev.t)} · ${ev.bt.toFixed(1)}°`;
        else if (row.kind === "fc" && snap.projFc) detail = `≈ ${mmss(snap.projFc.t)}`;
        else if (row.kind === "drop" && snap.projDrop) detail = `≈ ${mmss(snap.projDrop.t)} · ${snap.projDrop.bt.toFixed(1)}°`;
        else if (row.kind === "dry") detail = "at 150°";
        else detail = "—";
        return (
          <button
            key={row.kind}
            type="button"
            className={s.eventBtn}
            data-done={ev ? true : undefined}
            data-primary={primary || undefined}
            data-pulse={(primary && row.kind === "fc") || undefined}
            disabled={!!ev || !snap.allowed[row.kind]}
            onClick={() => onMark(row.kind)}
          >
            <span className={s.eventMark} aria-hidden>
              {ev ? <Icon name="check" /> : null}
            </span>
            <span className={s.eventLabel}>{row.label}</span>
            <span className={s.eventDetail}>
              {detail}
              {ev && <span className={s.eventSrc}>{ev.source === "auto" ? "auto" : "marked"}</span>}
            </span>
            {row.key ? <kbd className={ev ? s.keyDim : s.key}>{row.key}</kbd> : <span className={s.keyGap} />}
          </button>
        );
      })}
    </section>
  );
}

function Cooling({ snap, onNext }: { snap: Snapshot; onNext: () => void }) {
  const left = COOL_SECONDS - snap.cool;
  const ready = snap.stage === "ready";
  return (
    <section className={s.cooling} aria-label="Cooling tray">
      <div className={s.coolHead}>
        <Icon name="tray" />
        <span>Cooling tray</span>
        <span className={s.coolTime}>{ready ? "0:00" : mmss(left)}</span>
      </div>
      <div className={s.coolBar} aria-hidden>
        <span style={{ width: `${(left / COOL_SECONDS) * 100}%` }} />
      </div>
      <dl className={s.coolGrid}>
        <div>
          <dt>Beans in tray</dt>
          <dd>{snap.tray.toFixed(0)}°C</dd>
        </div>
        <div>
          <dt>Drum reheat</dt>
          <dd>
            {snap.preheat.toFixed(1)}°<small>of 200°</small>
          </dd>
        </div>
        <div>
          <dt>Development</dt>
          <dd>{snap.drop ? pct(snap.drop.dtr) : "—"}</dd>
        </div>
      </dl>
      <button type="button" className={s.nextBtn} disabled={!ready} onClick={onNext} data-primary={ready || undefined}>
        <Icon name="next" />
        <span>{ready ? `Charge batch #${String(snap.batch + 1).padStart(4, "0")}` : `Drum ready in ${mmss(left)}`}</span>
        <kbd className={ready ? s.key : s.keyDim}>N</kbd>
      </button>
    </section>
  );
}

/* ── bottom strip ────────────────────────────────────────────────────────── */

function Ramp({ snap }: { snap: Snapshot }) {
  const bt = snap.drop ? snap.drop.bt : snap.bt;
  const atCharge = snap.t < 90 && snap.stage === "roasting";
  // before the turning point the probe is reading the drum, not the beans
  const beanBt = atCharge ? 20 + snap.t * 0.8 : bt;
  const pos = rampPos(beanBt);
  const stopName = RAMP[Math.min(RAMP.length - 1, Math.floor(pos * RAMP.length))].name;
  const agtron = agtronEstimate(beanBt);
  const tLo = rampPos(TARGET_DROP.lo);
  const tHi = rampPos(TARGET_DROP.hi);
  return (
    <section className={s.ramp} aria-label="Bean colour">
      <div className={s.rampHead}>
        <h2>Bean colour</h2>
        <span className={s.rampNow}>
          <i style={{ background: beanColour(beanBt) }} />
          {stopName}
          {agtron !== null && <span className={s.num}> · Agtron ≈ {agtron}</span>}
        </span>
      </div>
      <div className={s.rampTrack}>
        <div className={s.rampStops}>
          {RAMP.map((r) => (
            <div key={r.name} className={s.rampStop} style={{ background: r.hex }} />
          ))}
        </div>
        <div className={s.rampTarget} style={{ left: `${tLo * 100}%`, width: `${(tHi - tLo) * 100}%` }}>
          <span>Target</span>
        </div>
        <div className={s.rampMarker} style={{ left: `${pos * 100}%` }} aria-hidden>
          <span style={{ background: beanColour(beanBt) }} />
        </div>
      </div>
      <ol className={s.rampNames}>
        {RAMP.map((r) => (
          <li key={r.name} data-on={r.name === stopName || undefined}>
            {r.name}
          </li>
        ))}
      </ol>
    </section>
  );
}

function BatchLog({ log, snap }: { log: LoggedBatch[]; snap: Snapshot }) {
  const listRef = useRef<HTMLDivElement>(null);
  // fade the cut edge only while rows are hidden below it
  const edge = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.dataset.more = String(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
    edge();
    const ro = new ResizeObserver(edge);
    ro.observe(el);
    return () => ro.disconnect();
  }, [log.length, edge]);
  const liveCharged = CHARGED_AT + (snap.batch - FIRST_BATCH) * BATCH_GAP;
  const d = snap.drop;
  const out = snap.outKg;
  return (
    <section className={s.log} aria-label="Today's batches">
      <div className={s.logHead}>
        <h2>Today</h2>
        <span>
          Thu 19 Nov · <span className={s.num}>{log.length + 1}</span> batches ·{" "}
          <span className={s.num}>{(log.reduce((a, b) => a + b.outKg, 0) + (out ?? 0)).toFixed(2)} kg</span> roasted
        </span>
      </div>
      <div className={s.logTable} ref={listRef} onScroll={edge}>
        <table>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Charged</th>
              <th>Coffee</th>
              <th className={s.r}>Time</th>
              <th className={s.r}>Drop</th>
              <th className={s.r}>DTR</th>
              <th className={s.r}>Out</th>
              <th className={s.r}>Loss</th>
            </tr>
          </thead>
          <tbody>
            <tr className={s.liveRow} data-stage={snap.stage}>
              <td className={s.num}>
                <span className={s.liveDot} aria-hidden />#{String(snap.batch).padStart(4, "0")}
              </td>
              <td className={s.num}>{clock(liveCharged)}</td>
              <td>
                {COFFEE}
                <span className={s.liveState}>
                  {snap.stage === "roasting" ? snap.phases[snap.phases.length - 1].label : snap.stage === "cooling" ? "Cooling" : "Weighed"}
                </span>
              </td>
              <td className={`${s.num} ${s.r}`}>{mmss(d?.t ?? snap.t)}</td>
              <td className={`${s.num} ${s.r}`}>{d ? `${d.bt.toFixed(1)}°` : "—"}</td>
              <td className={`${s.num} ${s.r}`}>{d ? pct(d.dtr) : "—"}</td>
              <td className={`${s.num} ${s.r}`}>{out !== null ? `${out.toFixed(2)} kg` : "—"}</td>
              <td className={`${s.num} ${s.r}`}>{out !== null ? pct(1 - out / GREEN_KG) : "—"}</td>
            </tr>
            {[...log].reverse().map((b) => (
              <tr key={b.id}>
                <td className={s.num}>#{String(b.id).padStart(4, "0")}</td>
                <td className={s.num}>{clock(b.charged)}</td>
                <td>{b.coffee}</td>
                <td className={`${s.num} ${s.r}`}>{mmss(b.time)}</td>
                <td className={`${s.num} ${s.r}`}>{b.dropBt.toFixed(1)}°</td>
                <td className={`${s.num} ${s.r}`}>{pct(b.dtr)}</td>
                <td className={`${s.num} ${s.r}`}>{b.outKg.toFixed(2)} kg</td>
                <td className={`${s.num} ${s.r}`}>{pct(1 - b.outKg / GREEN_KG)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

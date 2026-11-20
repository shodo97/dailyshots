"use client";

/* 0007 — Yard
   Halden Container Terminal, berth 4: the yard planner's screen while QC 03
   loads the deck of bay 34 on NORDLYS EXPRESS. The load sequence plays live —
   a gantry digs the box out of its block, a tractor hauls it down the lanes,
   the quay crane sets it into its slot — and any stack can be opened to see
   what is buried in it. */

import { Big_Shoulders, Big_Shoulders_Stencil, Rethink_Sans } from "next/font/google";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { BayPlan } from "./BayPlan";
import {
  BLOCKS,
  BLOCK_BY_ID,
  DONE_AT_START,
  HOLD,
  MOVES,
  MOVE_BY_BOX,
  MOVE_MS,
  OPS,
  OP_ORDER,
  PHASES,
  PHASE_LABEL,
  PORTS,
  SEQ_START,
  STACK_BY_KEY,
  TOTAL,
  VESSEL,
  VOYAGE,
  hhmm,
  locate,
  pad2,
  tonnes,
  yardAt,
  type Box,
} from "./data";
import { Elevation } from "./Elevation";
import { FrameCtx, type FrameBus, type FrameSub } from "./frame";
import { Icon, MarkChip, type IconName } from "./icons";
import { Plan } from "./Plan";
import { Sequence } from "./Sequence";
import { frameAt, phaseStart, settledT } from "./sim";
import s from "./shot.module.css";

const display = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-yard-display" });
const stencil = Big_Shoulders_Stencil({ subsets: ["latin"], axes: ["opsz"], variable: "--font-yard-stencil" });
const sans = Rethink_Sans({ subsets: ["latin"], variable: "--font-yard-sans" });

const START = DONE_AT_START;
const SPEEDS = [1, 2, 4] as const;

type Inspect = { mode: "live" } | { mode: "stack"; key: string } | { mode: "box"; id: string };

/* ── what the inspector is looking at ────────────────────────────────────── */

type Resolved = {
  box: Box | null;
  block: string | null;
  row: number | null;
  stackKey: string | null;
  tier: number | null;
  height: number | null;
  over: Box[];
  ghost: { bay: number; tier: number; text: string } | null;
  status: string;
  hold?: string;
};

function resolve(ins: Inspect, m: number, ph: number): Resolved {
  const yard = yardAt(m, ph);
  const empty: Resolved = { box: null, block: null, row: null, stackKey: null, tier: null, height: null, over: [], ghost: null, status: "" };
  const kind = m < TOTAL ? PHASES[m][ph].kind : "done";

  const forBox = (id: string): Resolved => {
    const loc = locate(yard, id);
    const mi = MOVE_BY_BOX[id];
    const hold = HOLD.find((h) => h.box.id === id);
    if (hold)
      return { ...empty, box: hold.box, status: "In the hold, under the hatch covers", hold: `34-${pad2(hold.row)}-${pad2(hold.tier)}` };
    if (loc) {
      const st = STACK_BY_KEY[loc.key];
      const boxes = yard[st.block][loc.key];
      const box = boxes[loc.tier - 1];
      const over = boxes.slice(loc.tier).reverse();
      let status = `Not in this sequence · booked ${box.vessel}`;
      if (mi != null) {
        const mv = MOVES[mi];
        status =
          mi === m
            ? `Move ${mv.n} · live · ${kind === "done" ? "" : PHASE_LABEL[kind]}`
            : `Move ${mv.n} of ${TOTAL} · to ${mv.toLabel} · planned ${hhmm(mv.done)}`;
      }
      return { ...empty, box, block: st.block, row: st.row, stackKey: loc.key, tier: loc.tier, height: boxes.length, over, status };
    }
    if (mi != null) {
      const mv = MOVES[mi];
      const st = STACK_BY_KEY[mv.key];
      const gone = mi < m;
      return {
        ...empty,
        box: mv.box,
        block: st.block,
        row: st.row,
        stackKey: mv.key,
        tier: mv.tier,
        ghost: { bay: mv.bay, tier: mv.tier, text: gone ? `Loaded ${hhmm(mv.done)} → ${mv.toLabel}` : `On the spreader → ${mv.truck}` },
        status: gone ? `Loaded ${hhmm(mv.done)} · stowed ${mv.toLabel}` : `Move ${mv.n} · live · ${kind === "done" ? "" : PHASE_LABEL[kind]}`,
      };
    }
    // A rehandled box in the air.
    return { ...empty, status: "In the air" };
  };

  if (ins.mode === "box") return forBox(ins.id);
  if (ins.mode === "stack") {
    const st = STACK_BY_KEY[ins.key];
    const boxes = yard[st.block][ins.key] ?? [];
    // A stack with a sequenced box in it opens on that box: that is the one the planner cares about.
    const target = boxes.find((b) => MOVE_BY_BOX[b.id] != null && MOVE_BY_BOX[b.id] >= m);
    if (target) return forBox(target.id);
    if (boxes.length) return forBox(boxes[boxes.length - 1].id);
    return { ...empty, block: st.block, row: st.row, stackKey: ins.key, height: 0, status: "Ground slot empty" };
  }
  if (m >= TOTAL) return { ...empty, status: "Sequence complete" };
  return forBox(MOVES[m].box.id);
}

/* ── the screen ──────────────────────────────────────────────────────────── */

export default function Yard() {
  const reduced = !!useReducedMotion();
  const [pos, setPos] = useState({ m: START, ph: 0 });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [inspect, setInspect] = useState<Inspect>({ mode: "live" });
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ block: string; idx: number; row: number } | null>(null);

  const eng = useRef({ m: START, t: 0, now: 0 });
  const subs = useRef(new Set<FrameSub>());
  const posRef = useRef(pos);
  const playRef = useRef(playing);
  const speedRef = useRef<number>(speed);
  const reducedRef = useRef(reduced);
  useLayoutEffect(() => {
    playRef.current = playing;
    speedRef.current = speed;
    reducedRef.current = reduced;
  });

  const bus = useMemo<FrameBus>(
    () => ({
      subscribe(fn) {
        subs.current.add(fn);
        return () => subs.current.delete(fn);
      },
      current: () => frameAt(eng.current.m, eng.current.t, eng.current.now, reducedRef.current),
    }),
    [],
  );

  const emit = useCallback(() => {
    const f = bus.current();
    subs.current.forEach((fn) => fn(f));
  }, [bus]);

  // Every discrete change re-poses the moving parts before the browser paints.
  useLayoutEffect(() => {
    emit();
  }, [pos, inspect, emit]);

  const sync = useCallback(() => {
    const f = bus.current();
    if (f.m !== posRef.current.m || f.ph !== posRef.current.ph) {
      posRef.current = { m: f.m, ph: f.ph };
      flushSync(() => setPos({ m: f.m, ph: f.ph }));
    }
  }, [bus]);

  // Reduced motion: a settled pose, and the sequence advances a whole move at a time.
  useEffect(() => {
    if (!reduced) return;
    eng.current.t = settledT(eng.current.m);
    sync();
    emit();
    if (!playing) return;
    const id = window.setInterval(() => {
      const e = eng.current;
      if (e.m >= TOTAL) return;
      e.m += 1;
      e.t = settledT(e.m);
      sync();
      emit();
    }, 2600 / speed);
    return () => window.clearInterval(id);
  }, [reduced, playing, speed, sync, emit]);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      const e = eng.current;
      e.now = now;
      if (playRef.current && e.m < TOTAL) {
        e.t += dt * speedRef.current;
        while (e.m < TOTAL && e.t >= MOVE_MS[e.m]) {
          e.t -= MOVE_MS[e.m];
          e.m += 1;
        }
        if (e.m >= TOTAL) e.t = 0;
      }
      sync();
      emit();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, sync, emit]);

  const step = useCallback(() => {
    const e = eng.current;
    if (e.m >= TOTAL) return;
    e.m += 1;
    e.t = reducedRef.current ? settledT(e.m) : 0;
    sync();
    emit();
  }, [sync, emit]);

  const restart = useCallback(() => {
    eng.current.m = START;
    eng.current.t = reducedRef.current ? settledT(START) : 0;
    sync();
    emit();
    setPlaying(true);
  }, [sync, emit]);

  const done = pos.m >= TOTAL;
  const togglePlay = useCallback(() => {
    if (eng.current.m >= TOTAL) restart();
    else setPlaying((p) => !p);
  }, [restart]);

  // Shortcuts that work anywhere on the screen.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === " " && (tag === "BUTTON" || tag === "svg")) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "." || e.key === "l") step();
      else if (e.key === "1" || e.key === "2" || e.key === "3") setSpeed(SPEEDS[Number(e.key) - 1]);
      else if (e.key === "Escape") setInspect({ mode: "live" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, step]);

  /* ── derived state ─────────────────────────────────────────────────────── */

  const { m, ph } = pos;
  const yard = yardAt(m, ph);
  const phase = done ? null : PHASES[m][ph];
  const kind = phase?.kind ?? "done";
  const rhIndex = phase?.kind === "rehandle" ? phase.i! : 0;
  const res = resolve(inspect, m, ph);
  const selectedKey = inspect.mode === "live" ? null : res.stackKey;
  const selectedId = inspect.mode === "live" ? null : (res.box?.id ?? null);

  // Scenario clock: the fraction of the current move's cycle, on top of the last completion.
  const prevDone = m > 0 ? MOVES[Math.min(m, TOTAL) - 1].done : SEQ_START;
  const clock = done ? MOVES[TOTAL - 1].done : prevDone + (phaseStart(m, ph) / MOVE_MS[m]) * MOVES[m].cycle;
  const elapsedH = (clock - SEQ_START) / 60;
  const gross = elapsedH > 0 ? Math.min(m, TOTAL) / elapsedH : 0;
  const eta = MOVES[TOTAL - 1].done;
  const remaining = Math.max(0, eta - clock);

  const cursorKey = cursor ? stackKeyAt(cursor) : null;

  const onPlanKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const c = cursor ?? { block: MOVES[Math.min(m, TOTAL - 1)].block, idx: 0, row: 1 };
    let next = c;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") next = moveH(c, e.key === "ArrowRight" ? 1 : -1);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") next = moveV(c, e.key === "ArrowDown" ? 1 : -1);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const k = stackKeyAt(c);
      if (k) setInspect({ mode: "stack", key: k });
      return;
    } else return;
    e.preventDefault();
    setCursor(next);
  };

  const focusStack = cursorKey ? STACK_BY_KEY[cursorKey] : null;
  const focusBoxes = cursorKey && focusStack ? yard[focusStack.block][cursorKey] : [];
  const planLabel = focusStack
    ? `Stack ${cursorKey}, ${focusBoxes.length} high${focusBoxes.length ? `, top ${focusBoxes[focusBoxes.length - 1].id}` : ""}. Enter to inspect.`
    : "Yard plan, blocks A1 to D4. Arrow keys move between stacks, Enter inspects.";

  const rootStyle = {
    "--shot-sans": "var(--font-yard-sans)",
    "--shot-display": "var(--font-yard-display)",
    "--shot-mono": "var(--font-yard-display)",
    "--shot-stencil": "var(--font-yard-stencil)",
  } as CSSProperties;

  const live = inspect.mode === "live";
  const activeMove = done ? null : MOVES[m];

  return (
    <FrameCtx.Provider value={bus}>
      <div className={`${s.root} ${display.variable} ${stencil.variable} ${sans.variable}`} style={rootStyle}>
        <header className={s.bar}>
          <div className={s.site}>
            <strong>Halden Container Terminal</strong>
            <span>Berth 4 · yard planning</span>
          </div>
          <div className={s.vessel}>
            <strong>{VESSEL}</strong>
            <span>
              Voy {VOYAGE} · QC 03 on bay 34 deck
            </span>
          </div>
          <dl className={s.readouts}>
            <div>
              <dt>Clock</dt>
              <dd>{hhmm(clock)}</dd>
            </div>
            <div>
              <dt>Bay 34 deck</dt>
              <dd>
                {Math.min(m, TOTAL)}
                <small>/{TOTAL}</small>
              </dd>
            </div>
            <div>
              <dt>QC 03 gross</dt>
              <dd>
                {gross.toFixed(1)}
                <small> mv/h</small>
              </dd>
            </div>
            <div>
              <dt>ETA complete</dt>
              <dd>
                {hhmm(eta)}
                <small> {done ? "done" : `in ${Math.floor(remaining / 60)}h${pad2(Math.round(remaining % 60))}`}</small>
              </dd>
            </div>
          </dl>
        </header>

        <main className={s.main}>
          <section className={s.yardCol} aria-label="Yard">
            <div className={s.planWrap}>
              <Plan
                yard={yard}
                m={m}
                ph={ph}
                phaseKind={kind}
                selectedKey={selectedKey}
                hoverKey={hoverKey}
                cursorKey={cursorKey}
                onHover={setHoverKey}
                onPick={(key) => {
                  setInspect({ mode: "stack", key });
                  const st = STACK_BY_KEY[key];
                  setCursor({ block: st.block, idx: idxOf(st.block, st.bay), row: st.row });
                }}
                onKey={onPlanKey}
                focusLabel={planLabel}
                spotlight={live && !done}
                numBlocks={[
                  ...(live ? (activeMove ? [activeMove.block] : []) : res.block ? [res.block] : []),
                  ...(hoverKey ? [STACK_BY_KEY[hoverKey].block] : []),
                  ...(cursorKey ? [STACK_BY_KEY[cursorKey].block] : []),
                ]}
              />
            </div>

            <div className={s.strip}>
              <div className={s.transport} role="group" aria-label="Sequence playback">
                <button
                  type="button"
                  className={s.play}
                  onClick={togglePlay}
                  aria-keyshortcuts="Space"
                  title="Space to play or pause · 1, 2, 3 set replay speed"
                  aria-label={done ? "Restart sequence" : playing ? "Pause sequence" : "Play sequence"}
                >
                  <Icon name={(done ? "restart" : playing ? "pause" : "play") as IconName} className={s.ico} />
                  <span>{done ? "Restart" : playing ? "Pause" : "Play"}</span>
                </button>
                <button type="button" className={s.tbtn} onClick={step} disabled={done} aria-keyshortcuts="." aria-label="Complete this move and step to the next">
                  <Icon name="step" className={s.ico} />
                  <span>Step</span>
                </button>
              </div>
              <p className={s.now} aria-live="polite">
                {activeMove ? (
                  <>
                    <b>Move {activeMove.n}</b>
                    <span>
                      {kind === "rehandle" ? `Rehandling ${rhIndex + 1} of ${activeMove.rehandles.length}` : PHASE_LABEL[kind as keyof typeof PHASE_LABEL]}
                    </span>
                    {!playing ? <em>Paused</em> : speed !== 1 && <em>{speed}× replay</em>}
                  </>
                ) : (
                  <>
                    <b>Bay 34 deck complete</b>
                    <span>48 of 48 moves</span>
                  </>
                )}
              </p>
              <ul className={s.legend} aria-label="Key">
                {OP_ORDER.map((id) => (
                  <li key={id} title={OPS[id].name}>
                    <i className={s.swatch} style={{ background: OPS[id].paint }} aria-hidden />
                    {OPS[id].prefix.slice(0, 3)}
                  </li>
                ))}
                <li className={s.legendMark}>
                  <MarkChip kind="reefer" />
                  Reefer
                </li>
                <li className={s.legendMark}>
                  <MarkChip kind="imdg" cls="3" />
                  IMDG
                </li>
                <li className={s.legendMark}>
                  <MarkChip kind="ow" />
                  Overweight
                </li>
              </ul>
            </div>

            <section className={s.inspector} aria-label="Stack inspector">
              <div className={s.elevWrap}>
                <div className={s.inspHead}>
                  <h2>
                    {res.block ? (
                      <>
                        Block {res.block} <span>·</span> Row {pad2(res.row!)}
                      </>
                    ) : res.hold ? (
                      <>Bay 34 hold</>
                    ) : (
                      <>{res.status || "No stack"}</>
                    )}
                  </h2>
                  <p>{res.block ? "Side elevation from the truck lane" : res.hold ? "Stowed before this sequence" : ""}</p>
                  {live ? (
                    <span className={s.follow} data-on>
                      <Icon name="follow" className={s.icoSm} />
                      Following live move
                    </span>
                  ) : (
                    <button type="button" className={s.follow} onClick={() => setInspect({ mode: "live" })} aria-keyshortcuts="Escape">
                      <Icon name="follow" className={s.icoSm} />
                      Follow live move
                    </button>
                  )}
                </div>
                {res.block && res.row ? (
                  <Elevation
                    yard={yard}
                    block={res.block}
                    row={res.row}
                    focusId={res.box?.id ?? null}
                    overIds={res.over.map((b) => b.id)}
                    ghost={res.ghost}
                    m={m}
                    onPickBox={(id) => setInspect({ mode: "box", id })}
                  />
                ) : (
                  <div className={s.elevEmpty}>
                    {res.hold
                      ? `Slot ${res.hold}. Closed under the hatch covers since 12:52; no yard position to show.`
                      : "Bay 34 deck is loaded. Select any stack on the plan to inspect it."}
                  </div>
                )}
              </div>
              <Details res={res} />
            </section>
          </section>

          <aside className={s.panel} aria-label="Vessel">
            <section className={s.bay}>
              <div className={s.bayHead}>
                <h2>
                  Bay <b>34</b>
                </h2>
                <p>
                  40′ · hold 44/44 closed · deck {Math.min(m, TOTAL)}/{TOTAL}
                </p>
              </div>
              <BayPlan m={m} onPick={(id) => setInspect({ mode: "box", id })} selectedId={selectedId ?? (live ? (activeMove?.box.id ?? null) : null)} />
              <p className={s.bayFoot}>
                <span>Port</span>
                <span>Looking forward</span>
                <span>Starboard</span>
              </p>
            </section>
            <section className={s.seqWrap} aria-label="Load sequence">
              <div className={s.seqTitle}>
                <h2>Load sequence</h2>
                <p>
                  QC 03 · {Math.min(m, TOTAL)} done · {TOTAL - Math.min(m, TOTAL)} to go
                </p>
              </div>
              <Sequence m={m} phaseKind={kind} rhIndex={rhIndex} selectedId={selectedId} onPick={(id) => setInspect({ mode: "box", id })} reduced={reduced} />
            </section>
          </aside>
        </main>
      </div>
    </FrameCtx.Provider>
  );
}

/* ── inspector details ───────────────────────────────────────────────────── */

function Details({ res }: { res: Resolved }) {
  const b = res.box;
  if (!b)
    return (
      <div className={s.details}>
        <p className={s.detailsEmpty}>{res.stackKey ? `${res.stackKey} · ground slot, nothing stacked` : res.status}</p>
      </div>
    );
  const op = OPS[b.op];
  const n = res.over.length;
  return (
    <div className={s.details}>
      <div className={s.idLine}>
        <span className={s.bigId}>
          {b.owner} {b.serial} <b>{b.check}</b>
        </span>
        <span className={s.opName}>
          <i className={s.swatch} style={{ background: op.paint }} aria-hidden />
          {op.name}
        </span>
      </div>
      {n > 0 && (
        <p className={s.warn} role="status">
          <Icon name="warn" className={s.icoSm} />
          <span>
            <b>
              {n} rehandle{n > 1 ? "s" : ""}:
            </b>{" "}
            under {res.over.map((o) => `${o.owner}\u00a0${o.serial}\u00a0${o.check}`).join(" and ")}
          </span>
        </p>
      )}
      <dl className={s.facts}>
        <div>
          <dt>Slot</dt>
          <dd>
            {res.hold ?? (res.stackKey && res.tier ? `${res.stackKey}-${res.tier}` : "—")}
            {res.height != null && res.tier != null && <small> tier {res.tier} of {res.height}</small>}
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>
            {b.iso} <small>{b.kind}</small>
          </dd>
        </div>
        <div>
          <dt>VGM</dt>
          <dd>
            {tonnes(b.vgm)} t{b.ow && <small className={s.owNote}> overweight, heavy spreader</small>}
          </dd>
        </div>
        <div>
          <dt>POD</dt>
          <dd>
            {b.pod} <small>{PORTS[b.pod]}</small>
          </dd>
        </div>
        {b.reefer && (
          <div>
            <dt>Reefer</dt>
            <dd>
              {b.reefer.set > 0 ? "+" : "−"}
              {Math.abs(b.reefer.set).toFixed(1)} °C <small>set point, plugged</small>
            </dd>
          </div>
        )}
        {b.imdg && (
          <div>
            <dt>IMDG</dt>
            <dd>
              Class {b.imdg.cls} · UN {b.imdg.un} <small>{b.imdg.name}</small>
            </dd>
          </div>
        )}
        <div className={s.factWide}>
          <dt>Status</dt>
          <dd>{res.status}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ── keyboard cursor over the plan ───────────────────────────────────────── */

function idxOf(block: string, bay: number) {
  return bay % 2 === 1 ? (bay - 1) / 2 : ((bay - 2) / 4) * 2;
}

function stackKeyAt(c: { block: string; idx: number; row: number }) {
  const b = BLOCK_BY_ID[c.block];
  const g = Math.floor(c.idx / 2);
  const bay = b.groups[g] === 40 ? g * 4 + 2 : c.idx * 2 + 1;
  return `${c.block}-${pad2(bay)}-${pad2(c.row)}`;
}

function moveH(c: { block: string; idx: number; row: number }, dir: 1 | -1) {
  const b = BLOCK_BY_ID[c.block];
  const g = Math.floor(c.idx / 2);
  let idx = b.groups[g] === 40 ? (dir > 0 ? g * 2 + 2 : g * 2 - 1) : c.idx + dir;
  let block = c.block;
  if (idx > 5 || idx < 0) {
    const nb = BLOCKS.find((q) => q.r === b.r && q.c === b.c + dir);
    if (!nb) return c;
    block = nb.id;
    idx = idx > 5 ? 0 : 5;
  }
  const nb = BLOCK_BY_ID[block];
  if (nb.groups[Math.floor(idx / 2)] === 40) idx = Math.floor(idx / 2) * 2;
  return { block, idx, row: c.row };
}

function moveV(c: { block: string; idx: number; row: number }, dir: 1 | -1) {
  const b = BLOCK_BY_ID[c.block];
  const row = c.row + dir;
  if (row >= 1 && row <= 6) return { ...c, row };
  const nb = BLOCKS.find((q) => q.c === b.c && q.r === b.r + dir);
  if (!nb) return c;
  let idx = c.idx;
  if (nb.groups[Math.floor(idx / 2)] === 40) idx = Math.floor(idx / 2) * 2;
  return { block: nb.id, idx, row: dir > 0 ? 1 : 6 };
}

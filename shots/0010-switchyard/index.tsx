"use client";

/* 0010 — Switchyard
   Deploy day for the atlas monorepo, drawn as a transit map. Pipelines are
   lines, stages are stations, the shared environments are interchanges, and
   every running build is a train labelled with its commit. The release
   engineer's one job here is to get 2026.47 from Canary into Production,
   which the map makes impossible to do while a line is suspended. */

import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LINE, stationIndex, type LineId } from "./data";
import { Yard, locate, type Run } from "./sim";
import { GATE, TransitMap, VB, trainPos, type ApiState, type Sel } from "./Map";
import { Departures, ROLL, ReleaseGate, ServiceBoard, TrainCard, boardRows, type Gate, type Promo } from "./Panels";
import { Drawer } from "./Drawer";
import { clockAt, hhmm } from "./format";
import s from "./shot.module.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted" });
const mono = Martian_Mono({ subsets: ["latin"], variable: "--font-martian", axes: ["wdth"] });

const HOTFIX = "r-api-4be1d07";
const E2E = stationIndex("api", "e2e");

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export default function Switchyard() {
  const reduced = !!useReducedMotion();
  const [yard] = useState(() => new Yard());
  const [t, setT] = useState(0);
  const tRef = useRef(0);

  const [selected, setSelected] = useState<Sel>({ line: "api", idx: E2E });
  const [focus, setFocus] = useState<Sel>({ line: "api", idx: E2E });
  const [selectAt, setSelectAt] = useState(0);
  const [hover, setHover] = useState<LineId | null>(null);
  const [keyIsolate, setKeyIsolate] = useState<LineId | null>(null);
  const [promoRaw, setPromo] = useState<Promo>({ phase: "idle", at: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoverTrain, setHoverTrain] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const areaRef = useRef<HTMLDivElement>(null);

  /* The map is authored on a fixed stage and scaled to the space it has. */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / VB.w, height / VB.h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Escape puts the log away. */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  /* The scenario clock. Frames are capped at 100ms so a background tab
     resumes where it left off instead of jumping the timetable. */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let pushed = -1;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current += dt;
      yard.step(tRef.current);
      if (!reduced || tRef.current - pushed >= 0.5) {
        pushed = tRef.current;
        setT(tRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [yard, reduced]);

  /* ── derived state ─────────────────────────────────────────────────── */

  const hotfix = yard.runs.find((r) => r.id === HOTFIX)!;
  const loc = locate(hotfix, t);
  const apiLine = LINE.api;
  const stagingIdx = stationIndex("api", "staging");

  let gateState: Gate["state"];
  let where = "";
  if (loc.phase === "done") gateState = "green";
  else if (loc.phase === "failed") gateState = "failed";
  else if (hotfix.attempt === 1) gateState = "running";
  else if (loc.phase === "dwell" && loc.i === E2E) gateState = "retrying";
  else {
    gateState = "travelling";
    if (loc.phase === "dwell") where = loc.i === stagingIdx ? "deploying to Staging" : "publishing image";
    else if (loc.phase === "move") where = loc.i + 1 === stagingIdx ? "heading to Staging" : "heading to Registry";
  }
  const gate = useMemo<Gate>(() => ({ state: gateState, where }), [gateState, where]);
  const rows = useMemo(() => boardRows(gate), [gate]);

  let api: ApiState = null;
  if (loc.phase !== "done" && (loc.phase === "failed" || hotfix.attempt > 1)) {
    const from = apiLine.stations[E2E].len;
    let restoredTo = from;
    if (hotfix.attempt > 1 && loc.phase !== "failed" && loc.phase !== "queued") {
      restoredTo = loc.phase === "move" && !reduced ? loc.len : apiLine.stations[loc.i].len;
    }
    api = { suspendedFrom: from, suspendedTo: apiLine.stations[stagingIdx].len, restoredTo };
  }

  const promoPhase = promoRaw.phase === "rolling" && t - promoRaw.at >= ROLL.done ? "done" : promoRaw.phase;
  const promo = useMemo<Promo>(() => ({ phase: promoPhase, at: promoRaw.at }), [promoPhase, promoRaw.at]);
  const relAt =
    promo.phase === "done" ? 1 : promo.phase === "rolling" ? (reduced ? 1 : ease(clamp01((t - promo.at) / ROLL.move))) : 0;
  const release = { at: relAt, previousOpacity: 1 - relAt, live: promo.phase === "done" };

  const isolate = hover ?? keyIsolate;
  const tc = reduced ? t : Math.floor(t * 6) / 6;

  /* ── actions ───────────────────────────────────────────────────────── */

  const select = useCallback((sel: Sel) => {
    setSelected(sel);
    setFocus(sel);
    setSelectAt(tRef.current);
    setDrawerOpen(true);
  }, []);

  const onFocusStation = useCallback((sel: Sel) => {
    setFocus(sel);
    setKeyIsolate(sel.line);
  }, []);

  const onSelectRun = useCallback(
    (run: Run) => {
      const l = locate(run, tRef.current);
      select({ line: run.line, idx: "i" in l ? l.i : 0 });
    },
    [select],
  );

  const onSelectLine = useCallback(
    (line: LineId) => {
      const now = tRef.current;
      let idx = 0;
      let best = -1;
      for (const run of yard.runs) {
        if (run.line !== line) continue;
        const l = locate(run, now);
        if (l.phase === "failed") {
          idx = l.i;
          break;
        }
        if ((l.phase === "dwell" || l.phase === "move") && l.i > best) {
          best = l.i;
          idx = l.i;
        }
      }
      select({ line, idx });
    },
    [yard, select],
  );

  const onRetry = useCallback(() => {
    yard.retry(HOTFIX, tRef.current);
    select({ line: "api", idx: E2E });
  }, [yard, select]);

  const onPromote = useCallback(() => setPromo({ phase: "confirm", at: tRef.current }), []);
  const onConfirm = useCallback(() => setPromo({ phase: "rolling", at: tRef.current }), []);
  const onCancel = useCallback(() => setPromo({ phase: "idle", at: 0 }), []);
  const onToggle = useCallback(() => setDrawerOpen((o) => !o), []);
  const onBlurMap = useCallback(() => setKeyIsolate(null), []);

  const hovered = hoverTrain ? yard.runs.find((r) => r.id === hoverTrain) : undefined;
  const hoveredPos = hovered ? trainPos(hovered, t, reduced) : null;
  const clock = hhmm(clockAt(t));

  return (
    <div
      className={`${s.root} ${sans.variable} ${mono.variable}`}
      style={
        {
          "--shot-sans": "var(--font-schibsted)",
          "--shot-display": "var(--font-schibsted)",
          "--shot-mono": "var(--font-martian)",
        } as CSSProperties
      }
    >
      <main className={s.stageArea} ref={areaRef}>
        <div className={s.stage} style={{ width: VB.w, height: VB.h, "--s": scale } as CSSProperties}>
          <TransitMap
            t={t}
            yard={yard}
            reduced={reduced}
            isolate={isolate}
            selected={selected}
            focus={focus}
            api={api}
            release={release}
            clock={clock}
            onSelect={select}
            onHover={setHover}
            onHoverTrain={setHoverTrain}
            onFocusStation={onFocusStation}
            onBlurMap={onBlurMap}
          />
          <div className={s.gateAnchor} style={{ left: GATE.x - VB.x, top: GATE.y - VB.y, width: GATE.w }}>
            <ReleaseGate
              t={tc}
              gate={gate}
              promo={promo}
              frac={release.at}
              onPromote={onPromote}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          </div>
          <Departures
            t={tc}
            yard={yard}
            hoverRun={hoverTrain}
            onHoverRun={setHoverTrain}
            onSelectRun={onSelectRun}
            style={{ left: 80 - VB.x, top: 206 - VB.y, width: 330 }}
          />
          {hovered && hoveredPos && (
            <TrainCard run={hovered} t={tc} x={hoveredPos.x - VB.x} y={hoveredPos.y - VB.y} below={hoveredPos.y < 150} />
          )}
        </div>
      </main>
      <ServiceBoard
        rows={rows}
        clock={clock}
        isolate={isolate}
        onIsolate={setHover}
        onSelectLine={onSelectLine}
        onRetry={onRetry}
      />
      <Drawer
        t={t}
        yard={yard}
        selected={selected}
        selectAt={selectAt}
        promoted={promo.phase === "done"}
        reduced={reduced}
        open={drawerOpen}
        onToggle={onToggle}
        onRetry={onRetry}
      />
    </div>
  );
}

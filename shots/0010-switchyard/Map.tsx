"use client";

import { memo, useCallback, useRef, type KeyboardEvent } from "react";
import { INTERCHANGES, IX_X, K, LINE, LINES, ORDER, RELEASE, type LineId, type Side, type Station } from "./data";
import { locate, type Run, type Yard } from "./sim";
import { pointAt, subPath } from "./track";
import { timer } from "./format";
import s from "./shot.module.css";

export type Sel = { line: LineId; idx: number };

/** The stage is authored at 1400 × 690 and scaled to fit; overlays share these coordinates. */
export const VB = { x: -36, y: -40, w: 1400, h: 690 };
/** The release gate hangs off Production, to the right of the network. */
export const GATE = { x: 1010, y: 128, w: 330 };

const GROUND = "#fbfbf9";
const INK = "#141412";
const GREY = "#b4b2aa";
const STROKE = 7;

const DIR: Record<Side, readonly [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const CHAR = 6.15; // average advance of the 11.5-unit station face

function labelPos(st: Station) {
  const [x, y] = st.at;
  switch (st.side) {
    case "n":
      return { x, y: y - 15, anchor: "middle" as const };
    case "s":
      return { x, y: y + 23, anchor: "middle" as const };
    case "e":
      return { x: x + (st.kind === "terminus" ? 16 : 31), y: y + 4, anchor: "start" as const };
    case "w":
      return { x: x - 31, y: y + 4, anchor: "end" as const };
  }
}

/** Where a second line of text (a timer, a failure) sits under a station name. */
function notePos(st: Station) {
  const p = labelPos(st);
  if (st.side === "n") return { ...p, y: p.y - 13 };
  if (st.side === "s") return { ...p, y: p.y + 13 };
  return { ...p, y: p.y + 14 };
}

function hitBox(st: Station) {
  const [x, y] = st.at;
  const w = st.name.length * CHAR + 10;
  if (st.ix) return { x: x - 9, y: y - 4.5, w: 18, h: 9 };
  if (st.kind === "origin") {
    return LINE[st.line].id === "infra" ? { x: x - 30, y: 30, w: 60, h: y - 22 } : { x: 4, y: y - 12, w: x - 4 + 8, h: 24 };
  }
  switch (st.side) {
    case "n":
      return { x: x - w / 2, y: y - 30, w, h: 36 };
    case "s":
      return { x: x - w / 2, y: y - 6, w, h: 36 };
    case "e":
      return { x: x - 6, y: y - 11, w: w + 36, h: 22 };
    case "w":
      return { x: x - w - 34, y: y - 11, w: w + 40, h: 22 };
  }
}

/* ── the lines themselves ─────────────────────────────────────────────── */

const Lines = memo(function Lines({ isolate, onHover }: { isolate: LineId | null; onHover: (l: LineId | null) => void }) {
  return (
    <g>
      {LINES.map((l) => (
        <g key={l.id} className={s.lineGroup} data-dim={isolate && isolate !== l.id ? "" : undefined}>
          <path d={l.track.d} fill="none" stroke={l.color} strokeWidth={STROKE} strokeLinejoin="round" />
        </g>
      ))}
      {/* Generous hit strokes, drawn last so hovering anywhere near a line isolates it. */}
      {LINES.map((l) => (
        <path
          key={l.id}
          d={l.track.d}
          className={s.lineHit}
          onPointerEnter={() => onHover(l.id)}
          onPointerLeave={() => onHover(null)}
        />
      ))}
    </g>
  );
});

/* ── stations, tabs, termini and interchanges ─────────────────────────── */

type StationsProps = {
  isolate: LineId | null;
  selected: Sel;
  focus: Sel;
  onSelect: (sel: Sel) => void;
  onFocusStation: (sel: Sel) => void;
  onHover: (l: LineId | null) => void;
};

const Stations = memo(function Stations({ isolate, selected, focus, onSelect, onFocusStation, onHover }: StationsProps) {
  return (
    <g>
      {LINES.map((l) => (
        <g key={l.id} className={s.lineGroup} data-dim={isolate && isolate !== l.id ? "" : undefined}>
          {l.stations.map((st, idx) => {
            const isSel = selected.line === l.id && selected.idx === idx;
            const hb = hitBox(st);
            const lp = labelPos(st);
            const [x, y] = st.at;
            const d = DIR[st.side];
            return (
              <g
                key={st.id}
                className={s.station}
                data-key={`${l.id}:${idx}`}
                data-selected={isSel ? "" : undefined}
                role="button"
                tabIndex={focus.line === l.id && focus.idx === idx ? 0 : -1}
                aria-label={`${l.name} line, ${st.name}${isSel ? ", selected" : ""}`}
                aria-pressed={isSel}
                onClick={() => onSelect({ line: l.id, idx })}
                onFocus={() => onFocusStation({ line: l.id, idx })}
                onPointerEnter={() => onHover(l.id)}
                onPointerLeave={() => onHover(null)}
              >
                <rect className={s.hit} x={hb.x} y={hb.y} width={hb.w} height={hb.h} rx={4} />
                {st.kind === "stop" && (
                  <line
                    x1={x + d[0] * 3}
                    y1={y + d[1] * 3}
                    x2={x + d[0] * 9.5}
                    y2={y + d[1] * 9.5}
                    stroke={l.color}
                    strokeWidth={3.6}
                  />
                )}
                {st.kind === "terminus" && !st.ix && (
                  <line x1={x + 6} y1={y - 10} x2={x + 6} y2={y + 10} stroke={l.color} strokeWidth={STROKE} />
                )}
                {st.kind === "origin" ? (
                  <OriginTab line={l.id} />
                ) : st.ix ? null : (
                  <text
                    className={s.stationName}
                    x={lp.x}
                    y={lp.y}
                    textAnchor={lp.anchor}
                    data-terminus={st.kind === "terminus" ? "" : undefined}
                  >
                    {st.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}

      {INTERCHANGES.map((ix) => (
        <g key={ix.id} className={s.interchange} pointerEvents="none">
          <rect
            x={ix.x - 8}
            y={ix.y0 - 8.5}
            width={16}
            height={ix.y1 - ix.y0 + 17}
            rx={8}
            fill={GROUND}
            stroke={INK}
            strokeWidth={3}
          />
          {ix.id === "registry" ? (
            <text className={s.ixName} x={ix.x} y={ix.y0 - 32} textAnchor="middle">
              <tspan x={ix.x}>Artifact</tspan>
              <tspan x={ix.x} dy={14}>
                Registry
              </tspan>
            </text>
          ) : (
            <text className={s.ixName} x={ix.x} y={ix.y1 + 28} textAnchor="middle">
              {ix.name}
            </text>
          )}
        </g>
      ))}
    </g>
  );
});

function OriginTab({ line }: { line: LineId }) {
  const l = LINE[line];
  const vertical = line === "infra";
  const w = 58;
  const h = 20;
  const x = vertical ? l.path[0][0] - w / 2 : l.path[0][0] - w;
  const y = vertical ? l.path[0][1] - h : l.path[0][1] - h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={l.color} />
      <text className={s.tabName} x={x + w / 2} y={y + h / 2 + 4.2} textAnchor="middle" fill={l.ink}>
        {l.name}
      </text>
    </g>
  );
}

/* ── the live layer: suspension, trains, timers ───────────────────────── */

export type ApiState = { suspendedFrom: number; suspendedTo: number; restoredTo: number } | null;

type LiveProps = {
  t: number;
  yard: Yard;
  reduced: boolean;
  isolate: LineId | null;
  selected: Sel;
  api: ApiState;
  release: { at: number; previousOpacity: number; live: boolean };
  onSelect: (sel: Sel) => void;
  onHoverTrain: (id: string | null) => void;
};

function Suspension({ api, isolate }: { api: ApiState; isolate: LineId | null }) {
  if (!api) return null;
  const track = LINE.api.track;
  const d = subPath(track, api.suspendedFrom, api.suspendedTo);
  const restored = api.restoredTo > api.suspendedFrom ? subPath(track, api.suspendedFrom, api.restoredTo) : "";
  return (
    <g className={s.lineGroup} data-dim={isolate && isolate !== "api" ? "" : undefined}>
      <path d={d} fill="none" stroke={GROUND} strokeWidth={STROKE + 1.2} />
      <path d={d} fill="none" stroke={GREY} strokeWidth={STROKE - 1} strokeDasharray="7 5" />
      {restored && <path d={restored} fill="none" stroke={LINE.api.color} strokeWidth={STROKE} />}
    </g>
  );
}

function Capsule({
  x,
  y,
  label,
  fill,
  ink,
  w = 50,
  state,
  compact = false,
  opacity = 1,
  onClick,
  onHover,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
  ink: string;
  w?: number;
  state?: "dwell" | "move" | "failed" | "release" | "previous";
  compact?: boolean;
  opacity?: number;
  onClick?: () => void;
  onHover?: (on: boolean) => void;
}) {
  // On the shared trunk lanes sit 9 units apart, so a train there is drawn as
  // a lane-sized car without its label; hovering it still names the commit.
  const cw = compact ? 24 : w;
  const ch = compact ? 7 : 16;
  return (
    <g
      className={s.capsule}
      data-state={state}
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
      opacity={opacity}
      onClick={onClick}
      onPointerEnter={onHover ? () => onHover(true) : undefined}
      onPointerLeave={onHover ? () => onHover(false) : undefined}
    >
      {state === "dwell" && (
        <rect className={s.pulse} x={-cw / 2} y={-ch / 2} width={cw} height={ch} rx={ch / 2} stroke={fill} />
      )}
      <rect
        x={-cw / 2}
        y={-ch / 2}
        width={cw}
        height={ch}
        rx={ch / 2}
        fill={fill}
        stroke={GROUND}
        strokeWidth={compact ? 1.3 : 1.6}
      />
      {!compact && (
        <text className={s.sha} x={0} y={3.1} textAnchor="middle" fill={ink}>
          {label}
        </text>
      )}
      {/* A generous invisible target, so a 7-unit car is still easy to point at. */}
      <rect x={-cw / 2 - 4} y={-11} width={cw + 8} height={22} fill="transparent" />
    </g>
  );
}

/** Lanes of the shared trunk, where trains are drawn compact. */
function onTrunk(line: LineId, x: number, y: number) {
  if (line === "mobile" && x > 626) return false;
  return x >= 546 && y >= 277 && y <= 323;
}

export function trainPos(run: Run, t: number, reduced: boolean) {
  const loc = locate(run, t);
  if (loc.phase === "queued") return null;
  const l = LINE[run.line];
  const st = l.stations[loc.i];
  const [x, y] = loc.phase === "move" && !reduced ? pointAt(l.track, loc.len) : st.at;
  return { x, y, loc, compact: onTrunk(run.line, x, y) };
}

function Live({ t, yard, reduced, isolate, selected, release, onSelect, onHoverTrain }: LiveProps) {
  const notes: React.ReactNode[] = [];
  const trains: React.ReactNode[] = [];

  for (const run of yard.runs) {
    const pos = trainPos(run, t, reduced);
    if (!pos) continue;
    const { loc } = pos;
    const l = LINE[run.line];
    let opacity = 1;
    if (loc.phase === "done") {
      const age = t - loc.at;
      if (age > 0.9) continue;
      opacity = reduced ? 0 : 1 - age / 0.9;
      if (opacity <= 0) continue;
    }
    const st = l.stations[loc.i];
    const failed = loc.phase === "failed";
    trains.push(
      <g key={run.id} className={s.lineGroup} data-dim={isolate && isolate !== run.line ? "" : undefined}>
        <Capsule
          x={pos.x}
          y={pos.y}
          label={run.sha}
          fill={failed ? INK : l.color}
          ink={failed ? GROUND : l.ink}
          state={failed ? "failed" : loc.phase === "dwell" ? "dwell" : "move"}
          compact={pos.compact}
          opacity={opacity}
          onClick={() => onSelect({ line: run.line, idx: loc.i })}
          onHover={(on) => onHoverTrain(on ? run.id : null)}
        />
      </g>,
    );

    if (st.ix) continue;
    const np = notePos(st);
    if (loc.phase === "dwell") {
      notes.push(
        <text
          key={`n-${run.id}`}
          className={s.timer}
          x={np.x}
          y={np.y}
          textAnchor={np.anchor}
          data-dim={isolate && isolate !== run.line ? "" : undefined}
        >
          {timer((t - loc.since) * K)}
        </text>,
      );
    } else if (failed) {
      notes.push(
        <text
          key={`n-${run.id}`}
          className={s.failNote}
          x={np.x}
          y={np.y}
          textAnchor={np.anchor}
          data-dim={isolate && isolate !== run.line ? "" : undefined}
        >
          {run.tests ?? 3} tests failed
        </text>,
      );
    }
  }

  const sel = LINE[selected.line].stations[selected.idx];

  return (
    <g>
      <circle className={s.selRing} cx={sel.at[0]} cy={sel.at[1]} r={sel.ix ? 7.5 : 11} />
      {notes}
      {release.previousOpacity > 0 && (
        <ReleaseTag x={IX_X.production} label={RELEASE.previous} previous opacity={release.previousOpacity} />
      )}
      <ReleaseTag x={IX_X.canary + (IX_X.production - IX_X.canary) * release.at} label={RELEASE.name} />
      {trains}
    </g>
  );
}

/** The release in an environment, hung above its interchange rather than on the lanes. */
function ReleaseTag({ x, label, previous = false, opacity = 1 }: { x: number; label: string; previous?: boolean; opacity?: number }) {
  const y = 250;
  return (
    <g className={s.releaseTag} transform={`translate(${x.toFixed(2)} ${y})`} opacity={opacity} aria-hidden="true">
      <line x1={0} x2={0} y1={8} y2={24} stroke={previous ? "#a9a79f" : INK} strokeWidth={1.6} />
      <rect x={-31} y={-9} width={62} height={18} rx={2} fill={previous ? "#e8e6df" : INK} />
      <text className={s.sha} x={0} y={3.4} textAnchor="middle" fill={previous ? INK : GROUND}>
        {label}
      </text>
    </g>
  );
}

/* ── title block, key and the leader to the release gate ──────────────── */

const RIGHT = 1340;

const Cartouche = memo(function Cartouche({ clock }: { clock: string }) {
  return (
    <g>
      <text className={s.cTitle} x={RIGHT} y={30} textAnchor="end">
        atlas
      </text>
      <text className={s.cSub} x={RIGHT} y={52} textAnchor="end">
        Pipeline map, monorepo
      </text>
      <line x1={RIGHT - 170} x2={RIGHT} y1={64} y2={64} stroke={INK} strokeWidth={1.4} />
      <text className={s.cMeta} x={RIGHT} y={83} textAnchor="end">
        Thursday 19 November 2026
      </text>
      <text className={s.cMeta} x={RIGHT} y={100} textAnchor="end">
        <tspan className={s.cClock}>{clock}</tspan>
        <tspan> · replayed at 30×</tspan>
      </text>
    </g>
  );
});

const Leader = memo(function Leader() {
  return (
    <g aria-hidden="true">
      <line x1={IX_X.production + 9} x2={GATE.x} y1={300} y2={300} stroke={INK} strokeWidth={1.6} />
      <circle cx={IX_X.production + 9} cy={300} r={2.6} fill={INK} />
    </g>
  );
});

const Key = memo(function Key() {
  const x = 700;
  const y = 540;
  return (
    <g className={s.key} aria-hidden="true">
      <text className={s.keyHead} x={x} y={y}>
        Key
      </text>
      <g transform={`translate(${x} ${y + 18})`}>
        <line x1={0} x2={30} y1={0} y2={0} stroke={INK} strokeWidth={5} />
        <line x1={15} x2={15} y1={-2.5} y2={-8} stroke={INK} strokeWidth={3} />
        <text className={s.keyText} x={42} y={4}>
          Stage
        </text>
      </g>
      <g transform={`translate(${x} ${y + 40})`}>
        <line x1={0} x2={30} y1={0} y2={0} stroke={INK} strokeWidth={5} />
        <rect x={9} y={-7} width={12} height={14} rx={6} fill={GROUND} stroke={INK} strokeWidth={2.4} />
        <text className={s.keyText} x={42} y={4}>
          Shared environment
        </text>
      </g>
      <g transform={`translate(${x} ${y + 62})`}>
        <rect x={0} y={-7} width={30} height={14} rx={7} fill={INK} />
        <text className={s.keyText} x={42} y={4}>
          Running build, by commit
        </text>
      </g>
      <g transform={`translate(${x} ${y + 84})`}>
        <line x1={0} x2={30} y1={0} y2={0} stroke={GREY} strokeWidth={5} strokeDasharray="6 4" />
        <text className={s.keyText} x={42} y={4}>
          Suspended
        </text>
      </g>
    </g>
  );
});

/* ── the map ──────────────────────────────────────────────────────────── */

type MapProps = Omit<LiveProps, "isolate"> & {
  isolate: LineId | null;
  focus: Sel;
  clock: string;
  onHover: (l: LineId | null) => void;
  onFocusStation: (sel: Sel) => void;
  onBlurMap: () => void;
};

export function TransitMap(props: MapProps) {
  const { isolate, selected, focus, onSelect, onHover, onFocusStation, onBlurMap, clock } = props;
  const svgRef = useRef<SVGSVGElement>(null);

  const move = useCallback(
    (to: Sel) => {
      onFocusStation(to);
      requestAnimationFrame(() => {
        svgRef.current?.querySelector<SVGGElement>(`[data-key="${to.line}:${to.idx}"]`)?.focus();
      });
    },
    [onFocusStation],
  );

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const line = LINE[focus.line];
    const n = line.stations.length;
    const li = ORDER.indexOf(focus.line);
    let to: Sel | null = null;
    switch (e.key) {
      case "ArrowRight":
        to = { line: focus.line, idx: Math.min(n - 1, focus.idx + 1) };
        break;
      case "ArrowLeft":
        to = { line: focus.line, idx: Math.max(0, focus.idx - 1) };
        break;
      case "ArrowDown":
      case "ArrowUp": {
        const nl = ORDER[(li + (e.key === "ArrowDown" ? 1 : ORDER.length - 1)) % ORDER.length];
        to = { line: nl, idx: Math.min(LINE[nl].stations.length - 1, focus.idx) };
        break;
      }
      case "Home":
        to = { line: focus.line, idx: 0 };
        break;
      case "End":
        to = { line: focus.line, idx: n - 1 };
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(focus);
        return;
      case "Escape":
        onHover(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    if (to) move(to);
  };

  return (
    <svg
      ref={svgRef}
      className={s.map}
      width={VB.w}
      height={VB.h}
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      role="group"
      aria-label="Pipeline map. Arrow keys move between stations, Enter opens the job log."
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlurMap();
      }}
    >
      <Cartouche clock={clock} />
      <Key />
      <Leader />
      <Lines isolate={isolate} onHover={onHover} />
      <Suspension api={props.api} isolate={isolate} />
      <Stations
        isolate={isolate}
        selected={selected}
        focus={focus}
        onSelect={onSelect}
        onFocusStation={onFocusStation}
        onHover={onHover}
      />
      <Live {...props} />
    </svg>
  );
}

"use client";

/* The hot clock: a 60-minute wheel read clockwise from the 17:00 post at the
   top. Segments are laid out from the running order and tweened toward their
   targets every frame, so a drop or a move re-flows the whole wheel. */

import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import s from "./shot.module.css";
import {
  HOUR_START,
  POST,
  TYPE_LABEL,
  clock,
  dueDrift,
  mmss,
  signed,
  stateOf,
  type Phase,
  type Placed,
} from "./data";
import { Icon } from "./icons";
import { Fig } from "./fig";

const C = 320;
const R_IN = 194;
const R_OUT = 258;
const R_MID = (R_IN + R_OUT) / 2;
const LANE_IN = 263;
const LANE_OUT = 271;
const TAU = Math.PI * 2;

const ang = (t: number) => (t / 3600) * TAU - Math.PI / 2;
const pt = (r: number, t: number) => {
  const a = ang(t);
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
};

function sector(t0: number, t1: number, r0: number, r1: number) {
  if (t1 - t0 < 0.05) return "";
  const large = t1 - t0 > 1800 ? 1 : 0;
  return `M${pt(r1, t0)}A${r1} ${r1} 0 ${large} 1 ${pt(r1, t1)}L${pt(r0, t1)}A${r0} ${r0} 0 ${large} 0 ${pt(r0, t0)}Z`;
}

function arc(t0: number, t1: number, r: number, reverse = false) {
  const large = t1 - t0 > 1800 ? 1 : 0;
  return reverse
    ? `M${pt(r, t1)}A${r} ${r} 0 ${large} 0 ${pt(r, t0)}`
    : `M${pt(r, t0)}A${r} ${r} 0 ${large} 1 ${pt(r, t1)}`;
}

/* ── tween ─────────────────────────────────────────────────────────────── */

type Span = [number, number];

function useTweened(target: Map<string, Span>, reduced: boolean) {
  // Mount state: every segment collapsed at the post, so the hour sweeps out.
  const [shown, setShown] = useState<Map<string, Span>>(() => new Map());
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 9);
      const next = new Map<string, Span>();
      const first = shownRef.current.size === 0;
      let moving = false;
      target.forEach(([a, b], id) => {
        // First paint sweeps out from the post; a newly added spare grows in place.
        const [sa, sb] = shownRef.current.get(id) ?? (first ? [0, 0] : [a, a]);
        const na = sa + (a - sa) * k;
        const nb = sb + (b - sb) * k;
        if (Math.abs(na - a) > 0.4 || Math.abs(nb - b) > 0.4) moving = true;
        next.set(id, [na, nb]);
      });
      if (!moving) {
        shownRef.current = target;
        setShown(target);
        return;
      }
      shownRef.current = next;
      setShown(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return reduced ? target : shown;
}

/* ── the wheel ─────────────────────────────────────────────────────────── */

type Props = {
  placed: Placed[];
  phase: Record<string, Phase>;
  nowAbs: number;
  over: number;
  selectedId: string | null;
  hoverId: string | null;
  draggingId: string | null;
  movable: (id: string) => boolean;
  reduced: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragTo: (id: string, t: number) => void;
  onDragEnd: () => void;
  onKey: (e: ReactKeyboardEvent) => void;
  nextTitle?: string;
  nextIn?: number;
};

export const Dial = memo(function Dial(props: Props) {
  const {
    placed,
    phase,
    nowAbs,
    over,
    selectedId,
    hoverId,
    draggingId,
    movable,
    reduced,
    onSelect,
    onHover,
    onDragStart,
    onDragTo,
    onDragEnd,
    onKey,
    nextTitle,
    nextIn,
  } = props;
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<number | null>(null);

  const target = useMemo(() => {
    const m = new Map<string, Span>();
    for (const p of placed) m.set(p.id, [p.start, p.end]);
    return m;
  }, [placed]);
  const shown = useTweened(target, reduced);

  const now = nowAbs - HOUR_START;
  const sec = Math.floor(nowAbs) % 60;
  const state = stateOf(over);
  const last = placed[placed.length - 1];
  const endShown = last ? (shown.get(last.id)?.[1] ?? 0) : 0;

  const timeAt = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 640 - C;
    const y = ((e.clientY - r.top) / r.height) * 640 - C;
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += TAU;
    return (a / TAU) * 3600;
  };

  const down = (e: ReactPointerEvent, id: string) => {
    onSelect(id);
    if (!movable(id)) return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    onDragStart(id);
    setGhost(timeAt(e));
  };
  const move = (e: ReactPointerEvent) => {
    if (!draggingId) return;
    const t = timeAt(e);
    setGhost(t);
    onDragTo(draggingId, t);
  };
  const up = (e: ReactPointerEvent) => {
    if (!draggingId) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    setGhost(null);
    onDragEnd();
  };

  const inspectId = draggingId ?? hoverId ?? selectedId;
  const inspected = inspectId ? placed.find((p) => p.id === inspectId) : undefined;
  const travel = placed.find((p) => p.item.due);
  const travelDrift = travel ? dueDrift(travel) : null;
  const active = selectedId ? `${uid}-seg-${selectedId}` : undefined;

  return (
    <div className={s.dialWrap}>
      <svg
        ref={svgRef}
        viewBox="0 0 640 640"
        className={s.dial}
        role="listbox"
        tabIndex={0}
        aria-label="Hot clock, 16:00 hour. Arrow keys select, Alt and arrows move, D drops."
        aria-activedescendant={active}
        onKeyDown={onKey}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        data-dragging={draggingId ? "" : undefined}
      >
        <defs>
          <pattern id="hc0004-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" className={s.hatchBase} />
            <rect width="2.2" height="7" className={s.hatchLine} />
          </pattern>
          {placed.map((p) => {
            const [a, b0] = shown.get(p.id) ?? [0, 0];
            const b = Math.min(b0, POST);
            if (b - a < 1) return null;
            const mid = (a + b) / 2;
            const bottom = mid > 900 && mid < 2700;
            return (
              <path
                key={p.id}
                id={`${uid}-lbl-${p.id}`}
                d={arc(a, b, bottom ? R_MID - 0.5 : R_MID + 0.5, bottom)}
              />
            );
          })}
        </defs>

        {/* minute ticks and numerals */}
        <g className={s.ticks} aria-hidden>
          {Array.from({ length: 60 }, (_, m) => {
            const five = m % 5 === 0;
            const a = ang(m * 60);
            const r0 = five ? 276 : 279;
            const r1 = five ? 288 : 284;
            return (
              <line
                key={m}
                x1={C + r0 * Math.cos(a)}
                y1={C + r0 * Math.sin(a)}
                x2={C + r1 * Math.cos(a)}
                y2={C + r1 * Math.sin(a)}
                data-five={five || undefined}
              />
            );
          })}
          {Array.from({ length: 12 }, (_, i) => {
            if (i === 0) return null;
            const a = ang(i * 300);
            return (
              <text key={i} x={C + 304 * Math.cos(a)} y={C + 304 * Math.sin(a)} className={s.numeral}>
                {String(i * 5).padStart(2, "0")}
              </text>
            );
          })}
          <text x={C} y={C - 304} className={s.numeral} data-post>
            17:00
          </text>
        </g>

        {/* seconds ring: the studio clock's LED dots */}
        <g aria-hidden>
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i / 60) * TAU - Math.PI / 2;
            const lit = i <= sec;
            return (
              <circle
                key={i}
                cx={C + 176 * Math.cos(a)}
                cy={C + 176 * Math.sin(a)}
                r={i % 5 === 0 ? 2.9 : 2.1}
                className={s.dot}
                data-lit={lit || undefined}
              />
            );
          })}
        </g>

        {/* segments */}
        <g>
          {placed.map((p) => {
            const [a, b] = shown.get(p.id) ?? [0, 0];
            const ph = phase[p.id];
            const can = movable(p.id);
            const mainEnd = Math.min(b, POST);
            const spentEnd = Math.min(mainEnd, Math.max(a, now));
            const liveStart = Math.max(a, now);
            const selected = selectedId === p.id;
            const hovered = hoverId === p.id;
            const lifted = draggingId === p.id;
            const span = Math.max(0, mainEnd - a);
            // Only segments that hold their whole name get one; the rest carry
            // their category in fill and pattern, and name themselves on hover.
            const room = ((span / 3600) * TAU * R_MID - 18) / 6.4;
            const name = p.item.dial ?? p.item.title;
            const label = !p.dropped && p.item.dur >= 180 && name.length <= room ? name : null;
            const rimmed = p.item.type === "travel" || p.item.type === "legal";
            return (
              <g
                key={p.id}
                id={`${uid}-seg-${p.id}`}
                role="option"
                aria-selected={selected}
                aria-label={`${clock(HOUR_START + p.start)} ${TYPE_LABEL[p.item.type]}: ${p.item.title}, ${mmss(p.item.dur)}, ${ph}`}
                className={s.seg}
                data-type={p.item.type}
                data-phase={ph}
                data-movable={can || undefined}
                data-lifted={lifted || undefined}
                onPointerDown={(e) => down(e, p.id)}
                onPointerEnter={() => onHover(p.id)}
                onPointerLeave={() => onHover(null)}
              >
                {a < POST && spentEnd > a ? <path d={sector(a, spentEnd, R_IN, R_OUT)} data-spent /> : null}
                {a < POST && mainEnd > liveStart ? <path d={sector(liveStart, mainEnd, R_IN, R_OUT)} /> : null}
                {rimmed && span > 0.5 ? <path d={sector(a, mainEnd, R_IN + 3, R_IN + 5)} className={s.rim} /> : null}
                {b > POST ? <path d={sector(Math.max(a, POST) - POST, b - POST, LANE_IN, LANE_OUT)} data-over /> : null}
                {ph === "onair" && mainEnd > now ? (
                  <path d={sector(now, mainEnd, R_IN - 7, R_IN - 3)} className={s.tallyArc} />
                ) : null}
                {(selected || hovered || lifted) && span > 0.5 ? (
                  <path
                    d={sector(a, mainEnd, R_IN, R_OUT)}
                    className={s.segRing}
                    data-strong={selected || lifted || undefined}
                  />
                ) : null}
                {label ? (
                  <text className={s.segLabel} dominantBaseline="central">
                    <textPath href={`#${uid}-lbl-${p.id}`} startOffset="50%" textAnchor="middle">
                      {label}
                    </textPath>
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        {/* the post: 17:00:00 news, pinned */}
        <g aria-hidden className={s.post}>
          <line x1={C} y1={C - R_IN + 6} x2={C} y2={C - 292} />
        </g>

        {/* run long: the overrun is drawn past the post on its own lane */}
        {state === "long" && endShown > POST + 1 ? (
          <text
            aria-hidden
            className={s.overLabel}
            x={C + 247 * Math.cos(ang(endShown - POST + 50))}
            y={C + 247 * Math.sin(ang(endShown - POST + 50))}
          >
            {signed(over)}
          </text>
        ) : null}
        {endShown < POST - 1 ? (
          <g aria-hidden className={s.under} data-state={state}>
            <path d={sector(endShown, POST, R_IN + 6, R_OUT - 6)} />
            {POST - endShown > 30 ? (
              <text
                x={C + R_MID * Math.cos(ang((endShown + POST) / 2))}
                y={C + R_MID * Math.sin(ang((endShown + POST) / 2))}
              >
                {signed(over)}
              </text>
            ) : null}
          </g>
        ) : null}

        {/* travel is booked for :45, plus or minus a minute */}
        {travel && !travel.dropped ? (
          <g aria-hidden className={s.due} data-ok={travelDrift?.ok || undefined}>
            <path d={arc(travel.item.due!.at - travel.item.due!.within, travel.item.due!.at + travel.item.due!.within, 267)} />
            <circle cx={C + 267 * Math.cos(ang(travel.item.due!.at))} cy={C + 267 * Math.sin(ang(travel.item.due!.at))} r={3} />
          </g>
        ) : null}

        {/* drag ghost */}
        {ghost !== null ? (
          <g aria-hidden className={s.ghost}>
            <line
              x1={C + (R_IN - 10) * Math.cos(ang(ghost))}
              y1={C + (R_IN - 10) * Math.sin(ang(ghost))}
              x2={C + (R_OUT + 14) * Math.cos(ang(ghost))}
              y2={C + (R_OUT + 14) * Math.sin(ang(ghost))}
            />
          </g>
        ) : null}

        {/* the hand */}
        <g aria-hidden className={s.hand} style={{ transform: `rotate(${(now / 3600) * 360}deg)` }}>
          <line x1={C} y1={C - 186} x2={C} y2={C - 293} />
          <path d={`M${C - 5} ${C - 300}L${C + 5} ${C - 300}L${C} ${C - 292}Z`} />
        </g>
      </svg>

      <div className={s.dialFace} aria-hidden>
        <span className={s.faceDate}>Thu 19 Nov · hour 16</span>
        <span className={s.faceTime}>
          <Fig>{clock(nowAbs)}</Fig>
        </span>
        <span className={s.faceState} data-state={state}>
          <Icon name={state} className={s.faceIcon} />
          <span>
            <Fig>{state === "clean" ? `Clean ${signed(over)}` : `${mmss(Math.abs(over))} ${state}`}</Fig>
          </span>
        </span>
        <span className={s.faceInspect} data-empty={!inspected || undefined}>
          {inspected ? (
            <>
              <b>{TYPE_LABEL[inspected.item.type]}</b>
              <span className={s.faceNextTitle}>{inspected.item.title}</span>
              <span className={s.tnum}>
                <Fig>{inspected.dropped ? `dropped · ${mmss(inspected.item.dur)}` : `${clock(HOUR_START + inspected.start)} · ${mmss(inspected.item.dur)}`}</Fig>
              </span>
            </>
          ) : (
            "Hover a segment to name it"
          )}
        </span>
        {nextTitle && nextIn !== undefined ? (
          <span className={s.faceNext}>
            <i>Next</i>
            <span className={s.faceNextTitle}>{nextTitle}</span>
            <span className={s.tnum}>
              <Fig>{mmss(Math.ceil(nextIn))}</Fig>
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
});

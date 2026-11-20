"use client";

/* The elevation: Hotel Meridiana's street front, one window per room.
   Rooms sit in a 17-column grid (end wall, seven rooms, the service core, seven
   rooms, end wall) whose fractions are shared with the carts, so a cart can be
   placed in pixels from a position measured in rooms and floors. */

import {
  memo,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ARRIVALS, CORE, CORE_X, END, SPAN, STATUS, colX, type Room, type Shape, type Status } from "./data";
import { roomPos, type Sim } from "./sim";
import { Fob, Mark, StatusGlyph } from "./icons";
import s from "./shot.module.css";

const SILL = 17;
const FLOORS = [9, 8, 7, 6, 5, 4, 3, 2];

export type Highlight =
  | { kind: "crew"; id: number }
  | { kind: "status"; status: Status }
  | { kind: "room"; id: number }
  | null;

type FaceProps = { id: number; status: Status; pct: number };

function Face({ id, status, pct }: FaceProps) {
  return (
    <>
      {status === "cln" && <span className={s.fill} style={{ height: `${pct}%` }} />}
      <span className={s.num}>{id}</span>
      <StatusGlyph status={status} />
    </>
  );
}

type WinProps = {
  id: number;
  floor: number;
  col: number;
  status: Status;
  prev: Status | "glass";
  rev: number;
  pct: number;
  stay: Room["stay"];
  serviced: boolean;
  arrival: 0 | 1 | 2;
  markShape: Shape | null;
  markColor: string | null;
  selected: boolean;
  focusable: boolean;
  dim: boolean;
  lit: boolean;
  shake: number;
  delay: number;
  label: string;
  onDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onEnter: (e: PointerEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
  onFocus: (e: FocusEvent<HTMLButtonElement>) => void;
};

const Win = memo(function Win(p: WinProps) {
  const gridColumn = p.col <= 7 ? p.col + 1 : p.col + 2;
  const gridRow = 10 - p.floor;
  return (
    <button
      type="button"
      data-room={p.id}
      className={s.win}
      data-sel={p.selected || undefined}
      data-dim={p.dim || undefined}
      data-lit={p.lit || undefined}
      data-shake={p.shake % 2 === 1 ? "a" : p.shake > 0 ? "b" : undefined}
      tabIndex={p.focusable ? 0 : -1}
      aria-label={p.label}
      aria-pressed={p.selected}
      style={{ gridColumn, gridRow }}
      onPointerDown={p.onDown}
      onClick={p.onClick}
      onPointerEnter={p.onEnter}
      onPointerLeave={p.onLeave}
      onFocus={p.onFocus}
      onBlur={p.onLeave}
    >
      <span className={s.layer} data-s={p.prev}>
        {p.prev !== "glass" && <Face id={p.id} status={p.prev} pct={100} />}
      </span>
      <span key={p.rev} className={s.blind} data-s={p.status} style={{ "--d": `${p.delay}ms` } as CSSProperties}>
        <Face id={p.id} status={p.status} pct={p.pct} />
      </span>
      <span key={`h${p.rev}`} className={s.hem} style={{ "--d": `${p.delay}ms` } as CSSProperties} />
      {p.arrival === 2 && (
        <span className={s.fobWrap} data-on={p.status}>
          <Fob early />
        </span>
      )}
      {p.markShape && p.markColor && (
        <span className={s.wmark}>
          <Mark shape={p.markShape} color={p.markColor} size={10} />
        </span>
      )}
    </button>
  );
});

export function roomLabel(r: Room, sim: Sim) {
  const parts = [`Room ${r.id}`, STATUS[r.status].label];
  if (r.status === "cln") parts.push(`${Math.round(r.progress * 100)} percent`);
  if (r.stay === "dueout") parts.push("due out");
  if (r.assignee) parts.push(`assigned to ${sim.crew[r.assignee - 1].first}`);
  else if (r.status === "vd") parts.push("unassigned");
  if (r.arrival != null) {
    const a = ARRIVALS[r.arrival];
    parts.push(`arrival ${a.name} ${Math.floor(a.eta / 60)}:${String(a.eta % 60).padStart(2, "0")}${a.early ? ", early check-in" : ""}`);
  }
  return parts.join(", ");
}

type FacadeProps = {
  sim: Sim;
  reduced: boolean;
  selected: number | null;
  highlight: Highlight;
  shake: { room: number; n: number } | null;
  onDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onHover: (id: number | null, el: HTMLElement | null) => void;
  tower: ReactNode;
  billboard: ReactNode;
  fasciaLeft: ReactNode;
  fasciaRight: ReactNode;
  staffLeft: ReactNode;
  staffRight: ReactNode;
};

export function Facade(props: FacadeProps) {
  const { sim, reduced, selected, highlight, shake, onDown, onClick, onHover } = props;
  const floorsRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<{ w: number; h: number; gh: number } | null>(null);
  const [geo, setGeo] = useState<{ w: number; h: number } | null>(null);
  const cartEls = useRef<(HTMLDivElement | null)[]>([]);
  const [focusId, setFocusId] = useState(512);
  const [opened] = useState(() => !reduced);

  useLayoutEffect(() => {
    const el = floorsRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const gh = groundRef.current?.getBoundingClientRect().height ?? 100;
      geoRef.current = { w: r.width, h: r.height, gh };
      setGeo({ w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (groundRef.current) ro.observe(groundRef.current);
    return () => ro.disconnect();
  }, []);

  // Carts are placed every frame straight onto the DOM: six transforms, no re-render.
  useEffect(() => {
    let raf = 0;
    const place = () => {
      const g = geoRef.current;
      if (g) {
        const rowH = g.h / 8;
        const yAt = (f: number) => {
          const y2 = 8 * rowH - SILL / 2;
          if (f >= 2) return (10 - f) * rowH - SILL / 2;
          return y2 + (g.h + g.gh * 0.68 - y2) * (2 - f);
        };
        for (const c of sim.crew) {
          const el = cartEls.current[c.id - 1];
          if (!el) continue;
          const p = reduced && c.phase === "travel" && c.current != null ? roomPos(sim.room(c.current)) : c.pos;
          const x = (p.x / SPAN) * g.w;
          const y = yAt(p.f);
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%)`;
          const lift = Math.abs(p.x - CORE_X) < 1e-3 && c.phase === "travel";
          if ((el.dataset.lift === "1") !== lift) el.dataset.lift = lift ? "1" : "0";
        }
      }
      raf = requestAnimationFrame(place);
    };
    raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [sim, reduced]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const r = sim.byId.get(focusId);
    if (!r) return;
    let floor = r.floor;
    let col = r.col;
    if (e.key === "ArrowLeft") col = Math.max(1, col - 1);
    else if (e.key === "ArrowRight") col = Math.min(14, col + 1);
    else if (e.key === "ArrowUp") floor = Math.min(9, floor + 1);
    else if (e.key === "ArrowDown") floor = Math.max(2, floor - 1);
    else if (e.key === "Home") col = 1;
    else if (e.key === "End") col = 14;
    else return;
    e.preventDefault();
    const id = floor * 100 + col;
    setFocusId(id);
    floorsRef.current?.querySelector<HTMLButtonElement>(`[data-room="${id}"]`)?.focus();
  };

  const onEnter = (e: PointerEvent<HTMLButtonElement>) => onHover(Number(e.currentTarget.dataset.room), e.currentTarget);
  const onLeave = () => onHover(null, null);
  const onFocus = (e: FocusEvent<HTMLButtonElement>) => {
    const id = Number(e.currentTarget.dataset.room);
    setFocusId(id);
    if (e.currentTarget.matches(":focus-visible")) onHover(id, e.currentTarget);
  };

  const crewRooms =
    highlight?.kind === "crew"
      ? new Set([...sim.crew[highlight.id - 1].queue, sim.crew[highlight.id - 1].current ?? -1])
      : null;

  const vdByFloor = (f: number) => sim.rooms.filter((r) => r.floor === f && r.status === "vd").length;

  return (
    <div className={s.building}>
      <div className={s.roofRow}>
        <NameSign w={geo?.w ?? 0} />
        <div className={s.towerCell}>{props.tower}</div>
        <div className={s.billboardCell}>{props.billboard}</div>
        <span className={s.roofSlab} />
      </div>

      <div className={s.floors} ref={floorsRef} onKeyDown={onKey} role="grid" aria-label="Hotel Meridiana, rooms by floor">
        <div className={s.endwall} style={{ gridColumn: 1 }} />
        <div className={s.endwall} style={{ gridColumn: 17 }} />
        <div className={s.core} style={{ gridColumn: 9 }}>
          <div className={s.shaft}>
            {FLOORS.map((f) => (
              <span key={f} className={s.landing} />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }, (_, k) => (
          <span key={`fl${k}`} className={s.fin} style={{ left: `${((END + k) / SPAN) * 100}%` }} />
        ))}
        {Array.from({ length: 8 }, (_, k) => (
          <span key={`fr${k}`} className={s.fin} style={{ left: `${((END + 7 + CORE + k) / SPAN) * 100}%` }} />
        ))}
        {FLOORS.map((f, r) => (
          <div key={f} className={s.slabRow} style={{ top: `calc(${(r + 1) * 12.5}% - ${SILL}px)` }}>
            <span className={s.slab} style={{ left: `${(END / SPAN) * 100}%`, width: `${(7 / SPAN) * 100}%` }} />
            <span className={s.slab} style={{ left: `${((END + 7 + CORE) / SPAN) * 100}%`, width: `${(7 / SPAN) * 100}%` }} />
          </div>
        ))}
        {FLOORS.map((f, r) => {
          const vd = vdByFloor(f);
          return (
            <div key={`n${f}`} className={s.floorTag} style={{ top: `${r * 12.5}%`, height: "12.5%" }}>
              <span className={s.floorNo}>{f}</span>
              <span className={s.floorVd} data-zero={vd === 0 || undefined} title={`${vd} vacant dirty on floor ${f}`}>
                <span className={s.miniPane} data-s="vd" />
                {vd}
              </span>
            </div>
          );
        })}

        {sim.rooms.map((r) => {
          const a = r.arrival == null ? null : ARRIVALS[r.arrival];
          const crew = r.assignee == null ? null : sim.crew[r.assignee - 1];
          const queued = crew != null && r.status !== "cln";
          let dim = false;
          let lit = false;
          if (highlight?.kind === "status") dim = r.status !== highlight.status;
          else if (highlight?.kind === "room") {
            dim = r.id !== highlight.id;
            lit = !dim;
          } else if (crewRooms) {
            dim = !crewRooms.has(r.id);
            lit = !dim;
          }
          const row = 9 - r.floor;
          return (
            <Win
              key={r.id}
              id={r.id}
              floor={r.floor}
              col={r.col}
              status={r.status}
              prev={r.prev}
              rev={r.rev}
              pct={Math.round(r.progress * 100)}
              stay={r.stay}
              serviced={r.serviced}
              arrival={a ? (a.early ? 2 : 1) : 0}
              markShape={queued ? crew.shape : null}
              markColor={queued ? crew.color : null}
              selected={selected === r.id}
              focusable={focusId === r.id}
              dim={dim}
              lit={lit}
              shake={shake?.room === r.id ? shake.n : 0}
              delay={opened && r.rev === 0 ? 120 + row * 85 + (r.col <= 7 ? r.col : 15 - r.col) * 16 : 0}
              label={roomLabel(r, sim)}
              onDown={onDown}
              onClick={onClick}
              onEnter={onEnter}
              onLeave={onLeave}
              onFocus={onFocus}
            />
          );
        })}

        <div className={s.carts} aria-hidden>
          {sim.crew.map((c) => (
            <div
              key={c.id}
              ref={(el) => {
                cartEls.current[c.id - 1] = el;
              }}
              className={s.cart}
              data-phase={c.phase}
              data-lit={highlight?.kind === "crew" && highlight.id === c.id ? "1" : undefined}
              data-dim={highlight?.kind === "crew" && highlight.id !== c.id ? "1" : undefined}
              style={{ "--c": c.color } as CSSProperties}
            >
              <span className={s.cartBody}>
                <Mark shape={c.shape} color={c.color} size={9} />
                {c.id}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={s.groundRow} ref={groundRef}>
        <div className={s.fascia} style={{ gridColumn: "1 / 9" }}>
          {props.fasciaLeft}
        </div>
        <div className={s.fascia} style={{ gridColumn: "10 / 18" }}>
          {props.fasciaRight}
        </div>
        <div className={s.serviceBay} style={{ gridColumn: 9 }}>
          <span className={s.serviceText}>Service</span>
          <span className={s.serviceDoor} />
        </div>
        <div className={s.staffZone} style={{ gridColumn: "1 / 9" }}>
          {props.staffLeft}
        </div>
        <div className={s.staffZone} style={{ gridColumn: "10 / 18" }}>
          {props.staffRight}
        </div>
      </div>
    </div>
  );
}

/* ── the name sign on the west wing roof ─────────────────────────────────── */

function NameSign({ w }: { w: number }) {
  const x = (colX(4) / SPAN) * w;
  return (
    <div className={s.nameSign}>
      {w > 0 && (
        <svg className={s.signSvg} width={w} height={60} viewBox={`0 0 ${w} 60`} aria-hidden>
          <g className={s.signFrame}>
            <path d={`M${x - 124} 26V60M${x + 124} 26V60M${x - 66} 26V60M${x + 66} 26V60`} />
            <path d={`M${x - 140} 25.5H${x + 140}`} className={s.signRail} />
            <path d={`M${x - 124} 42L${x - 66} 26M${x + 124} 42L${x + 66} 26`} />
          </g>
        </svg>
      )}
      <div className={s.sign} style={{ left: x }}>
        Hotel Meridiana
      </div>
    </div>
  );
}

"use client";

/* 0013 Turndown
   The housekeeping board for Hotel Meridiana at 11:20 on a heavy checkout
   day, drawn as the building's own street elevation. Each window is a room;
   its blind rolls down in the colour of the room's status. Carts work the
   corridors and ride the service lift on a scenario clock, and the supervisor
   drags rooms onto attendants (or selects one and presses 1 to 6) to get the
   early check-ins clean and inspected before 15:00. */

import { Albert_Sans, Young_Serif } from "next/font/google";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { ARRIVALS, STATUS, credit, hhmm, type Room } from "./data";
import { Facade, type Highlight } from "./facade";
import { Fob, Icon, Mark } from "./icons";
import { ArrivalsBoard, Billboard, Pane, StaffCells, StaffFascia, TowerClock } from "./boards";
import { Sim, jobCredit, type LogItem } from "./sim";
import s from "./shot.module.css";

const sans = Albert_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-albert" });
const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-young" });

type Hover = { id: number; left: number; top: number; w: number; h: number; paneW: number; paneH: number };

export default function Turndown() {
  const reduced = !!useReducedMotion();
  const [sim, setSim] = useState(() => new Sim());
  const [run, setRun] = useState(0);
  const [, setVersion] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [drag, setDrag] = useState<{ room: number; over: number | null } | null>(null);
  const [shake, setShake] = useState<{ room: number; n: number } | null>(null);
  const [crewShake, setCrewShake] = useState<{ id: number; n: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; x: number; y: number; active: boolean; over: number | null } | null>(null);
  const swallowClick = useRef(false);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // The scenario clock. Discrete changes re-render at once; progress fills at ~8fps.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let dirty = false;
      if (speed > 0 && !sim.done) dirty = sim.step(dt * speed);
      acc += dt;
      if (dirty || (speed > 0 && acc > 0.12)) {
        acc = 0;
        bump();
      }
      if (sim.done && speed > 0) setSpeed(0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim, speed, bump]);

  const assign = useCallback(
    (room: number, crew: number) => {
      const res = sim.assign(room, crew);
      if (res.ok) setSelected(null);
      else {
        setShake((p) => ({ room, n: (p?.room === room ? p.n : 0) + 1 }));
        setCrewShake((p) => ({ id: crew, n: (p?.id === crew ? p.n : 0) + 1 }));
      }
      bump();
    },
    [sim, bump],
  );

  const inspect = useCallback(
    (room: number) => {
      const res = sim.inspect(room);
      if (!res.ok) setShake((p) => ({ room, n: (p?.room === room ? p.n : 0) + 1 }));
      bump();
    },
    [sim, bump],
  );

  // Drag a window onto an attendant. Pointer events, so it is our ghost, not the browser's.
  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const g = ghostRef.current;
      if (g) g.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (!p.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) {
        p.active = true;
        setHover(null);
        setDrag({ room: p.id, over: null });
      }
      if (p.active) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-crew]");
        const over = hit ? Number(hit.dataset.crew) : null;
        if (over !== p.over) {
          p.over = over;
          setDrag({ room: p.id, over });
        }
      }
    };
    const up = () => {
      const p = press.current;
      press.current = null;
      if (!p?.active) return;
      swallowClick.current = true;
      setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      setDrag(null);
      if (p.over != null) assign(p.id, p.over);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [assign]);

  // Keys: 1–6 assign the selected room, I inspects it, Escape lets go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setSelected(null);
        setHover(null);
        return;
      }
      if (selected == null) return;
      if (/^[1-6]$/.test(e.key)) {
        e.preventDefault();
        assign(selected, Number(e.key));
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        inspect(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, assign, inspect]);

  const onDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const id = Number(e.currentTarget.dataset.room);
    press.current = { id, x: e.clientX, y: e.clientY, active: false, over: null };
    const g = ghostRef.current;
    if (g) g.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }, []);

  const onClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    const id = Number(e.currentTarget.dataset.room);
    setSelected((cur) => (cur === id ? null : id));
  }, []);

  const onHover = useCallback((id: number | null, el: HTMLElement | null) => {
    if (id == null || !el || press.current?.active) {
      setHover(null);
      return;
    }
    const pane = rootRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!pane) return;
    setHover({ id, left: r.left - pane.left, top: r.top - pane.top, w: r.width, h: r.height, paneW: pane.width, paneH: pane.height });
  }, []);

  const reset = () => {
    setSim(new Sim());
    setRun((n) => n + 1);
    setSelected(null);
    setHover(null);
    setSpeed(1);
  };
  const staff = {
    sim,
    fc: sim.forecast(),
    dragOver: drag?.over ?? null,
    dragging: !!drag,
    selected,
    crewShake,
    highlight: drag ? null : highlight,
    onHighlight: setHighlight,
    onCrewClick: (id: number) => {
      if (selected != null) assign(selected, id);
    },
  };

  const fc = sim.forecast();
  const sel = selected == null ? null : sim.room(selected);
  const latest = sim.log[0];

  return (
    <div
      ref={rootRef}
      className={`${s.root} ${sans.variable} ${serif.variable}`}
      style={
        {
          "--shot-sans": "var(--font-albert), system-ui, sans-serif",
          "--shot-display": "var(--font-young), Georgia, serif",
        } as CSSProperties
      }
      data-dragging={drag ? "1" : undefined}
    >
      <div className={s.scene}>
        <div className={s.forecourt}>
          <ArrivalsBoard
            sim={sim}
            fc={fc}
            selected={selected}
            highlight={drag ? null : highlight}
            onHighlight={setHighlight}
            onSelect={(room) => setSelected((cur) => (cur === room ? null : room))}
          />
        </div>
        <div className={s.site}>
          <Facade
            key={run}
            sim={sim}
            reduced={reduced}
            selected={selected}
            highlight={drag ? null : highlight}
            shake={shake}
            onDown={onDown}
            onClick={onClick}
            onHover={onHover}
            tower={<TowerClock sim={sim} running={speed > 0} onToggle={() => setSpeed((v) => (v > 0 ? 0 : 1))} onReset={reset} />}
            billboard={<Billboard sim={sim} highlight={drag ? null : highlight} onHighlight={setHighlight} />}
            fasciaLeft={<StaffFascia sim={sim} selected={selected} side="left" />}
            fasciaRight={<StaffFascia sim={sim} selected={selected} side="right" />}
            staffLeft={<StaffCells {...staff} ids={[1, 2, 3]} />}
            staffRight={<StaffCells {...staff} ids={[4, 5, 6]} />}
          />
        </div>
      </div>

      <footer className={s.foot}>
        {sel ? (
          <SelectionBar room={sel} sim={sim} onAssign={(c) => assign(sel.id, c)} onInspect={() => inspect(sel.id)} onClear={() => setSelected(null)} />
        ) : (
          <p className={s.hint}>
            <Icon name="drag" />
            <span>
              Drag a window onto an attendant on the staff board, or select it and press <kbd>1</kbd>–<kbd>6</kbd>
            </span>
          </p>
        )}
        {latest && <Ticker item={latest} />}
      </footer>

      {hover && !drag && <RoomCard sim={sim} fc={fc} h={hover} />}

      <div className={s.ghost} ref={ghostRef} data-on={drag ? "1" : undefined} aria-hidden>
        {drag && (
          <div className={s.ghostTag} data-over={drag.over != null || undefined}>
            <Fob early={false} />
            <span>{drag.room}</span>
            {drag.over != null && <small>to {sim.crew[drag.over - 1].first}</small>}
          </div>
        )}
      </div>
    </div>
  );
}

function Ticker({ item }: { item: LogItem }) {
  return (
    <p key={item.id} className={s.ticker} data-tone={item.tone} role="status">
      <span className={s.tickTime}>{hhmm(item.t)}</span>
      {item.tone === "error" && <Icon name="warn" />}
      <span>{item.text}</span>
    </p>
  );
}

function SelectionBar({
  room,
  sim,
  onAssign,
  onInspect,
  onClear,
}: {
  room: Room;
  sim: Sim;
  onAssign: (c: number) => void;
  onInspect: () => void;
  onClear: () => void;
}) {
  const assignable = jobCredit(room) > 0 && room.status !== "dnd";
  return (
    <div className={s.selBar}>
      <Pane status={room.status} />
      <span className={s.selId}>{room.id}</span>
      <span className={s.selWhat}>
        {STATUS[room.status].label}
        {room.assignee ? `, ${sim.crew[room.assignee - 1].first}` : assignable ? ", unassigned" : ""}
      </span>
      {assignable && (
        <span className={s.selAssign} role="group" aria-label={`Assign ${room.id}`}>
          {sim.crew.map((c) => (
            <button
              key={c.id}
              type="button"
              className={s.selCrew}
              onClick={() => onAssign(c.id)}
              aria-current={room.assignee === c.id || undefined}
              title={`Assign to ${c.first}`}
              style={{ "--c": c.color } as CSSProperties}
            >
              <Mark shape={c.shape} color={c.color} size={10} />
              {c.id}
            </button>
          ))}
        </span>
      )}
      {room.status === "vc" && (
        <button type="button" className={s.selAction} onClick={onInspect}>
          <Icon name="tick" /> Inspect <kbd>I</kbd>
        </button>
      )}
      <button type="button" className={s.selClear} onClick={onClear} aria-label="Clear selection">
        <Icon name="close" />
      </button>
    </div>
  );
}

function RoomCard({ sim, fc, h }: { sim: Sim; fc: ReturnType<Sim["forecast"]>; h: Hover }) {
  const r = sim.room(h.id);
  const a = r.arrival == null ? null : ARRIVALS[r.arrival];
  const crew = r.assignee == null ? null : sim.crew[r.assignee - 1];
  const W = 264;
  const right = h.left + h.w + 12 + W < h.paneW - 8;
  const left = right ? h.left + h.w + 12 : h.left - W - 12;
  const top = Math.max(12, Math.min(h.top - 6, h.paneH - 250));

  let state = STATUS[r.status].label;
  if (r.status === "vd" && r.departedAt != null) state = `Vacant dirty since ${hhmm(r.departedAt)}`;
  if (r.status === "cln") state = `${r.stay === "stayover" ? "Stayover service" : "Cleaning"} ${Math.round(r.progress * 100)}%`;
  if (r.status === "occ") state = r.stay === "dueout" ? `Occupied, due out ${r.departAt ? hhmm(r.departAt) : "today"}` : r.serviced ? `Stayover, serviced ${hhmm(r.cleanedAt ?? sim.t)}` : "Stayover, service due";
  if (r.status === "vc") state = `Clean ${hhmm(r.cleanedAt ?? sim.t)}, to inspect`;
  if (r.status === "dnd") state = r.dndUntil ? `Do not disturb until ${hhmm(r.dndUntil)}` : "Do not disturb, no release time";
  if (r.status === "ooo") state = `Out of order. ${r.ooo}`;

  let guest = "–";
  if (r.status === "occ" || r.status === "dnd" || (r.status === "cln" && r.stay === "stayover")) guest = `In house: ${r.guest}`;
  else if (r.guest && r.departedAt != null) guest = `Departed ${hhmm(r.departedAt)}: ${r.guest}`;

  let who: { text: string; warn?: boolean } = { text: "–" };
  const at = fc.cleanAt.get(r.id);
  if (r.status === "cln" && crew) who = { text: `${crew.name}, clean ~${hhmm(at ?? sim.t)}` };
  else if (crew) who = { text: `${crew.name}, ${crew.current === r.id ? "on the way" : `${crew.queue.indexOf(r.id) + 1} in queue`}${at ? `, clean ~${hhmm(at)}` : ""}` };
  else if (jobCredit(r) > 0 && r.status !== "dnd") who = { text: `Unassigned, ${credit(jobCredit(r))} cr`, warn: true };

  return (
    <div className={s.card} style={{ left, top, width: W }} role="tooltip">
      <div className={s.cardHead}>
        <span className={s.cardNo}>{r.id}</span>
        <span className={s.cardType}>
          {r.type}
          <small>Floor {r.floor}</small>
        </span>
        <Pane status={r.status} />
      </div>
      <dl className={s.cardList}>
        <dt>Status</dt>
        <dd>{state}</dd>
        <dt>Guest</dt>
        <dd>{guest}</dd>
        {a && (
          <>
            <dt>Arriving</dt>
            <dd data-tone={a.early ? "early" : undefined}>
              {a.name}, {a.party}, {hhmm(a.eta)}
              {a.early && <b> · early check-in</b>}
            </dd>
          </>
        )}
        <dt>Attendant</dt>
        <dd data-tone={who.warn ? "warn" : undefined}>{who.text}</dd>
        {r.notes.length > 0 && (
          <>
            <dt>Notes</dt>
            <dd>
              <ul className={s.notes}>
                {r.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
      {jobCredit(r) > 0 && r.status !== "dnd" && <p className={s.cardHint}>Drag onto an attendant, or click and press 1–6</p>}
      {r.status === "vc" && <p className={s.cardHint}>Click, then press I to mark inspected</p>}
    </div>
  );
}

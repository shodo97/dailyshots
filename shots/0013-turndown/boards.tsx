"use client";

/* Everything the supervisor reads is mounted on the building itself: the clock
   on the lift tower, readiness on the rooftop board, the staff board in the
   ground-floor shopfront, and arrivals on the letterboard out front. Every
   number is counted from the same rooms the windows draw, on the same render. */

import type { CSSProperties } from "react";
import { ARRIVALS, CHECKIN, MIN_PER_CREDIT, STATUS, STATUS_ORDER, credit, hhmm, type Room, type Status } from "./data";
import type { Highlight } from "./facade";
import { Fob, Icon, Mark, StatusGlyph } from "./icons";
import { jobCredit, type Crew, type Sim } from "./sim";
import s from "./shot.module.css";

export type Forecast = ReturnType<Sim["forecast"]>;

/** A miniature window: the status colour, its pattern and its glyph. */
export function Pane({ status, size = "m" }: { status: Status; size?: "s" | "m" }) {
  return (
    <span className={s.pane} data-s={status} data-size={size}>
      {status === "cln" && <span className={s.paneFill} />}
      <StatusGlyph status={status} />
    </span>
  );
}

export function counts(sim: Sim) {
  const by = Object.fromEntries(STATUS_ORDER.map((st) => [st, 0])) as Record<Status, number>;
  for (const r of sim.rooms) by[r.status]++;
  const serviced = sim.rooms.filter((r) => r.status === "occ" && r.serviced).length;
  const unassigned = sim.rooms.filter((r) => r.assignee == null && jobCredit(r) > 0 && r.status !== "dnd");
  return {
    by,
    serviced,
    ready: by.vi + serviced,
    unassigned,
    unCredits: unassigned.reduce((n, r) => n + jobCredit(r), 0),
    unEarly: unassigned.filter((r) => r.arrival != null && ARRIVALS[r.arrival].early).length,
  };
}

/* ── lift tower: the clock ───────────────────────────────────────────────── */

export function TowerClock({ sim, running, onToggle, onReset }: { sim: Sim; running: boolean; onToggle: () => void; onReset: () => void }) {
  const t = sim.t;
  const minute = (t % 60) * 6;
  const hour = ((t / 60) % 12) * 30;
  return (
    <div className={s.tower}>
      <svg viewBox="0 0 60 60" className={s.clock} role="img" aria-label={`Scenario time ${hhmm(t)}`}>
        <circle cx="30" cy="30" r="27" className={s.clockFace} />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={i % 3 === 0 ? "M30 6V11" : "M30 6V8.5"} transform={`rotate(${i * 30} 30 30)`} className={s.clockTick} />
        ))}
        <path d="M30 30V15" transform={`rotate(${hour} 30 30)`} className={s.clockHour} />
        <path d="M30 32V9" transform={`rotate(${minute} 30 30)`} className={s.clockMin} />
        <circle cx="30" cy="30" r="2.2" className={s.clockPin} />
      </svg>
      <span className={s.digital}>{hhmm(t)}</span>
      <span className={s.towerBtns}>
        <button
          type="button"
          onClick={onToggle}
          disabled={sim.done}
          aria-label={running ? "Pause the clock" : "Run the clock"}
          title={running ? "Pause" : "Run"}
        >
          <Icon name={running ? "pause" : "play"} />
        </button>
        <button type="button" onClick={onReset} aria-label="Restart from 11:20" title="Restart from 11:20">
          <Icon name="rewind" />
        </button>
      </span>
    </div>
  );
}

/* ── rooftop board: readiness and the key ────────────────────────────────── */

export function Billboard({ sim, highlight, onHighlight }: { sim: Sim; highlight: Highlight; onHighlight: (h: Highlight) => void }) {
  const c = counts(sim);
  const left = Math.max(0, CHECKIN - sim.t);
  return (
    <div className={s.billboard} onPointerLeave={() => onHighlight(null)}>
      <div className={s.bbHead}>
        <span className={s.bbTitle}>Ready for 15:00</span>
        <span className={s.bbNum} title={`${c.by.vi} inspected + ${c.serviced} stayovers serviced`}>
          <b>{c.ready}</b>/{sim.rooms.length}
        </span>
        <div className={s.bar} aria-hidden>
          {STATUS_ORDER.map((st) => (
            <span key={st} data-s={st} style={{ width: `${(c.by[st] / sim.rooms.length) * 100}%` }} />
          ))}
        </div>
        <span className={s.bbLeft}>
          {left > 0 ? (
            <>
              <b>
                {Math.floor(left / 60)}h {String(Math.floor(left % 60)).padStart(2, "0")}m
              </b>{" "}
              to check-in
            </>
          ) : (
            <b>Check-in open</b>
          )}
        </span>
      </div>
      <ul className={s.legend}>
        {STATUS_ORDER.map((st) => (
          <li key={st}>
            <button
              type="button"
              className={s.legendItem}
              data-on={(highlight?.kind === "status" && highlight.status === st) || undefined}
              onPointerEnter={() => onHighlight({ kind: "status", status: st })}
              onFocus={() => onHighlight({ kind: "status", status: st })}
              onBlur={() => onHighlight(null)}
              aria-label={`${STATUS[st].label}: ${c.by[st]} rooms. Highlight them`}
            >
              <Pane status={st} size="s" />
              <span className={s.legendLabel}>{STATUS[st].legend}</span>
              <span className={s.legendN}>{c.by[st]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── shopfront: the staff board ──────────────────────────────────────────── */

export function StaffFascia({ sim, selected, side }: { sim: Sim; selected: number | null; side: "left" | "right" }) {
  const c = counts(sim);
  if (side === "left") {
    return (
      <p className={s.fasciaText}>
        <span className={s.fasciaName}>Housekeeping</span>
        <span className={s.fasciaMarks}>
          {sim.crew.map((k) => (
            <Mark key={k.id} shape={k.shape} color={k.color} size={10} />
          ))}
          on a window: in that attendant&rsquo;s queue
        </span>
      </p>
    );
  }
  return (
    <p className={s.fasciaText} data-tone={c.unassigned.length ? "warn" : "good"}>
      {selected != null ? (
        <span>
          Assign <b>{selected}</b>: press 1–6 or click an attendant
        </span>
      ) : c.unassigned.length ? (
        <>
          <Icon name="warn" />
          <span>
            <b>{c.unassigned.length} rooms unassigned</b>, {credit(c.unCredits)} cr
            {c.unEarly > 0 && (
              <>
                , <b>{c.unEarly} early check-in{c.unEarly > 1 ? "s" : ""}</b>
              </>
            )}
          </span>
        </>
      ) : (
        <>
          <Icon name="tick" />
          <span>Every room with work is assigned</span>
        </>
      )}
    </p>
  );
}

function activity(sim: Sim, c: Crew): { text: string; tone?: "warn" } {
  const cur = c.current == null ? null : sim.room(c.current);
  switch (c.phase) {
    case "break":
      return { text: `Break to ${hhmm(c.breakUntil ?? sim.t)}` };
    case "clean":
      return { text: `${cur?.stay === "stayover" ? "Service" : "Cleaning"} ${cur?.id} · ${Math.round((cur?.progress ?? 0) * 100)}%` };
    case "travel": {
      const inLift = c.path.length > 1 || (c.path.length === 1 && Math.abs(c.path[0].f - c.pos.f) > 1e-3);
      return { text: `To ${cur?.id}${inLift ? ", by lift" : ""}` };
    }
    case "wait": {
      const r = sim.room(c.queue[0]);
      const when = r.departAt != null ? `out ${hhmm(r.departAt)}` : r.dndUntil != null ? `DND ${hhmm(r.dndUntil)}` : "blocked";
      return { text: `Waiting, ${r.id} ${when}`, tone: "warn" };
    }
    default:
      return { text: "Idle, nothing queued", tone: "warn" };
  }
}

const SCALE = 16;

export type StaffProps = {
  sim: Sim;
  fc: Forecast;
  ids: number[];
  dragOver: number | null;
  dragging: boolean;
  selected: number | null;
  crewShake: { id: number; n: number } | null;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  onCrewClick: (id: number) => void;
};

export function StaffCells(p: StaffProps) {
  return (
    <>
      {p.ids.map((id) => (
        <CrewCell key={id} {...p} c={p.sim.crew[id - 1]} />
      ))}
    </>
  );
}

function CrewCell({ sim, fc, c, dragOver, dragging, selected, crewShake, highlight, onHighlight, onCrewClick }: StaffProps & { c: Crew }) {
  const load = sim.crewLoad(c);
  const act = activity(sim, c);
  const finish = fc.finish.get(c.id) ?? sim.t;
  const busy = c.current != null || c.queue.length > 0;
  const late = busy && finish > CHECKIN;
  const capStart = Math.max(sim.t, c.breakUntil ?? 0);
  const cap = load.done + Math.max(0, CHECKIN - capStart) / MIN_PER_CREDIT;
  const curLeft = c.current != null ? load.curJob - (load.done - c.done) : 0;
  const shake = crewShake?.id === c.id ? crewShake.n : 0;
  const next = c.queue.slice(0, 3);
  return (
    <button
      type="button"
      className={s.crew}
      data-crew={c.id}
      data-over={dragOver === c.id || undefined}
      data-drag={dragging || undefined}
      data-armed={selected != null || undefined}
      data-lit={(highlight?.kind === "crew" && highlight.id === c.id) || undefined}
      data-shake={shake % 2 === 1 ? "a" : shake > 0 ? "b" : undefined}
      style={{ "--c": c.color } as CSSProperties}
      onPointerEnter={() => onHighlight({ kind: "crew", id: c.id })}
      onPointerLeave={() => onHighlight(null)}
      onFocus={() => onHighlight({ kind: "crew", id: c.id })}
      onBlur={() => onHighlight(null)}
      onClick={() => onCrewClick(c.id)}
      aria-label={`${c.name}, key ${c.id}, ${c.section}. ${act.text}. ${credit(load.done)} of ${credit(load.total)} credits${
        busy ? `, clear about ${hhmm(finish)}` : ""
      }${selected != null ? `. Assign room ${selected}` : ""}`}
    >
      <span className={s.crewTop}>
        <kbd className={s.key}>{c.id}</kbd>
        <Mark shape={c.shape} color={c.color} size={12} />
        <span className={s.crewName}>{c.first}</span>
</span>
      <span className={s.act} data-tone={act.tone}>
        {act.text}
      </span>
      <span className={s.next}>
        {next.length ? (
          <>
            then {next.join(" · ")}
            {c.queue.length > 3 && ` +${c.queue.length - 3}`}
          </>
        ) : (
          c.section
        )}
      </span>
      <span className={s.crewFoot}>
        <span className={s.crewCr}>
          {credit(load.done)}
          <span>/{credit(load.total)} cr</span>
        </span>
        <span className={s.finish} data-late={late || undefined}>
          {busy ? (
            <>
              {late && <Icon name="warn" />}
              ~{hhmm(finish)}
            </>
          ) : (
            "idle"
          )}
        </span>
      </span>
      <span className={s.load} aria-hidden>
        <span className={s.loadDone} style={{ width: `${(load.done / SCALE) * 100}%` }} />
        <span className={s.loadCur} style={{ width: `${(curLeft / SCALE) * 100}%` }} />
        <span className={s.loadQ} style={{ width: `${(load.queued / SCALE) * 100}%` }} />
        <span className={s.cap} style={{ left: `${Math.min(100, (cap / SCALE) * 100)}%` }} />
      </span>
    </button>
  );
}

/* ── forecourt: the arrivals letterboard ─────────────────────────────────── */

function arrivalState(sim: Sim, fc: Forecast, r: Room, eta: number): { text: string; tone: "good" | "warn" | "late" | "info" } {
  if (r.status === "vi") return { text: "Ready", tone: "good" };
  const at = sim.readyAt(r, fc.cleanAt);
  const who = r.assignee == null ? null : sim.crew[r.assignee - 1].first;
  if (r.status === "vc") return { text: `Insp ~${hhmm(at ?? sim.t)}`, tone: "info" };
  if (at == null) return { text: r.stay === "dueout" ? `Out ${hhmm(r.departAt ?? sim.t)}` : "Unassigned", tone: "warn" };
  return { text: `${who} ${hhmm(at)}`, tone: at > eta ? "late" : "info" };
}

type ArrivalsProps = {
  sim: Sim;
  fc: Forecast;
  selected: number | null;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  onSelect: (room: number) => void;
};

export function ArrivalsBoard(p: ArrivalsProps) {
  const ready = ARRIVALS.filter((a) => p.sim.room(a.room).status === "vi").length;
  return (
    <div className={s.letterboard} onPointerLeave={() => p.onHighlight(null)}>
      <svg className={s.lbCap} viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden>
        <polygon points="0,0 120,0 120,6 110,12 100,6 90,12 80,6 70,12 60,6 50,12 40,6 30,12 20,6 10,12 0,6" />
      </svg>
      <div className={s.lbFelt}>
        <div className={s.lbHead}>
          <span>Arrivals</span>
          <span>
            {ready}/{ARRIVALS.length} ready
          </span>
        </div>
        <p className={s.lbGroup}>
          <Fob early /> Early check-in
        </p>
        <ul className={s.lbList}>
          {ARRIVALS.filter((a) => a.early).map((a) => (
            <ArrivalRow key={a.i} {...p} i={a.i} />
          ))}
        </ul>
        <p className={s.lbGroup}>From 15:00</p>
        <ul className={s.lbList}>
          {ARRIVALS.filter((a) => !a.early).map((a) => (
            <ArrivalRow key={a.i} {...p} i={a.i} />
          ))}
        </ul>
      </div>
      <span className={s.lbPost} data-side="l" />
      <span className={s.lbPost} data-side="r" />
    </div>
  );
}

function ArrivalRow({ sim, fc, i, selected, highlight, onHighlight, onSelect }: ArrivalsProps & { i: number }) {
  const a = ARRIVALS[i];
  const r = sim.room(a.room);
  const st = arrivalState(sim, fc, r, a.eta);
  return (
    <li>
      <button
        type="button"
        className={s.arr}
        data-sel={selected === r.id || undefined}
        data-lit={(highlight?.kind === "room" && highlight.id === r.id) || undefined}
        onPointerEnter={() => onHighlight({ kind: "room", id: r.id })}
        onFocus={() => onHighlight({ kind: "room", id: r.id })}
        onBlur={() => onHighlight(null)}
        onClick={() => onSelect(r.id)}
        aria-label={`${a.name}, ${a.party}, arriving ${hhmm(a.eta)}, room ${r.id}, ${STATUS[r.status].label}. ${st.text}`}
        title={a.party}
      >
        <span className={s.arrEta}>{hhmm(a.eta)}</span>
        <span className={s.arrName}>{a.name}</span>
        <Pane status={r.status} size="s" />
        <span className={s.arrRoom}>{r.id}</span>
        <span className={s.arrState} data-tone={st.tone}>
          {st.text}
        </span>
      </button>
    </li>
  );
}

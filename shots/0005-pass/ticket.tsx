"use client";

import { animate, motion, useAnimationControls, usePresence } from "motion/react";
import { forwardRef, useEffect, useMemo, useRef, type CSSProperties, type Ref } from "react";
import s from "./shot.module.css";
import { Icon } from "./icons";
import {
  MENU,
  activeCourse,
  ageOf,
  clock,
  elapsed,
  mmss,
  tearPath,
  tiltOf,
  type Course,
  type Line,
  type Ticket,
} from "./data";

/* ── the printed slip ─────────────────────────────────────────────────────── */

export const TICKET_W = 272;

const seatList = (seats: number[]) => seats.map((n) => `S${n}`).join(" ");

function LineRow({ line, held }: { line: Line; held: boolean }) {
  const m = MENU[line.item];
  return (
    <li className={s.line} data-held={held || undefined}>
      <span className={s.qty}>{line.qty}</span>
      <span className={s.item}>{m.name}</span>
      <span className={s.seats}>{seatList(line.seats)}</span>
      {line.mod && (
        <span className={s.mod}>
          <span className={s.modInk}>
            {line.mod.seat ? `S${line.mod.seat} ` : ""}
            {line.mod.text}
          </span>
        </span>
      )}
      {line.allergy && (
        <span className={s.allergy}>
          <Icon name="allergy" className={s.allergyIcon} />
          <span>
            ALLERGY · {line.allergy.text}
          </span>
          <span className={s.allergySeat}>S{line.allergy.seat}</span>
        </span>
      )}
    </li>
  );
}

function CourseBlock({ course, reduce }: { course: Course; reduce: boolean }) {
  if (course.state === "sent")
    return (
      <div className={s.sent}>
        <Icon name="check" className={s.sentIcon} />
        <span>{course.name} SENT</span>
        <span className={s.courseTime}>{clock(course.at ?? 0)}</span>
      </div>
    );

  const held = course.state === "hold";
  return (
    <div className={s.course}>
      <div className={s.courseHead} data-state={course.state}>
        {course.state === "away" && <Icon name="fire" className={s.courseIcon} />}
        <span className={s.courseName}>{course.name}</span>
        <span className={s.courseState}>
          {course.state === "fired" && !course.stamped && `FIRED ${clock(course.at ?? 0)}`}
          {course.state === "away" && "AWAY"}
          {course.state === "hold" && "HOLD"}
        </span>
      </div>
      <ul className={s.lines}>
        {course.lines.map((l) => (
          <LineRow key={l.item + l.seats.join()} line={l} held={held} />
        ))}
      </ul>
      {course.stamped && course.at !== undefined && (
        <motion.span
          className={s.stamp}
          initial={reduce ? false : { scale: 2.1, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: -7 }}
          transition={{ duration: 0.2, ease: [0.55, 0, 0.9, 0.35] }}
        >
          FIRED {clock(course.at)}
        </motion.span>
      )}
    </div>
  );
}

export const Paper = forwardRef(function Paper(
  { ticket, now, reduce }: { ticket: Ticket; now: number; reduce: boolean },
  ref: Ref<HTMLDivElement>,
) {
  const secs = elapsed(ticket, now);
  const age = ageOf(secs);
  const active = activeCourse(ticket);
  const tear = useMemo(() => tearPath(ticket.id), [ticket.id]);

  return (
    <div ref={ref} className={s.paperBody}>
      <div className={s.paper} style={{ clipPath: tear }}>
        <header className={s.head} data-age={age}>
          <span className={s.tableNo}>
            <span className={s.tableT}>T</span>
            {ticket.table}
          </span>
          <span className={s.timeCol}>
            <span className={s.timer}>{mmss(secs)}</span>
            <span className={s.ageWord}>
              {age === "late" && (
                <>
                  <Icon name="late" className={s.ageIcon} />
                  LATE
                </>
              )}
              {age === "amber" && (
                <>
                  <Icon name="glass" className={s.ageIcon} />
                  SLOW
                </>
              )}
              {age === "ok" && (active?.state === "away" ? "WAITING" : active?.name)}
            </span>
          </span>
        </header>
        <div className={s.meta}>
          <span className={s.covers}>{ticket.covers} COV</span>
          <span className={s.server}>{ticket.server}</span>
          <span className={s.check}>#{ticket.check}</span>
        </div>
        {ticket.courses.map((c) => (
          <CourseBlock key={c.name} course={c} reduce={reduce} />
        ))}
      </div>
    </div>
  );
});

/* ── the slip on the rail ─────────────────────────────────────────────────── */

type RailTicketProps = {
  ticket: Ticket;
  now: number;
  reduce: boolean;
  selected: boolean;
  index: number;
  /** Below 1 when the rail is crowded: the slips shrink rather than overlap. */
  scale: number;
  gap: number;
  z: number;
  sway: number;
  swayDir: 1 | -1;
  enter: "print" | "recall" | undefined;
  onSelect: () => void;
  onBump: () => void;
  ref?: Ref<HTMLDivElement>;
};

export function RailTicket({
  ticket,
  now,
  reduce,
  selected,
  index,
  scale,
  gap,
  z,
  sway,
  swayDir,
  enter,
  onSelect,
  onBump,
  ref,
}: RailTicketProps) {
  const swing = useAnimationControls();
  const tilt = useMemo(() => tiltOf(ticket.id), [ticket.id]);
  const [isPresent, safeToRemove] = usePresence();
  const stubRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A slip that has just moved along the rail swings from its clip.
  useEffect(() => {
    if (reduce || sway === 0) return;
    const d = swayDir * 2.6;
    swing.start({
      rotate: [0, d, -d * 0.62, d * 0.34, -d * 0.14, 0],
      transition: { duration: 1.5, ease: "easeOut", delay: 0.12 },
    });
  }, [sway, swayDir, reduce, swing]);

  // Bumped: a short pull splits the perforation, the stub stays in the clip
  // a beat, and the body drops behind the shelf. Recalled mid-fall, it is
  // put straight back together.
  const done = useRef(safeToRemove);
  useEffect(() => {
    done.current = safeToRemove;
  });
  const running = useRef<{ stop: () => void }[]>([]);
  useEffect(() => {
    const body = bodyRef.current;
    const stub = stubRef.current;
    running.current.forEach((a) => a.stop());
    running.current = [];
    if (isPresent) {
      if (body) body.style.transform = "";
      if (stub) Object.assign(stub.style, { transform: "", opacity: "" });
      return;
    }
    if (reduce || !body || !stub) {
      done.current?.();
      return;
    }
    const fall = animate(
      body,
      { y: [0, 8, 8, 820], rotate: [0, -1.4, -1.4, 12] },
      { duration: 0.86, times: [0, 0.12, 0.22, 1], ease: ["easeOut", "linear", [0.55, 0, 1, 0.45]] },
    );
    const lift = animate(stub, { opacity: [1, 1, 0], y: [0, 0, -5] }, { duration: 0.95, times: [0, 0.6, 1] });
    running.current = [fall, lift];
    let live = true;
    Promise.all([fall, lift]).then(() => {
      if (live) done.current?.();
    });
    return () => {
      live = false;
    };
  }, [isPresent, reduce]);

  const secs = elapsed(ticket, now);
  const age = ageOf(secs);

  return (
    <motion.div
      ref={ref}
      layoutId={ticket.id}
      layout={reduce ? false : "position"}
      className={s.hanger}
      data-selected={selected || undefined}
      style={{ marginLeft: index === 0 ? 0 : gap, zIndex: isPresent ? z : 30, width: TICKET_W * scale } as CSSProperties}
      initial={enter === "recall" && !reduce ? { opacity: 0, y: -80 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 26,
        // The rail waits for the tear before it closes the gap.
        layout: { type: "spring", stiffness: 260, damping: 30, delay: 0.14 },
      }}
    >
      <div className={s.scaler} style={{ "--k": scale } as CSSProperties}>
        <button
          type="button"
          className={s.slipButton}
          tabIndex={selected ? 0 : -1}
          aria-pressed={selected}
          aria-label={`Table ${ticket.table}, ${ticket.covers} covers, ${mmss(secs)}${age === "late" ? ", late" : ""}. Double-click to bump.`}
          onClick={onSelect}
          onDoubleClick={onBump}
        />
        <svg className={s.clip} viewBox="0 0 44 34" aria-hidden>
          <rect x="3" y="2" width="38" height="20" rx="3" className={s.clipBody} />
          <rect x="9" y="20" width="26" height="12" rx="1.5" className={s.clipJaw} />
          <circle cx="22" cy="12" r="4.5" className={s.clipBall} />
        </svg>
        <motion.div className={s.swing} animate={swing} style={{ originY: 0 }}>
          <div className={s.tilt} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
            <div ref={stubRef} className={s.stub}>
              <span className={s.perf} />
            </div>
            <div ref={bodyRef} className={s.bodyFall}>
              <Paper ticket={ticket} now={now} reduce={reduce} />
            </div>
            <span className={s.ring} aria-hidden />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── the slip in the printer ──────────────────────────────────────────────── */

export function PrintingTicket({
  ticket,
  now,
  feedRef,
}: {
  ticket: Ticket;
  now: number;
  feedRef: Ref<HTMLDivElement>;
}) {
  return (
    <motion.div layoutId={ticket.id} className={s.hanger} style={{ zIndex: 1 }}>
      <div ref={feedRef} className={s.feed}>
        <div className={s.tilt}>
          <div className={s.stub}>
            <span className={s.perf} />
          </div>
          <div className={s.bodyFall}>
            <Paper ticket={ticket} now={now} reduce />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

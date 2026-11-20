"use client";

/* 0005 — Pass
   The kitchen display at the pass of Osteria Lume, Friday, 20:14. Read from a
   metre and a half under heat lamps by the expediter, so the type is large,
   the words are few, and every action has a key and a hit target the size of
   a thumb. New orders print in from the slot; bumped orders tear off along
   the perforation and drop. */

import { Archivo, Azeret_Mono } from "next/font/google";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import s from "./shot.module.css";
import { Icon, type IconName } from "./icons";
import { PrintingTicket, RailTicket, TICKET_W } from "./ticket";
import {
  BEHIND_AT,
  BISTECCA_LEFT,
  BUMPED,
  EIGHTY_SIXED,
  INCOMING,
  OPEN,
  PRINT_AT,
  SLAMMED_AT,
  activeCourse,
  ageOf,
  allDay,
  clock,
  countItem,
  elapsed,
  itemCount,
  mmss,
  nextToFire,
  seeded,
  stationLoads,
  type Bumped,
  type Ticket,
} from "./data";

// Archivo carries every word, pushed along its width axis: fully condensed and
// black for table numbers, wider for labels. Azeret Mono is the printer.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const azeret = Azeret_Mono({ subsets: ["latin"], variable: "--font-azeret" });

const GAP = 16;
/** The printer's footprint on the rail while it is printing. */
const PRINTER_W = TICKET_W + 16;
const PITCH = TICKET_W + GAP;
const LINE = 21; // one step of the paper feed, in px

type Enter = "print" | "recall";

/* ── brushed steel, drawn once ────────────────────────────────────────────── */

function useBrushedSteel(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = 720;
    c.height = 360;
    const g = c.getContext("2d");
    if (!g) return;
    const r = seeded("steel");
    g.fillStyle = "#9ba1a7";
    g.fillRect(0, 0, c.width, c.height);
    // Long, faint, strictly horizontal strokes: the grain of a #4 finish.
    for (let i = 0; i < 5200; i++) {
      const y = Math.floor(r() * c.height) + 0.5;
      const x = r() * c.width;
      const len = 30 + r() * r() * 520;
      const light = r() > 0.48;
      g.strokeStyle = light
        ? `rgba(236,240,243,${0.035 + r() * 0.07})`
        : `rgba(48,54,60,${0.03 + r() * 0.06})`;
      g.lineWidth = r() > 0.92 ? 1.6 : 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.stroke();
      // Wrap so the tile repeats without a seam.
      if (x + len > c.width) {
        g.beginPath();
        g.moveTo(x - c.width, y);
        g.lineTo(x + len - c.width, y);
        g.stroke();
      }
    }
    ref.current?.style.setProperty("--brushed", `url(${c.toDataURL("image/png")})`);
  }, [ref]);
}

/* ── the shot ─────────────────────────────────────────────────────────────── */

export default function Pass() {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  useBrushedSteel(rootRef);

  const [now, setNow] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>(OPEN);
  const [printing, setPrinting] = useState<Ticket | null>(null);
  const [bumped, setBumped] = useState<Bumped[]>(BUMPED);
  const [selected, setSelected] = useState<string | null>(OPEN[0].id);
  const [bistecca, setBistecca] = useState(BISTECCA_LEFT);
  const [sway, setSway] = useState<Record<string, { n: number; dir: 1 | -1 }>>({});
  const [enter, setEnter] = useState<Record<string, Enter>>({});
  const [pressed, setPressed] = useState<string | null>(null);

  const nowRef = useRef(0);
  const ticketsRef = useRef(tickets);
  const bumpedRef = useRef(bumped);
  const selectedRef = useRef(selected);
  useEffect(() => {
    ticketsRef.current = tickets;
    bumpedRef.current = bumped;
    selectedRef.current = selected;
  });

  // The scenario clock: 20:14:00 at mount, one tick a second.
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = Math.floor((performance.now() - t0) / 1000);
      nowRef.current = t;
      setNow(t);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const swing = useCallback((ids: string[], dir: 1 | -1) => {
    if (!ids.length) return;
    setSway((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { n: (prev[id]?.n ?? 0) + 1, dir };
      return next;
    });
  }, []);

  /* ── printing ── */

  const queue = useRef<Ticket[]>([]);
  const [queueTick, setQueueTick] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const land = useCallback(
    (t: Ticket) => {
      setPrinting(null);
      setEnter((e) => ({ ...e, [t.id]: "print" }));
      setTickets((prev) => [...prev, t].sort((a, b) => a.seq - b.seq));
      setSelected((sel) => sel ?? t.id);
      swing([t.id], 1);
    },
    [swing],
  );

  const startPrint = useCallback(
    (raw: Ticket) => {
      const at = nowRef.current;
      const t: Ticket = {
        ...raw,
        sentAt: at,
        courses: raw.courses.map((c) => (c.state === "fired" && c.at === undefined ? { ...c, at } : c)),
      };
      setBistecca((n) => Math.max(0, n - countItem(t, "bistecca")));
      if (reduce) land(t);
      else setPrinting(t);
    },
    [land, reduce],
  );

  useEffect(() => {
    const timers = PRINT_AT.map((sec, i) =>
      window.setTimeout(() => {
        queue.current.push(INCOMING[i]);
        setQueueTick((n) => n + 1);
      }, sec * 1000),
    );
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (printing || !queue.current.length) return;
    const next = queue.current.shift();
    if (next) startPrint(next);
  }, [queueTick, printing, startPrint]);

  // Stepped feed: the paper advances one printed line at a time, each step a
  // quick push and a pause, the way a thermal head pulls it through.
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (!printing || !el) return;
    const H = el.offsetHeight;
    const steps = Math.ceil(H / LINE);
    const stepMs = 74;
    const total = steps * stepMs;
    el.style.transform = `translateY(${-H}px)`;
    let raf = 0;
    let timer = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / total);
      const k = p * steps;
      const i = Math.floor(k);
      const local = Math.min(1, (k - i) / 0.45);
      const shown = Math.min(H, (i + (1 - Math.pow(1 - local, 3))) * LINE);
      el.style.transform = `translateY(${shown - H}px)`;
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        el.style.transform = "translateY(0)";
        // The cutter: a tug down, a release, then off to the rail.
        el.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(5px)" }, { transform: "translateY(0)" }],
          { duration: 180, easing: "ease-out", delay: 240 },
        );
        timer = window.setTimeout(() => land(printing), 560);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [printing, land]);

  /* ── actions ── */

  const bump = useCallback(
    (id: string) => {
      const list = ticketsRef.current;
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) return;
      const t = list[i];
      setTickets(list.filter((x) => x.id !== id));
      setBumped((b) => [...b, { ticket: t, at: nowRef.current }]);
      if (selectedRef.current === id) {
        const neighbour = list[i + 1] ?? list[i - 1];
        setSelected(neighbour ? neighbour.id : null);
      }
      // Everything to the right slides left to close the gap, and swings.
      swing(
        list.slice(i + 1).map((x) => x.id),
        -1,
      );
    },
    [swing],
  );

  const recall = useCallback(
    (id?: string) => {
      const bin = bumpedRef.current;
      const entry = id ? bin.find((b) => b.ticket.id === id) : bin[bin.length - 1];
      if (!entry) return;
      const t = entry.ticket;
      setBumped(bin.filter((b) => b !== entry));
      setEnter((e) => ({ ...e, [t.id]: "recall" }));
      const list = [...ticketsRef.current, t].sort((a, b) => a.seq - b.seq);
      setTickets(list);
      setSelected(t.id);
      const at = list.indexOf(t);
      swing([t.id, ...list.slice(at + 1).map((x) => x.id)], 1);
    },
    [swing],
  );

  const fire = useCallback((id: string) => {
    setTickets((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const target = nextToFire(t);
        if (!target) return t;
        return {
          ...t,
          courses: t.courses.map((c) =>
            c === target ? { ...c, state: "fired" as const, at: nowRef.current, stamped: true } : c,
          ),
        };
      }),
    );
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    const list = ticketsRef.current;
    if (!list.length) return;
    const i = list.findIndex((t) => t.id === selectedRef.current);
    const j = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + dir));
    setSelected(list[j].id);
  }, []);

  const flash = useCallback((key: string) => {
    setPressed(key);
    window.setTimeout(() => setPressed((p) => (p === key ? null : p)), 140);
  }, []);

  // The bump bar, on the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const onButton = !!el?.closest("button, a");
      const sel = selectedRef.current;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight":
          e.preventDefault();
          step(e.key === "ArrowLeft" ? -1 : 1);
          flash(e.key === "ArrowLeft" ? "left" : "right");
          break;
        case " ":
          if (onButton && !el?.closest(`.${s.slipButton}`)) return;
          e.preventDefault();
          if (sel) bump(sel);
          flash("bump");
          break;
        case "f":
        case "F":
          if (sel) fire(sel);
          flash("fire");
          break;
        case "r":
        case "R":
          recall();
          flash("recall");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bump, fire, recall, step, flash]);

  /* ── rail geometry ── */

  const railRef = useRef<HTMLDivElement>(null);
  const [railBox, setRailBox] = useState({ w: 1390, h: 560 });
  const [tallest, setTallest] = useState(0);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRailBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The longest slip, measured unscaled, so the rail can fit it above the shelf.
  const railKey = tickets.map((t) => t.id).join();
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => {
      let h = 0;
      el.querySelectorAll<HTMLElement>(`.${s.scaler}`).forEach((n) => (h = Math.max(h, n.offsetHeight)));
      setTallest(h);
    };
    const ro = new ResizeObserver(measure);
    el.querySelectorAll(`.${s.scaler}`).forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, [railKey]);

  // A crowded rail shrinks every slip rather than hiding any of one. The
  // printer claims the right end of the rail only while it is printing.
  const n = tickets.length;
  const usable = railBox.w - (printing ? PRINTER_W + GAP : 0);
  const fitW = n ? usable / (n * PITCH - GAP) : 1;
  const fitH = tallest ? (railBox.h - 10) / tallest : 1;
  const scale = Math.max(0.55, Math.min(1, fitW, fitH));

  /* ── derived boards ── */

  const open = useMemo(() => (printing ? [...tickets, printing] : tickets), [tickets, printing]);
  const loads = useMemo(() => stationLoads(open, now), [open, now]);
  const rows = useMemo(() => allDay(open), [open]);
  const allDayTotal = rows.reduce((a, r) => a + r.qty, 0);
  const late = tickets.filter((t) => ageOf(elapsed(t, now)) === "late").length;
  const sel = tickets.find((t) => t.id === selected) ?? null;
  const toFire = sel ? nextToFire(sel) : undefined;
  const lastBumped = bumped[bumped.length - 1];

  const rootStyle = {
    "--shot-sans": "var(--font-archivo)",
    "--shot-display": "var(--font-archivo)",
    "--shot-mono": "var(--font-azeret)",
  } as CSSProperties;

  return (
    <div ref={rootRef} className={`${s.root} ${archivo.variable} ${azeret.variable}`} style={rootStyle}>
      {/* ── station load ── */}
      <header className={s.top}>
        <div className={s.service}>
          <span className={s.clock}>{clock(now, true)}</span>
          <span className={s.serviceLine}>
            <span>{tickets.length} ON RAIL</span>
            {late > 0 && <span className={s.lateChip}>{late} LATE</span>}
          </span>
        </div>
        <ol className={s.stations} aria-label="Station load">
          {loads.map((l) => {
            // Judged on the minutes shown, so "10 MIN" and BEHIND always agree.
            const mins = Math.ceil(l.clear / 60);
            const state = mins * 60 >= SLAMMED_AT ? "slammed" : mins * 60 >= BEHIND_AT ? "behind" : "ok";
            const pips = l.cooking + l.held;
            const shown = Math.min(pips, 14);
            return (
              <li key={l.station.id} className={s.station} data-state={state}>
                <span className={s.stationHead}>
                  <span className={s.stationName}>{l.station.name}</span>
                  {state !== "ok" && <span className={s.stationState}>{state === "behind" ? "BEHIND" : "SLAMMED"}</span>}
                </span>
                <span className={s.clear}>
                  <span className={s.clearTime}>
                    {pips === 0 ? (
                      "—"
                    ) : (
                      <>
                        {mins}
                        <small>MIN</small>
                      </>
                    )}
                  </span>
                  <span className={s.clearLabel}>TO CLEAR</span>
                </span>
                <span className={s.pips} aria-hidden>
                  {Array.from({ length: shown }, (_, i) => (
                    <i key={i} className={i < l.cooking ? s.pipOn : s.pipHeld} />
                  ))}
                  {pips > shown && <b className={s.pipMore}>+{pips - shown}</b>}
                </span>
                <span className={s.stationCount}>
                  {l.cooking} ON{l.held > 0 && <span className={s.heldCount}> · {l.held} HELD</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </header>

      {/* ── the rail ── */}
      <main className={s.railZone}>
        <div className={s.rod} aria-hidden />
        <LayoutGroup>
          <div ref={railRef} className={s.rail} role="listbox" aria-label="Open tickets, oldest first">
            <AnimatePresence mode="popLayout" initial={false}>
              {tickets.map((t, i) => (
                <RailTicket
                  key={t.id}
                  ticket={t}
                  now={now}
                  reduce={reduce}
                  selected={t.id === selected}
                  index={i}
                  scale={scale}
                  gap={GAP * scale}
                  z={t.id === selected ? 29 : 20 - i}
                  sway={sway[t.id]?.n ?? 0}
                  swayDir={sway[t.id]?.dir ?? 1}
                  enter={enter[t.id]}
                  onSelect={() => setSelected(t.id)}
                  onBump={() => bump(t.id)}
                />
              ))}
            </AnimatePresence>
            {tickets.length === 0 && !printing && (
              <p className={s.railClear}>
                Rail clear
                <span>Next order prints from the slot</span>
              </p>
            )}
          </div>

          <div className={s.printer} data-busy={!!printing || undefined}>
            <div className={s.housing}>
              <span className={s.led} />
              <span className={s.printerState}>{printing ? `PRINTING T${printing.table}` : "READY"}</span>
              <span className={s.slot} />
            </div>
            <div className={s.mouth}>
              {printing && <PrintingTicket ticket={printing} now={now} feedRef={feedRef} />}
            </div>
          </div>
        </LayoutGroup>
      </main>

      {/* ── the shelf: bump bar, all day, 86, recall ── */}
      <footer className={s.shelf}>
        <section className={s.bumpBar} aria-label="Bump bar">
          <div className={s.selLine}>
            {sel ? (
              <>
                <span className={s.selTable}>T{sel.table}</span>
                <span className={s.selMeta}>
                  <span>
                    {sel.covers} COV · {itemCount(sel)} ITEMS
                  </span>
                  <span className={s.selState}>
                    {activeCourse(sel)?.name} {activeCourse(sel)?.state === "away" ? "AWAY" : "ON"} ·{" "}
                    {mmss(elapsed(sel, now))}
                  </span>
                </span>
              </>
            ) : (
              <span className={s.selNone}>No ticket selected</span>
            )}
          </div>
          <div className={s.keys}>
            <Key
              label={toFire ? `FIRE ${toFire.name}` : "ALL FIRED"}
              cap="F"
              icon="fire"
              tone="paper"
              disabled={!toFire}
              down={pressed === "fire"}
              onClick={() => sel && fire(sel.id)}
              wide
            />
            <Key
              label="BUMP"
              cap="SPACE"
              icon="bump"
              tone="ink"
              disabled={!sel}
              down={pressed === "bump"}
              onClick={() => sel && bump(sel.id)}
              wide
            />
            <Key
              label={lastBumped ? `RECALL T${lastBumped.ticket.table}` : "RECALL"}
              cap="R"
              icon="recall"
              tone="steel"
              disabled={!lastBumped}
              down={pressed === "recall"}
              onClick={() => recall()}
              wide
            />
            <div className={s.arrows}>
              <Key label="Previous ticket" cap="" icon="left" tone="steel" disabled={!tickets.length} down={pressed === "left"} onClick={() => step(-1)} iconOnly />
              <Key label="Next ticket" cap="" icon="right" tone="steel" disabled={!tickets.length} down={pressed === "right"} onClick={() => step(1)} iconOnly />
            </div>
          </div>
        </section>

        <section className={s.allDay} aria-label="All day">
          <h2 className={s.shelfHead}>
            All day
            <span className={s.shelfSub}>
              {allDayTotal} ITEMS · {open.length} TICKETS
            </span>
          </h2>
          <ol className={s.allDayList}>
            {rows.map((r) => (
              <motion.li key={r.id} layout={!reduce} className={s.allDayRow} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
                <span key={r.qty} className={s.allDayQty}>
                  {r.qty}
                </span>
                <span className={s.times}>×</span>
                <span className={s.allDayName}>{r.name}</span>
              </motion.li>
            ))}
          </ol>
        </section>

        <section className={s.eightySix} aria-label="86'd">
          <h2 className={s.shelfHead}>86&rsquo;d</h2>
          <ul className={s.outList}>
            {(bistecca === 0 ? ["BISTECCA", ...EIGHTY_SIXED] : EIGHTY_SIXED).map((name) => (
              <li key={name} className={s.out}>
                {name}
              </li>
            ))}
            {bistecca > 0 && (
              <li className={s.low}>
                <span>BISTECCA</span>
                <span className={s.lowChip}>{bistecca} LEFT</span>
              </li>
            )}
          </ul>
        </section>

        <section className={s.recall} aria-label="Recall bin">
          <h2 className={s.shelfHead}>
            Recall
            <span className={s.shelfSub}>LAST BUMPED</span>
          </h2>
          <ol className={s.bin}>
            <AnimatePresence initial={false} mode="popLayout">
              {[...bumped]
                .reverse()
                .slice(0, 4)
                .map((b, i) => (
                  <motion.li
                    key={b.ticket.id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -26, rotate: -4 }}
                    animate={{ opacity: 1, y: 0, rotate: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -40, transition: { duration: 0.22 } }}
                    transition={{ type: "spring", stiffness: 420, damping: 30, delay: reduce ? 0 : 0.45 }}
                  >
                    <button
                      type="button"
                      className={s.binSlip}
                      onClick={() => recall(b.ticket.id)}
                      aria-label={`Recall table ${b.ticket.table}, bumped ${clock(b.at)}`}
                    >
                      <span className={s.binTable}>T{b.ticket.table}</span>
                      <span className={s.binMeta}>
                        <span>{clock(b.at)}</span>
                        <span>{b.ticket.covers} COV</span>
                      </span>
                      {i === 0 && <span className={s.binKey}>R</span>}
                      <Icon name="recall" className={s.binIcon} />
                    </button>
                  </motion.li>
                ))}
            </AnimatePresence>
            {bumped.length === 0 && <li className={s.binEmpty}>Nothing bumped yet</li>}
          </ol>
        </section>
      </footer>
    </div>
  );
}

/* ── a bump bar key ───────────────────────────────────────────────────────── */

function Key({
  label,
  cap,
  icon,
  tone,
  disabled,
  down,
  onClick,
  wide,
  iconOnly,
}: {
  label: string;
  cap: string;
  icon: IconName;
  tone: "ink" | "paper" | "steel";
  disabled?: boolean;
  down?: boolean;
  onClick: () => void;
  wide?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={s.key}
      data-tone={tone}
      data-down={down || undefined}
      data-wide={wide || undefined}
      disabled={disabled}
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
    >
      <Icon name={icon} className={s.keyIcon} />
      {!iconOnly && <span className={s.keyLabel}>{label}</span>}
      {cap && <kbd className={s.keyCap}>{cap}</kbd>}
    </button>
  );
}

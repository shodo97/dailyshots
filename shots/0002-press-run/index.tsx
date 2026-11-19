"use client";

import { Instrument_Sans } from "next/font/google";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import s from "./shot.module.css";
import {
  PERIODS,
  dayLabel,
  delta,
  findings,
  int,
  km,
  min,
  pct,
  periodById,
  weekday,
  type PeriodId,
} from "./data";

// One neutral grotesque carries the whole report: headings, labels, buttons and
// every figure. The second family went away with the mono capitals, because a
// cataloguing voice was doing work the hierarchy should do on its own.
const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

/* ── tiny icon set, one stroke weight, drawn for this shot ────────────────── */

type IconProps = { d: string };
const Icon = ({ d }: IconProps) => (
  <svg viewBox="0 0 16 16" className={s.icon} aria-hidden focusable="false">
    <path d={d} />
  </svg>
);

const PATHS = {
  overview: "M2.5 2.5h4.2v4.2H2.5zM9.3 2.5h4.2v4.2H9.3zM2.5 9.3h4.2v4.2H2.5zM9.3 9.3h4.2v4.2H9.3z",
  map: "M2 4.2l4-1.7 4 1.7 4-1.7v9.3l-4 1.7-4-1.7-4 1.7zM6 2.5v10.8M10 4.2V15",
  bolt: "M8.8 1.5L3.5 9h4L7.2 14.5 12.5 7h-4z",
  tram: "M4.5 2.5h7a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 10V4a1.5 1.5 0 011.5-1.5zM3 6.3h10M5 14l1.3-2.5M11 14l-1.3-2.5M6 2.5V1",
  sliders: "M2.5 4.5h11M2.5 11.5h11M6 2.8v3.4M10.5 9.8v3.4",
  report: "M4 1.8h5l3 3v9.4H4zM9 1.8v3h3M6 8.5h4M6 11h4",
  gear: "M8 5.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zM8 1.4l.9 1.6 1.8-.3.5 1.8 1.7.7-.6 1.7.6 1.7-1.7.7-.5 1.8-1.8-.3L8 14.6l-.9-1.6-1.8.3-.5-1.8-1.7-.7.6-1.7-.6-1.7 1.7-.7.5-1.8 1.8.3z",
  clock: "M8 2.2a5.8 5.8 0 100 11.6A5.8 5.8 0 008 2.2zM8 4.8V8l2.2 1.4",
  down: "M8 2.6v7.6M4.8 7.3L8 10.5l3.2-3.2M3 13.4h10",
  chevron: "M5.5 6.5L8 9l2.5-2.5",
  spark: "M8 1.8l1.3 3.9 3.9 1.3-3.9 1.3L8 12.2 6.7 8.3 2.8 7l3.9-1.3z",
  search: "M7.3 2.4a4.9 4.9 0 100 9.8 4.9 4.9 0 000-9.8zM10.9 10.9l2.7 2.7",
} as const;

/* ── count-up on tabular figures, so a period switch reads as a re-print ──── */

function useTick(value: number, enabled: boolean) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (!enabled) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 560);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(a + (value - a) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    });
    return () => cancelAnimationFrame(frame);
  }, [value, enabled]);

  return shown;
}

function Figure({
  value,
  format,
  animate,
}: {
  value: number;
  format: (n: number) => string;
  animate: boolean;
}) {
  const shown = useTick(value, animate);
  return <span className={s.tnum}>{format(shown)}</span>;
}

/* ── axis ─────────────────────────────────────────────────────────────────── */

const STEPS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];

function ticks(peak: number) {
  const step = STEPS.find((v) => peak / v <= 5) ?? 10000;
  const top = Math.ceil(peak / step) * step;
  return { top, marks: Array.from({ length: top / step + 1 }, (_, i) => i * step).reverse() };
}

/* ── nav ──────────────────────────────────────────────────────────────────── */

const NAV = [
  { label: "Overview", icon: PATHS.overview },
  { label: "Live map", icon: PATHS.map },
  { label: "Disruptions", icon: PATHS.bolt, count: 18 },
  { label: "Fleet", icon: PATHS.tram },
];

const VIEWS = [
  { label: "My depots", count: 3 },
  { label: "Relay interlockings", count: 9 },
  { label: "Over 1 km, unassigned", count: 7 },
];

const WORKSPACE = [
  { label: "Thresholds", icon: PATHS.sliders },
  { label: "Reports", icon: PATHS.report, active: true },
  { label: "Settings", icon: PATHS.gear },
];

const REPORT_TITLE: Record<PeriodId, string> = {
  "7d": "Weekly reliability",
  "30d": "Monthly reliability",
  quarter: "Quarterly reliability",
};

/** The spot colour composited against the surface at five strengths. */
const TINTS = ["#a2326d", "#b45d8c", "#c585a8", "#d6acc4", "#e4ccda"];

const SUGGESTIONS = [
  "Which lines account for the signal faults?",
  "Compare Björklund against the network mean",
  "Show the incidents behind the worst day",
];

export default function PressRun() {
  const reduced = useReducedMotion();
  const [periodId, setPeriodId] = useState<PeriodId>("30d");
  // Which period has finished inking. Deriving `printed` from it rather than
  // resetting a boolean means a period switch is already un-printed on the very
  // render that swaps the data, with no intermediate frame to flash.
  const [printedFor, setPrintedFor] = useState<PeriodId | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");

  const printed = printedFor === periodId;
  const period = periodById(periodId);
  const note = useMemo(() => findings(period), [period]);
  const axis = useMemo(() => ticks(period.peak), [period.peak]);

  const plot = useRef<HTMLDivElement>(null);
  const ask = useRef<HTMLInputElement>(null);
  const seriesId = useId();

  // The press run: ink the ultramarine plate, then strike the coral plate over
  // it. Re-runs on every period switch, which is what makes the switch read as
  // a reprint rather than a swap.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPrintedFor(periodId));
    return () => cancelAnimationFrame(frame);
  }, [periodId]);

  // ⌘J / Ctrl+J puts the caret in the ask bar, the shortcut the chip advertises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        ask.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scrub = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const box = plot.current?.getBoundingClientRect();
      if (!box) return;
      const t = (e.clientX - box.left) / box.width;
      const i = Math.floor(t * period.days.length);
      setCursor(Math.max(0, Math.min(period.days.length - 1, i)));
    },
    [period.days.length],
  );

  const onPlotKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const n = period.days.length;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setCursor((c) => (c === null ? (step > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, c + step))));
    }
    if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      setCursor(n - 1);
    }
    if (e.key === "Escape") setCursor(null);
  };

  const active = cursor === null ? null : period.days[cursor];
  const grainWord = period.grain === "week" ? "week of" : "";

  // Running subtotals, so a half recomputes as the cursor crosses into it.
  const through = (startIndex: number, endIndex: number) => {
    const upto = cursor === null ? endIndex : Math.min(cursor, endIndex);
    if (cursor !== null && cursor < startIndex) return null;
    const slice = period.days.slice(startIndex, upto + 1);
    return {
      km: slice.reduce((a, d) => a + d.km, 0),
      trips: slice.reduce((a, d) => a + d.trips, 0),
      partial: cursor !== null && cursor <= endIndex,
      upto: slice[slice.length - 1]?.iso,
    };
  };

  const firstRun = through(0, period.split - 1);
  const secondRun = through(period.split, period.days.length - 1);
  const kmDelta = delta(period.first.km, period.second.km);
  const maxEwt = Math.max(...period.depots.map((d) => d.ewt));

  return (
    <div
      className={`${s.desk} ${sans.variable}`}
      data-printed={printed || undefined}
      style={
        {
          "--shot-sans": "var(--font-instrument)",
        } as CSSProperties
      }
    >
      <div className={s.sheet}>
        {/* ── plate one: the structural ink ──────────────────────────────── */}
        <nav className={s.rail} aria-label="Headway">
          <div className={s.wordmark}>
            <span className={s.regMark} aria-hidden>
              <i />
              <i />
            </span>
            <span>Headway</span>
          </div>

          <ul className={s.navList}>
            {NAV.map((item) => (
              <li key={item.label}>
                <button type="button" className={s.navItem}>
                  <Icon d={item.icon} />
                  <span>{item.label}</span>
                  {item.count ? <span className={`${s.navCount} ${s.tnum}`}>{item.count}</span> : null}
                </button>
              </li>
            ))}
          </ul>

          <p className={s.railLabel}>Saved views</p>
          <ul className={s.navList}>
            {VIEWS.map((v) => (
              <li key={v.label}>
                <button type="button" className={s.navItem}>
                  <span className={s.viewDot} aria-hidden />
                  <span className={s.viewLabel}>{v.label}</span>
                  <span className={`${s.navCount} ${s.tnum}`}>{v.count}</span>
                </button>
              </li>
            ))}
          </ul>

          <p className={s.railLabel}>Workspace</p>
          <ul className={s.navList}>
            {WORKSPACE.map((w) => (
              <li key={w.label}>
                <button
                  type="button"
                  className={s.navItem}
                  data-active={w.active || undefined}
                  aria-current={w.active ? "page" : undefined}
                >
                  <Icon d={w.icon} />
                  <span>{w.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className={s.railFoot}>
            <div className={s.meter}>
              <p className={s.railLabel}>Telemetry</p>
              <p className={s.meterValue}>
                <span className={s.tnum}>2.14M</span>
                <span className={s.meterOf}>of 5M vehicle polls</span>
              </p>
              <div className={s.meterBar} aria-hidden>
                {Array.from({ length: 24 }, (_, i) => (
                  <i key={i} data-on={i < 10 || undefined} />
                ))}
              </div>
              <p className={s.meterNote}>Resets 1 June · ~4.6M projected</p>
            </div>

            <div className={s.user}>
              <span className={s.avatar} aria-hidden>
                TL
              </span>
              <span>
                <strong>Tomas Lindqvist</strong>
                <em>Duty planner</em>
              </span>
            </div>
          </div>
        </nav>

        {/* ── the report ─────────────────────────────────────────────────── */}
        <div className={s.column}>
          <header className={s.chrome}>
            <div className={s.crumbs}>
              <button type="button" className={s.tenant}>
                <span className={s.tenantMark} aria-hidden>
                  L
                </span>
                <span>Lindholm Spårväg</span>
                <span className={s.live}>
                  <i aria-hidden />
                  Live
                </span>
                <Icon d={PATHS.chevron} />
              </button>
              <span className={s.slash} aria-hidden>
                /
              </span>
              <span className={s.crumb}>Reliability</span>

              <div className={s.segmented} role="group" aria-label="Reporting period">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={s.segment}
                    data-active={p.id === periodId || undefined}
                    aria-pressed={p.id === periodId}
                    onClick={() => {
                      setPeriodId(p.id);
                      setCursor(null);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={s.actions}>
              <button type="button" className={s.ghost}>
                <Icon d={PATHS.clock} />
                Schedule
              </button>
              <button type="button" className={s.solid}>
                <Icon d={PATHS.down} />
                Export PDF
              </button>
            </div>
          </header>

          <div className={s.body}>
            <main className={s.report}>
              <div className={s.titleBlock}>
                <h1 className={s.title}>
                  {REPORT_TITLE[periodId]}
                  <span className={s.titleGhost} aria-hidden>
                    {REPORT_TITLE[periodId]}
                  </span>
                </h1>
                <p className={s.subtitle}>
                  <span className={s.tnum}>{period.range} 2026</span>
                  <span className={s.dot} aria-hidden />
                  Nine lines, six depots
                  <span className={s.dot} aria-hidden />
                  Updated today, 06:40
                </p>
              </div>

              <section className={s.stats} aria-label="Headline figures">
                <Stat
                  icon={PATHS.tram}
                  label="Service km lost"
                  value={<Figure value={period.km} format={km} animate={!reduced} />}
                  sub={`${int(period.trips)} trips cancelled`}
                />
                <Stat
                  icon={PATHS.clock}
                  label="Trips to timetable"
                  value={<Figure value={period.punctuality} format={pct} animate={!reduced} />}
                  sub={`${int(period.onTime)} of ${int(period.scheduled)} trips`}
                />
                <Stat
                  icon={PATHS.sliders}
                  label="Excess wait time"
                  value={<Figure value={period.ewt} format={min} animate={!reduced} />}
                  sub="9 high-frequency lines"
                />
                <Stat
                  icon={PATHS.bolt}
                  label="Mean time to restore"
                  value={<Figure value={period.mttr} format={(n) => `${Math.round(n)} min`} animate={!reduced} />}
                  sub={`${pct(period.restored / 100)} cleared on shift`}
                />
              </section>

              <section className={s.chartBlock} aria-labelledby={`${seriesId}-h`}>
                <div className={s.blockHead}>
                  <h2 id={`${seriesId}-h`}>Service km lost per {period.grain}</h2>
                  <p className={s.tnum}>
                    {km(period.km)} over {period.days.length} {period.grain === "week" ? "weeks" : "days"}
                  </p>
                </div>

                <div className={s.chart}>
                  <div className={s.axis} aria-hidden>
                    {axis.marks.map((m, i) => (
                      <span
                        key={m}
                        className={s.tnum}
                        style={{ "--t": i / (axis.marks.length - 1) } as CSSProperties}
                      >
                        {m === 0 ? "0" : int(m)}
                      </span>
                    ))}
                  </div>

                  <div
                    ref={plot}
                    className={s.plot}
                    data-scrubbing={cursor !== null || undefined}
                    role="img"
                    tabIndex={0}
                    aria-label={`Service kilometres lost per ${period.grain} from ${period.range}. Peak ${km(period.peak)}. Use arrow keys to read each column.`}
                    aria-describedby={`${seriesId}-table`}
                    onPointerMove={scrub}
                    onPointerLeave={() => setCursor(null)}
                    onKeyDown={onPlotKey}
                    onBlur={() => setCursor(null)}
                  >
                    <div className={s.grid} aria-hidden>
                      {axis.marks.map((m, i) => (
                        <i
                          key={m}
                          style={{ "--t": i / (axis.marks.length - 1) } as CSSProperties}
                        />
                      ))}
                    </div>

                    <div className={s.bars}>
                      {period.days.map((d, i) => (
                        <div
                          key={d.iso}
                          className={s.barSlot}
                          data-active={cursor === i || undefined}
                          style={{ "--i": i, "--h": d.km / axis.top } as CSSProperties}
                        >
                          <span className={s.bar} />
                        </div>
                      ))}
                    </div>

                    {active ? (
                      <>
                        <span
                          className={s.rule}
                          aria-hidden
                          style={{ "--x": (cursor! + 0.5) / period.days.length } as CSSProperties}
                        />
                        <div
                          className={s.readout}
                          data-flip={cursor! / period.days.length > 0.62 || undefined}
                          style={{ "--x": (cursor! + 0.5) / period.days.length } as CSSProperties}
                        >
                          <p className={s.readoutDay}>
                            {grainWord ? `Week of ` : `${weekday(active.iso)} `}
                            <span className={s.tnum}>{dayLabel(active.iso)}</span>
                          </p>
                          <p className={s.readoutValue}>
                            <span className={s.tnum}>{km(active.km)}</span>
                            <span>lost</span>
                          </p>
                          <p className={s.readoutSub}>
                            <i aria-hidden />
                            <span className={s.tnum}>{active.trips}</span> trips cancelled
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <table id={`${seriesId}-table`} className={s.srOnly}>
                  <caption>Service kilometres lost per {period.grain}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Kilometres lost</th>
                      <th scope="col">Trips cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.days.map((d) => (
                      <tr key={d.iso}>
                        <th scope="row">{dayLabel(d.iso)}</th>
                        <td>{d.km}</td>
                        <td>{d.trips}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={s.halves}>
                  <Half
                    flex={period.split}
                    label={period.first.label}
                    run={firstRun}
                    dim={cursor !== null && cursor >= period.split}
                  />
                  <Half
                    flex={period.days.length - period.split}
                    label={period.second.label}
                    run={secondRun}
                    dim={cursor !== null && cursor < period.split}
                    trailing={
                      secondRun && !secondRun.partial ? (
                        <span className={s.delta}>{kmDelta.label}</span>
                      ) : null
                    }
                  />
                </div>
              </section>

              <section className={s.causeBlock} aria-labelledby={`${seriesId}-c`}>
                <div className={s.blockHead}>
                  <h2 id={`${seriesId}-c`}>Lost km by cause</h2>
                  <p className={s.tnum}>{int(period.causes.length)} categories</p>
                </div>

                <div className={s.causeBody}>
                  <div
                    className={s.waffle}
                    aria-hidden
                    data-isolating={isolated ? true : undefined}
                  >
                    {period.causes.map((c, ci) => (
                      <div
                        key={c.name}
                        className={s.waffleGroup}
                        data-on={isolated === c.name || undefined}
                        style={{ flexGrow: Math.ceil(c.cells / 4) } as CSSProperties}
                      >
                        {Array.from({ length: c.cells }, (_, k) => (
                          <i
                            key={k}
                            style={{ "--cell": TINTS[ci], "--i": ci * 6 + k } as CSSProperties}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  <ul className={s.legend}>
                    {period.causes.map((c, ci) => (
                      <li key={c.name}>
                        <button
                          type="button"
                          className={s.legendRow}
                          data-dim={isolated !== null && isolated !== c.name ? true : undefined}
                          onPointerEnter={() => setIsolated(c.name)}
                          onPointerLeave={() => setIsolated(null)}
                          onFocus={() => setIsolated(c.name)}
                          onBlur={() => setIsolated(null)}
                        >
                          <span className={s.swatch} style={{ "--cell": TINTS[ci] } as CSSProperties} />
                          <span className={s.legendName}>{c.name}</span>
                          <span className={`${s.legendKm} ${s.tnum}`}>{int(c.km)}</span>
                          <span className={`${s.legendPct} ${s.tnum}`}>{Math.round(c.share * 100)}%</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </main>

            {/* ── right rail ──────────────────────────────────────────────── */}
            <aside className={s.side}>
              <section className={s.summary} aria-labelledby={`${seriesId}-s`}>
                <p className={s.summaryLabel} id={`${seriesId}-s`}>
                  <Icon d={PATHS.spark} />
                  Headway summary
                </p>
                {note.map((f) => (
                  <div key={f.head} className={s.finding}>
                    <h3>{f.head}</h3>
                    <p>{f.body}</p>
                  </div>
                ))}
              </section>

              <section className={s.depots} aria-labelledby={`${seriesId}-d`}>
                <div className={s.blockHead}>
                  <h2 id={`${seriesId}-d`}>Depots</h2>
                  <p className={s.tnum}>6 of 6</p>
                </div>

                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">Depot</th>
                      <th scope="col">Trips</th>
                      <th scope="col">EWT</th>
                      <th scope="col">Restored</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.depots.map((d) => (
                      <tr key={d.code}>
                        <th scope="row">
                          <span className={s.depotMark} aria-hidden>
                            {d.code}
                          </span>
                          {d.name}
                        </th>
                        <td className={s.tnum}>{int(d.trips)}</td>
                        <td className={s.tnum}>
                          {d.ewt.toFixed(1)}
                          <span
                            className={s.ewtBar}
                            aria-hidden
                            style={{ "--w": d.ewt / maxEwt } as CSSProperties}
                          />
                        </td>
                        <td className={s.tnum}>{d.restored.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Network</th>
                      <td className={s.tnum}>{int(period.scheduled)}</td>
                      <td className={s.tnum}>{period.ewt.toFixed(1)}</td>
                      <td className={s.tnum}>{period.restored.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            </aside>
          </div>

          {/* ── ask bar ──────────────────────────────────────────────────── */}
          <div className={s.askWrap} data-open={asking || undefined}>
            {asking ? (
              <ul className={s.suggestions}>
                {SUGGESTIONS.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      className={s.suggestion}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuestion(q);
                        ask.current?.focus();
                      }}
                    >
                      <Icon d={PATHS.search} />
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <form
              className={s.ask}
              onSubmit={(e) => {
                e.preventDefault();
                ask.current?.blur();
              }}
            >
              <Icon d={PATHS.spark} />
              <input
                ref={ask}
                className={s.askInput}
                value={question}
                placeholder="Ask about this report, e.g. what drove the worst day?"
                aria-label="Ask about this report"
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => setAsking(true)}
                onBlur={() => setAsking(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") ask.current?.blur();
                }}
              />
              <kbd className={s.kbd}>⌘J</kbd>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────────── */

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className={s.stat}>
      <Icon d={icon} />
      <p className={s.statLabel}>{label}</p>
      <p className={s.statValue}>{value}</p>
      <p className={s.statSub}>{sub}</p>
    </div>
  );
}

function Half({
  flex,
  label,
  run,
  dim,
  trailing,
}: {
  flex: number;
  label: string;
  run: { km: number; trips: number; partial: boolean; upto?: string } | null;
  dim: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={s.half} data-dim={dim || undefined} style={{ flexGrow: flex }}>
      <span className={s.halfRule} aria-hidden />
      <p className={s.halfLabel}>
        <span className={s.tnum}>{label}</span>
        {run?.partial ? <em>through {dayLabel(run.upto!)}</em> : null}
      </p>
      <p className={s.halfValue}>
        <span className={s.tnum}>{run ? km(run.km) : "—"}</span>
        {run ? (
          <span className={s.halfSub}>
            <span className={s.tnum}>{run.trips}</span> cancelled
          </span>
        ) : null}
        {trailing}
      </p>
    </div>
  );
}

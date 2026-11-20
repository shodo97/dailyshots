"use client";

/* 0006 — Helicorder
   The duty seismologist's screen at Kessel Volcano Observatory, 03:55 UTC on
   the night of an unrest episode. The centre is a drum record written live;
   everything around it exists to answer one question: raise the alert level
   or not. Red Hat Text carries the interface, Red Hat Mono every code, time,
   magnitude and depth. */

import { Red_Hat_Mono, Red_Hat_Text } from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import s from "./shot.module.css";
import { Drum, type Clock } from "./drum";
import { CrossSection, EventTrace, HourlyChart } from "./panels";
import { Icon } from "./icons";
import {
  CURRENT_LEVEL,
  GAP_ON,
  HANDOVER_T,
  LAST_RSAM,
  LEVELS,
  LEVEL_SINCE,
  LINES,
  LINE_S,
  RSAM_ALARM,
  RSAM_BASE,
  START_T,
  STATIONS,
  TREMOR_ON,
  dayLabel,
  detectT,
  eventsAround,
  fmtDepth,
  fmtMl,
  hhmm,
  rsam,
  span,
  utc,
  type Ev,
  type Kind,
} from "./data";

const sans = Red_Hat_Text({ subsets: ["latin"], variable: "--font-rht" });
const mono = Red_Hat_Mono({ subsets: ["latin"], variable: "--font-rhm" });

const RATES = [1, 30, 120] as const;
const GAINS = [0.5, 1, 2, 4] as const;

function initialSelection(): Ev {
  const evs = eventsAround(START_T - 5400, START_T).filter((e) => e.t0 >= START_T - 5400 && detectT(e) <= START_T);
  return evs.reduce((a, b) => (b.ml > a.ml ? b : a));
}

export default function Helicorder() {
  const reduce = !!useReducedMotion();
  const clock = useRef<Clock>({ t: START_T, rate: 30 });
  const [now, setNow] = useState(START_T);
  const [rateChoice, setRateChoice] = useState<number | null>(null);
  const rate = rateChoice ?? (reduce ? 1 : 30);
  const [gain, setGain] = useState(1);
  const [station, setStation] = useState(0);
  const [selected, setSelected] = useState<Ev>(initialSelection);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [notice, setNotice] = useState<"none" | "draft" | "sent">("none");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [proposed, setProposed] = useState(2);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    clock.current.rate = rate;
  }, [rate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(clock.current.t), 250);
    return () => window.clearInterval(id);
  }, []);

  const sec = Math.floor(now);
  const cur = Math.floor(now / LINE_S);
  const winStart = (cur - (LINES - 1)) * LINE_S;
  const from = Math.floor(winStart / 3600) * 3600;

  const detected = useMemo(
    () =>
      eventsAround(from, sec)
        .filter((e) => e.t0 >= from && detectT(e) <= sec)
        .sort((a, b) => b.t0 - a.t0),
    [from, sec],
  );

  const tenSec = Math.floor(now / 10);
  const rsamNow = useMemo(() => STATIONS.map((_, i) => rsam(i, tenSec * 10)), [tenSec]);

  const lastHour = detected.filter((e) => e.t0 > sec - 3600);
  const vtLastHour = lastHour.filter((e) => e.kind === "VT").length;
  const lpLastHour = lastHour.length - vtLastHour;
  const ratio = (rsamNow[0] ?? 0) / RSAM_BASE[0];

  const onPick = useCallback((id: string) => {
    const ev = eventsAround(0, clock.current.t + 600).find((e) => e.id === id);
    if (!ev) return;
    setSelected(ev);
    setPicked((prev) => new Set(prev).add(id));
  }, []);

  const pickedRecently = [...picked].some((id) => detected.find((e) => e.id === id && e.t0 > sec - 3600));

  const openNotice = () => {
    const vt = detected.filter((e) => e.kind === "VT");
    const firstTwo = vt.filter((e) => e.t0 < from + 7200);
    const lastTwo = vt.filter((e) => e.t0 > sec - 7200);
    const mean = (xs: Ev[]) => xs.reduce((a, e) => a + e.depth, 0) / Math.max(1, xs.length);
    const maxMl = Math.max(...lastHour.map((e) => e.ml), 0);
    const lps = detected.filter((e) => e.kind === "LP");
    setDraft(
      `Seismicity at Kessel has increased through the night. Volcano-tectonic earthquakes rose from ` +
        `${(firstTwo.length / 2).toFixed(1)} per hour between ${hhmm(from)} and ${hhmm(from + 7200)} UTC to ` +
        `${vtLastHour} in the past hour (largest ML ${fmtMl(maxMl)}), with hypocentres shallowing from about ` +
        `${mean(firstTwo).toFixed(1)} to ${mean(lastTwo).toFixed(1)} km below sea level. ${lps.length} long-period ` +
        `events since ${hhmm(lps[lps.length - 1]?.t0 ?? sec)} UTC. Harmonic tremor near 1.9 Hz began at ` +
        `${hhmm(TREMOR_ON)} UTC; RSAM at the summit station is ${ratio.toFixed(1)} times background. ` +
        `No eruption observed; summit obscured by cloud.`,
    );
    setNotice("draft");
    setSheetOpen(true);
  };

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const st = STATIONS[station];
  const rows = filter === "all" ? detected : detected.filter((e) => e.kind === filter);
  const vtTotal = detected.filter((e) => e.kind === "VT").length;
  const showProposed = notice !== "none";

  return (
    <div
      className={`${s.root} ${sans.variable} ${mono.variable}`}
      style={{ "--shot-sans": "var(--font-rht)", "--shot-mono": "var(--font-rhm)" } as CSSProperties}
    >
      {/* ── top: observatory, alert ladder, clock ──────────────────────── */}
      <header className={s.top}>
        <div className={s.brand}>
          <Icon name="mark" className={s.brandMark} />
          <div>
            <h1 className={s.brandName}>Kessel Volcano Observatory</h1>
            <p className={s.brandSub}>Seismic duty, night shift</p>
          </div>
        </div>

        <ol className={s.ladder} aria-label="Volcano alert level and aviation colour code">
          {LEVELS.map((l, i) => {
            const isCur = i === CURRENT_LEVEL;
            const isProp = showProposed && i === proposed && i !== CURRENT_LEVEL;
            return (
              <li
                key={l.level}
                className={`${s.rung} ${isCur ? s.rungCur : ""} ${isProp ? s.rungProp : ""}`}
                style={{ "--code": l.hex } as CSSProperties}
                aria-current={isCur ? "step" : undefined}
              >
                <span className={s.swatch} aria-hidden />
                <span className={s.rungText}>
                  <span className={s.rungLevel}>{l.level}</span>
                  <span className={s.rungCode}>{l.code}</span>
                </span>
                {isCur && <span className={s.rungNote}>since {LEVEL_SINCE}</span>}
                {isProp && <span className={s.rungNoteProp}>{notice === "sent" ? "awaiting sign-off" : "proposed"}</span>}
              </li>
            );
          })}
        </ol>

        <div className={s.topRight}>
          <div className={s.clock}>
            <span className={`${s.mono} ${s.clockTime}`}>{utc(sec)}</span>
            <span className={s.clockDay}>UTC, {dayLabel(sec)} 2026</span>
          </div>
          <button
            type="button"
            className={s.primary}
            onClick={() => (notice === "none" ? openNotice() : setSheetOpen((o) => !o))}
            aria-expanded={sheetOpen}
          >
            <Icon name="doc" />
            {notice === "sent" ? "Notice sent" : notice === "draft" && !sheetOpen ? "Resume draft" : "Draft notice"}
          </button>
        </div>
      </header>

      {/* ── left: stations, counts, log ────────────────────────────────── */}
      <aside className={s.rail}>
        <section aria-labelledby="stations-h">
          <div className={s.railHead}>
            <h2 id="stations-h" className={s.h2}>
              Stations
            </h2>
            <span className={s.dim}>
              {STATIONS.filter((x) => !(x.offlineFrom !== undefined && sec >= x.offlineFrom)).length} of {STATIONS.length} reporting
            </span>
          </div>
          <ul className={s.stations}>
            {STATIONS.map((x, i) => {
              const v = rsamNow[i];
              const off = v === null;
              const alarm = RSAM_ALARM[i];
              const high = !off && v > alarm;
              const pct = off ? 0 : Math.min(100, (v / (alarm * 2)) * 100);
              return (
                <li key={x.code}>
                  <button
                    type="button"
                    className={`${s.sta} ${i === station ? s.staSel : ""} ${off ? s.staOff : ""}`}
                    aria-pressed={i === station}
                    onClick={() => setStation(i)}
                  >
                    <span className={s.staTop}>
                      <span className={`${s.mono} ${s.staCode}`}>{x.code}</span>
                      <span className={`${s.staState} ${high ? s.stateHigh : ""} ${off ? s.stateOff : ""}`}>
                        {off ? <Icon name="linkOff" /> : null}
                        {off ? "Offline" : high ? "Above alarm" : "OK"}
                      </span>
                    </span>
                    <span className={s.staName}>
                      {x.name}
                      <span className={s.dim}>
                        {" "}
                        · <span className={s.mono}>{x.dist.toFixed(1)} km</span>
                      </span>
                    </span>
                    <span className={s.rsamRow}>
                      <span className={s.rsamTrack} aria-hidden>
                        {!off && <span className={s.rsamFill} style={{ width: `${pct}%` }} />}
                        <span className={s.rsamAlarm} />
                      </span>
                      <span className={`${s.mono} ${s.rsamVal}`}>{off ? "—" : v}</span>
                    </span>
                    {off && (
                      <span className={s.staGap}>
                        No telemetry for <span className={s.mono}>{span(sec - GAP_ON)}</span>, last RSAM{" "}
                        <span className={s.mono}>{LAST_RSAM[i]}</span> at <span className={s.mono}>{utc(GAP_ON)}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={s.rsamKey}>
            RSAM, 10 min mean in counts. Tick: alarm at 2.5× background.
          </p>
        </section>

        <section aria-labelledby="counts-h" className={s.railSection}>
          <div className={s.railHead}>
            <h2 id="counts-h" className={s.h2}>
              Events per hour
            </h2>
            <span className={s.legend}>
              <i className={s.keyVt} /> VT <i className={s.keyLp} /> LP
            </span>
          </div>
          <HourlyChart events={detected} from={from} now={sec} />
        </section>

      </aside>

      {/* ── centre: the drum ───────────────────────────────────────────── */}
      <main className={s.centre}>
        <div className={s.drumHead}>
          <div className={s.drumTitle}>
            <h2 className={`${s.mono} ${s.drumCode}`}>{st.code}</h2>
            <span className={s.drumMeta}>
              {st.name}, vertical · 24 lines × 30 min ·{" "}
              <span className={s.mono}>
                {hhmm(winStart)}–{hhmm(winStart + LINES * LINE_S)}
              </span>
            </span>
          </div>
          <div className={s.controls}>
            <div className={s.ctl}>
              <span className={s.ctlLabel} id="gain-l">
                Gain
              </span>
              <div className={s.stepper} role="group" aria-labelledby="gain-l">
                <button
                  type="button"
                  aria-label="Decrease gain"
                  disabled={gain === GAINS[0]}
                  onClick={() => setGain(GAINS[Math.max(0, GAINS.indexOf(gain as (typeof GAINS)[number]) - 1)])}
                >
                  <Icon name="minus" />
                </button>
                <span className={`${s.mono} ${s.stepVal}`}>×{gain}</span>
                <button
                  type="button"
                  aria-label="Increase gain"
                  disabled={gain === GAINS[GAINS.length - 1]}
                  onClick={() =>
                    setGain(GAINS[Math.min(GAINS.length - 1, GAINS.indexOf(gain as (typeof GAINS)[number]) + 1)])
                  }
                >
                  <Icon name="plus" />
                </button>
              </div>
            </div>
            <div className={s.ctl}>
              <span className={s.ctlLabel} id="rate-l">
                Drum rate
              </span>
              <div className={s.seg} role="radiogroup" aria-labelledby="rate-l">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={rate === r}
                    className={rate === r ? s.segOn : ""}
                    onClick={() => setRateChoice(r)}
                  >
                    {r === 1 ? "Live" : `×${r}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Drum
          clock={clock}
          station={station}
          gain={gain}
          selectedId={selected.id}
          picked={picked}
          onPick={onPick}
          reduce={reduce}
          mono={mono.style.fontFamily}
          sans={sans.style.fontFamily}
        />

        <div className={s.drumFoot}>
          <span>
            Past hour{" "}
            <b>
              {vtLastHour} VT · {lpLastHour} LP
            </b>
          </span>
          <span>
            Harmonic tremor since <b className={s.mono}>{hhmm(TREMOR_ON)}</b>
          </span>
          <span>
            RSAM <span className={s.mono}>SUM</span> <b>{ratio.toFixed(1)}×</b> background
          </span>
          <span className={s.hint}>
            Hover to magnify, click to pick · <kbd>←</kbd>
            <kbd>→</kbd> <kbd>Enter</kbd>
          </span>
        </div>
      </main>

      {/* ── right: the selected event, then the catalogue ─────────────── */}
      <aside className={s.side}>
        <section className={s.detail} aria-labelledby="ev-h">
          <div className={s.detailHead}>
            <h2 id="ev-h" className={`${s.mono} ${s.evId}`}>
              {selected.id}
            </h2>
            <span className={s.kindTag}>{selected.kind === "VT" ? "Volcano-tectonic" : "Long-period"}</span>
            <Status ev={selected} picked={picked} />
          </div>
          <dl className={s.facts}>
            <div>
              <dt>Origin UTC</dt>
              <dd className={s.mono}>{utc(selected.t0, 1)}</dd>
            </div>
            <div>
              <dt>ML</dt>
              <dd className={s.mono}>{fmtMl(selected.ml)}</dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd className={s.mono}>{fmtDepth(selected.depth)} km</dd>
            </div>
            <div>
              <dt>S−P</dt>
              <dd className={s.mono}>
                {selected.kind === "VT"
                  ? `${(selected.arr[0].ts - selected.arr[0].tp).toFixed(2)} s`
                  : "no S"}
              </dd>
            </div>
          </dl>
          <EventTrace ev={selected} si={station} reduce={reduce} mono={mono.style.fontFamily} />
          <figure className={s.xsWrap}>
            <figcaption className={s.traceCap}>
              <span>Cross-section W–E through the vent</span>
              <span className={s.legend}>
                <i className={s.keyCircle} /> VT <i className={s.keyDiamond} /> LP
              </span>
            </figcaption>
            <CrossSection events={detected} selected={selected} now={sec} reduce={reduce} station={station} />
          </figure>
        </section>

        <section className={s.cat} aria-labelledby="cat-h">
          <div className={s.catHead}>
            <h2 id="cat-h" className={s.h2}>
              Catalogue
            </h2>
            <span className={s.dim}>
              <span className={s.tnum}>{detected.length}</span> since {hhmm(from)}
            </span>
            <div className={s.chips} role="radiogroup" aria-label="Filter by event type">
              {(
                [
                  ["all", "All", detected.length],
                  ["VT", "VT", vtTotal],
                  ["LP", "LP", detected.length - vtTotal],
                ] as const
              ).map(([k, label, n]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={filter === k}
                  className={filter === k ? s.chipOn : s.chip}
                  onClick={() => setFilter(k)}
                >
                  {label} <span className={s.tnum}>{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={s.catCols} aria-hidden>
            <span>UTC</span>
            <span>Type</span>
            <span>ML</span>
            <span>Depth</span>
            <span>Review</span>
          </div>
          <ul className={s.catList}>
            {rows.map((e) => (
              <li key={e.id} className={sec - detectT(e) < 30 * rate && e.t0 > START_T ? s.rowNew : undefined}>
                <button
                  type="button"
                  className={`${s.row} ${e.id === selected.id ? s.rowSel : ""}`}
                  aria-current={e.id === selected.id ? "true" : undefined}
                  onClick={() => onPick(e.id)}
                >
                  <span className={s.mono}>{utc(e.t0)}</span>
                  <span className={e.kind === "LP" ? s.typeLp : s.typeVt}>{e.kind}</span>
                  <span className={s.mono}>{fmtMl(e.ml)}</span>
                  <span className={s.mono}>{fmtDepth(e.depth)}</span>
                  <Status ev={e} picked={picked} compact />
                </button>
              </li>
            ))}
            {rows.length === 0 && <li className={s.empty}>No {filter} events in this window.</li>}
          </ul>
        </section>

        <AnimatePresence>
          {sheetOpen && (
            <motion.section
              className={s.sheet}
              aria-labelledby="notice-h"
              initial={reduce ? false : { x: "100%", opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { x: "100%", opacity: 0.6 }}
              transition={{ duration: reduce ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={s.sheetHead}>
                <div>
                  <h2 id="notice-h" className={s.sheetTitle}>
                    Notice draft
                  </h2>
                  <p className={s.dim}>Volcano Observatory Notice for Aviation</p>
                </div>
                <button type="button" className={s.iconBtn} aria-label="Close draft" onClick={() => setSheetOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <dl className={s.vona}>
                <div>
                  <dt>Volcano</dt>
                  <dd>
                    Kessel <span className={s.mono}>0412-07</span>
                  </dd>
                </div>
                <div>
                  <dt>Notice</dt>
                  <dd className={s.mono}>2026-KSL-007</dd>
                </div>
                <div>
                  <dt>Summit</dt>
                  <dd className={s.mono}>2412 m · 7913 ft</dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd className={s.mono}>{notice === "sent" ? utc(sentAt) : utc(sec)} UTC</dd>
                </div>
              </dl>

              <fieldset className={s.codes} disabled={notice === "sent"}>
                <legend className={s.fieldLabel}>Aviation colour code</legend>
                {LEVELS.map((l, i) => (
                  <label key={l.code} className={s.code} style={{ "--code": l.hex } as CSSProperties}>
                    <input
                      type="radio"
                      name="code"
                      checked={proposed === i}
                      onChange={() => setProposed(i)}
                    />
                    <span className={s.swatch} aria-hidden />
                    <span className={s.codeName}>{l.code}</span>
                    <span className={s.dim}>{i === CURRENT_LEVEL ? "current" : l.level.toLowerCase()}</span>
                  </label>
                ))}
              </fieldset>

              <label className={s.fieldLabel} htmlFor="summary">
                Volcanic activity summary
              </label>
              <textarea
                id="summary"
                className={s.summary}
                value={draft}
                readOnly={notice === "sent"}
                onChange={(e) => setDraft(e.target.value)}
              />

              {notice === "draft" && !pickedRecently && (
                <p className={s.warn} role="status">
                  <Icon name="warn" />
                  Pick at least one event from the past hour before sending. The summary still quotes automatic
                  locations.
                </p>
              )}
              {notice === "draft" && proposed === CURRENT_LEVEL && (
                <p className={s.warn} role="status">
                  <Icon name="warn" />
                  Colour code unchanged. Send a status update instead of a VONA.
                </p>
              )}

              {notice === "sent" ? (
                <div className={s.sent} role="status">
                  <span className={s.sentDot} aria-hidden />
                  <span>
                    Sent to the duty chief at <span className={s.mono}>{utc(sentAt)}</span>. Awaiting sign-off before
                    release to Kessel ACC and the VAAC.
                  </span>
                  <button type="button" className={s.ghost} onClick={() => setNotice("draft")}>
                    Withdraw
                  </button>
                </div>
              ) : (
                <div className={s.actions}>
                  <button
                    type="button"
                    className={s.ghost}
                    onClick={() => {
                      setNotice("none");
                      setSheetOpen(false);
                    }}
                  >
                    Discard draft
                  </button>
                  <button
                    type="button"
                    className={s.primary}
                    disabled={!pickedRecently || proposed === CURRENT_LEVEL}
                    onClick={() => {
                      setSentAt(sec);
                      setNotice("sent");
                    }}
                  >
                    <Icon name="send" />
                    Send to duty chief
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
}

function Status({ ev, picked, compact }: { ev: Ev; picked: ReadonlySet<string>; compact?: boolean }) {
  if (picked.has(ev.id))
    return (
      <span className={`${s.status} ${s.statusPicked}`}>
        <Icon name="pen" />
        {compact ? "You" : "Picked by you"}
      </span>
    );
  if (ev.t0 < HANDOVER_T)
    return (
      <span className={s.status}>
        <Icon name="check" />
        {compact ? "MK" : "Reviewed, MK"}
      </span>
    );
  return (
    <span className={`${s.status} ${s.statusAuto}`}>
      <Icon name="auto" />
      Auto
    </span>
  );
}

"use client";

/* 0011 — Tidewater
   A harbour tide and passage app for leaving a mooring before dawn. The
   chart is drawn in the S-52 night colour table that real ship displays
   switch to after dark; scrubbing the tide floods and drains it. Set in
   Atkinson Hyperlegible, a face drawn for reading in poor conditions. */

import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import s from "./shot.module.css";
import { Chart } from "./chart";
import { Timeline } from "./timeline";
import { Icon, StatusGlyphs } from "./icons";
import {
  BAR_CHARTED,
  BERTH,
  DAY,
  DAY_EXTREMES,
  DRAUGHT,
  FIRST,
  FIRST_GUST,
  HARBOUR,
  MARGIN,
  NEXT,
  NOW,
  SAFETY_DEPTH,
  SLIP,
  SPEED_KN,
  SUN,
  TO_BAR_H,
  TO_BAR_NM,
  WIND,
  compass,
  duration,
  hhmm,
  m2,
  tide,
  ukc,
  verdictFor,
  type Verdict,
} from "./data";

const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-tw-sans",
});
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-tw-mono" });

const PEAK = WIND.reduce((a, b) => (b.gust > a.gust ? b : a));

/** Playback runs the day at 1.2 hours a second. */
const RATE = 1.2 / 1000;

/** What the bar is like at the scrubbed time, after the margin figure. */
const VERDICT_TEXT: Record<Verdict, string> = {
  clear: "bar passable at",
  margin: "too tight at",
  aground: "aground on the bar at",
};

const VERDICT_ICON = { clear: "clear", margin: "margin", aground: "aground" } as const;

function verdictFigure(c: number) {
  const v = verdictFor(c);
  if (v === "clear") return `${m2(c - MARGIN)} m above margin`;
  if (v === "margin") return `${m2(MARGIN - c)} m inside margin`;
  return `${m2(-c)} m short`;
}

function relative(t: number, clock: number) {
  const d = t - clock;
  if (Math.abs(d) < 1 / 60) return "now";
  return d > 0 ? `in ${duration(d)}` : `${duration(-d)} ago`;
}

export default function Tidewater() {
  const reduced = !!useReducedMotion();
  const [t, setT] = useState(NOW);
  const [playing, setPlaying] = useState(false);
  const [red, setRed] = useState(false);
  const [clock, setClock] = useState(NOW);
  const tRef = useRef(t);
  const tween = useRef(0);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // the scenario clock: Saturday 05:10 when the page opens, then real time
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => setClock(NOW + (performance.now() - start) / 3_600_000), 10_000);
    return () => window.clearInterval(id);
  }, []);

  // play the day on open, so the chart is visibly flooding before anyone touches it
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => setPlaying(true), 450);
    return () => window.clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (!playing || reduced) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setT((v) => {
        const n = v + dt * RATE;
        return n >= 24 ? n - 24 : n;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(tween.current);
    setPlaying(false);
  }, []);

  const scrub = useCallback((v: number) => setT(v), []);

  const jump = useCallback(
    (target: number) => {
      stopAll();
      if (reduced) {
        setT(target);
        return;
      }
      const from = tRef.current;
      const t0 = performance.now();
      const dur = Math.min(900, 380 + Math.abs(target - from) * 70);
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(2, -10 * k);
        setT(from + (target - from) * (k >= 1 ? 1 : e));
        if (k < 1) tween.current = requestAnimationFrame(step);
      };
      tween.current = requestAnimationFrame(step);
    },
    [reduced, stopAll],
  );

  const h = tide(t);
  const c = ukc(t);
  const v = verdictFor(c);
  const atNow = Math.abs(t - clock) < 1 / 120;
  const atOpen = Math.abs(t - FIRST.open) < 1 / 120;
  const mode = red ? "red" : "night";
  const beforeDawn = SUN.dawn - FIRST.open;

  const opens =
    clock < FIRST.open
      ? `Opens in ${duration(FIRST.open - clock)}. Slip lines by ${hhmm(SLIP)}.`
      : clock < FIRST.close
        ? `Open now. Closes in ${duration(FIRST.close - clock)}.`
        : `Closed. Next water ${NEXT ? hhmm(NEXT.open) : "tomorrow"}.`;

  return (
    <div
      className={`${s.root} ${sans.variable} ${mono.variable}`}
      data-mode={mode}
      style={
        {
          "--shot-sans": "var(--font-tw-sans)",
          "--shot-display": "var(--font-tw-sans)",
          "--shot-mono": "var(--font-tw-mono)",
        } as CSSProperties
      }
    >
      <div className={s.status} aria-hidden>
        <span className={s.num}>{hhmm(clock)}</span>
        <StatusGlyphs />
      </div>

      <header className={s.head}>
        <div className={s.place}>
          <h1>{HARBOUR}</h1>
          <p>
            {DAY} · Berth {BERTH} · draught <span className={s.tn}>{DRAUGHT.toFixed(1)} m</span>
          </p>
        </div>
        <div className={s.answer}>
          <h2>
            Clear to cross <span className={s.num}>{hhmm(FIRST.open)}</span>
            <span className={s.dash}>–</span>
            <span className={s.num}>{hhmm(FIRST.close)}</span>
          </h2>
          <p className={s.tn}>{opens}</p>
        </div>
      </header>

      <Chart t={t} mode={mode} reduced={reduced} />

      <ul className={s.legend} aria-label="Depth shading, tide included">
        <li><i data-b="dry" />Dries</li>
        <li><i data-b="shoal" />&lt;{DRAUGHT.toFixed(1)}</li>
        <li><i data-b="margin" />{DRAUGHT.toFixed(1)}–{SAFETY_DEPTH.toFixed(1)}</li>
        <li><i data-b="safe" />&gt;{SAFETY_DEPTH.toFixed(1)} m</li>
        <li><i data-b="contour" />safety</li>
      </ul>

      <section className={s.scrub} aria-label="Tide at the bar">
        <div className={s.readout}>
          <div className={s.when}>
            <b className={s.num}>{hhmm(t)}</b>
            <span>{relative(t, clock)}</span>
          </div>
          <dl className={s.figs}>
            <div>
              <dt>Tide</dt>
              <dd className={s.num}>{m2(h)}<small> m</small></dd>
            </div>
            <div>
              <dt>On the bar</dt>
              <dd className={s.num}>{m2(BAR_CHARTED + h)}<small> m</small></dd>
            </div>
            <div data-v={v}>
              <dt>Under keel</dt>
              <dd className={s.num}>{c >= 0 ? "+" : "−"}{m2(Math.abs(c))}<small> m</small></dd>
            </div>
          </dl>
        </div>

        <p className={s.verdict} data-v={v} aria-live="polite">
          <Icon name={VERDICT_ICON[v]} size={16} className={s.verdictIcon} />
          <b className={s.tn}>{verdictFigure(c)}</b>
          <span className={s.tn}>
            {VERDICT_TEXT[v]} {hhmm(t)}
          </span>
        </p>

        <Timeline t={t} onScrub={scrub} onScrubStart={stopAll} onJump={jump} reduced={reduced} />
        <div className={s.controls}>
          <button
            type="button"
            className={s.btn}
            data-primary
            aria-pressed={playing}
            disabled={reduced}
            onClick={() => (playing ? setPlaying(false) : setPlaying(true))}
          >
            <Icon name={playing ? "pause" : "play"} size={16} />
            {playing ? "Pause" : "Play the day"}
          </button>
          <button type="button" className={s.btn} disabled={atNow && !playing} onClick={() => jump(clock)}>
            <Icon name="now" size={16} />
            Now
          </button>
          <button type="button" className={s.btn} disabled={atOpen && !playing} onClick={() => jump(FIRST.open)}>
            <Icon name="skip" size={16} />
            Window opens
          </button>
        </div>

        <p className={s.hint}>Drag the timeline, tap a time, or use the arrow keys.</p>
      </section>

      <section className={s.block} aria-labelledby="tw-plan">
        <h3 id="tw-plan">Passage out</h3>
        <dl className={s.rows}>
          <div>
            <dt>Slip lines</dt>
            <dd className={s.num}>{hhmm(SLIP)}</dd>
          </div>
          <div>
            <dt>
              Over Ardlin Bar
              <small>
                {TO_BAR_NM.toFixed(2)} nm, {Math.round(TO_BAR_H * 60)} min at {SPEED_KN} kn
              </small>
            </dt>
            <dd className={s.num}>{hhmm(FIRST.open)}</dd>
          </div>
          <div>
            <dt>
              Back over the bar by
              <small>window closes</small>
            </dt>
            <dd className={s.num}>{hhmm(FIRST.close)}</dd>
          </div>
          {NEXT && (
            <div>
              <dt>
                Evening window
                <small>after dark</small>
              </dt>
              <dd className={s.num}>
                {hhmm(NEXT.open)}–{hhmm(NEXT.close)}
              </dd>
            </div>
          )}
        </dl>

        <p className={s.advisory} role="note">
          <Icon name="gust" size={18} className={s.advisoryIcon} />
          <span>
            Gusts reach <b>{FIRST_GUST.gust} kt</b> from <b>{hhmm(FIRST_GUST.h)}</b>{" "}
            and <b>{PEAK.gust} kt</b> at <b>{hhmm(PEAK.h)}</b> as the front
            clears and the wind veers {compass(WIND[PEAK.h + 2].dir)}. Miss the {hhmm(FIRST.close)} close and the next water is{" "}
            {NEXT ? hhmm(NEXT.open) : "tomorrow"}.
          </span>
        </p>

        <ol className={s.tides} aria-label="High and low water">
          {DAY_EXTREMES.map((e) => (
            <li key={e.t} data-k={e.kind}>
              <span>{e.kind === "HW" ? "High" : "Low"}</span>
              <b className={s.num}>{hhmm(e.t)}</b>
              <span className={s.num}>{m2(e.h)} m</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={s.block} aria-labelledby="tw-night">
        <h3 id="tw-night">Night watch</h3>
        <p className={s.lede}>
          You cross the bar <span className={s.tn}>{duration(beforeDawn)}</span> before civil dawn. Lights on, and
          keep the screen dim.
        </p>
        <dl className={s.rows}>
          <div>
            <dt>
              <Icon name="horizon" size={16} className={s.rowIcon} />
              Civil dawn
            </dt>
            <dd className={s.num}>{hhmm(SUN.dawn)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="sun" size={16} className={s.rowIcon} />
              Sunrise
            </dt>
            <dd className={s.num}>{hhmm(SUN.rise)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="sun" size={16} className={s.rowIcon} />
              Sunset
            </dt>
            <dd className={s.num}>{hhmm(SUN.set)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="horizon" size={16} className={s.rowIcon} />
              Civil dusk
            </dt>
            <dd className={s.num}>{hhmm(SUN.dusk)}</dd>
          </div>
        </dl>

        <button type="button" role="switch" aria-checked={red} className={s.switchRow} onClick={() => setRed((r) => !r)}>
          <Icon name="bulb" size={20} className={s.rowIcon} />
          <span className={s.switchText}>
            <b>Red light</b>
            <small>Red only, every colour. Keeps your night vision on deck.</small>
          </span>
          <span className={s.switch} aria-hidden>
            <span />
          </span>
        </button>
      </section>

      <footer className={s.foot}>
        Predictions for Ardlin Bar, heights in metres above chart datum. Charted depth{" "}
        <span className={s.tn}>{BAR_CHARTED.toFixed(1)} m</span>. Not for navigation.
      </footer>
    </div>
  );
}

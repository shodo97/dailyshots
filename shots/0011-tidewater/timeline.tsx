"use client";

/* The passage timeline: one horizontal time axis shared by the tide curve,
   the hourly wind and the daylight, panned under a fixed playhead. Drag it,
   flick it, tap a time, or use the arrow keys. */

import { memo, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import s from "./shot.module.css";
import {
  EXTREMES,
  GUST_WARN,
  NOW,
  SUN,
  THRESHOLD,
  WINDOWS,
  WIND,
  compass,
  hhmm,
  m2,
  tide,
  ukc,
} from "./data";

const PPH = 44;
const W = 390;
const MID = W / 2;
const H_MAX = 2.6;
const H_MIN = -0.2;
const PLOT_TOP = 30;
const PLOT_BOT = 124;
const Y = (h: number) => PLOT_TOP + ((H_MAX - h) / (H_MAX - H_MIN)) * (PLOT_BOT - PLOT_TOP);
const X = (t: number) => t * PPH;
const WIND_Y = 152;
const SUN_Y = 218;
const TOTAL_H = 258;
const FROM = -5;
const TO = 29;

const curvePts = (() => {
  const pts: string[] = [];
  for (let t = FROM; t <= TO + 1e-6; t += 1 / 12) pts.push(`${X(t).toFixed(1)} ${Y(tide(t)).toFixed(2)}`);
  return pts;
})();
const CURVE_D = `M${curvePts.join("L")}`;
const AREA_D = `${CURVE_D}L${X(TO)} ${PLOT_BOT}L${X(FROM)} ${PLOT_BOT}Z`;
const Y_THR = Y(THRESHOLD);

/** The static drawing, panned as one group. Only the hour highlight changes. */
const Track = memo(function Track({ hour }: { hour: number }) {
  const dayAfter = { dawn: SUN.dawn + 24, rise: SUN.rise + 24 };
  return (
    <>
      {/* night, twilight and day behind the curve */}
      <rect x={X(FROM)} y={PLOT_TOP - 14} width={X(SUN.dawn - FROM)} height={PLOT_BOT - PLOT_TOP + 14} className={s.tlNight} />
      <rect x={X(SUN.dawn)} y={PLOT_TOP - 14} width={X(SUN.rise - SUN.dawn)} height={PLOT_BOT - PLOT_TOP + 14} className={s.tlTwilight} />
      <rect x={X(SUN.rise)} y={PLOT_TOP - 14} width={X(SUN.set - SUN.rise)} height={PLOT_BOT - PLOT_TOP + 14} className={s.tlDay} />
      <rect x={X(SUN.set)} y={PLOT_TOP - 14} width={X(SUN.dusk - SUN.set)} height={PLOT_BOT - PLOT_TOP + 14} className={s.tlTwilight} />
      <rect x={X(SUN.dusk)} y={PLOT_TOP - 14} width={X(dayAfter.dawn - SUN.dusk)} height={PLOT_BOT - PLOT_TOP + 14} className={s.tlNight} />

      {/* hour grid and labels */}
      {Array.from({ length: TO - FROM + 1 }, (_, i) => {
        const hh = FROM + i;
        const inDay = hh >= 0 && hh < 24;
        return (
          <g key={hh}>
            <path d={`M${X(hh)} ${PLOT_TOP - 14}V${PLOT_BOT}`} className={hh % 24 === 0 ? s.tlMidnight : s.tlGrid} />
            <text x={X(hh)} y={PLOT_BOT + 15} textAnchor="middle" className={`${s.tlHour} ${inDay ? "" : s.tlOff} ${hh === hour ? s.tlHourOn : ""}`}>
              {String(((hh % 24) + 24) % 24).padStart(2, "0")}
            </text>
          </g>
        );
      })}
      <text x={X(0) + 5} y={PLOT_TOP - 4} className={s.tlDayName}>Sat</text>
      <text x={X(24) + 5} y={PLOT_TOP - 4} className={`${s.tlDayName} ${s.tlOff}`}>Sun</text>
      <text x={X(0) - 5} y={PLOT_TOP - 4} textAnchor="end" className={`${s.tlDayName} ${s.tlOff}`}>Fri</text>

      {/* water under the curve, and the part of it that clears the bar */}
      <path d={AREA_D} className={s.tlWater} />
      <path d={AREA_D} className={s.tlSafe} clipPath="url(#tw-above)" />
      <path d={`M${X(FROM)} ${Y_THR}H${X(TO)}`} className={s.tlThreshold} />
      <path d={CURVE_D} className={s.tlCurve} />
      <path d={CURVE_D} className={s.tlCurveSafe} clipPath="url(#tw-above)" />

      {WINDOWS.map((w) => (
        <g key={w.open} className={s.tlWindow}>
          <path d={`M${X(w.open)} ${Y_THR}V${PLOT_TOP - 14}M${X(w.close)} ${Y_THR}V${PLOT_TOP - 14}`} />
          <text x={X((w.open + w.close) / 2)} y={11} textAnchor="middle">
            {hhmm(w.open)} – {hhmm(w.close)}
          </text>
        </g>
      ))}

      {EXTREMES.map((e) => (
        <g key={e.t} className={s.tlExtreme}>
          <circle cx={X(e.t)} cy={Y(e.h)} r={2.2} />
          <text x={X(e.t)} y={e.kind === "HW" ? Y(e.h) + 17 : Y(e.h) - 10} textAnchor="middle">
            <tspan className={s.tlExKind}>{e.kind}</tspan> {hhmm(e.t)} {m2(e.h)}
          </text>
        </g>
      ))}

      <g className={s.tlNow}>
        <path d={`M${X(NOW)} ${PLOT_TOP - 12}V${PLOT_BOT}`} />
        <text x={X(NOW) - 4} y={PLOT_BOT - 4} textAnchor="end">now</text>
      </g>

      {/* wind */}
      {WIND.map((w) => {
        const warn = w.gust >= GUST_WARN;
        return (
          <g key={w.h} transform={`translate(${X(w.h)} ${WIND_Y})`} className={`${s.tlWind} ${w.h === hour ? s.tlWindOn : ""}`} data-warn={warn || undefined}>
            <rect x={-18} y={-4} width={36} height={58} rx={6} className={s.tlWindCell} />
            <path
              d="M0 1.5v13M-3.6 5.1L0 1.5l3.6 3.6"
              transform={`rotate(${w.dir + 180} 0 8)`}
              className={s.tlArrow}
            />
            <text y={34} textAnchor="middle" className={s.tlKt}>{w.kt}</text>
            <text y={47} textAnchor="middle" className={s.tlGust}>{w.gust}</text>
          </g>
        );
      })}

      {/* daylight */}
      <g transform={`translate(0 ${SUN_Y})`}>
        <rect x={X(FROM)} y={10} width={X(TO - FROM)} height={6} rx={3} className={s.sunNight} />
        <rect x={X(SUN.dawn)} y={10} width={X(SUN.dusk - SUN.dawn)} height={6} className={s.sunTwilight} />
        <rect x={X(SUN.rise)} y={10} width={X(SUN.set - SUN.rise)} height={6} className={s.sunDay} />
        <rect x={X(dayAfter.dawn)} y={10} width={X(dayAfter.rise - dayAfter.dawn)} height={6} className={s.sunTwilight} />
        {[
          { t: SUN.dawn, label: "civil dawn", up: true, anchor: "end" as const },
          { t: SUN.rise, label: "sunrise", up: false, anchor: "start" as const },
          { t: SUN.set, label: "sunset", up: false, anchor: "end" as const },
          { t: SUN.dusk, label: "civil dusk", up: true, anchor: "start" as const },
        ].map((m) => (
          <g key={m.label} className={s.sunMark}>
            <path d={`M${X(m.t)} ${m.up ? 4 : 10}V${m.up ? 16 : 22}`} />
            <text x={X(m.t) + (m.anchor === "end" ? -4 : 4)} y={m.up ? 6 : 32} textAnchor={m.anchor}>
              <tspan className={s.num}>{hhmm(m.t)}</tspan> {m.label}
            </text>
          </g>
        ))}
      </g>
    </>
  );
});

type Props = {
  t: number;
  onScrub: (t: number) => void;
  onScrubStart: () => void;
  onJump: (t: number) => void;
  reduced: boolean;
};

export function Timeline({ t, onScrub, onScrubStart, onJump, reduced }: Props) {
  const drag = useRef<{
    id: number;
    x0: number;
    t0: number;
    moved: number;
    lastX: number;
    lastAt: number;
    v: number;
  } | null>(null);
  const inertia = useRef(0);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const clamp = (v: number) => Math.min(24, Math.max(0, v));

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(inertia.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x0: e.clientX, t0: tRef.current, moved: 0, lastX: e.clientX, lastAt: e.timeStamp, v: 0 };
    onScrubStart();
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    d.moved = Math.max(d.moved, Math.abs(dx));
    const dt = Math.max(1, e.timeStamp - d.lastAt);
    d.v = 0.7 * d.v + 0.3 * ((e.clientX - d.lastX) / dt);
    d.lastX = e.clientX;
    d.lastAt = e.timeStamp;
    onScrub(clamp(d.t0 - dx / PPH));
  };

  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved < 4) {
      const rect = e.currentTarget.getBoundingClientRect();
      onJump(clamp(tRef.current + (e.clientX - rect.left - MID) / PPH));
      return;
    }
    if (reduced || e.timeStamp - d.lastAt > 80) return;
    let v = -d.v / PPH; // hours per ms
    let last = performance.now();
    let cur = tRef.current;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      v *= Math.pow(0.994, dt);
      const next = clamp(cur + v * dt);
      cur = next;
      onScrub(next);
      if (Math.abs(v) > 0.00002 && next > 0 && next < 24) inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  };

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = e.shiftKey || e.key === "PageUp" || e.key === "PageDown";
    const stepH = big ? 1 : 1 / 6;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp")
      next = (Math.floor(t / stepH + 1e-6) + 1) * stepH;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown")
      next = (Math.ceil(t / stepH - 1e-6) - 1) * stepH;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = 24;
    if (next === null) return;
    e.preventDefault();
    onScrubStart();
    onScrub(clamp(next));
  };

  const h = tide(t);
  const c = ukc(t);
  const hour = Math.min(23, Math.round(t));
  const wh = WIND[hour];

  return (
    <div
      className={s.timeline}
      role="slider"
      tabIndex={0}
      aria-label="Time of day"
      aria-valuemin={0}
      aria-valuemax={1440}
      aria-valuenow={Math.round(t * 60)}
      aria-valuetext={`${hhmm(t)}, tide ${m2(h)} metres, ${c >= 0 ? "" : "minus "}${m2(Math.abs(c))} metres under the keel on the bar, wind ${compass(wh.dir)} ${wh.kt} knots gusting ${wh.gust}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <svg width={W} height={TOTAL_H} viewBox={`0 0 ${W} ${TOTAL_H}`} className={s.tlSvg} aria-hidden>
        <defs>
          <clipPath id="tw-above">
            <rect x={X(FROM)} y={0} width={X(TO - FROM)} height={Y_THR} />
          </clipPath>
          <linearGradient id="tw-fade-l" x1="0" x2="1">
            <stop offset="0" className={s.fadeStop} stopOpacity="1" />
            <stop offset="0.5" className={s.fadeStop} stopOpacity="0.92" />
            <stop offset="1" className={s.fadeStop} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tw-fade-r" x1="1" x2="0">
            <stop offset="0" className={s.fadeStop} stopOpacity="1" />
            <stop offset="1" className={s.fadeStop} stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${(MID - X(t)).toFixed(2)} 0)`}>
          <Track hour={hour} />
        </g>

        <rect x={0} y={0} width={64} height={TOTAL_H} fill="url(#tw-fade-l)" />
        <rect x={W - 44} y={0} width={44} height={TOTAL_H} fill="url(#tw-fade-r)" />

        {/* fixed furniture */}
        {[0, 1, 2].map((m) => (
          <text key={m} x={10} y={Y(m) + 3.5} className={s.tlAxis}>
            {m}
            {m === 2 ? " m" : ""}
          </text>
        ))}
        <text x={W - 10} y={Y_THR - 5} textAnchor="end" className={s.tlThrLabel}>
          {THRESHOLD.toFixed(1)} m · 0.5 under keel
        </text>
        <text x={8} y={WIND_Y + 34} className={s.tlTrackLabel}>kt</text>
        <text x={8} y={WIND_Y + 47} className={s.tlTrackLabel}>gust</text>

        {/* the playhead */}
        <path d={`M${MID} ${PLOT_TOP - 8}V${PLOT_BOT + 4}M${MID} ${SUN_Y + 4}V${SUN_Y + 22}`} className={s.playhead} />
        <circle cx={MID} cy={Y(h)} r={4.5} className={s.playDot} />
        <path d={`M${MID - 5} ${PLOT_TOP - 13}h10l-5 6z`} className={s.playCap} />
      </svg>
    </div>
  );
}

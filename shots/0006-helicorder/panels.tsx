"use client";

/* The right-hand instruments: one event's waveform with its phase picks, the
   W–E cross-section it is plotted on, and the hourly count chart. */

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./shot.module.css";
import {
  FS_FINE,
  STATIONS,
  elevation,
  eventsAround,
  fmtDepth,
  hhmm,
  sample,
  utc,
  type Ev,
} from "./data";

const VIOLET = "#5b3fa0";
const INK = "#1f1d1a";
const PAPER = "#f3e7c6";
const PAPER_RULE = "#d8c597";
const PRINT = "#6d6250";

/* ── zoomed waveform with picks ─────────────────────────────────────────── */

export function EventTrace({ ev, si, reduce, mono }: { ev: Ev; si: number; reduce: boolean; mono: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  // An event during a telemetry gap cannot be shown on that channel; fall back to the summit.
  const st = STATIONS[si];
  const gapped = st.offlineFrom !== undefined && ev.arr[si].tp >= st.offlineFrom - 30;
  const use = gapped ? 0 : si;

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(wrapRef.current!);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const arr = ev.arr[use];
    const pre = ev.kind === "LP" ? 6 : 4;
    const len = ev.kind === "LP" ? 46 : 34;
    const a = arr.tp - pre;
    const evs = eventsAround(a, a + len);
    const n = len * FS_FINE;
    const v = new Float32Array(n);
    let peak = 0;
    for (let k = 0; k < n; k++) {
      v[k] = sample(use, a + k / FS_FINE, evs);
      peak = Math.max(peak, Math.abs(v[k]));
    }
    return { a, len, v, peak, arr };
  }, [ev, use]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !width) return;
    const H = 116;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = width * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const t0 = performance.now();
    const padB = 18;
    const mid = (H - padB) / 2 + 2;
    const amp = (H - padB) / 2 - 8;
    const { a, len, v, peak, arr } = data;
    const xOf = (t: number) => ((t - a) / len) * width;

    const draw = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, H);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, width, H - padB);

      // seconds
      ctx.strokeStyle = PAPER_RULE;
      ctx.fillStyle = PRINT;
      ctx.font = `400 9.5px ${mono}`;
      ctx.textBaseline = "alphabetic";
      for (let sec = Math.ceil(a); sec <= a + len; sec++) {
        const x = Math.round(xOf(sec)) + 0.5;
        const major = sec % 5 === 0;
        ctx.beginPath();
        ctx.moveTo(x, H - padB);
        ctx.lineTo(x, H - padB + (major ? 5 : 3));
        ctx.stroke();
        if (major && x > 14 && x < width - 30) {
          ctx.textAlign = "center";
          ctx.fillText(utc(sec).slice(3), x, H - 3);
        }
      }

      // trace
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * e, H - padB);
      ctx.clip();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const n = v.length;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * width;
        const y = mid - (v[i] / (peak * 1.05)) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // picks: drawn once the trace has reached them
      const picks: [string, number][] = ev.kind === "VT" ? [["P", arr.tp], ["S", arr.ts]] : [["eP", arr.tp]];
      picks.forEach(([name, t], i) => {
        const x = Math.round(xOf(t)) + 0.5;
        if (x > width * e) return;
        ctx.strokeStyle = VIOLET;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x, H - padB);
        ctx.stroke();
        const label = `${name} ${utc(t, 2).slice(3)}`;
        ctx.font = `500 10px ${mono}`;
        const w = ctx.measureText(label).width + 8;
        const y = 4 + i * 16;
        ctx.fillStyle = VIOLET;
        ctx.fillRect(x, y, w, 14);
        ctx.fillStyle = "#f4f0fb";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + 4, y + 7.5);
      });

      if (k < 1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, width, reduce, mono, ev.kind]);

  return (
    <figure className={s.trace}>
      <figcaption className={s.traceCap}>
        <span className={s.mono}>{STATIONS[use].code}</span>
        <span>{gapped ? `${STATIONS[si].sta} has no data for this event` : "50 Hz, auto-scaled"}</span>
      </figcaption>
      <div ref={wrapRef} className={s.traceBox}>
        <canvas
          ref={cvRef}
          className={s.traceCanvas}
          role="img"
          aria-label={`Waveform of event ${ev.id} at ${STATIONS[use].code} with ${ev.kind === "VT" ? "P and S" : "emergent P"} picks`}
        />
      </div>
    </figure>
  );
}

/* ── cross-section ──────────────────────────────────────────────────────── */

const XS = { w: 340, h: 186, l: 30, r: 8, t: 10, b: 22, xMin: -7, xMax: 7, eTop: 3, eBot: -9 };
const X = (x: number) => XS.l + ((x - XS.xMin) / (XS.xMax - XS.xMin)) * (XS.w - XS.l - XS.r);
const Y = (e: number) => XS.t + ((XS.eTop - e) / (XS.eTop - XS.eBot)) * (XS.h - XS.t - XS.b);
const rOf = (ml: number) => 1.6 + Math.max(0, ml) * 2.6;

export function CrossSection({
  events,
  selected,
  now,
  reduce,
  station,
}: {
  events: Ev[];
  selected: Ev;
  now: number;
  reduce: boolean;
  station: number;
}) {
  const profile = useMemo(() => {
    let d = `M ${X(XS.xMin)} ${Y(XS.eBot)}`;
    for (let x = XS.xMin; x <= XS.xMax + 1e-6; x += 0.1) d += ` L ${X(x).toFixed(1)} ${Y(elevation(x)).toFixed(1)}`;
    return `${d} L ${X(XS.xMax)} ${Y(XS.eBot)} Z`;
  }, []);
  const surface = useMemo(() => {
    let d = "";
    for (let x = XS.xMin; x <= XS.xMax + 1e-6; x += 0.1) d += `${d ? " L" : "M"} ${X(x).toFixed(1)} ${Y(elevation(x)).toFixed(1)}`;
    return d;
  }, []);

  const sx = X(selected.x);
  const sy = Y(-selected.depth);
  const surfY = Y(elevation(selected.x));
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <svg className={s.xsec} viewBox={`0 0 ${XS.w} ${XS.h}`} role="img" aria-label={`Cross-section west to east with ${events.length} hypocentres; selected event at ${fmtDepth(selected.depth)} km below sea level`}>
      <path d={profile} className={s.xsGround} />
      <path d={surface} className={s.xsSurface} />
      <line x1={XS.l} x2={XS.w - XS.r} y1={Y(0)} y2={Y(0)} className={s.xsSea} />

      {[2, 0, -2, -4, -6, -8].map((e) => (
        <g key={e}>
          <line x1={XS.l - 4} x2={XS.l} y1={Y(e)} y2={Y(e)} className={s.xsTick} />
          <text x={XS.l - 7} y={Y(e) + 3.5} className={s.xsLabel} textAnchor="end">
            {e > 0 ? `−${e}` : `${-e}`}
          </text>
        </g>
      ))}
      <text x={XS.l + 4} y={XS.h - XS.b - 6} className={s.xsUnit}>
        depth, km b.s.l.
      </text>
      {[-6, -4, -2, 0, 2, 4, 6].map((x) => (
        <g key={x}>
          <line x1={X(x)} x2={X(x)} y1={XS.h - XS.b} y2={XS.h - XS.b + 4} className={s.xsTick} />
          <text x={X(x)} y={XS.h - 6} className={s.xsLabel} textAnchor="middle">
            {x === 0 ? "vent" : x < 0 ? `${-x} W` : `${x} E`}
          </text>
        </g>
      ))}
      <line x1={XS.l} x2={XS.w - XS.r} y1={XS.h - XS.b} y2={XS.h - XS.b} className={s.xsTick} />

      {STATIONS.map((st, i) =>
        Math.abs(st.x) < 6.8 ? (
          <g key={st.sta} transform={`translate(${X(st.x)} ${Y(elevation(st.x)) - 2})`}>
            <path
              d="M -3.6 -6 L 3.6 -6 L 0 0 Z"
              className={st.offlineFrom !== undefined && now >= st.offlineFrom ? s.xsStaOff : i === station ? s.xsStaSel : s.xsSta}
            />
            {(i === station || i === 0) && (
              <text y={-9} textAnchor="middle" className={s.xsStaLabel}>
                {st.sta}
              </text>
            )}
          </g>
        ) : null,
      )}

      {events.map((e) => {
        if (e.id === selected.id) return null;
        const recent = now - e.t0 < 3600;
        const x = X(e.x);
        const y = Y(-e.depth);
        const r = rOf(e.ml);
        return e.kind === "VT" ? (
          <circle key={e.id} cx={x} cy={y} r={r} className={recent ? s.hypoRecent : s.hypo} />
        ) : (
          <rect
            key={e.id}
            x={x - r * 0.75}
            y={y - r * 0.75}
            width={r * 1.5}
            height={r * 1.5}
            transform={`rotate(45 ${x} ${y})`}
            className={recent ? s.hypoRecent : s.hypo}
          />
        );
      })}

      <g key={selected.id}>
        <motion.line
          x1={sx}
          x2={sx}
          y1={surfY}
          className={s.xsDrop}
          initial={reduce ? false : { y2: surfY }}
          animate={{ y2: sy }}
          transition={{ duration: 0.7, ease }}
        />
        {!reduce && (
          <motion.circle
            cx={sx}
            cy={sy}
            className={s.xsRipple}
            initial={{ r: rOf(selected.ml), opacity: 0.7 }}
            animate={{ r: rOf(selected.ml) + 22, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.6, ease: "easeOut" }}
          />
        )}
        <motion.circle
          cx={sx}
          r={rOf(selected.ml)}
          className={s.xsSel}
          initial={reduce ? false : { cy: surfY, scale: 0.3 }}
          animate={{ cy: sy, scale: 1 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 16, mass: 0.9 }}
        />
        <motion.text
          x={sx + rOf(selected.ml) + 5}
          y={sy + 3.5}
          className={s.xsSelLabel}
          textAnchor={selected.x > 4 ? "end" : "start"}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.3 }}
        >
          {fmtDepth(selected.depth)} km
        </motion.text>
      </g>
    </svg>
  );
}

/* ── hourly counts ──────────────────────────────────────────────────────── */

const HC = { w: 224, h: 128, l: 22, r: 4, t: 8, b: 18 };

export function HourlyChart({ events, from, now }: { events: Ev[]; from: number; now: number }) {
  const hours = useMemo(() => {
    const out: { t: number; vt: number; lp: number; partial: boolean }[] = [];
    for (let t = from; t <= now; t += 3600) out.push({ t, vt: 0, lp: 0, partial: t + 3600 > now });
    for (const e of events) {
      const i = Math.floor((e.t0 - from) / 3600);
      if (i < 0 || i >= out.length) continue;
      if (e.kind === "VT") out[i].vt++;
      else out[i].lp++;
    }
    return out;
  }, [events, from, now]);

  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, Math.ceil(Math.max(...hours.map((h) => h.vt + h.lp)) / 5) * 5);
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5);
  const iw = HC.w - HC.l - HC.r;
  const ih = HC.h - HC.t - HC.b;
  const bw = iw / hours.length;
  const yv = (v: number) => HC.t + ih - (v / max) * ih;
  const shown = hover ?? hours.length - 2;
  const h = hours[Math.max(0, shown)];

  return (
    <div className={s.counts}>
      <svg
        viewBox={`0 0 ${HC.w} ${HC.h}`}
        className={s.countsSvg}
        role="img"
        aria-label={`Events per hour from ${hhmm(from)} UTC: ${hours.map((x) => x.vt + x.lp).join(", ")}`}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={HC.l} x2={HC.w - HC.r} y1={yv(v)} y2={yv(v)} className={v === 0 ? s.countsBase : s.countsGrid} />
            <text x={HC.l - 5} y={yv(v) + 3} textAnchor="end" className={s.countsLabel}>
              {v}
            </text>
          </g>
        ))}
        {hours.map((b, i) => {
          const x = HC.l + i * bw + 1.5;
          const w = bw - 3;
          const yVt = yv(b.vt);
          const yLp = yv(b.vt + b.lp);
          const dim = hover !== null && hover !== i;
          return (
            <g key={b.t} opacity={dim ? 0.45 : 1} onPointerEnter={() => setHover(i)}>
              <rect x={HC.l + i * bw} y={HC.t} width={bw} height={ih} fill="transparent" />
              <rect x={x} y={yVt} width={w} height={HC.t + ih - yVt} className={b.partial ? s.barVtPartial : s.barVt} />
              {b.lp > 0 && <rect x={x} y={yLp} width={w} height={yVt - yLp} className={s.barLp} />}
              {(i % 2 === 0 || i === hours.length - 1) && (
                <text x={x + w / 2} y={HC.h - 5} textAnchor="middle" className={s.countsLabel}>
                  {hhmm(b.t).slice(0, 2)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className={s.countsRead} aria-live="polite">
        <span className={s.mono}>
          {hhmm(h.t)}–{h.partial ? "now" : hhmm(h.t + 3600)}
        </span>
        <span>
          <b>{h.vt}</b> VT
        </span>
        <span>
          <b>{h.lp}</b> LP
        </span>
        {h.partial && <span className={s.dim}>in progress</span>}
      </p>
    </div>
  );
}

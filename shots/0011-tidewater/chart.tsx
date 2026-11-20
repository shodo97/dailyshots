"use client";

/* The harbour chart. Three layers:
   1. a canvas that classifies every pixel of the depth field against the
      scrubbed tide (land, drying, shoal, margin, safe, deep) and traces the
      band edges as contours, so the chart floods and drains as you scrub;
   2. a canvas of wind particles drifting with the forecast at that hour;
   3. SVG for everything a chart prints: soundings, marks, light flares
      blinking in their real rhythms, the route, the bar callout. */

import { useEffect, useMemo, useRef } from "react";
import s from "./shot.module.css";
import {
  BANDS,
  BAR_CHARTED,
  BAR_XY,
  BASIN_D,
  BERTH,
  BERTH_XY,
  CHART_H,
  CHART_W,
  DRAUGHT,
  LAND,
  MARKS,
  M_PER_PX,
  NIGHT,
  OUT_COURSE,
  RED,
  ROUTE,
  SAFETY_DEPTH,
  SOUNDINGS,
  elevation,
  hhmm,
  lit,
  m2,
  soundingParts,
  tide,
  ukc,
  verdictFor,
  windAt,
  type ChartPalette,
  type Mark,
} from "./data";

type Mode = "night" | "red";

function rgba(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (255 << 24) | (b << 16) | (g << 8) | r; // little-endian ABGR
}

type Field = { w: number; h: number; bold: number; e: Float32Array; band: Uint8Array; img: ImageData };

function buildField(dpr: number, ctx: CanvasRenderingContext2D): Field {
  // sample the elevation once per CSS pixel, then upsample bilinearly so the
  // band edges land on device pixels and stay smooth
  const W = CHART_W + 1;
  const H = CHART_H + 1;
  const base = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) base[y * W + x] = elevation(x, y);

  const w = Math.round(CHART_W * dpr);
  const h = Math.round(CHART_H * dpr);
  const e = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) / dpr;
    const y0 = Math.min(H - 2, Math.floor(fy));
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / dpr;
      const x0 = Math.min(W - 2, Math.floor(fx));
      const tx = fx - x0;
      const i = y0 * W + x0;
      const a = base[i] + (base[i + 1] - base[i]) * tx;
      const b = base[i + W] + (base[i + W + 1] - base[i + W]) * tx;
      e[y * w + x] = a + (b - a) * ty;
    }
  }
  return { w, h, bold: Math.max(1, Math.round(dpr * 0.9)), e, band: new Uint8Array(w * h), img: ctx.createImageData(w, h) };
}

function paint(ctx: CanvasRenderingContext2D, f: Field, tideH: number, pal: ChartPalette) {
  const fill = BANDS.map((b) => rgba(pal[b]));
  const contour = rgba(pal.contour);
  const safety = rgba(pal.safety);
  const coast = rgba(pal.coast);
  const drycoast = rgba(pal.drycoast);
  const { w, h, e, band } = f;
  const px = new Uint32Array(f.img.data.buffer);
  const safe: number[] = [];

  for (let i = 0; i < w * h; i++) {
    const el = e[i];
    const d = tideH - el;
    const b = el > LAND ? 0 : d <= 0 ? 1 : d < DRAUGHT ? 2 : d < SAFETY_DEPTH ? 3 : d < 5 ? 4 : d < 10 ? 5 : 6;
    band[i] = b;
    px[i] = fill[b];
  }

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const b = band[i];
      const r = band[i + 1];
      const d = band[i + w];
      if (b === r && b === d) continue;
      const o = b !== r ? r : d;
      const lo = b < o ? b : o;
      const hi = b < o ? o : b;
      if (lo === 0) px[i] = coast;
      else if (lo === 1) px[i] = drycoast;
      else if (lo <= 3 && hi >= 4) safe.push(i);
      else px[i] = contour;
    }
  }

  // the safety contour (draught plus margin) is the boldest line on the
  // chart, as on a real ECDIS: dilate its edge into a ~2px stroke
  const r = f.bold;
  for (const i of safe) {
    const x0 = i % w;
    const y0 = (i - x0) / w;
    for (let dy = -r; dy <= r; dy++) {
      const yy = y0 + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x0 + dx;
        if (xx < 0 || xx >= w || dx * dx + dy * dy > r * r + r) continue;
        px[yy * w + xx] = safety;
      }
    }
  }
  ctx.putImageData(f.img, 0, 0);
}

/* ── particles ────────────────────────────────────────────────────────────── */

type P = { x: number; y: number; age: number; life: number };

const spawn = (p: P) => {
  p.x = Math.random() * CHART_W;
  p.y = Math.random() * CHART_H;
  p.age = 0;
  p.life = 70 + Math.random() * 90;
};

/* ── the component ───────────────────────────────────────────────────────── */

export function Chart({ t, mode, reduced }: { t: number; mode: Mode; reduced: boolean }) {
  const depthRef = useRef<HTMLCanvasElement>(null);
  const windRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<Field | null>(null);
  const lightRefs = useRef<Record<string, SVGGElement | null>>({});
  const tRef = useRef(t);
  const modeRef = useRef(mode);

  const h = tide(t);
  const c = ukc(t);
  const v = verdictFor(c);

  // depth field: build once, repaint whenever the tide or the palette changes
  useEffect(() => {
    const cv = depthRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (!fieldRef.current) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(CHART_W * dpr);
      cv.height = Math.round(CHART_H * dpr);
      fieldRef.current = buildField(dpr, ctx);
    }
    paint(ctx, fieldRef.current, tide(t), mode === "red" ? RED : NIGHT);
  }, [t, mode]);

  useEffect(() => {
    tRef.current = t;
    modeRef.current = mode;
  }, [t, mode]);

  // wind particles and navigation lights share one frame loop
  useEffect(() => {
    const cv = windRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(CHART_W * dpr);
    cv.height = Math.round(CHART_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const parts: P[] = Array.from({ length: 110 }, () => {
      const p = { x: 0, y: 0, age: 0, life: 0 };
      spawn(p);
      p.age = Math.random() * p.life;
      return p;
    });

    const setLights = (sec: number) => {
      for (const m of MARKS) {
        const g = lightRefs.current[m.id];
        if (!g) continue;
        g.dataset.on = reduced ? "1" : String(lit(m.ch, sec + m.phase));
      }
    };

    if (reduced) {
      setLights(0);
      return;
    }

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const sec = (now - t0) / 1000;
      setLights(sec);

      const wnd = windAt(tRef.current);
      const to = ((wnd.dir + 180) * Math.PI) / 180;
      const sp = wnd.kt * 0.085;
      const vx = Math.sin(to) * sp;
      const vy = -Math.cos(to) * sp;
      const pal = modeRef.current === "red" ? RED : NIGHT;

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, 0, CHART_W, CHART_H);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      for (const p of parts) {
        const nx = p.x + vx;
        const ny = p.y + vy;
        const k = Math.sin((p.age / p.life) * Math.PI);
        ctx.strokeStyle = `rgba(${pal.particle},${(0.5 * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx;
        p.y = ny;
        p.age++;
        if (p.age > p.life || nx < -4 || ny < -4 || nx > CHART_W + 4 || ny > CHART_H + 4) spawn(p);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // reduced motion: a still field of short streaks, redrawn when the hour changes
  const hourKey = Math.round(t);
  useEffect(() => {
    if (!reduced) return;
    const cv = windRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const wnd = windAt(hourKey);
    const to = ((wnd.dir + 180) * Math.PI) / 180;
    const pal = mode === "red" ? RED : NIGHT;
    ctx.clearRect(0, 0, CHART_W, CHART_H);
    ctx.strokeStyle = `rgba(${pal.particle},0.28)`;
    ctx.lineWidth = 1;
    for (let y = 12; y < CHART_H; y += 26) {
      for (let x = (y / 26) % 2 ? 4 : 17; x < CHART_W; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(to) * wnd.kt * 0.55, y - Math.cos(to) * wnd.kt * 0.55);
        ctx.stroke();
      }
    }
  }, [reduced, hourKey, mode]);

  const routeD = useMemo(() => ROUTE.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(""), []);
  const scalePx = (0.25 * 1852) / M_PER_PX;

  return (
    <figure className={s.chart} aria-label={`Chart of Port Ardlin with depths for ${hhmm(t)}`}>
      <canvas ref={depthRef} className={s.chartCanvas} aria-hidden />
      <canvas ref={windRef} className={s.chartCanvas} aria-hidden />
      <svg className={s.chartSvg} viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden>
        <defs>
          {(["r", "g", "w"] as const).map((k) => (
            <radialGradient key={k} id={`tw-glow-${k}`}>
              <stop offset="0" className={s[`stop_${k}`]} stopOpacity="0.75" />
              <stop offset="1" className={s[`stop_${k}`]} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* harbour works: the mole and the pontoons */}
        <path className={s.works} d={`M${BASIN_D.x1 + 14} ${BASIN_D.y0 - 3}H270`} strokeWidth={3} />
        <path
          className={s.pontoon}
          d={`M252 233H330M262 233V215M280 233V215M298 233V215M316 233V215`}
          strokeWidth={1.4}
        />

        {/* soundings: charted values, brightened where today's water is too shallow */}
        {SOUNDINGS.map((sd) => {
          const p = soundingParts(sd.e);
          const shallow = h - sd.e < SAFETY_DEPTH;
          return (
            <text
              key={`${sd.x}-${sd.y}`}
              x={sd.x}
              y={sd.y}
              className={`${s.sounding} ${shallow ? s.soundingShallow : ""}`}
              textAnchor="middle"
              textDecoration={p.dries ? "underline" : undefined}
            >
              {p.whole}
              {p.dec && (
                <tspan className={s.soundingDec} dy={2}>
                  {p.dec}
                </tspan>
              )}
            </text>
          );
        })}

        {/* names: land upright, water italic, as charts set them */}
        <text x={12} y={116} className={s.landName}>Ardlin Head</text>
        <text x={382} y={148} className={s.landName} textAnchor="end">Kelp Point</text>
        <text x={196} y={256} className={s.landName} textAnchor="middle" letterSpacing="0.14em">PORT ARDLIN</text>
        <text x={92} y={192} className={s.waterName} textAnchor="middle">Ardlin Sands</text>
        <text x={128} y={92} className={s.waterName} textAnchor="middle">Carrick Rk</text>

        {/* planned route */}
        <path d={routeD} className={s.route} />
        {ROUTE.slice(1, -1).map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={2.2} className={s.waypoint} />
        ))}
        <text x={212} y={28} className={s.routeLabel}>
          {String(OUT_COURSE).padStart(3, "0")}°T
        </text>

        {/* marks and their lights */}
        {MARKS.map((m) => (
          <MarkGlyph key={m.id} m={m} refFn={(el) => {
            lightRefs.current[m.id] = el;
          }} />
        ))}

        {/* own vessel alongside */}
        <g transform={`translate(${BERTH_XY[0]} ${BERTH_XY[1]})`} className={s.ownship}>
          <path d="M0 -8.5C3.4 -4.8 3.4 3.4 2.6 7.5H-2.6C-3.4 3.4 -3.4 -4.8 0 -8.5Z" />
          <text x={8} y={12} className={s.ownLabel}>{BERTH}</text>
        </g>

        {/* the bar, with today's water over it */}
        <g className={s.barCallout} data-v={v}>
          <circle cx={BAR_XY[0]} cy={BAR_XY[1]} r={5.5} className={s.barRing} />
          <path d={`M${BAR_XY[0] + 6} ${BAR_XY[1]}H250`} className={s.barLeader} />
          <rect x={250} y={BAR_XY[1] - 20} width={130} height={40} rx={4} className={s.barBox} />
          <text x={258} y={BAR_XY[1] - 5} className={s.barTitle}>
            Ardlin Bar <tspan className={s.barDim}>charted {BAR_CHARTED.toFixed(1)}</tspan>
          </text>
          <text x={258} y={BAR_XY[1] + 11} className={s.barFig}>
            {m2(BAR_CHARTED + h)}
            <tspan className={s.barDim}> m  keel </tspan>
            <tspan className={s.barUkc}>
              {c >= 0 ? "+" : "−"}
              {m2(Math.abs(c))}
            </tspan>
          </text>
        </g>

        {/* north and scale */}
        <g transform="translate(26 206)" className={s.chartFurniture}>
          <path d="M0 -12L4 4L0 1L-4 4Z" />
          <text x={0} y={16} textAnchor="middle">N</text>
        </g>
        <g transform="translate(14 240)" className={s.chartFurniture}>
          <path d={`M0 0V4H${scalePx}V0M${scalePx / 2} 2V4`} fill="none" />
          <text x={scalePx + 6} y={5}>0.25 nm</text>
        </g>
      </svg>
      <div className={s.chartStamp} aria-hidden>
        <span>Depths at</span> <b className={s.num}>{hhmm(t)}</b>
        <span className={s.num}> +{m2(h)} m</span>
      </div>
    </figure>
  );
}

function MarkGlyph({ m, refFn }: { m: Mark; refFn: (el: SVGGElement | null) => void }) {
  const k = m.colour.toLowerCase() as "r" | "g" | "w";
  const lx = m.side === "l" ? -9 : 9;
  return (
    <g transform={`translate(${m.x} ${m.y})`}>
      <g ref={refFn} className={s.light} data-c={k} data-on="1">
        <circle r={13} fill={`url(#tw-glow-${k})`} className={s.halo} />
        <path
          d="M0 0C-2.6 -4 -3.4 -9 0 -14C3.4 -9 2.6 -4 0 0Z"
          transform={`rotate(${m.side === "l" ? -135 : 135})`}
          className={s.flare}
        />
      </g>
      {m.kind === "stbd" && <path d="M0 -6.5L4.2 1H-4.2Z" className={s.buoyG} />}
      {m.kind === "port" && <rect x={-3.6} y={-5.5} width={7.2} height={6.5} className={s.buoyR} />}
      {m.kind === "north" && (
        <g className={s.buoyN}>
          <path d="M0 4V-3" />
          <path d="M0 -12L3 -7.5H-3ZM0 -7.5L3 -3H-3Z" />
        </g>
      )}
      {m.kind === "pier" && <circle r={2.2} className={s.pierLight} />}
      <circle r={1.3} className={s.buoyBase} />
      <text
        x={m.kind === "north" ? 0 : lx}
        y={m.kind === "north" ? 12 : 3}
        textAnchor={m.kind === "north" ? "middle" : m.side === "l" ? "end" : "start"}
        className={s.lightLabel}
      >
        {m.ch}
      </text>
    </g>
  );
}

"use client";

/* Channel meters with PPM-style ballistics: fast attack, slow fall, a peak
   hold. Levels come from deterministic signal shapes (music, speech) keyed to
   what the schedule says each channel is carrying. PFL lights the channel in
   cue yellow and, as on a real desk, never reaches programme. */

import { memo, useEffect, useRef } from "react";
import s from "./shot.module.css";
import { noise } from "./data";
import { Icon } from "./icons";
import type { ClockStore } from "./clock";

export type Channel = "mic1" | "mic2" | "plrA" | "plrB" | "cart";

export type Feeds = {
  mic1: boolean;
  mic2: boolean;
  plrA: "air" | "cue" | "idle";
  plrB: "air" | "cue" | "idle";
  cart: boolean;
  /** What each player has loaded, for the strip labels. */
  loadA: string;
  loadB: string;
};

const STRIPS: { id: Channel; label: string }[] = [
  { id: "mic1", label: "Mic 1" },
  { id: "mic2", label: "Mic 2" },
  { id: "plrA", label: "Plr A" },
  { id: "plrB", label: "Plr B" },
  { id: "cart", label: "Cart" },
];

const SEGS = 28;
const SCALE = [0, -6, -12, -20, -30, -40];
/** Level 0..1 maps −48 dBFS..0. */
const frac = (db: number) => (db + 48) / 48;

function music(t: number, seed: number) {
  const beat = (t * 118) / 60 + seed;
  const kick = Math.exp(-(beat % 1) * 7) * 0.08;
  return 0.74 + kick + (noise(t * 7 + seed * 13) - 0.5) * 0.1 + Math.sin(t * 0.7 + seed) * 0.03;
}
function speech(t: number, seed: number) {
  const syll = noise(t * 5.2 + seed * 7);
  const phrase = noise(t * 0.6 + seed);
  if (phrase < 0.28) return 0.08 + noise(t * 30) * 0.04;
  return 0.42 + syll * 0.34 + (noise(t * 23 + seed) - 0.5) * 0.08;
}

type Props = {
  store: ClockStore;
  feeds: Feeds;
  pfl: Record<Channel, boolean>;
  onPfl: (c: Channel) => void;
  reduced: boolean;
};

export const Meters = memo(function Meters({ store, feeds, pfl, onPfl, reduced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ feeds, pfl });

  useEffect(() => {
    live.current = { feeds, pfl };
  }, [feeds, pfl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cs = getComputedStyle(canvas);
    const col = {
      off: cs.getPropertyValue("--m-off").trim(),
      on: cs.getPropertyValue("--m-on").trim(),
      hot: cs.getPropertyValue("--m-hot").trim(),
      cue: cs.getPropertyValue("--cue").trim(),
      text: cs.getPropertyValue("--ink-3").trim(),
      font: cs.fontFamily,
    };

    let w = 0;
    let h = 0;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    let redraw = () => {};
    const ro = new ResizeObserver(() => {
      fit();
      redraw();
    });
    ro.observe(canvas);

    // 7 bars: five strips, then programme L and R.
    const shown = new Array(7).fill(0);
    const peak = new Array(7).fill(0);
    const held = new Array(7).fill(0);

    const levels = (t: number) => {
      const { feeds: f } = live.current;
      const a = f.plrA === "idle" ? 0.02 : music(t, 1) * (f.plrA === "cue" ? 0.93 : 1);
      const b = f.plrB === "idle" ? 0.02 : music(t + 41, 2) * (f.plrB === "cue" ? 0.93 : 1);
      const m1 = f.mic1 ? speech(t, 1) : 0.05 + noise(t * 40) * 0.03;
      const m2 = f.mic2 ? speech(t + 9, 3) : 0.04 + noise(t * 40 + 5) * 0.03;
      const c = f.cart ? music(t * 1.3, 4) * 0.97 : 0.02;
      // Programme only carries what is on air: a cued player is pre-fade only.
      const onA = f.plrA === "air" ? a : 0;
      const onB = f.plrB === "air" ? b : 0;
      const bus = Math.max(onA, onB, f.mic1 ? m1 * 0.98 : 0, f.mic2 ? m2 * 0.98 : 0, f.cart ? c : 0);
      const L = Math.min(0.97, bus + (noise(t * 11) - 0.5) * 0.04);
      const R = Math.min(0.97, bus + (noise(t * 11 + 77) - 0.5) * 0.04);
      return [m1, m2, a, b, c, L, R];
    };

    const left = 26;
    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      const { pfl: p } = live.current;
      const lv = levels(t);
      const top = 8;
      const bottom = h - 2;
      const H = bottom - top;
      const segH = H / SEGS;

      // scale
      ctx.font = `500 10px ${col.font}`;
      ctx.fillStyle = col.text;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const db of SCALE) ctx.fillText(String(db), left - 6, bottom - frac(db) * H);

      const cw = (w - left) / 7;
      for (let i = 0; i < 7; i++) {
        const target = Math.max(0, Math.min(1, lv[i]));
        shown[i] = target > shown[i] ? target : Math.max(target, shown[i] - dt * 0.9);
        if (shown[i] >= peak[i]) {
          peak[i] = shown[i];
          held[i] = 1.4;
        } else if ((held[i] -= dt) < 0) peak[i] = Math.max(0, peak[i] - dt * 0.35);

        const stereoGap = i >= 5 ? (i === 5 ? 3 : -3) : 0;
        const bw = Math.min(16, cw * 0.42);
        const x = left + i * cw + (cw - bw) / 2 + stereoGap;
        const cue = i < 5 && p[STRIPS[i].id];
        const lit = Math.round(shown[i] * SEGS);
        const pk = Math.min(SEGS - 1, Math.round(peak[i] * SEGS) - 1);
        for (let k = 0; k < SEGS; k++) {
          const y = bottom - (k + 1) * segH;
          const hot = k >= SEGS - 4;
          ctx.fillStyle = k < lit || k === pk ? (cue ? col.cue : hot ? col.hot : col.on) : col.off;
          ctx.fillRect(x, y + 1, bw, segH - 2);
        }
      }
    };

    if (reduced) {
      // Settled frame: a representative level, no ballistics.
      for (let i = 0; i < 7; i++) shown[i] = peak[i] = 0;
      const lv = levels(1300);
      for (let i = 0; i < 7; i++) shown[i] = peak[i] = lv[i];
      redraw = () => draw(1300, 0);
      redraw();
      return () => ro.disconnect();
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(store.get(), dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [store, reduced]);

  return (
    <section className={s.meters} aria-label="Channel meters">
      <header className={s.bayHead}>
        <h2 className={s.panelTitle}>Meters</h2>
        <span className={s.bayNote}>PFL is off-air</span>
      </header>
      <canvas ref={canvasRef} className={s.meterCanvas} aria-hidden />
      <div className={s.strips}>
        <span />
        {STRIPS.map((st) => {
          const sub =
            st.id === "plrA" ? feeds.loadA : st.id === "plrB" ? feeds.loadB : st.id === "mic1" ? "Ines" : st.id === "mic2" ? "Guest" : "Wall";
          const isLive =
            st.id === "plrA" ? feeds.plrA === "air" : st.id === "plrB" ? feeds.plrB === "air" : feeds[st.id];
          return (
            <div key={st.id} className={s.strip}>
              <span className={s.stripName} data-live={isLive || undefined}>
                {st.label}
              </span>
              <span className={s.stripSub}>{sub}</span>
              <button
                type="button"
                className={s.pfl}
                aria-pressed={pfl[st.id]}
                onClick={() => onPfl(st.id)}
                aria-label={`Pre-fade listen, ${st.label}`}
              >
                <Icon name="phones" className={s.icon} />
                PFL
              </button>
            </div>
          );
        })}
        <div className={s.strip} data-pgm>
          <span className={s.stripName} data-live>
            PGM
          </span>
          <span className={s.stripSub}>L · R</span>
        </div>
      </div>
    </section>
  );
});

"use client";

import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import s from "./shot.module.css";

// This shot's own type. Deliberately nothing to do with the shell's.
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet" });

const LOG = [
  { name: "Cassini division", note: "Ring shadow", date: "11.02.61" },
  { name: "Messier eighty-one", note: "Spiral, faint", date: "28.03.61" },
  { name: "Barnard's loop", note: "Hydrogen alpha", date: "04.07.61" },
  { name: "Lagoon nebula", note: "Long exposure", date: "19.09.61" },
  { name: "Omega Centauri", note: "Core resolved", date: "02.12.61" },
];

export default function FirstLight() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Write the lamp position straight to CSS custom properties on the next
  // frame — re-rendering React on every pointer move would be wasteful.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;

    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight * 0.4;

    const paint = () => {
      frame = 0;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { y: "105%" },
          animate: { y: "0%" },
          transition: { duration: 1.15, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  const fade = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div
      ref={root}
      className={`${s.root} ${display.variable} ${sans.variable} ${mono.variable}`}
      style={
        {
          "--shot-display": "var(--font-fraunces)",
          "--shot-sans": "var(--font-inter)",
          "--shot-mono": "var(--font-jet)",
        } as React.CSSProperties
      }
    >
      <div className={s.grid} aria-hidden />
      <div className={s.lamp} aria-hidden />
      <div className={s.grain} aria-hidden />

      <motion.header className={s.meta} {...fade(0.9)}>
        <span>Mount Rakau Observatory</span>
        <span>Plate archive · 1961</span>
        <span>52° 12&apos; N</span>
      </motion.header>

      <section className={s.hero}>
        <motion.div
          className={s.plate}
          aria-hidden
          initial={reduced ? undefined : { opacity: 0, scale: 0.94 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 2.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={s.plateRings} />
          <div className={s.plateTicks} />
          <div className={s.plateCore} />
        </motion.div>
        <motion.p className={s.kicker} {...fade(1.05)}>
          Survey one
        </motion.p>

        <h1 className={s.title}>
          <span className={s.line}>
            <motion.span className={s.lineInner} {...rise(0.1)}>
              First
            </motion.span>
          </span>
          <span className={s.line}>
            <motion.span className={`${s.lineInner} ${s.indent}`} {...rise(0.24)}>
              light
            </motion.span>
          </span>
        </h1>

        <motion.p className={s.lede} {...fade(1.2)}>
          Four hundred glass plates, exposed over a single winter and then left
          in a drawer for sixty years. Move the lamp across them.
        </motion.p>

        <motion.p className={s.scrollHint} {...fade(1.5)}>
          Scroll ↓
        </motion.p>
      </section>

      <section className={s.log}>
        <div className={s.logHead}>
          <span>The plates</span>
          <span>Five of four hundred</span>
        </div>

        {LOG.map((entry, i) => (
          <motion.div
            key={entry.name}
            className={s.row}
            initial={reduced ? undefined : { opacity: 0, y: 26 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-12%" }}
            transition={{ duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={s.rowIndex}>{String(i + 1).padStart(3, "0")}</span>
            <span className={s.rowName}>{entry.name}</span>
            <span className={s.rowNote}>{entry.note}</span>
            <span className={s.rowDate}>{entry.date}</span>
          </motion.div>
        ))}
      </section>
    </div>
  );
}

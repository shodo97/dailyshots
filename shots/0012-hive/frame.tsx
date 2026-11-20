"use client";

/* 0012 — Hive: one frame held up to the light.
   The card is a canvas: pine frame plus comb face. The comb paints, the wood
   is the handle. Grabbing any bar drags the card sideways like lifting a frame
   out of the box; release past the threshold and the next one comes up. */

import { motion, useDragControls, useIsPresent, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  CARD_H,
  CARD_W,
  COMB_H,
  COMB_W,
  COMB_X,
  COMB_Y,
  drawWood,
  renderComb,
  surface,
} from "./comb";
import { GH, GW, writeCell, type Cat } from "./data";
import s from "./shot.module.css";

/** Brush radius in cells: about a gloved thumb's contact patch. */
const BRUSH = 2.8;
const CELL_PX = COMB_W / GW;

export type Painter = {
  /** Card-local CSS px. `start` begins a new stroke. */
  paintAt: (x: number, y: number, cat: Cat, start: boolean) => void;
};

const variants = {
  enter: (d: number) =>
    d > 0 ? { x: 0, y: 9, scale: 0.955, zIndex: 1, opacity: 1 } : { x: -440, y: 0, scale: 1, zIndex: 3, opacity: 1 },
  center: { x: 0, y: 0, scale: 1, zIndex: 2, opacity: 1 },
  exit: (d: number) =>
    d > 0 ? { x: -460, y: 0, scale: 1, zIndex: 3, opacity: 1 } : { x: 0, y: 9, scale: 0.955, zIndex: 1, opacity: 0 },
};

export function FrameCard({
  index,
  dir,
  grid,
  version,
  cat,
  reduce,
  canPrev,
  canNext,
  onStroke,
  onChanged,
  onSwipe,
  register,
}: {
  index: number;
  dir: number;
  grid: Uint8Array;
  version: number;
  cat: Cat;
  reduce: boolean;
  canPrev: boolean;
  canNext: boolean;
  onStroke: (index: number) => void;
  onChanged: (index: number) => void;
  onSwipe: (delta: 1 | -1) => void;
  register: (index: number, p: Painter | null) => void;
}) {
  const present = useIsPresent();
  const controls = useDragControls();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-9, 0, 9]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const engine = useRef<{
    g: CanvasRenderingContext2D;
    img: ImageData;
    dpr: number;
    dirty: { x0: number; y0: number; x1: number; y1: number } | null;
    raf: number;
    last: { x: number; y: number } | null;
  } | null>(null);
  const catRef = useRef(cat);
  const [painting, setPainting] = useState(false);

  useEffect(() => {
    catRef.current = cat;
  }, [cat]);

  // Mount: size the canvas, draw the wood, resolve the whole face.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    cv.width = CARD_W * dpr;
    cv.height = CARD_H * dpr;
    const g = cv.getContext("2d")!;
    drawWood(g, dpr, 90 + index * 7);
    const S = surface(dpr);
    const img = g.createImageData(S.w, S.h);
    renderComb(img, grid, S);
    g.putImageData(img, COMB_X * dpr, COMB_Y * dpr);
    engine.current = { g, img, dpr, dirty: null, raf: 0, last: null };
    return () => {
      if (engine.current) cancelAnimationFrame(engine.current.raf);
      engine.current = null;
    };
  }, [grid, index]);

  // Undo replaced the grid underneath us: resolve the whole face again.
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    const e = engine.current;
    if (!e) return;
    const S = surface(e.dpr);
    renderComb(e.img, grid, S);
    e.g.putImageData(e.img, COMB_X * e.dpr, COMB_Y * e.dpr);
  }, [version, grid]);

  const flush = () => {
    const e = engine.current;
    if (!e || !e.dirty) return;
    const S = surface(e.dpr);
    const r = renderComb(e.img, grid, S, e.dirty);
    e.g.putImageData(e.img, COMB_X * e.dpr, COMB_Y * e.dpr, r.x, r.y, r.w, r.h);
    e.dirty = null;
    e.raf = 0;
  };

  const stamp = (cx: number, cy: number, c: Cat) => {
    const e = engine.current!;
    let changed = false;
    const x0 = Math.max(0, Math.floor(cx - BRUSH));
    const x1 = Math.min(GW - 1, Math.ceil(cx + BRUSH));
    const y0 = Math.max(0, Math.floor(cy - BRUSH));
    const y1 = Math.min(GH - 1, Math.ceil(cy + BRUSH));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > BRUSH * BRUSH) continue;
        const i = y * GW + x;
        if (writeCell(grid, i, c)) changed = true;
      }
    }
    if (changed) {
      const d = e.dirty;
      e.dirty = d
        ? { x0: Math.min(d.x0, x0), y0: Math.min(d.y0, y0), x1: Math.max(d.x1, x1), y1: Math.max(d.y1, y1) }
        : { x0, y0, x1, y1 };
    }
    return changed;
  };

  const paintAt = (lx: number, ly: number, c: Cat, start: boolean) => {
    const e = engine.current;
    if (!e) return;
    const cx = ((lx - COMB_X) / COMB_W) * GW;
    const cy = ((ly - COMB_Y) / COMB_H) * GH;
    if (start) {
      e.last = null;
      onStroke(index);
    }
    let changed = false;
    const from = e.last ?? { x: cx, y: cy };
    const dist = Math.hypot(cx - from.x, cy - from.y);
    const steps = Math.max(1, Math.ceil(dist / 0.5));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      if (stamp(from.x + (cx - from.x) * t, from.y + (cy - from.y) * t, c)) changed = true;
    }
    e.last = { x: cx, y: cy };
    if (changed) {
      onChanged(index);
      if (!e.raf) e.raf = requestAnimationFrame(flush);
    }
  };

  const paintRef = useRef(paintAt);
  useEffect(() => {
    paintRef.current = paintAt;
  });

  useEffect(() => {
    if (!present) return;
    register(index, { paintAt: (x, y, c, st) => paintRef.current(x, y, c, st) });
    return () => register(index, null);
  }, [present, index, register]);

  const local = (ev: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * CARD_W,
      y: ((ev.clientY - r.top) / r.height) * CARD_H,
    };
  };
  const inComb = (p: { x: number; y: number }) =>
    p.x >= COMB_X && p.x <= COMB_X + COMB_W && p.y >= COMB_Y && p.y <= COMB_Y + COMB_H;

  const moveRing = (p: { x: number; y: number }, show: boolean) => {
    const ring = ringRef.current;
    if (!ring) return;
    ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
    ring.dataset.show = show ? "1" : "0";
    if (canvasRef.current) canvasRef.current.style.cursor = inComb(p) ? "none" : "grab";
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!present || ev.button > 0) return;
    const p = local(ev);
    if (!inComb(p)) {
      moveRing(p, false);
      controls.start(ev);
      return;
    }
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setPainting(true);
    paintAt(p.x, p.y, catRef.current, true);
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(ev);
    moveRing(p, inComb(p) && ev.pointerType === "mouse");
    if (painting) paintAt(p.x, p.y, catRef.current, false);
  };
  const endStroke = () => setPainting(false);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if ((info.offset.x < -70 || info.velocity.x < -480) && canNext) onSwipe(1);
    else if ((info.offset.x > 70 || info.velocity.x > 480) && canPrev) onSwipe(-1);
  };

  return (
    <motion.div
      className={s.card}
      custom={dir}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
      style={{ x, rotate, pointerEvents: present ? "auto" : "none" }}
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: canNext ? 0.9 : 0.12, right: canPrev ? 0.9 : 0.12 }}
      dragTransition={{ bounceStiffness: 420, bounceDamping: 30 }}
      onDragEnd={onDragEnd}
      data-painting={painting ? "1" : "0"}
    >
      <canvas
        ref={canvasRef}
        className={s.canvas}
        style={{ width: CARD_W, height: CARD_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={(ev) => moveRing(local(ev), false)}
        aria-hidden
      />
      <span className={s.combShade} aria-hidden />
      <span className={s.grip} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className={s.topMark} aria-hidden>
        {index + 1}
      </span>
      <div ref={ringRef} className={s.brushRing} data-show="0" style={{ width: BRUSH * 2 * CELL_PX, height: BRUSH * 2 * CELL_PX }} aria-hidden />
    </motion.div>
  );
}

/* 0012 — Hive: the comb surface.
   No hexagons. The face is a coverage grid of GW × GH cells, and the picture
   is that grid resolved into soft painted regions: every device pixel samples
   the four nearest cells through a small noise warp, picks the dominant
   category, blends across the boundary, and reads its colour from a
   procedural texture for that category (cappings, larvae, glints, pollen). */

import { CAT_RGB, GH, GW, mulberry32, valueNoise, type Cat } from "./data";

/* Card geometry, CSS px. A deep frame: top bar with lugs, side bars, bottom bar. */
export const CARD_W = 350;
export const TOP = 20;
export const BOTTOM = 10;
export const LUG = 14;
export const SIDE = 10;
export const COMB_X = LUG + SIDE;
export const COMB_Y = TOP;
export const COMB_W = CARD_W - 2 * COMB_X;
export const COMB_H = 140;
export const CARD_H = TOP + COMB_H + BOTTOM;

type Surface = {
  w: number;
  h: number;
  warpX: Float32Array;
  warpY: Float32Array;
  tex: Uint8ClampedArray[];
};

const cache = new Map<number, Surface>();

/** Textures and warp field for one pixel ratio, built once and shared by every card. */
export function surface(dpr: number): Surface {
  const hit = cache.get(dpr);
  if (hit) return hit;
  const w = Math.round(COMB_W * dpr);
  const h = Math.round(COMB_H * dpr);

  const nx = valueNoise(41, 14, 8);
  const ny = valueNoise(77, 14, 8);
  const fx = valueNoise(5, 40, 22);
  const fy = valueNoise(9, 40, 22);
  const warpX = new Float32Array(w * h);
  const warpY = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const i = y * w + x;
      warpX[i] = nx(u, v) * 0.55 + fx(u, v) * 0.22;
      warpY[i] = ny(u, v) * 0.55 + fy(u, v) * 0.22;
    }
  }

  const tex = ([0, 1, 2, 3, 4] as Cat[]).map((c) => texture(c, w, h, dpr));
  const s = { w, h, warpX, warpY, tex };
  cache.set(dpr, s);
  return s;
}

const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${r},${g},${b},${a})`;

function texture(cat: Cat, w: number, h: number, dpr: number): Uint8ClampedArray {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d")!;
  const rnd = mulberry32(300 + cat * 13);
  const [r0, g0, b0] = CAT_RGB[cat];
  g.fillStyle = rgb(r0, g0, b0);
  g.fillRect(0, 0, w, h);

  // Broad mottling so a region never reads as a flat swatch.
  const low = valueNoise(600 + cat, 8, 5);
  const step = Math.max(2, Math.round(3 * dpr));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const n = low(x / w, y / h);
      g.fillStyle = n > 0 ? rgb(255, 250, 230, n * 0.09) : rgb(40, 24, 8, -n * 0.12);
      g.fillRect(x, y, step, step);
    }
  }

  const dot = (x: number, y: number, rad: number, fill: string) => {
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  const area = (w * h) / (dpr * dpr);

  if (cat === 0) {
    // Old comb: dark wax with lighter cell rims catching the light.
    for (let i = 0; i < area / 22; i++) {
      dot(rnd() * w, rnd() * h, (0.6 + rnd() * 0.9) * dpr, rgb(120, 100, 70, 0.35 + rnd() * 0.3));
    }
    for (let i = 0; i < area / 60; i++) dot(rnd() * w, rnd() * h, 1.6 * dpr, rgb(20, 14, 8, 0.45));
  } else if (cat === 1) {
    // Cappings: domed, slightly irregular, each with a darker rim.
    for (let i = 0; i < area / 16; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rad = (2.1 + rnd() * 0.8) * dpr;
      dot(x, y, rad, rgb(132, 86, 40, 0.5));
      dot(x - 0.4 * dpr, y - 0.5 * dpr, rad * 0.62, rgb(205, 156, 96, 0.55 + rnd() * 0.3));
    }
  } else if (cat === 2) {
    // Open brood: pearly larvae curled in cells, and the odd standing egg.
    for (let i = 0; i < area / 26; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      g.beginPath();
      g.arc(x, y, (1.6 + rnd() * 0.9) * dpr, rnd() * 6.28, rnd() * 6.28 + 3.6);
      g.strokeStyle = rgb(255, 251, 238, 0.8);
      g.lineWidth = 1.2 * dpr;
      g.stroke();
      if (rnd() < 0.35) dot(x + 3 * dpr, y + 2 * dpr, 0.6 * dpr, rgb(196, 176, 130, 0.9));
    }
    for (let i = 0; i < area / 30; i++) dot(rnd() * w, rnd() * h, 0.9 * dpr, rgb(214, 196, 150, 0.55));
  } else if (cat === 3) {
    // Honey: deep amber pools and specular glints off the wet cells.
    const deep = valueNoise(812, 18, 10);
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n = deep(x / w, y / h);
        if (n < -0.15) {
          g.fillStyle = rgb(196, 110, 6, Math.min(0.45, -n * 0.6));
          g.fillRect(x, y, step, step);
        }
      }
    }
    for (let i = 0; i < area / 34; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      g.beginPath();
      g.ellipse(x, y, (1.4 + rnd()) * dpr, 0.7 * dpr, -0.6, 0, Math.PI * 2);
      g.fillStyle = rgb(255, 246, 214, 0.55 + rnd() * 0.4);
      g.fill();
    }
  } else {
    // Pollen: packed cells, each a different forage source.
    const hues: [number, number, number][] = [
      [226, 84, 28],
      [240, 134, 22],
      [192, 62, 24],
      [232, 168, 30],
      [214, 104, 30],
      [168, 72, 34],
    ];
    for (let i = 0; i < area / 9; i++) {
      const [r, gg, b] = hues[Math.floor(rnd() * hues.length)];
      dot(rnd() * w, rnd() * h, (2 + rnd() * 1.2) * dpr, rgb(r, gg, b, 0.9));
    }
    for (let i = 0; i < area / 40; i++) dot(rnd() * w, rnd() * h, 0.8 * dpr, rgb(255, 214, 140, 0.6));
  }

  return g.getImageData(0, 0, w, h).data;
}

/**
 * Resolve the grid into pixels. `cells` limits the work to a dirty rectangle
 * of cells; the result is written into `img` (comb-sized ImageData).
 */
export function renderComb(
  img: ImageData,
  grid: Uint8Array,
  S: Surface,
  cells?: { x0: number; y0: number; x1: number; y1: number },
) {
  const { w, h, warpX, warpY, tex } = S;
  const out = img.data;
  const sx = GW / w;
  const sy = GH / h;
  let px0 = 0;
  let px1 = w;
  let py0 = 0;
  let py1 = h;
  if (cells) {
    px0 = Math.max(0, Math.floor((cells.x0 - 1.5) / sx));
    px1 = Math.min(w, Math.ceil((cells.x1 + 2.5) / sx));
    py0 = Math.max(0, Math.floor((cells.y0 - 1.5) / sy));
    py1 = Math.min(h, Math.ceil((cells.y1 + 2.5) / sy));
  }
  const wt = new Float32Array(5);
  for (let py = py0; py < py1; py++) {
    for (let px = px0; px < px1; px++) {
      const i = py * w + px;
      let gx = px * sx - 0.5 + warpX[i];
      let gy = py * sy - 0.5 + warpY[i];
      if (gx < 0) gx = 0;
      else if (gx > GW - 1.001) gx = GW - 1.001;
      if (gy < 0) gy = 0;
      else if (gy > GH - 1.001) gy = GH - 1.001;
      const x0 = gx | 0;
      const y0 = gy | 0;
      let fx = gx - x0;
      let fy = gy - y0;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      wt[0] = wt[1] = wt[2] = wt[3] = wt[4] = 0;
      const r = y0 * GW + x0;
      wt[grid[r]] += (1 - fx) * (1 - fy);
      wt[grid[r + 1]] += fx * (1 - fy);
      wt[grid[r + GW]] += (1 - fx) * fy;
      wt[grid[r + GW + 1]] += fx * fy;

      let best = 0;
      let second = 0;
      let bw = -1;
      let sw = -1;
      for (let c = 0; c < 5; c++) {
        const v = wt[c];
        if (v > bw) {
          sw = bw;
          second = best;
          bw = v;
          best = c;
        } else if (v > sw) {
          sw = v;
          second = c;
        }
      }
      // A narrow blend across each boundary, with a faint darkened seam where
      // two regions meet, the way wax walls read between different contents.
      let t = (bw - sw) * 5;
      if (t > 1) t = 1;
      const mix = 0.5 + 0.5 * t;
      const seam = 1 - 0.15 * (1 - t);
      const a = tex[best];
      const b = tex[second];
      const o = i * 4;
      out[o] = (a[o] * mix + b[o] * (1 - mix)) * seam;
      out[o + 1] = (a[o + 1] * mix + b[o + 1] * (1 - mix)) * seam;
      out[o + 2] = (a[o + 2] * mix + b[o + 2] * (1 - mix)) * seam;
      out[o + 3] = 255;
    }
  }
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
}

/** The wooden frame: pine with grain, propolis stains along the top bar. */
export function drawWood(g: CanvasRenderingContext2D, dpr: number, seed: number) {
  const rnd = mulberry32(seed);
  const pine = "#e6c890";
  const edge = "#b8925a";
  g.save();
  g.scale(dpr, dpr);
  g.clearRect(0, 0, CARD_W, CARD_H);

  const bar = (x: number, y: number, w: number, h: number, rad: number, vertical: boolean) => {
    g.beginPath();
    g.roundRect(x, y, w, h, rad);
    g.fillStyle = pine;
    g.fill();
    g.save();
    g.clip();
    // Grain: long, slightly wandering strokes along the length of the bar.
    const lines = vertical ? Math.round(w / 2.6) : Math.round(h / 2.4);
    for (let k = 0; k < lines; k++) {
      g.beginPath();
      const off = (k + rnd()) * (vertical ? w / lines : h / lines);
      const amp = 0.6 + rnd() * 1.4;
      const freq = 0.01 + rnd() * 0.03;
      const len = vertical ? h : w;
      for (let t = 0; t <= len; t += 6) {
        const d = off + Math.sin(t * freq + k) * amp;
        if (vertical) g.lineTo(x + d, y + t);
        else g.lineTo(x + t, y + d);
      }
      g.strokeStyle = `rgba(150,104,48,${0.12 + rnd() * 0.2})`;
      g.lineWidth = 0.6 + rnd() * 0.7;
      g.stroke();
    }
    g.restore();
    g.strokeStyle = edge;
    g.lineWidth = 1;
    g.stroke();
  };

  bar(COMB_X - SIDE, TOP - 2, SIDE, COMB_H + 4, 2, true);
  bar(CARD_W - COMB_X, TOP - 2, SIDE, COMB_H + 4, 2, true);
  bar(COMB_X - SIDE, TOP + COMB_H, COMB_W + 2 * SIDE, BOTTOM, 2, false);
  bar(0, 0, CARD_W, TOP, 3, false);

  // Propolis: the colony glues everything; it collects where bars meet.
  for (let k = 0; k < 7; k++) {
    const x = COMB_X + rnd() * COMB_W;
    g.beginPath();
    g.ellipse(x, TOP - 1.5, 4 + rnd() * 10, 1.4 + rnd() * 1.4, 0, 0, Math.PI * 2);
    g.fillStyle = `rgba(122,58,20,${0.25 + rnd() * 0.25})`;
    g.fill();
  }
  g.restore();
}

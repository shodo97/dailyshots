/* Octilinear track geometry. A line is authored as a polyline of 0/45/90°
   legs; every interior vertex is replaced by a true circular arc, so a train
   can be placed at an exact length along the drawn path and parallel lines
   can share concentric bends. */

export type Pt = readonly [number, number];

type LineSeg = { kind: "L"; a: Pt; b: Pt; start: number; len: number };
type ArcSeg = {
  kind: "A";
  c: Pt;
  r: number;
  a0: number;
  /** Signed sweep in radians; positive turns clockwise on screen. */
  sweep: number;
  from: Pt;
  to: Pt;
  start: number;
  len: number;
};
type Seg = LineSeg | ArcSeg;

export type Track = { segs: Seg[]; length: number; d: string };

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const norm = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => {
  const n = norm(a);
  return [a[0] / n, a[1] / n];
};
const f = (n: number) => Math.round(n * 100) / 100;

/** `radii[i]` rounds interior vertex `i + 1`. */
export function buildTrack(pts: readonly Pt[], radii: readonly number[]): Track {
  const segs: Seg[] = [];
  let cursor: Pt = pts[0];
  let acc = 0;

  const pushLine = (a: Pt, b: Pt) => {
    const len = norm(sub(b, a));
    if (len < 0.01) return;
    segs.push({ kind: "L", a, b, start: acc, len });
    acc += len;
  };

  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (i === pts.length - 1) {
      pushLine(cursor, p);
      break;
    }
    const u = unit(sub(p, pts[i - 1]));
    const v = unit(sub(pts[i + 1], p));
    const cross = u[0] * v[1] - u[1] * v[0];
    const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]));
    const theta = Math.acos(dot);
    const r = radii[i - 1] ?? 18;
    const t = r * Math.tan(theta / 2);
    const A: Pt = [p[0] - u[0] * t, p[1] - u[1] * t];
    const B: Pt = [p[0] + v[0] * t, p[1] + v[1] * t];
    pushLine(cursor, A);
    const s = Math.sign(cross);
    const c: Pt = [A[0] - u[1] * s * r, A[1] + u[0] * s * r];
    const a0 = Math.atan2(A[1] - c[1], A[0] - c[0]);
    const len = r * theta;
    segs.push({ kind: "A", c, r, a0, sweep: s * theta, from: A, to: B, start: acc, len });
    acc += len;
    cursor = B;
  }

  return { segs, length: acc, d: subPath({ segs, length: acc, d: "" }, 0, acc) };
}

function arcPoint(s: ArcSeg, local: number): Pt {
  const a = s.a0 + s.sweep * (local / s.len);
  return [s.c[0] + s.r * Math.cos(a), s.c[1] + s.r * Math.sin(a)];
}

export function pointAt(track: Track, l: number): Pt {
  const len = Math.max(0, Math.min(track.length, l));
  for (const s of track.segs) {
    if (len <= s.start + s.len + 1e-6) {
      const local = len - s.start;
      if (s.kind === "L") {
        const k = s.len === 0 ? 0 : local / s.len;
        return [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k];
      }
      return arcPoint(s, local);
    }
  }
  const last = track.segs[track.segs.length - 1];
  return last.kind === "L" ? last.b : last.to;
}

/** SVG path data for the stretch of track between two lengths. */
export function subPath(track: Track, l0: number, l1: number): string {
  if (l1 <= l0) return "";
  const p0 = pointAt(track, l0);
  let d = `M${f(p0[0])} ${f(p0[1])}`;
  for (const s of track.segs) {
    const end = s.start + s.len;
    if (end <= l0 || s.start >= l1) continue;
    const to = Math.min(end, l1);
    if (s.kind === "L") {
      const q = pointAt(track, to);
      d += `L${f(q[0])} ${f(q[1])}`;
    } else {
      const q = arcPoint(s, to - s.start);
      d += `A${s.r} ${s.r} 0 0 ${s.sweep > 0 ? 1 : 0} ${f(q[0])} ${f(q[1])}`;
    }
  }
  return d;
}

/** Length along the track of a point that sits on one of its straight legs. */
export function lengthOf(track: Track, p: Pt): number {
  for (const s of track.segs) {
    if (s.kind !== "L") continue;
    const ab = sub(s.b, s.a);
    const ap = sub(p, s.a);
    const k = (ap[0] * ab[0] + ap[1] * ab[1]) / (s.len * s.len);
    if (k < -0.001 || k > 1.001) continue;
    const px = s.a[0] + ab[0] * k;
    const py = s.a[1] + ab[1] * k;
    if (Math.hypot(px - p[0], py - p[1]) < 0.75) return s.start + k * s.len;
  }
  throw new Error(`Point ${p.join(",")} is not on a straight leg of the track`);
}

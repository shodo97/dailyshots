/* One stroke weight (1.6 on a 16 grid) for the controls, and three cargo
   marks drawn the way they are stencilled on a yard screen. */

import type { ReactNode } from "react";
import { IMDG } from "./data";

const PATHS = {
  play: "M5 3.2v9.6l7.6-4.8z",
  pause: "M5 3.5v9M11 3.5v9",
  step: "M3.5 3.5v9l6.5-4.5zM12.5 3.5v9",
  restart: "M3.2 8a4.8 4.8 0 108.4-3.2M11.8 2.2v2.8H9",
  follow: "M8 1.8v2.6M8 11.6v2.6M1.8 8h2.6M11.6 8h2.6M8 5.4a2.6 2.6 0 110 5.2 2.6 2.6 0 010-5.2z",
  warn: "M8 2.2l6.2 11H1.8zM8 6.6v3.2M8 11.6v.2",
  check: "M3.2 8.4l3 3 6.6-6.8",
  pin: "M6 2.2h4M7 2.2v4L4.6 9h6.8L9 6.2v-4M8 9v4.8",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const filled = name === "play" || name === "step";
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden focusable="false">
      <path
        d={PATHS[name]}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── cargo marks, drawn in SVG user space ─────────────────────────────────── */

/** A reefer plug: a rounded head with two pins. `s` is the overall height. */
export function PlugMark({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const u = s / 10;
  return (
    <g transform={`translate(${x} ${y}) scale(${u})`} aria-hidden>
      <path
        d="M-3.2 -1.5h6.4v2.6a3.2 3.2 0 01-6.4 0zM-1.6 -1.5v-3M1.6 -1.5v-3M0 4.2v1.8"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

const PLACARD: Record<string, { fill: string; ink: string; lower?: string }> = {
  "3": { fill: "#c8322a", ink: "#f6f1ea" },
  "2.1": { fill: "#c8322a", ink: "#f6f1ea" },
  "8": { fill: "#f2efe7", ink: "#f2efe7", lower: "#1c1c1c" },
  "9": { fill: "#f2efe7", ink: "#1c1c1c" },
  "5.1": { fill: "#ecc22a", ink: "#1c1c1c" },
};

/** IMDG placard: a diamond with the class number in its lower corner. */
export function Diamond({ x, y, s, cls, label = true }: { x: number; y: number; s: number; cls: string; label?: boolean }) {
  const c = PLACARD[cls] ?? PLACARD["9"];
  const h = s / 2;
  const id = `dg-${cls.replace(".", "")}`;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      {c.lower ? (
        <>
          <clipPath id={`${id}-${Math.round(s * 10)}`}>
            <path d={`M0 ${-h}L${h} 0L0 ${h}L${-h} 0z`} />
          </clipPath>
          <path d={`M0 ${-h}L${h} 0L0 ${h}L${-h} 0z`} fill={c.fill} />
          <rect x={-h} y={0} width={s} height={h} fill={c.lower} clipPath={`url(#${id}-${Math.round(s * 10)})`} />
        </>
      ) : (
        <path d={`M0 ${-h}L${h} 0L0 ${h}L${-h} 0z`} fill={c.fill} />
      )}
      <path
        d={`M0 ${-h}L${h} 0L0 ${h}L${-h} 0z`}
        fill="none"
        stroke="#1c1c1c"
        strokeWidth={Math.max(0.5, s * 0.05)}
        strokeOpacity={0.55}
      />
      {label && (
        <text
          x={0}
          y={h * 0.62}
          textAnchor="middle"
          fontSize={s * (cls.length > 1 ? 0.3 : 0.4)}
          fontWeight={800}
          fill={c.ink}
          style={{ fontFamily: "var(--shot-display)" }}
        >
          {cls}
        </text>
      )}
    </g>
  );
}

/** Overweight: a heavy downward bar, the way the gate stencils it. */
export function OwMark({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const u = s / 10;
  return (
    <g transform={`translate(${x} ${y}) scale(${u})`} aria-hidden>
      <path d="M-4.6 -3.6h9.2L2.6 3.8h-5.2z" fill={color} />
      <path d="M-4.6 -5h9.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

/** HTML-side chip for a mark, used in lists and the inspector. */
export function MarkChip({ kind, cls }: { kind: "reefer" | "imdg" | "ow"; cls?: string }): ReactNode {
  return (
    <svg viewBox="-6 -6 12 12" width={14} height={14} aria-hidden focusable="false">
      {kind === "reefer" && <PlugMark x={0} y={0.4} s={11} color="currentColor" />}
      {kind === "imdg" && <Diamond x={0} y={0} s={11.5} cls={cls ?? "9"} label={false} />}
      {kind === "ow" && <OwMark x={0} y={0.8} s={10} color="currentColor" />}
    </svg>
  );
}

export const imdgLabel = (cls: string) => `IMDG ${cls} · UN ${Object.values(IMDG).find((i) => i.cls === cls)?.un ?? ""}`;

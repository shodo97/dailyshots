/* 0008 — Roast · icons. One 16-unit grid, 1.5 stroke, round joins. */

import type { SVGProps } from "react";

const PATHS = {
  play: "M5 3.5v9l7-4.5z",
  pause: "M5.5 3.5v9M10.5 3.5v9",
  flame:
    "M8 14c-2.6 0-4.3-1.8-4.3-4.2 0-2.6 2-3.9 2.6-6.3.9 1 1.3 2 1.3 3 1-.5 1.6-1.6 1.7-2.8 1.8 1.4 3 3.4 3 5.9C12.3 12.2 10.6 14 8 14zM8 14c-1 0-1.7-.8-1.7-1.8 0-1.2 1-1.8 1.7-3 .7 1.2 1.7 1.8 1.7 3 0 1-.7 1.8-1.7 1.8z",
  fan: "M8 8c0-2.6 1-4.5 2.6-4.5S13 5 11.7 6.4 8 8 8 8zm0 0c2.6 0 4.5 1 4.5 2.6S11 13 9.6 11.7 8 8 8 8zm0 0c0 2.6-1 4.5-2.6 4.5S3 11 4.3 9.6 8 8 8 8zm0 0C5.4 8 3.5 7 3.5 5.4S5 3 6.4 4.3 8 8 8 8z",
  warn: "M8 2.5l6 10.5H2zM8 6.5v3M8 11.2v.3",
  check: "M3.5 8.5l3 3 6-7",
  minus: "M4 8h8",
  plus: "M4 8h8M8 4v8",
  drum: "M2.5 5.5h11v6a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5zM2.5 8.5h11M5 3h6M8 3v2.5",
  cue: "M3 13V3l9 3.5L3 10",
  hand: "M5.5 8V3.8a1 1 0 0 1 2 0V7.5M7.5 7V3a1 1 0 0 1 2 0v4.5M9.5 7.3V4a1 1 0 0 1 2 0v5c0 2.8-1.6 4.5-4 4.5-1.6 0-2.6-.8-3.4-2L2.6 9a1 1 0 0 1 1.6-1.2L5.5 9.3",
  tray: "M2 9.5h12l-1.3 3a1 1 0 0 1-.9.5H4.2a1 1 0 0 1-.9-.5zM8 9.5V6M5 6h6M6 3.5c0 .8.6.8.6 1.6M9.4 3.5c0 .8.6.8.6 1.6",
  next: "M4 3.5v9M7 3.5v9l6-4.5z",
  pin: "M8 2.5v11M5.5 5h5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const filled = name === "play" || name === "next";
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden focusable="false" {...rest}>
      <path
        d={PATHS[name]}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

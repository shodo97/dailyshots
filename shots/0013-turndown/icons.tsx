import type { Shape } from "./data";
import s from "./shot.module.css";

/* One drawn set: 16-unit grid, 1.5 stroke, round joins. */

const PATHS = {
  play: "M5 3.5v9l7-4.5z",
  pause: "M5.5 3.5v9M10.5 3.5v9",
  fast: "M2.5 4v8l5.5-4zM8.5 4v8l5.5-4z",
  rewind: "M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.5v3h3",
  tick: "M3.5 8.5l3 3 6-7",
  warn: "M8 2.5l6 11H2zM8 6.8v3M8 11.7v.1",
  close: "M4 4l8 8M12 4l-8 8",
  exit: "M6.5 3H3.5v10h3M9 5l3 3-3 3M12 8H6",
  lift: "M4 2.5h8v11H4zM6.6 6.2L8 4.8l1.4 1.4M6.6 9.8L8 11.2l1.4-1.4",
  key: "M5.5 4.5a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM8.3 7.3h5.2M11.5 7.3v2.2M13.5 7.3v1.6",
  drag: "M8 2v12M2 8h12M8 2L6.3 3.7M8 2l1.7 1.7M8 14l-1.7-1.7M8 14l1.7-1.7M2 8l1.7-1.7M2 8l1.7 1.7M14 8l-1.7-1.7M14 8l-1.7 1.7",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const filled = name === "play" || name === "fast";
  return (
    <svg viewBox="0 0 16 16" className={`${s.icon} ${className ?? ""}`} aria-hidden focusable="false" data-filled={filled || undefined}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** An attendant's mark: a pastel shape, outlined, so it survives any background. */
export function Mark({ shape, color, size = 12 }: { shape: Shape; color: string; size?: number }) {
  const common = { fill: color, stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" as const };
  let el;
  switch (shape) {
    case "circle":
      el = <circle cx="6" cy="6" r="4.6" {...common} />;
      break;
    case "triangle":
      el = <path d="M6 1.3l5 9H1z" {...common} />;
      break;
    case "square":
      el = <rect x="1.6" y="1.6" width="8.8" height="8.8" rx="0.6" {...common} />;
      break;
    case "diamond":
      el = <path d="M6 .9L11.1 6 6 11.1.9 6z" {...common} />;
      break;
    case "hexagon":
      el = <path d="M3.4 1.5h5.2L11.2 6l-2.6 4.5H3.4L.8 6z" {...common} />;
      break;
    case "half":
      el = <path d="M1.2 8.6a4.8 4.8 0 0 1 9.6 0z" {...common} />;
      break;
  }
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} className={s.mark} aria-hidden focusable="false">
      {el}
    </svg>
  );
}

/** The arrival key fob drawn on a window: filled for an early check-in. */
export function Fob({ early }: { early: boolean }) {
  return (
    <svg viewBox="0 0 10 12" className={s.fob} aria-hidden focusable="false">
      <path
        d="M5 .9L9 5.2 5 11.1 1 5.2z"
        fill={early ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="4.4" r="1" fill={early ? "var(--fob-hole)" : "currentColor"} />
    </svg>
  );
}

/** The glyph a window carries next to its colour, so status never rides on colour alone.
    Vacant dirty, occupied and out of order carry a pattern instead (see the CSS). */
export function StatusGlyph({ status }: { status: string }) {
  let d: string | null = null;
  if (status === "vi") d = "M2 5.4l2.2 2.2L8.2 2.8";
  else if (status === "vc") d = "M4.2 1.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM6 6l2.4 2.4";
  else if (status === "dnd") d = "M1.8 5h6.4";
  if (!d) return null;
  return (
    <svg viewBox="0 0 10 10" className={s.sglyph} data-g={status} aria-hidden focusable="false">
      <path d={d} />
    </svg>
  );
}

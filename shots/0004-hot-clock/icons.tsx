/* One stroke weight (1.5 on a 16 grid), round caps, drawn for this desk. */

const PATHS = {
  grip: "M6 3.5v.01M10 3.5v.01M6 8v.01M10 8v.01M6 12.5v.01M10 12.5v.01",
  drop: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  restore: "M3.5 6.5h6.25a3 3 0 010 6H6M6 3.5l-2.5 3 2.5 3",
  add: "M8 3.5v9M3.5 8h9",
  lock: "M4.5 7.5h7v5.5h-7zM6 7.5V5.5a2 2 0 014 0v2",
  fade: "M2.5 5l11 6.5H2.5z",
  cold: "M2.5 5h8v6.5h-8zM13 4v8.5",
  mic: "M8 2.5a2 2 0 012 2v3.5a2 2 0 01-4 0V4.5a2 2 0 012-2zM4.5 7.5a3.5 3.5 0 007 0M8 11v2.5",
  warn: "M8 2.75l5.75 10H2.25zM8 6.75v2.5M8 11.25v.01",
  long: "M3.5 10.5L8 6l4.5 4.5",
  short: "M3.5 5.5L8 10l4.5-4.5",
  clean: "M3 8.5l3 3 7-7",
  phones: "M3 10.5V8a5 5 0 0110 0v2.5M3 10h2v3.5H3zM11 10h2v3.5h-2z",
  play: "M5 3.5l7.5 4.5L5 12.5z",
  stop: "M4.5 4.5h7v7h-7z",
  suggest: "M8 2.5v1.5M3.6 4.1l1 1M12.4 4.1l-1 1M5.5 9.5a2.5 2.5 0 115 0c0 1-.75 1.5-1 2.5h-3c-.25-1-1-1.5-1-2.5zM6.5 14h3",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

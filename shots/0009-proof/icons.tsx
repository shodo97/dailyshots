/* One stroke weight (1.5 on a 16 grid), round caps, drawn for this shot. */

const PATHS = {
  play: "M5 3.2v9.6l7.6-4.8z",
  pause: "M5.2 3.5v9M10.8 3.5v9",
  back: "M3.2 4.2v3.3h3.3M3.5 7.3A5 5 0 1 1 4.2 11",
  fwd: "M12.8 4.2v3.3H9.5M12.5 7.3A5 5 0 1 0 11.8 11",
  undo: "M5.5 3.5 2.8 6.2l2.7 2.7M3 6.2h6.3a3.7 3.7 0 0 1 0 7.4H6.5",
  redo: "M10.5 3.5l2.7 2.7-2.7 2.7M13 6.2H6.7a3.7 3.7 0 0 0 0 7.4h2.8",
  export: "M8 10.2V2.6M5 5.4l3-3 3 3M3 9.4v3.4a.9.9 0 0 0 .9.9h8.2a.9.9 0 0 0 .9-.9V9.4",
  loop: "M3 7.2V6.3A2.3 2.3 0 0 1 5.3 4h7.2M10.6 2.1 12.5 4l-1.9 1.9M13 8.8v.9A2.3 2.3 0 0 1 10.7 12H3.5M5.4 13.9 3.5 12l1.9-1.9",
  follow: "M8 2.8v8.4M4.6 7.8 8 11.2l3.4-3.4M3.5 13.5h9",
  warn: "M8 2.6 14 13H2zM8 6.6v3M8 11.3v.2",
  check: "M3.2 8.4l3 3 6.6-6.8",
  sweep: "M2.5 8h1.4M5.6 5.2v5.6M8.4 3.4v9.2M11.2 6v4M2 2l12 12",
  scissors: "M4.6 6.2a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8zM4.6 13.6a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8zM6.2 5.1 13.5 12M6.2 10.9 13.5 4",
  // A proofreader's dele: the mark for "take this out", in one loop.
  dele: "M2.6 12.6C4 9.5 6.3 4.2 9.6 3.4c1.9-.5 3 .9 2.5 2.4-.6 1.8-3 2.3-4 1.1-.9-1.1 0-3 1.3-3.9M5.4 12.8h7.4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, filled }: { name: IconName; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* Speaker marks: the host is a disc, the guest a square, so the two read
   apart in the gutter, the dock and the legend without leaning on colour. */
export function SpeakerMark({ who, className }: { who: "host" | "guest"; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden focusable="false">
      {who === "host" ? <circle cx="5" cy="5" r="4" fill="currentColor" /> : <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="1" fill="currentColor" />}
    </svg>
  );
}

/* Icons on a 20px grid, 1.5px round stroke, drawn for this shot. */

const PATHS = {
  play: "M7 5.2v9.6l7.6-4.8z",
  pause: "M7.2 5.5v9M12.8 5.5v9",
  now: "M10 3.5v2.2M10 14.3v2.2M3.5 10h2.2M14.3 10h2.2M10 7.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z",
  skip: "M5 5.5l6 4.5-6 4.5zM14.5 5.5v9",
  clear: "M4.8 10.4l3.4 3.3 7-7.4",
  margin: "M10 4.5v7M10 14.6v.9",
  aground: "M5.5 5.5l9 9M14.5 5.5l-9 9",
  gust: "M3.5 7.5h8.2a2.2 2.2 0 1 0-2.2-2.2M3.5 10.5h11.3a2.4 2.4 0 1 1-2.4 2.4M3.5 13.5h5",
  bulb: "M10 3.5a4.6 4.6 0 0 0-2.7 8.3v2.2h5.4v-2.2A4.6 4.6 0 0 0 10 3.5zM8 16.5h4",
  sun: "M10 6.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM10 2.8v1.6M10 15.6v1.6M2.8 10h1.6M15.6 10h1.6M4.9 4.9l1.1 1.1M14 14l1.1 1.1M4.9 15.1L6 14M14 6l1.1-1.1",
  horizon: "M2.5 13.5h15M6 13.5a4 4 0 0 1 8 0M10 6v1.6M4.6 8.4l1.1 1.1M15.4 8.4l-1.1 1.1M5.5 16.5h9",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  const filled = name === "play";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden
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

/** Wind arrow: drawn pointing north (downwind), rotated by the caller. */
export function WindArrow({ deg, size = 16 }: { deg: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ transform: `rotate(${deg}deg)` }}>
      <path
        d="M8 2.2v11.3M4.6 5.6L8 2.2l3.4 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Phone status bar glyphs. */
export function StatusGlyphs() {
  return (
    <svg width="66" height="12" viewBox="0 0 66 12" aria-hidden fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="0.8" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.8" />
      <rect x="9" y="3" width="3" height="9" rx="0.8" />
      <rect x="13.5" y="0.5" width="3" height="11.5" rx="0.8" opacity="0.35" />
      <path
        d="M30 3.4a10 10 0 0 1 12.4 0M32.2 6.2a6.4 6.4 0 0 1 8 0M34.4 9a2.8 2.8 0 0 1 3.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="45.5" y="1" width="18" height="10" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <rect x="47.3" y="2.8" width="10.4" height="6.4" rx="1.4" />
      <path d="M64.6 4.4v3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/* Hairline icons on a 28px grid, 1px stroke, drawn for this shot. */

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const I = {
  // top bar
  plusCircle: `${circle(14, 14, 9.5)}M14 9v10M9 14h10`,
  candles: "M10.5 5v4M10.5 19v4M8.5 9.5h4v9h-4zM17.5 7v3M17.5 18v3M15.5 10.5h4v7h-4z",
  barStyle: "M9.5 5v18M9.5 9.5h-3M9.5 17.5h3M18.5 5v18M18.5 12.5h-3M18.5 20.5h3",
  indicators: "M4.5 22.5h19M7.5 22.5v-5h3v5M12.5 22.5v-8h3v8M17.5 22.5v-6h3v6M5 13.5l5-5 4 3.5 8.5-7",
  alert: `${circle(13, 15, 7.5)}M13 11v4.5h-3M5.5 7.5l3-2.5M20.5 7.5l-3-2.5M21 19v6M18 22h6`,
  replay: "M13.5 8.5l-6.5 5.5 6.5 5.5zM21.5 8.5l-6.5 5.5 6.5 5.5z",
  undo: "M10.5 8.5l-4 4 4 4M6.5 12.5h9.5a5 5 0 0 1 5 5v1.5",
  redo: "M17.5 8.5l4 4-4 4M21.5 12.5H12a5 5 0 0 0-5 5v1.5",
  layout: "M8.5 6.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z",
  quickSearch: `${circle(12.5, 13, 6.5)}M17.3 17.8l5.2 5.2M13.5 8.5l-2.5 4.5h3l-1.5 4`,
  settings: `M4.5 14l4.75-8.25h9.5L23.5 14l-4.75 8.25h-9.5z${circle(14, 14, 3.5)}`,
  fullscreen:
    "M6.5 11.5v-3a2 2 0 0 1 2-2h3M16.5 6.5h3a2 2 0 0 1 2 2v3M21.5 16.5v3a2 2 0 0 1-2 2h-3M11.5 21.5h-3a2 2 0 0 1-2-2v-3",
  camera: `M5.5 10.5a2 2 0 0 1 2-2h3l1.5-2h4l1.5 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z${circle(14, 14.5, 3.5)}`,
  publish:
    "M14 4.5a6 6 0 0 0-3.5 10.9v3.1h7v-3.1A6 6 0 0 0 14 4.5zM11 21.5h6M12 24h4M14 7.5v6M11 10.5h6",

  // drawing toolbar
  cross: "M14 4.5v7M14 16.5v7M4.5 14h7M16.5 14h7",
  trend: `M8.2 19.8L19.8 8.2${circle(7, 21, 1.6)}${circle(21, 7, 1.6)}`,
  fib: `M4.5 7.5h15M4.5 11.5h19M4.5 15.5h19M4.5 19.5h15${circle(21.5, 7.5, 1.6)}${circle(21.5, 19.5, 1.6)}`,
  pattern: `M7.2 19.4L9.8 9.6M11 9.7l4.3 7M16.7 16.4l3.8-8.7M8 20.2l7.4-2.8M11.2 8.6l8.4-1.3${circle(7, 21, 1.6)}${circle(10.2, 8, 1.6)}${circle(16.2, 17.8, 1.6)}${circle(21.2, 6.2, 1.6)}`,
  forecast: "M4.5 7.5h19M4.5 20.5h19M8.5 10.5v6h5M4.5 13.5h2M16.5 13.5h7",
  brush: "M5.5 22.5c3.5-.5 4-3.5 6-5.5s4.5-2 5 0-2 4-4.5 3.5M15 15l7.5-8.5",
  text: "M7.5 7.5h13M14 7.5v14M11.5 21.5h5M7.5 7.5v2M20.5 7.5v2",
  emoji: `${circle(14, 14, 8.5)}M10.5 16.5c1.9 2.3 5.1 2.3 7 0M11 11.5v1M17 11.5v1`,
  aiPattern:
    "M6.5 6.5v15M21.5 6.5v15M14 9c.6 2.8 2.2 4.4 5 5-2.8.6-4.4 2.2-5 5-.6-2.8-2.2-4.4-5-5 2.8-.6 4.4-2.2 5-5z",
  ruler:
    "M5.5 18.5l13-13 4 4-13 13zM9 15l2 2M11.5 12.5l1.5 1.5M14 10l2 2M16.5 7.5l1.5 1.5",
  zoom: `${circle(12.5, 12.5, 7)}M17.5 17.5l5.5 5.5M12.5 9.5v6M9.5 12.5h6`,
  magnet:
    "M8.5 6.5v8a5.5 5.5 0 0 0 11 0v-8H16v8a2 2 0 0 1-4 0v-8zM8.5 10.5H12M16 10.5h3.5",
  pencilLock:
    "M5.5 22.5l1-4 10-10 3 3-10 10zM14.5 10.5l3 3M18.5 19.5V18a2 2 0 0 1 4 0v1.5M17.5 19.5h6v4h-6z",
  lockOpen:
    "M9.5 13.5h10v9h-10zM11.5 13.5V10a3 3 0 0 1 5.8-1M14.5 16.5v3",
  lockClosed: "M9.5 13.5h10v9h-10zM11.5 13.5V10a3 3 0 0 1 6 0v3.5M14.5 16.5v3",
  eye: `M4.5 14s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z${circle(14, 14, 3)}`,
  eyeOff: `M4.5 14s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z${circle(14, 14, 3)}M6 22L22 6`,
  trash: "M6.5 8.5h15M11.5 8.5v-2h5v2M8.5 8.5l1 14h9l1-14M12.5 11.5v8M15.5 11.5v8",

  // widget rail
  watchlist: "M6.5 5.5h15v18l-7.5-4-7.5 4zM9.5 9.5h9M9.5 12.5h9",
  alarm: `${circle(14, 15, 7.5)}M14 11v4.5h-3M5.5 8l3.5-3M22.5 8L19 5`,
  layers: "M14 5.5l9 5-9 5-9-5zM5 15l9 5 9-5",
  sparkle: "M14 4.5c.9 5 3.9 8.6 9 9.5-5.1.9-8.1 4.5-9 9.5-.9-5-3.9-8.6-9-9.5 5.1-.9 8.1-4.5 9-9.5z",
  target: `${circle(14, 14, 9)}${circle(14, 14, 5)}M14 14l7-7`,
  ideasGear: `M4.5 21.5l7-12.5 4.5 7.5 2.5-3.5${circle(20.5, 20.5, 3.5)}${circle(20.5, 20.5, 1)}`,
  ideas: "M4.5 21.5L14 6.5l9.5 15zM8.6 15l3.4 2.2 2-2.2 2 2.2 3.4-2.2",
  calendar:
    "M5.5 8.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM5.5 11.5h17M10 4.5v4M18 4.5v4",
  stream: `${circle(7, 21, 1.5)}M6.5 15a6.5 6.5 0 0 1 6.5 6.5M6.5 10a11.5 11.5 0 0 1 11.5 11.5M6.5 5A16.5 16.5 0 0 1 23 21.5`,
  bell: "M8.5 18.5v-6a5.5 5.5 0 0 1 11 0v6l2 2h-15zM11.8 22.5a2.3 2.3 0 0 0 4.4 0",
  chat: "M4.5 6.5h13v9h-7l-4 3.2v-3.2h-2zM17.5 10.5h6v9h-2v3.2l-4-3.2h-4.5v-4",
  help: `${circle(14, 14, 9.5)}M11.3 11.5a2.7 2.7 0 1 1 3.8 2.5c-.7.3-1.1.9-1.1 1.6v.9M14 18.6v.9`,

  // panel chrome
  plus: "M14 6.5v15M6.5 14h15",
  dots: `${circle(7.5, 14, 1.6)}${circle(14, 14, 1.6)}${circle(20.5, 14, 1.6)}`,
  grid4:
    "M6.5 6.5h6v6h-6zM15.5 6.5h6v6h-6zM6.5 15.5h6v6h-6zM15.5 15.5h6v6h-6z",
  edit: "M20.5 14.5v5a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h5M12.5 15.5l.5-3 7.5-7.5 2.5 2.5-7.5 7.5z",
  dateRange:
    "M5.5 9.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-6M5.5 12.5h17M10 5v4M18 5v4M4.5 19.5h7M9 17l2.5 2.5L9 22",
} as const;

export type IconName = keyof typeof I;

export function Icon({ name, size = 28 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={I[name]} />
    </svg>
  );
}

/** 18px glyphs used inline in text runs. */
export const S = {
  chevDown: "M5 7.5l4 4 4-4",
  chevUp: "M5 11l4-4 4 4",
  chevRight: "M7.5 5l4 4-4 4",
  external: "M8 4.5H4.5v9h9V10M10.5 4.5h3v3M13.5 4.5L8.5 9.5",
  sun: "M3 12.5h12M5.5 12.5a3.5 3.5 0 0 1 7 0M9 5.5v2M4 7.5l1.4 1.4M14 7.5l-1.4 1.4",
  sparkle: "M9 2.5c.6 3.3 2.4 5.2 5.5 5.8-3.1.6-4.9 2.5-5.5 5.8-.6-3.3-2.4-5.2-5.5-5.8 3.1-.6 4.9-2.5 5.5-5.8z",
} as const;

export function Glyph({ name, size = 18, strokeWidth = 1.2 }: { name: keyof typeof S; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={S[name]} />
    </svg>
  );
}

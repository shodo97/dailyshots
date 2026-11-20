/* 0012 — Hive: authored icons. One stroke weight (2.4 on a 24 grid), round
   caps and joins, drawn heavy enough to read through a veil in full sun. */

import type { SVGProps } from "react";

export type IconName =
  | "left"
  | "right"
  | "undo"
  | "sun"
  | "alert"
  | "minus"
  | "plus"
  | "check"
  | "phone";

const PATHS: Record<IconName, React.ReactNode> = {
  left: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  right: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  undo: (
    <>
      <path d="M8.5 5.5 4.5 9.5l4 4" />
      <path d="M4.5 9.5h9a5.5 5.5 0 0 1 0 11H10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </>
  ),
  minus: <path d="M5.5 12h13" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  phone: (
    <>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.4" />
      <path d="M11 17.6h2" />
    </>
  ),
};

export function Icon({ name, size = 24, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Status-bar glyphs are filled shapes, as the OS draws them. */
export function Signal({ bars }: { bars: number }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 4.6}
          y={9 - i * 3}
          width="3.2"
          height={3 + i * 3}
          rx="0.8"
          fill="currentColor"
          opacity={i < bars ? 1 : 0.28}
        />
      ))}
    </svg>
  );
}

export function Battery({ level }: { level: number }) {
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
      <rect x="0.75" y="0.75" width="22.5" height="11.5" rx="3.4" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x="2.6" y="2.6" width={18.8 * level} height="7.8" rx="1.8" fill="currentColor" />
      <path d="M25 4.4v4.2c.9-.3 1.4-1.1 1.4-2.1s-.5-1.8-1.4-2.1z" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

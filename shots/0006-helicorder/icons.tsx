/* Icons for this shot only: 16-unit grid, 1.4 stroke, round caps. */

import s from "./shot.module.css";

const PATHS = {
  mark: "M1.5 13.5h13M2.5 13.5L6.6 5.2l1 1.1 1-1.1 4.9 8.3M4.8 3.2c.6-.9 1.6-.9 2.2 0s1.6.9 2.2 0",
  pen: "M10.6 2.6l2.8 2.8-7.6 7.6-3.4.6.6-3.4zM9.2 4l2.8 2.8",
  check: "M3.2 8.4l3 3 6.6-6.8",
  auto: "M8 4.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6z",
  warn: "M8 2.2l6.2 11H1.8zM8 6.4v3.2M8 11.4v.2",
  close: "M4 4l8 8M12 4l-8 8",
  minus: "M3.5 8h9",
  plus: "M3.5 8h9M8 3.5v9",
  send: "M2.4 7.6l11-5-4.6 11-1.8-4.4zM7 9.2l6.4-6.6",
  linkOff: "M2.5 13.5l11-11M8 13.2V9.8M5.2 6.4a3.9 3.9 0 015.6 0M3 4.2a7 7 0 012.3-1.4M10.7 2.8A7 7 0 0113 4.2",
  station: "M4 3.5h8L8 10.5zM8 10.5v3",
  doc: "M4 1.8h5l3 3v9.4H4zM9 1.8v3h3M6 8.4h4M6 10.8h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${s.icon} ${className ?? ""}`} aria-hidden focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

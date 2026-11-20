import { CLOCK0, K } from "./data";

const pad = (n: number) => String(n).padStart(2, "0");

/** Scenario clock at real time t, seconds since midnight. */
export const clockAt = (t: number) => CLOCK0 + t * K;

export function hhmm(sec: number) {
  const s = Math.floor(sec);
  return `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}`;
}

export function hhmmss(sec: number) {
  const s = Math.floor(sec);
  return `${hhmm(s)}:${pad(s % 60)}`;
}

/** A display-seconds duration as "12m 41s" or "48s". */
export function dur(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
}

/** A running job timer, "2:41". */
export function timer(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

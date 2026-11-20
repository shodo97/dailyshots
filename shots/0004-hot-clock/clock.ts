/* The scenario clock: 16:21:40 at mount, then real time. One rAF loop feeds
   every subscriber, and each subscriber picks its own resolution, so the
   seconds ring re-renders once a second while the ramp counter runs at tenths. */

import { useSyncExternalStore } from "react";
import { SCENARIO_START } from "./data";

export type ClockStore = {
  /** Absolute seconds of the day. */
  get: () => number;
  subscribe: (cb: () => void) => () => void;
};

export function createClock(start = SCENARIO_START): ClockStore {
  let t = start;
  let origin = -1;
  let raf = 0;
  const subs = new Set<() => void>();

  const frame = (now: number) => {
    if (origin < 0) origin = now;
    t = start + (now - origin) / 1000;
    subs.forEach((cb) => cb());
    raf = requestAnimationFrame(frame);
  };

  return {
    get: () => t,
    subscribe(cb) {
      subs.add(cb);
      if (subs.size === 1 && typeof window !== "undefined") raf = requestAnimationFrame(frame);
      return () => {
        subs.delete(cb);
        if (subs.size === 0) {
          cancelAnimationFrame(raf);
          // Freeze where we are; a re-subscribe resumes from here.
          start = t;
          origin = -1;
        }
      };
    },
  };
}

/** Scenario time rounded down to 1/steps of a second. */
export function useNow(store: ClockStore, steps = 1) {
  return useSyncExternalStore(
    store.subscribe,
    () => Math.floor(store.get() * steps) / steps,
    () => SCENARIO_START,
  );
}

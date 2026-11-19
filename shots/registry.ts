import type { ShotEntry } from "./types";
import { meta as m0002 } from "./0002-press-run/meta";
import { meta as m0001 } from "./0001-first-light/meta";

/**
 * Every shot, registered once. Order here does not matter — the gallery sorts
 * by sequence number. `pnpm new-shot` adds entries automatically.
 */
export const shots: ShotEntry[] = [
  { meta: m0001, load: () => import("./0001-first-light") },
  { meta: m0002, load: () => import("./0002-press-run") },
  /* new-shot:anchor */
];

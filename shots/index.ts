import { shots } from "./registry";
import type { ShotEntry, Tag } from "./types";

/** Newest first. */
const byRecency = (a: ShotEntry, b: ShotEntry) => b.meta.n.localeCompare(a.meta.n);

/** Everything, including unpublished — used for routing. */
export const allShots = [...shots].sort(byRecency);

/** What the gallery shows. */
export const publishedShots = allShots.filter((s) => s.meta.published);

export const routeSlug = (e: ShotEntry) => `${e.meta.n}-${e.meta.slug}`;

export const findShot = (slug: string) =>
  allShots.find((e) => routeSlug(e) === slug);

/**
 * Prev/next walk the published set so the info panel never strands a visitor
 * on a draft — unless they are already on one, where we fall back to all.
 */
export function neighbours(slug: string) {
  const list = findShot(slug)?.meta.published ? publishedShots : allShots;
  const i = list.findIndex((e) => routeSlug(e) === slug);
  if (i === -1) return { prev: undefined, next: undefined };
  return {
    // "next" reads as the newer shot, which sits earlier in the sorted list.
    next: list[i - 1],
    prev: list[i + 1],
  };
}

/** Only tags actually in use, in TAGS order, so the filter row stays honest. */
export function activeTags(order: readonly Tag[]): Tag[] {
  const used = new Set(publishedShots.flatMap((s) => s.meta.tags));
  return order.filter((t) => used.has(t));
}

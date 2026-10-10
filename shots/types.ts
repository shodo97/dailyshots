import type { ComponentType } from "react";

/** Tags drive the grid filters. Add sparingly — a long filter row looks weak. */
export const TAGS = ["ui", "3d", "type", "motion", "mobile"] as const;
export type Tag = (typeof TAGS)[number];

/**
 * How the card sits in the 12-column grid.
 *  wide   → 8 cols, 16:10   (hero moments)
 *  square → 4 cols, 1:1
 *  tall   → 4 cols, 3:4     (mobile shots sit naturally here)
 */
export type Aspect = "wide" | "square" | "tall";

export type ShotMeta = {
  /** Zero-padded sequence, e.g. "0001". Also the URL prefix. */
  readonly n: string;
  readonly slug: string;
  readonly title: string;
  /** ISO date, the day it shipped. */
  readonly date: string;
  readonly tags: readonly Tag[];
  readonly aspect: Aspect;
  /** Designed for a desktop canvas, or presented inside a phone frame. */
  readonly target: "desktop" | "mobile";
  /** Hex. Tints the card border on hover and the info panel accent. */
  readonly accent: string;
  /** 1–3 sentences for the info panel. What the idea was, what was hard. */
  readonly note: string;
  /** Shown as a mono list in the info panel. */
  readonly tools: readonly string[];
  /** false keeps it out of the grid while the route stays live. */
  readonly published: boolean;
};

export type ShotEntry = {
  readonly meta: ShotMeta;
  /** Dynamic import — keeps every shot out of the gallery bundle. */
  readonly load: () => Promise<{ default: ComponentType }>;
};

export const shotHref = (m: ShotMeta) => `/shots/${m.n}-${m.slug}`;
export const posterSrc = (m: ShotMeta) => `/posters/${m.n}.webp`;
export const previewSrc = (m: ShotMeta) => `/previews/${m.n}.webm`;

import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0012",
  slug: "hive",
  title: "Hive",
  date: "2026-11-19",
  tags: ["ui", "motion", "mobile"],
  aspect: "tall",
  target: "mobile",
  accent: "#f5c400",
  note: "A beekeeping inspection recorded at the open hive, by someone in a veil and gloves in full sun, so the yellow is the surface, the type is large and nothing to tap is under 56px. Each frame is a coverage grid that you paint with a thumb, resolved on a Canvas 2D surface into soft regions with procedural textures for cappings, larvae, honey and pollen; the strip, the tool readouts and the summary are all counted from those cells, so the 6.5 frames of brood and the swarm warning come from the same data. The hard part was letting one surface take two gestures: the comb paints, and the wooden bars are the handle you drag to swipe to the next frame.",
  tools: ["Canvas 2D", "Motion", "CSS Modules"],
  // Flip to true when it is ready to enter the grid.
  published: true,
};

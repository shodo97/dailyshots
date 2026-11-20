import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0006",
  slug: "helicorder",
  title: "Helicorder",
  date: "2026-11-19",
  tags: ["ui", "motion"],
  aspect: "square",
  target: "desktop",
  accent: "#5b3fa0",
  note:
    "A night-shift seismic monitor for a fictional volcano, built around a helicorder drum written live in Canvas 2D: 24 half-hour lines in four alternating inks, minute marks from the recorder itself, and a record that advances when the pen reaches the end of a line. Every trace comes from one seeded signal function (microseism, VT and LP events with real P–S arrival times per station, harmonic tremor from 01:12), so the drum, the loupe, the picked waveform, RSAM and the hourly counts all read the same data. The hard part was the loupe: it re-samples the record at 50 Hz under the cursor rather than scaling pixels, which is what lets the P and S picks separate at ×24.",
  tools: ["Canvas 2D", "SVG", "Motion", "CSS Modules"],
  // Flip to true when it is ready to enter the grid.
  published: true,
};

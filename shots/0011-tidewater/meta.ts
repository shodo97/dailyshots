import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0011",
  slug: "tidewater",
  title: "Tidewater",
  date: "2026-11-19",
  tags: ["ui", "motion", "mobile"],
  aspect: "tall",
  target: "mobile",
  accent: "#4fc1d1",
  note: "A tide app for a 1.6 m boat leaving Port Ardlin before dawn, with the harbour drawn in the S-52 night colours that ship chart displays switch to after dark. Scrubbing the tide repaints the chart pixel by pixel: water depth is the tide minus a procedural seabed, so the shallows dry and cover and the band edges move as real contours. The hard part was the data. The tide is a harmonic sum tuned until the 0.5 m under-keel window lands on 05:40 and 10:55, and every time and height on screen is computed from that model.",
  tools: ["Canvas 2D", "SVG", "CSS Modules"],
  // Flip to true when it is ready to enter the grid.
  published: true,
};

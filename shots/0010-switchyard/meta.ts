import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0010",
  slug: "switchyard",
  title: "Switchyard",
  date: "2026-11-19",
  tags: ["ui", "motion"],
  aspect: "square",
  target: "desktop",
  accent: "#d6246e",
  note: "A monorepo's CI drawn as a transit map on deploy day: pipelines are lines, stages are stations, and every running build is a train labelled with its commit. When the api train fails at e2e, the line beyond it turns to grey dashes, the status board reads Part suspended, and promoting to Production stays locked until a retry carries the train through to Staging. The hard part was the geometry. Every bend is a true arc, so trains can sit at exact lengths along the track and parallel lines can share concentric curves, and the whole timetable is a pure function of time, so the server render and the client render agree.",
  tools: ["SVG", "React", "CSS Modules"],
  // Flip to true when it is ready to enter the grid.
  published: true,
};

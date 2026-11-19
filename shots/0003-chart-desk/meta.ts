import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0003",
  slug: "chart-desk",
  title: "Chart Desk",
  date: "2026-11-19",
  tags: ["ui", "motion"],
  aspect: "wide",
  target: "desktop",
  accent: "#2962ff",
  note: "A charting workstation set in Thursday's pre-market, built as a close study of a professional trading desk: two panes on one time axis, both scaled in percent from whichever bar is first on screen, so panning re-bases the whole chart. The canvas engine is written from scratch, with greedy time-axis labelling, inertial panning, trend lines, a brush, a measure tool and box zoom. The data is seeded and pinned so every number agrees: the legend, the axis tags, the watchlist and the details panel all derive from the same bars, and the pre-market prints tick once a second.",
  tools: ["Canvas 2D", "CSS Modules", "System UI"],
  published: false,
};

import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0004",
  slug: "hot-clock",
  title: "Hot Clock",
  date: "2026-11-19",
  tags: ["ui", "motion"],
  aspect: "wide",
  target: "desktop",
  accent: "#ff3b30",
  note: "Playout for the 16:00 hour of a drive-time show on an independent station, booked 38 seconds past the 17:00 news join. The 60-minute wheel and the log are one running order: drag a segment round the clock or a row down the log, drop or add a spare, and the wheel re-flows while the backtime moves from long to clean. The clock runs live from 16:21:40, so the on-air track drains, the ramp counts down to the vocal and the next item takes air. The hard part was making both views edit the same order without either one lying about the time.",
  tools: ["SVG", "Canvas 2D", "Motion", "CSS Modules"],
  published: true,
};

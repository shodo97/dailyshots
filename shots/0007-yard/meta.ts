import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0007",
  slug: "yard",
  title: "Yard",
  date: "2026-11-19",
  tags: ["ui", "motion"],
  aspect: "wide",
  target: "desktop",
  accent: "#3f9a3a",
  note: "A yard planner's screen for loading one bay of a feeder: sixteen blocks of stacks seen from above, the vessel bay in cross-section, and the load sequence playing live from gantry to truck to quay crane. The yard is generated once and the whole 48-move plan replayed ahead of time, so every frame is a lookup and buried boxes really are buried: the rehandles move them to a neighbouring row before the target can come out. Container numbers carry valid ISO 6346 check digits.",
  tools: ["SVG", "requestAnimationFrame", "CSS Modules"],
  published: true,
};

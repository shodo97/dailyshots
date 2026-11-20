import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0009",
  slug: "proof",
  title: "Proof",
  date: "2026-11-19",
  tags: ["ui", "motion", "type"],
  aspect: "wide",
  target: "desktop",
  accent: "#2b3cff",
  note: "A podcast editor where you cut words instead of waveforms: one chapter of a 42-minute interview about bridge expansion joints, playing on load with the spoken word highlighted as it goes. Select words and press Delete, and the text strikes and collapses while the audio under it slides shut, the runtime drops and the overview gains a notch. The hard part was keeping two clocks honest: raw time never changes, edited time subtracts every cut weighted by how far it has closed, and the dock, the runtime, the chapter starts and the summary all read the same function, so they agree even mid-animation.",
  tools: ["Canvas 2D", "CSS Modules", "Bricolage Grotesque", "Literata"],
  // Flip to true when it is ready to enter the grid.
  published: true,
};

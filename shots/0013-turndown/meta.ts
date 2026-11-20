import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "0013",
  slug: "turndown",
  title: "Turndown",
  date: "2026-11-19",
  tags: ["ui", "motion"],
  aspect: "wide",
  target: "desktop",
  accent: "#f28f7a",
  note: "A housekeeping board drawn as the hotel's street elevation, with nothing beside it: 112 windows are the rooms, the staff board is the ground-floor shopfront, arrivals stand on a letterboard out front, and readiness is a sign on the roof next to the lift-tower clock. Each status change rolls a blind down in the room's new colour and pattern, carts ride the service lift on a scenario clock, and a room is assigned by dragging its window onto an attendant or pressing 1 to 6. The hard part was keeping the forecast honest while queues reorder for early check-ins and a cart reroutes partway up the lift shaft.",
  tools: ["SVG", "CSS Modules", "requestAnimationFrame"],
  // Flip to true when it is ready to enter the grid.
  published: true,
};

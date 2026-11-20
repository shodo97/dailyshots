/* Authored for this shot: 24 grid, 2.4 stroke, square caps. Heavy enough to
   survive a heat lamp and a glance from across the pass. */

const PATHS = {
  // A warning triangle with a bar and a dot, for allergies.
  allergy: "M12 3.2 22 20.5H2L12 3.2Z M12 9.5v5.2 M12 17.2v.4",
  // Hourglass: the ticket is ageing.
  glass: "M6 3h12 M6 21h12 M7.5 3c0 5 9 5.5 9 9s-9 4-9 9 M16.5 3c0 5-9 5.5-9 9s9 4 9 9",
  // A clock face with a bang: late.
  late: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z M12 7.5v5.5 M12 15.8v.4",
  // Flame, for a course that has been called away and wants firing.
  fire: "M12 21.5c-4 0-6.5-2.6-6.5-6.2 0-4.2 4-6 4.4-11.3 3.2 2.1 4.6 4.9 4.3 7.6 1-.6 1.7-1.6 2-2.9 1.6 1.8 2.3 4 2.3 6.4 0 3.8-2.5 6.4-6.5 6.4Z",
  recall: "M4.5 9.5h10a5 5 0 0 1 0 10H8 M8.5 5.2 4.2 9.5l4.3 4.3",
  left: "M15 4.5 7.5 12l7.5 7.5",
  right: "M9 4.5l7.5 7.5L9 19.5",
  // Ticket dropping off the rail.
  bump: "M12 3v12 M6.5 9.8 12 15.3l5.5-5.5 M4 20.5h16",
  check: "M4.5 12.5l5 5 10-11",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

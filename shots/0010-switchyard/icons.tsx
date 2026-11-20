/* One stroke family, drawn for this shot on a 16px grid at 1.6 weight. */

export type IconName =
  | "check"
  | "cross"
  | "delay"
  | "suspended"
  | "planned"
  | "retry"
  | "arrow"
  | "chevron"
  | "minus"
  | "lock";

const PATHS: Record<IconName, React.ReactNode> = {
  check: <path d="M3.5 8.4 6.6 11.4 12.5 4.8" />,
  cross: <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />,
  delay: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 4.9V8l2.2 1.5" />
    </>
  ),
  suspended: (
    <>
      <rect x="2.4" y="5.2" width="11.2" height="5.6" rx="1" />
      <path d="M5.6 5.2 3.4 10.8M9.6 5.2 7.4 10.8M13.4 5.6 11.4 10.8" />
    </>
  ),
  planned: (
    <>
      <rect x="2.6" y="3.6" width="10.8" height="9.8" rx="1.4" />
      <path d="M2.6 6.8h10.8M5.6 2.2v2.6M10.4 2.2v2.6" />
    </>
  ),
  retry: (
    <>
      <path d="M12.8 7.6A4.8 4.8 0 1 1 11 4.1" />
      <path d="M11.4 1.8 11.2 4.4 8.6 4.6" />
    </>
  ),
  arrow: <path d="M2.8 8h10.2M9.4 4.4 13 8l-3.6 3.6" />,
  chevron: <path d="M4.2 6.2 8 10l3.8-3.8" />,
  minus: <path d="M4.2 8h7.6" />,
  lock: (
    <>
      <rect x="3.2" y="7.2" width="9.6" height="6.4" rx="1.2" />
      <path d="M5.4 7.2V5.4a2.6 2.6 0 0 1 5.2 0v1.8" />
    </>
  ),
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

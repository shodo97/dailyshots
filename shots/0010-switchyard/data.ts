/* The atlas monorepo drawn as a network. Each pipeline is a line, each stage
   a station, and the shared release environments are interchanges. Times on
   this map run on a fixed scenario clock: Thursday 19 November 2026, starting
   14:06, replayed at 30× so a whole pipeline crosses the map in about 25s. */

import { buildTrack, lengthOf, type Pt, type Track } from "./track";

export type LineId = "web" | "api" | "workers" | "mobile" | "infra" | "docs";
export type Side = "n" | "s" | "e" | "w";
export type Kind = "origin" | "stop" | "interchange" | "terminus";
export type IxId = "registry" | "staging" | "canary" | "production";

/** Display seconds per real second. */
export const K = 30;
/** Track units per real second while a train is between stations. */
export const SPEED = 150;
/** Scenario clock at mount, in seconds since midnight (14:06:00). */
export const CLOCK0 = 14 * 3600 + 6 * 60;

export type StationDef = {
  id: string;
  name: string;
  at: Pt;
  side: Side;
  kind: Kind;
  /** Real seconds a train dwells here while the job runs. */
  dwell: number;
  ix?: IxId;
};

export type Station = StationDef & { len: number; line: LineId };

type LineDef = {
  id: LineId;
  name: string;
  color: string;
  /** Text colour that reads on the line colour. */
  ink: string;
  path: Pt[];
  radii: number[];
  stations: StationDef[];
  /** Station id a normal run ends at. */
  until: string;
  /** Where the monorepo filter points, used in logs. */
  scope: string;
};

export type Line = Omit<LineDef, "stations"> & { track: Track; stations: Station[] };

const st = (
  id: string,
  name: string,
  at: Pt,
  side: Side,
  dwell: number,
  kind: Kind = "stop",
  ix?: IxId,
): StationDef => ({ id, name, at, side, dwell, kind, ix });

// Shared trunk lanes, top to bottom, 9 units apart.
const Y_INFRA = 282;
const Y_WEB = 291;
const Y_API = 300;
const Y_WORK = 309;
const Y_MOB = 318;
export const IX_X: Record<IxId, number> = { registry: 600, staging: 720, canary: 840, production: 950 };
export const IX_NAME: Record<IxId, string> = {
  registry: "Artifact Registry",
  staging: "Staging",
  canary: "Canary",
  production: "Production",
};

const ix = (id: IxId, y: number, dwell: number, side: Side = "s") =>
  st(id, IX_NAME[id], [IX_X[id], y], side, dwell, id === "production" ? "terminus" : "interchange", id);

const DEFS: LineDef[] = [
  {
    id: "web",
    name: "web",
    color: "#dc241f",
    ink: "#fbfbf9",
    path: [[64, 90], [539, 90], [539, Y_WEB], [956, Y_WEB]],
    radii: [24, 16],
    until: "staging",
    scope: "apps/web packages/ui packages/config",
    stations: [
      st("checkout", "checkout", [88, 90], "n", 0.8, "origin"),
      st("install", "pnpm install", [160, 90], "n", 2.2),
      st("eslint", "eslint", [235, 90], "n", 1.4),
      st("typecheck", "typecheck", [310, 90], "n", 1.8),
      st("vitest", "vitest", [385, 90], "n", 3.2),
      st("build", "next build", [460, 90], "n", 4.0),
      ix("registry", Y_WEB, 1.0),
      ix("staging", Y_WEB, 2.6),
      ix("canary", Y_WEB, 1),
      ix("production", Y_WEB, 1),
    ],
  },
  {
    id: "api",
    name: "api",
    color: "#d6246e",
    ink: "#fbfbf9",
    path: [[64, 190], [530, 190], [530, Y_API], [956, Y_API]],
    radii: [20, 25],
    until: "staging",
    scope: "services/api pkg",
    stations: [
      st("checkout", "checkout", [88, 190], "n", 0.8, "origin"),
      st("gomod", "go mod", [160, 190], "n", 1.2),
      st("lint", "golangci-lint", [235, 190], "n", 2.0),
      st("test", "go test", [310, 190], "n", 3.6),
      st("docker", "docker build", [385, 190], "n", 2.6),
      st("integration", "integration", [460, 190], "n", 3.8),
      st("e2e", "e2e", [530, 244], "w", 5.0),
      ix("registry", Y_API, 1.0),
      ix("staging", Y_API, 2.6),
      ix("canary", Y_API, 1),
      ix("production", Y_API, 1),
    ],
  },
  {
    id: "workers",
    name: "workers",
    color: "#1d4f9e",
    ink: "#fbfbf9",
    path: [[64, 400], [560, 400], [560, Y_WORK], [956, Y_WORK]],
    radii: [20, 23],
    until: "staging",
    scope: "services/workers",
    stations: [
      st("checkout", "checkout", [88, 400], "s", 0.8, "origin"),
      st("install", "poetry install", [160, 400], "s", 1.8),
      st("ruff", "ruff", [235, 400], "s", 1.0),
      st("pytest", "pytest", [310, 400], "s", 3.0),
      st("image", "image build", [385, 400], "s", 4.4),
      st("contract", "contract tests", [460, 400], "s", 2.4),
      ix("registry", Y_WORK, 1.0),
      ix("staging", Y_WORK, 2.4),
      ix("canary", Y_WORK, 1),
      ix("production", Y_WORK, 1),
    ],
  },
  {
    id: "mobile",
    name: "mobile",
    color: "#00843d",
    ink: "#fbfbf9",
    path: [[64, 490], [569, 490], [569, Y_MOB], [632, Y_MOB], [712, 398], [800, 398]],
    radii: [20, 14, 22, 22],
    until: "testflight",
    scope: "apps/mobile packages/ui",
    stations: [
      st("checkout", "checkout", [88, 490], "n", 0.8, "origin"),
      st("install", "yarn install", [160, 490], "n", 2.4),
      st("tsc", "tsc", [235, 490], "n", 1.6),
      st("jest", "jest", [310, 490], "n", 2.6),
      st("ios", "xcodebuild", [385, 490], "n", 5.0),
      st("android", "gradle", [460, 490], "n", 4.0),
      st("detox", "detox", [526, 490], "n", 4.2),
      ix("registry", Y_MOB, 1.2),
      st("testflight", "TestFlight", [794, 398], "e", 2.0, "terminus"),
    ],
  },
  {
    id: "infra",
    name: "infra",
    color: "#c8930a",
    ink: "#141412",
    path: [[660, 54], [660, Y_INFRA], [956, Y_INFRA]],
    radii: [20],
    until: "staging",
    scope: "infra/terraform",
    stations: [
      st("checkout", "checkout", [660, 72], "e", 0.8, "origin"),
      st("fmt", "tf fmt", [660, 108], "e", 0.8),
      st("validate", "tf validate", [660, 140], "e", 1.0),
      st("plan", "tf plan", [660, 172], "e", 3.0),
      st("policy", "OPA policy", [660, 204], "e", 1.4),
      ix("staging", Y_INFRA, 3.2),
      ix("production", Y_INFRA, 1),
    ],
  },
  {
    id: "docs",
    name: "docs",
    color: "#8f5a2b",
    ink: "#fbfbf9",
    path: [[64, 568], [316, 568]],
    radii: [],
    until: "pages",
    scope: "docs",
    stations: [
      st("checkout", "checkout", [88, 568], "n", 0.8, "origin"),
      st("mdx", "mdx build", [160, 568], "n", 2.2),
      st("links", "link check", [235, 568], "n", 1.8),
      st("pages", "Pages", [310, 568], "e", 1.4, "terminus"),
    ],
  },
];

export const LINES: Line[] = DEFS.map((d) => {
  const track = buildTrack(d.path, d.radii);
  return {
    ...d,
    track,
    stations: d.stations.map((s) => ({ ...s, line: d.id, len: lengthOf(track, s.at) })),
  };
});

export const LINE: Record<LineId, Line> = Object.fromEntries(LINES.map((l) => [l.id, l])) as Record<
  LineId,
  Line
>;

export const stationIndex = (line: LineId, id: string) => LINE[line].stations.findIndex((s) => s.id === id);

/** Every interchange and the lanes that call there, for drawing the capsules. */
export const INTERCHANGES = (Object.keys(IX_X) as IxId[]).map((id) => {
  const ys = LINES.flatMap((l) => l.stations.filter((s) => s.ix === id).map((s) => s.at[1]));
  return { id, x: IX_X[id], y0: Math.min(...ys), y1: Math.max(...ys), name: IX_NAME[id] };
});

/* ── people and commits ───────────────────────────────────────────────── */

export type Commit = {
  sha: string;
  branch: string;
  message: string;
  author: string;
};

export const RELEASE = {
  name: "2026.47",
  previous: "2026.46",
  branch: "release/2026.47",
  commits: 38,
  cut: "11:40",
  canarySince: "13:28",
  previousLive: "Tue 17 Nov, 16:12",
};

/** The runs already on the map when the page opens, placed mid-route. */
export type Seed = Commit & {
  id: string;
  line: LineId;
  /** Station the train is at (or has just left) at t = 0. */
  at: string;
  /** Real seconds since it arrived there. Beyond the dwell means it is moving. */
  elapsed: number;
  fail?: { at: string; after: number; tests: number };
};

export const SEEDS: Seed[] = [
  {
    id: "r-api-4be1d07",
    line: "api",
    sha: "4be1d07",
    branch: RELEASE.branch,
    message: "Cherry-pick: retry idempotent captures on 409 (#4812)",
    author: "Priya Raman",
    at: "e2e",
    elapsed: 3.3,
    fail: { at: "e2e", after: 4.8, tests: 3 },
  },
  {
    id: "r-web-a91c3f2",
    line: "web",
    sha: "a91c3f2",
    branch: "main",
    message: "Move address autocomplete behind checkout.autocomplete",
    author: "Tomás Ferreira",
    at: "vitest",
    elapsed: 1.2,
  },
  {
    id: "r-web-b7e0c13",
    line: "web",
    sha: "b7e0c13",
    branch: "dependabot/npm/next-16.0.4",
    message: "Bump next from 16.0.3 to 16.0.4",
    author: "dependabot",
    at: "install",
    elapsed: 0.4,
  },
  {
    id: "r-workers-7d02e8b",
    line: "workers",
    sha: "7d02e8b",
    branch: "main",
    message: "Bump celery to 5.4.1 and pin kombu",
    author: "Ade Okafor",
    at: "image",
    elapsed: 1.6,
  },
  {
    id: "r-mobile-c5e19a0",
    line: "mobile",
    sha: "c5e19a0",
    branch: "main",
    message: "Fix deep-link crash when the order id contains a slash",
    author: "Hana Sato",
    at: "ios",
    elapsed: 2.2,
  },
  {
    id: "r-infra-0f6b2d4",
    line: "infra",
    sha: "0f6b2d4",
    branch: "main",
    message: "Raise staging RDS max_connections to 400",
    author: "Marek Nowak",
    at: "validate",
    elapsed: 1.3,
  },
];

/** Commits waiting behind the trains on each line, departing in order. */
export const QUEUE: Record<LineId, Commit[]> = {
  web: [
    { sha: "e4a1f90", branch: "main", message: "Fix focus trap in the refund confirmation sheet", author: "Lena Fischer" },
    { sha: "18c6b2a", branch: "main", message: "Drop the legacy /account/billing redirect", author: "Tomás Ferreira" },
    { sha: "6f3d8e7", branch: "main", message: "Lazy-load the order history charts", author: "Sam Whitfield" },
    { sha: "92ab0c4", branch: "main", message: "Announce cart total changes to screen readers", author: "Lena Fischer" },
    { sha: "c31e7a9", branch: "main", message: "Split checkout.tsx into address and payment steps", author: "Tomás Ferreira" },
  ],
  api: [
    { sha: "3c9f5a1", branch: "main", message: "Add a pagination cursor to /v2/disputes", author: "Sam Whitfield" },
    { sha: "7a0e2d6", branch: "main", message: "Log the idempotency key hash, not the key", author: "Priya Raman" },
    { sha: "d81f4b3", branch: "main", message: "Remove the deprecated /v1/charges handlers", author: "Sam Whitfield" },
  ],
  workers: [
    { sha: "2e6c1f9", branch: "main", message: "Batch webhook retries per merchant", author: "Ade Okafor" },
    { sha: "5b4a0d3", branch: "main", message: "Add dead-letter metrics to the payout worker", author: "Marek Nowak" },
    { sha: "f09d3b7", branch: "main", message: "Cap reconciliation batches at 5,000 rows", author: "Ade Okafor" },
  ],
  mobile: [
    { sha: "8e2b7d1", branch: "main", message: "Add haptics to the pay button", author: "Hana Sato" },
    { sha: "4f1c9a6", branch: "main", message: "Cache merchant logos for offline receipts", author: "Tomás Ferreira" },
  ],
  infra: [
    { sha: "a7d3e50", branch: "main", message: "Budget alert for the e2e runner pool", author: "Marek Nowak" },
    { sha: "1c8b4f2", branch: "main", message: "Scale image-build runners from 8 to 12", author: "Ade Okafor" },
    { sha: "b62e0d9", branch: "main", message: "Move staging Redis to cache.r7g.large", author: "Marek Nowak" },
  ],
  docs: [
    { sha: "e38a7b1", branch: "main", message: "Document pagination for /v2/refunds", author: "Lena Fischer" },
    { sha: "6d0a3c8", branch: "main", message: "Add the deploy-day runbook", author: "Ines Duarte" },
    { sha: "0b7f4e2", branch: "main", message: "Fix broken anchors in the webhooks guide", author: "Lena Fischer" },
  ],
};

/** Real seconds after mount that each quiet line's first queued commit departs. */
export const FIRST_DEPARTURE: Partial<Record<LineId, number>> = { docs: 3.2 };
/** Real seconds between a train finishing and the next one leaving the origin. */
export const HEADWAY = 2.4;

/** Runs that finished before the page opened. Durations in display seconds. */
export type Past = Commit & {
  id: string;
  line: LineId;
  status: "passed" | "cancelled";
  duration: number;
  /** Display clock when it started, seconds since midnight. */
  started: number;
};

const hm = (h: number, m: number) => h * 3600 + m * 60;

export const PAST: Past[] = [
  { id: "p1", line: "infra", sha: "d17c08e", branch: "main", message: "Rotate staging TLS certificates through ACM", author: "Marek Nowak", status: "passed", duration: 363, started: hm(13, 51) },
  { id: "p2", line: "api", sha: "5f7e210", branch: "main", message: "Add a pagination cursor to /v2/refunds", author: "Sam Whitfield", status: "passed", duration: 955, started: hm(13, 44) },
  { id: "p3", line: "mobile", sha: "3ab9d44", branch: "main", message: "Bump React Native to 0.79.2", author: "Hana Sato", status: "cancelled", duration: 130, started: hm(13, 39) },
  { id: "p4", line: "workers", sha: "91ab3c0", branch: "main", message: "Drop the legacy invoice backfill job", author: "Ade Okafor", status: "passed", duration: 702, started: hm(13, 22) },
  { id: "p5", line: "web", sha: "2c4d9e1", branch: RELEASE.branch, message: "Release 2026.47", author: "Ines Duarte", status: "passed", duration: 848, started: hm(11, 42) },
];

/** Standing notices on the status board, independent of any one run. */
export const NOTICES: Partial<Record<LineId, { status: "minor" | "planned"; text: string }>> = {
  workers: { status: "minor", text: "image builds queued ~6 min" },
  mobile: { status: "planned", text: "planned works 18:00–19:00" },
};

export const ORDER: LineId[] = ["web", "api", "workers", "mobile", "infra", "docs"];

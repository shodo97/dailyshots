import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SHOTS_DIR = path.join(process.cwd(), "shots");

/**
 * The registry is TypeScript, so rather than compile it we read each shot's
 * meta.ts and pull out the handful of fields the scripts actually need. Crude,
 * but it keeps the tooling dependency-free and the format is ours to control.
 */
function field(src, name) {
  const match = src.match(new RegExp(`${name}:\\s*"([^"]*)"`));
  return match?.[1];
}

export async function shotList() {
  const entries = await readdir(SHOTS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && /^\d{4}-/.test(e.name));

  const shots = [];
  for (const dir of dirs) {
    const src = await readFile(path.join(SHOTS_DIR, dir.name, "meta.ts"), "utf8");
    shots.push({
      n: field(src, "n") ?? dir.name.slice(0, 4),
      slug: field(src, "slug") ?? dir.name.slice(5),
      title: field(src, "title") ?? dir.name,
      aspect: field(src, "aspect") ?? "wide",
      target: field(src, "target") ?? "desktop",
      route: `/shots/${dir.name}`,
      dir: dir.name,
    });
  }
  return shots.sort((a, b) => a.n.localeCompare(b.n));
}

/** Poster dimensions follow the card's aspect so nothing is cropped away. */
export const VIEWPORTS = {
  wide: { width: 1600, height: 1000 },
  square: { width: 1200, height: 1200 },
  tall: { width: 1050, height: 1400 },
};

export async function resolveTargets(argv) {
  const all = await shotList();
  const picked = argv.filter((a) => /^\d{1,4}$/.test(a)).map((a) => a.padStart(4, "0"));
  if (picked.length === 0) return all;
  const found = all.filter((s) => picked.includes(s.n));
  const missing = picked.filter((p) => !found.some((s) => s.n === p));
  if (missing.length) throw new Error(`No shot found for: ${missing.join(", ")}`);
  return found;
}

export async function assertServer(base) {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    throw new Error(`Nothing answering at ${base}. Start it with \`pnpm dev\` first.`);
  }
}

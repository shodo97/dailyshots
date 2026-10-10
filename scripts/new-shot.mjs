#!/usr/bin/env node
/**
 * Scaffold tomorrow's shot.
 *   pnpm new-shot "Wallet onboarding"
 *   pnpm new-shot "Transit board" --tags=ui,motion --aspect=tall --target=mobile --accent=#7c5cff
 *
 * Creates the folder, the meta, a starter component with its own CSS module,
 * and registers it. Starts as a draft so it stays out of the grid until ready.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { shotList } from "./shot-list.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const title = argv.filter((a) => !a.startsWith("--")).join(" ").trim();
if (!title) {
  console.error('Give it a title:  pnpm new-shot "Wallet onboarding"');
  process.exit(1);
}

const tags = flag("tags", "ui,motion").split(",").map((t) => t.trim()).filter(Boolean);
const aspect = flag("aspect", "wide");
const target = flag("target", "desktop");
const accent = flag("accent", "#e9a23b");

if (!["wide", "square", "tall"].includes(aspect)) throw new Error(`aspect must be wide|square|tall`);
if (!["desktop", "mobile"].includes(target)) throw new Error(`target must be desktop|mobile`);

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const existing = await shotList();
const n = String(existing.length ? Math.max(...existing.map((s) => Number(s.n))) + 1 : 1).padStart(4, "0");
const dir = `${n}-${slug}`;
const abs = path.join(process.cwd(), "shots", dir);

await mkdir(abs, { recursive: true });

const pascal = slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const today = new Date().toISOString().slice(0, 10);

await writeFile(
  path.join(abs, "meta.ts"),
  `import type { ShotMeta } from "../types";

export const meta: ShotMeta = {
  n: "${n}",
  slug: "${slug}",
  title: "${title}",
  date: "${today}",
  tags: [${tags.map((t) => `"${t}"`).join(", ")}],
  aspect: "${aspect}",
  target: "${target}",
  accent: "${accent}",
  note: "TODO — one or two sentences: the idea, and the part that was hard.",
  tools: ["Motion"],
  // Flip to true when it is ready to enter the grid.
  published: false,
};
`,
);

await writeFile(
  path.join(abs, "shot.module.css"),
  `/* This shot's palette and type live here and nowhere else. Do not reach for
   the shell's tokens — the range between shots is the whole point. */
.root {
  --paper: #0b0b0e;
  --accent: ${accent};
  --bone: #f2f1ee;

  position: relative;
  min-height: 100dvh;
  background: var(--paper);
  color: var(--bone);
  font-family: var(--shot-sans);
  overflow: clip;
}

.stage {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 4.5rem;
}

.title {
  font-family: var(--shot-display);
  font-size: clamp(3rem, 9vw, 8rem);
  font-weight: 300;
  line-height: 0.9;
  letter-spacing: -0.03em;
}
`,
);

await writeFile(
  path.join(abs, "index.tsx"),
  `"use client";

import { Inter } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import s from "./shot.module.css";

// Pick type that belongs to THIS shot. Fontshare and Google both work via
// next/font — just do not reuse the shell's Geist.
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function ${pascal}() {
  const reduced = useReducedMotion();

  return (
    <div
      className={\`\${s.root} \${sans.variable}\`}
      style={{ "--shot-sans": "var(--font-inter)", "--shot-display": "var(--font-inter)" } as React.CSSProperties}
    >
      <section className={s.stage}>
        <motion.h1
          className={s.title}
          initial={reduced ? undefined : { opacity: 0, y: 24 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          ${title}
        </motion.h1>
      </section>
    </div>
  );
}
`,
);

// Register it.
const registryPath = path.join(process.cwd(), "shots", "registry.ts");
let registry = await readFile(registryPath, "utf8");
const ANCHOR = "  /* new-shot:anchor */";
if (!registry.includes(ANCHOR)) {
  throw new Error("Lost the new-shot anchor in shots/registry.ts — add it back.");
}
registry = registry
  .replace(
    'import type { ShotEntry } from "./types";',
    `import type { ShotEntry } from "./types";\nimport { meta as m${n} } from "./${dir}/meta";`,
  )
  .replace(ANCHOR, `  { meta: m${n}, load: () => import("./${dir}") },\n${ANCHOR}`);
await writeFile(registryPath, registry);

console.log(`
  ${n} — ${title}

  shots/${dir}/index.tsx
  shots/${dir}/shot.module.css
  shots/${dir}/meta.ts          draft, not in the grid yet

  → http://localhost:3000/shots/${dir}

  when it is done:
    pnpm shot:capture ${Number(n)}
    pnpm shot:record ${Number(n)}
    flip published: true in meta.ts
`);

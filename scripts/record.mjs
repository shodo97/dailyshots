#!/usr/bin/env node
/**
 * The hover loop for the gallery grid.
 *   pnpm shot:record 1                       # 4s, after a 1.5s warm-up
 *   pnpm shot:record 1 --duration=6 --warmup=2.5
 *   pnpm shot:record 1 --scroll              # drift down the page while recording
 *
 * Playwright starts recording the moment the context opens, so the warm-up is
 * trimmed afterwards with ffmpeg when it is available. Without ffmpeg you get
 * the untrimmed clip and a note saying so.
 */
import { mkdir, rename, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright";
import { assertServer, resolveTargets } from "./shot-list.mjs";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "previews");
const TMP = path.join(process.cwd(), ".shot-record");

const argv = process.argv.slice(2);
const num = (flag, fallback) =>
  Number(argv.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1] ?? fallback);

const duration = num("duration", 4);
const warmup = num("warmup", 1.5);
const scroll = argv.includes("--scroll");

await assertServer(BASE);
const targets = await resolveTargets(argv);
if (targets.length !== 1) {
  throw new Error("Record one shot at a time, e.g. `pnpm shot:record 1` — you art-direct these.");
}
const [shot] = targets;

await mkdir(OUT, { recursive: true });
await rm(TMP, { recursive: true, force: true });

const browser = await chromium.launch();
const size = { width: 1280, height: 800 };
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 1,
  colorScheme: "dark",
  recordVideo: { dir: TMP, size },
});

const page = await context.newPage();
await page.goto(BASE + shot.route, { waitUntil: "networkidle" });
await page.addStyleTag({ content: "[data-chrome]{display:none!important}" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(warmup * 1000);

if (scroll) {
  // A slow, even drift reads better in a 4-second loop than a real scroll would.
  const steps = Math.round(duration * 30);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 14);
    await page.waitForTimeout(1000 / 30);
  }
} else {
  // A drifting cursor wakes up hover and pointer-driven effects.
  const steps = Math.round(duration * 30);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      size.width * (0.3 + 0.4 * Math.sin(t * Math.PI * 2)),
      size.height * (0.4 + 0.2 * Math.cos(t * Math.PI * 2)),
    );
    await page.waitForTimeout(1000 / 30);
  }
}

await context.close();
await browser.close();

const [raw] = (await readdir(TMP)).filter((f) => f.endsWith(".webm"));
if (!raw) throw new Error("Playwright produced no video.");

const final = path.join(OUT, `${shot.n}.webm`);
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

if (hasFfmpeg) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-ss", String(warmup), "-i", path.join(TMP, raw), "-an", "-c:v", "libvpx-vp9",
     "-b:v", "900k", "-crf", "34", "-loop", "0", final],
    { stdio: "ignore" },
  );
  if (r.status !== 0) throw new Error("ffmpeg failed — re-run after checking your install.");
  console.log(`  ${shot.n}  trimmed + encoded → public/previews/${shot.n}.webm`);
} else {
  await rename(path.join(TMP, raw), final);
  console.log(`  ${shot.n}  → public/previews/${shot.n}.webm`);
  console.log(`  note: ffmpeg not found, so the ${warmup}s warm-up is still in the clip.`);
  console.log(`        \`brew install ffmpeg\` to get trimming and smaller files.`);
}

await rm(TMP, { recursive: true, force: true });

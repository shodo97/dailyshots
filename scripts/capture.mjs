#!/usr/bin/env node
/**
 * Poster frames for the gallery grid.
 *   pnpm shot:capture            # every shot
 *   pnpm shot:capture 1 4        # just 0001 and 0004
 * Needs `pnpm dev` running.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { assertServer, resolveTargets, VIEWPORTS } from "./shot-list.mjs";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "posters");

const argv = process.argv.slice(2);
const settle = Number(argv.find((a) => a.startsWith("--settle="))?.split("=")[1] ?? 2600);

await assertServer(BASE);
const targets = await resolveTargets(argv);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

for (const shot of targets) {
  const viewport = VIEWPORTS[shot.aspect] ?? VIEWPORTS.wide;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1.5,
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  await page.goto(BASE + shot.route, { waitUntil: "networkidle" });
  // The chrome is navigation, not design — it has no place in the poster.
  await page.addStyleTag({ content: "[data-chrome]{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  // Let entrance animations finish before the shutter.
  await page.waitForTimeout(settle);

  const png = await page.screenshot({ type: "png", animations: "disabled" });
  const file = path.join(OUT, `${shot.n}.webp`);
  await writeFile(file, await sharp(png).webp({ quality: 82, effort: 5 }).toBuffer());

  console.log(`  ${shot.n}  ${shot.title.padEnd(24)} ${viewport.width}×${viewport.height} → public/posters/${shot.n}.webp`);
  await context.close();
}

await browser.close();
console.log(`\n${targets.length} poster${targets.length === 1 ? "" : "s"} captured.`);

import { assetsFor } from "@/lib/assets";
import { publishedShots } from "@/shots";
import { posterSrc, previewSrc, shotHref } from "@/shots/types";

/**
 * Public feed of the published grid, newest first. The portfolio reads this to
 * show the latest shots without importing any shot code. Paths are
 * root-relative; consumers resolve them against this site's origin.
 *
 * Built once per deploy — a new shot reaches the feed when it ships.
 */
export const dynamic = "force-static";

export function GET() {
  const shots = publishedShots.map(({ meta }) => {
    const { hasPoster, hasPreview } = assetsFor(meta);
    return {
      n: meta.n,
      title: meta.title,
      date: meta.date,
      tags: meta.tags,
      aspect: meta.aspect,
      target: meta.target,
      accent: meta.accent,
      href: shotHref(meta),
      poster: hasPoster ? posterSrc(meta) : null,
      preview: hasPreview ? previewSrc(meta) : null,
    };
  });

  return Response.json(
    { version: 1, count: shots.length, shots },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

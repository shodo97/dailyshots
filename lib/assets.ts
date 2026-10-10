import { existsSync } from "node:fs";
import path from "node:path";
import type { ShotMeta } from "@/shots/types";

/**
 * Posters and loops are generated artefacts, so a shot can exist before they
 * do. Resolving that on the server means the card renders a deliberate
 * placeholder instead of a broken image — a client-side onError fires too late,
 * after the browser has already painted the broken state.
 */
export function assetsFor(meta: ShotMeta) {
  const pub = (p: string) => path.join(process.cwd(), "public", p);
  return {
    hasPoster: existsSync(pub(`posters/${meta.n}.webp`)),
    hasPreview: existsSync(pub(`previews/${meta.n}.webm`)),
  };
}

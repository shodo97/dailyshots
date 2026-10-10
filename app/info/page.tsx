import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { publishedShots } from "@/shots";

export const metadata: Metadata = { title: "Info" };

export default function Info() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-10 md:px-10 md:py-14">
      <Link
        href="/"
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint transition-colors hover:text-bone"
      >
        <span aria-hidden>←</span> index
      </Link>

      <h1 className="mt-24 font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">
        {site.tagline}
      </h1>

      <div className="mt-12 space-y-6 text-[15px] leading-[1.7] text-bone-dim">
        <p>
          A daily practice. Every day I design and build one interface from
          scratch — product UI, editorial layout, WebGL, whatever the idea asks
          for. No templates, no shared component library between pieces. Each
          one gets its own palette, its own typography, its own motion.
        </p>
        <p>
          Everything here is built for a desktop canvas and designed to move,
          so it is best seen on a large screen. Mobile-first ideas are presented
          inside a device frame rather than stretched to fit.
        </p>
        <p>
          {publishedShots.length} shot
          {publishedShots.length === 1 ? "" : "s"} so far. The source is{" "}
          <a
            href={site.links.github}
            target="_blank"
            rel="noreferrer"
            className="text-bone underline decoration-hairline-strong underline-offset-4 transition-colors hover:decoration-bone"
          >
            on GitHub
          </a>
          .
        </p>
      </div>

      <p className="mt-16 border-t border-hairline pt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint">
        {site.name}
      </p>
    </main>
  );
}

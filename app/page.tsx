import Link from "next/link";
import { Gallery } from "@/components/shell/Gallery";
import { assetsFor } from "@/lib/assets";
import { site } from "@/config/site";
import { activeTags, publishedShots } from "@/shots";
import { TAGS } from "@/shots/types";

export default function Home() {
  const metas = publishedShots.map((s) => s.meta);
  const cards = metas.map((meta) => ({ meta, ...assetsFor(meta) }));
  const since = metas.at(-1)?.date;

  return (
    <main className="mx-auto w-full max-w-[1480px] px-6 pb-32 md:px-10">
      <header className="pt-10 md:pt-14">
        <nav className="flex items-baseline justify-between">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone transition-opacity hover:opacity-60"
          >
            {site.name}
          </Link>
          <div className="flex items-baseline gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint">
            <Link href="/info" className="transition-colors hover:text-bone">
              info
            </Link>
            <a
              href={site.links.github}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-bone"
            >
              github <span aria-hidden>↗</span>
            </a>
          </div>
        </nav>

        <h1 className="mt-20 max-w-[16ch] font-display text-[clamp(2.75rem,7.5vw,7rem)] leading-[0.92] tracking-[-0.02em] md:mt-28">
          One interface,
          <br />
          <span className="italic text-bone-dim">every day.</span>
        </h1>

        <p className="mt-10 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint md:mt-14">
          <span className="tnum text-bone-dim">
            {String(metas.length).padStart(3, "0")} shots
          </span>
          {since && (
            <>
              <span aria-hidden>·</span>
              <span className="tnum">
                since{" "}
                {new Date(since)
                  .toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                  .toUpperCase()}
              </span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>designed &amp; built from scratch</span>
        </p>
      </header>

      <section className="mt-16 md:mt-24">
        <Gallery cards={cards} tags={activeTags(TAGS)} />
      </section>
    </main>
  );
}

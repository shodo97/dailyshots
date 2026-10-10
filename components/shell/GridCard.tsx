"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { posterSrc, previewSrc, shotHref, type ShotMeta } from "@/shots/types";

/** The grid item is the wrapper in Gallery, not this Link, so the span lives
 *  there — a `display: contents` wrapper cannot be animated. */
export const spanFor = (aspect: ShotMeta["aspect"]) =>
  aspect === "wide" ? "col-span-12 md:col-span-8" : "col-span-6 md:col-span-4";

const RATIO: Record<ShotMeta["aspect"], string> = {
  wide: "16 / 10",
  square: "1 / 1",
  tall: "3 / 4",
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();

export type Card = { meta: ShotMeta; hasPoster: boolean; hasPreview: boolean };

export function GridCard({ meta, hasPoster, hasPreview }: Card) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function enter() {
    video.current?.play().catch(() => {
      /* autoplay refusal is not worth surfacing */
    });
  }

  function leave() {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }

  return (
    <Link
      href={shotHref(meta)}
      onMouseEnter={hasPreview ? enter : undefined}
      onMouseLeave={hasPreview ? leave : undefined}
      style={{ ["--accent" as string]: meta.accent }}
      className="group block"
    >
      <figure
        style={{ aspectRatio: RATIO[meta.aspect] }}
        className="relative overflow-hidden rounded-[14px] border border-hairline bg-ink-raised
                   transition-[transform,border-color,box-shadow] duration-500 ease-out-quint
                   group-hover:-translate-y-1 group-hover:border-[var(--accent)]
                   group-hover:shadow-[0_24px_60px_-28px_var(--accent)]"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 120% at 20% 0%, ${meta.accent}2e 0%, transparent 60%)`,
          }}
        />

        {hasPoster ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={posterSrc(meta)}
            alt={meta.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-opacity duration-500"
            style={{ opacity: playing ? 0 : 1 }}
          />
        ) : (
          /* No poster captured yet — read as a plate waiting to be exposed. */
          <div className="absolute inset-0 grid place-items-center">
            <span className="tnum font-display text-[clamp(2rem,6vw,4.5rem)] text-bone/10">
              {meta.n}
            </span>
          </div>
        )}

        {hasPreview && (
          <video
            ref={video}
            src={previewSrc(meta)}
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity
                       duration-500 group-hover:opacity-100"
          />
        )}

        {/* Keeps light posters from blowing out against the dark shell. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent
                     opacity-70 transition-opacity duration-500 group-hover:opacity-0"
        />

        {meta.target === "mobile" && (
          <span
            className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/40 px-2 py-0.5
                       font-mono text-[9px] tracking-[0.14em] text-bone/70 backdrop-blur-sm"
          >
            MOBILE
          </span>
        )}
      </figure>

      <figcaption className="mt-3.5 flex items-baseline gap-3">
        <span className="tnum font-mono text-[11px] text-bone-faint transition-colors duration-300 group-hover:text-[var(--accent)]">
          {meta.n}
        </span>
        <span className="flex-1 truncate text-[13.5px] text-bone-dim transition-colors duration-300 group-hover:text-bone">
          {meta.title}
        </span>
        <span className="tnum font-mono text-[10px] tracking-[0.1em] text-bone-faint">
          {shortDate(meta.date)}
        </span>
      </figcaption>
    </Link>
  );
}

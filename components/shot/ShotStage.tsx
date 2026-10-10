"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { ShotMeta } from "@/shots/types";

type Viewport = "unknown" | "wide" | "narrow";

/**
 * Shots are designed for a desktop canvas, so anything narrower gets a crafted
 * notice instead of a squashed design. The gate runs in JS rather than CSS so a
 * hidden WebGL scene never mounts and drains a phone battery.
 */
export function ShotStage({ meta, children }: { meta: ShotMeta; children: ReactNode }) {
  const [viewport, setViewport] = useState<Viewport>("unknown");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setViewport(mq.matches ? "wide" : "narrow");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // A mobile-target shot is presented in a frame, so the page itself must not
  // scroll — the frame scrolls instead.
  useEffect(() => {
    if (viewport !== "wide" || meta.target !== "mobile") return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [viewport, meta.target]);

  // Matches the shell background, so settling on the real answer reads as a
  // load rather than a flash.
  if (viewport === "unknown") return <div className="fixed inset-0 bg-ink" />;

  if (viewport === "narrow") return <TooNarrow meta={meta} />;

  if (meta.target === "mobile") {
    return (
      <div
        className="relative grid h-dvh place-items-center overflow-hidden bg-ink"
        style={{
          backgroundImage: `radial-gradient(110% 80% at 50% 0%, ${meta.accent}26 0%, transparent 62%)`,
        }}
      >
        <div
          className="relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-black
                     shadow-[0_60px_140px_-50px_rgba(0,0,0,0.9)]"
          style={{ width: 390, height: "min(844px, 86dvh)" }}
        >
          <div className="size-full overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function TooNarrow({ meta }: { meta: ShotMeta }) {
  return (
    <main className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <span className="tnum font-mono text-[11px] tracking-[0.18em] text-bone-faint">
          {meta.n}
        </span>
        <h1 className="mt-5 font-display text-[2rem] leading-[1.1] tracking-[-0.01em]">
          {meta.title}
        </h1>
        <p className="mx-auto mt-6 max-w-[26ch] text-[14px] leading-[1.65] text-bone-dim">
          This one was built for a bigger screen. Open it on a desktop and it
          will be worth the wait.
        </p>
        <Link
          href="/"
          className="mt-10 inline-block rounded-full border border-hairline-strong px-5 py-2.5
                     font-mono text-[10px] uppercase tracking-[0.16em] text-bone-dim
                     transition-colors hover:border-bone hover:text-bone"
        >
          <span aria-hidden>←</span> back to the index
        </Link>
      </div>
    </main>
  );
}

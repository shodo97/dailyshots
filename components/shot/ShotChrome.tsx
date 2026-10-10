"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { shotHref, type ShotMeta } from "@/shots/types";

const IDLE_MS = 2600;

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export function ShotChrome({
  meta,
  prev,
  next,
}: {
  meta: ShotMeta;
  prev?: ShotMeta;
  next?: ShotMeta;
}) {
  const [open, setOpen] = useState(false);
  const [awake, setAwake] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAwake(false), IDLE_MS);
  }, []);

  useEffect(() => {
    wake();
    window.addEventListener("pointermove", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      clearTimeout(timer.current);
    };
  }, [wake]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never steal keys from a shot that is taking text input.
      const el = document.activeElement;
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) {
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // While the panel is open the chrome stays put regardless of idle.
  const shown = awake || open;

  return (
    <>
      <div
        data-chrome
        className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden items-center justify-between lg:flex
                   p-5 transition-opacity duration-500 md:p-7"
        style={{ opacity: shown ? 1 : 0 }}
      >
        <Link
          href="/"
          className="pointer-events-auto rounded-full border border-white/12 bg-black/35 px-3.5 py-1.5
                     font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 backdrop-blur-md
                     transition-colors hover:border-white/30 hover:text-white"
        >
          <span aria-hidden>←</span> index
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="pointer-events-auto rounded-full border border-white/12 bg-black/35 px-3.5 py-1.5
                     font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 backdrop-blur-md
                     transition-colors hover:border-white/30 hover:text-white"
        >
          <span className="tnum">{meta.n}</span>
          <span aria-hidden className="mx-2 text-white/25">
            |
          </span>
          info
        </button>
      </div>

      <aside
        data-chrome
        aria-hidden={!open}
        style={{ ["--accent" as string]: meta.accent }}
        className={`fixed right-0 top-0 z-50 hidden h-dvh w-[min(23rem,88vw)] flex-col justify-between lg:flex
                    border-l border-white/10 bg-black/70 p-7 backdrop-blur-2xl
                    transition-transform duration-[650ms] ease-out-quint
                    ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
      >
        <div>
          <div className="flex items-start justify-between">
            <span className="tnum font-mono text-[11px] tracking-[0.16em] text-[var(--accent)]">
              {meta.n}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition-colors hover:text-white"
            >
              close
            </button>
          </div>

          <h2 className="mt-7 font-display text-[1.9rem] leading-[1.1] tracking-[-0.01em] text-white">
            {meta.title}
          </h2>
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            {longDate(meta.date)}
          </p>

          <p className="mt-8 text-[13.5px] leading-[1.65] text-white/60">{meta.note}</p>

          <ul className="mt-8 flex flex-wrap gap-1.5">
            {meta.tools.map((tool) => (
              <li
                key={tool}
                className="rounded-full border border-white/12 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/45"
              >
                {tool}
              </li>
            ))}
          </ul>
        </div>

        <nav className="flex items-center justify-between border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.14em]">
          {prev ? (
            <Link href={shotHref(prev)} className="text-white/45 transition-colors hover:text-white">
              <span aria-hidden>←</span> <span className="tnum">{prev.n}</span>
            </Link>
          ) : (
            <span className="text-white/15">
              <span aria-hidden>←</span> start
            </span>
          )}
          {next ? (
            <Link href={shotHref(next)} className="text-white/45 transition-colors hover:text-white">
              <span className="tnum">{next.n}</span> <span aria-hidden>→</span>
            </Link>
          ) : (
            <span className="text-white/15">
              latest <span aria-hidden>→</span>
            </span>
          )}
        </nav>
      </aside>
    </>
  );
}

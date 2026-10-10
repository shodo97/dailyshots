"use client";

import { useMemo, useState } from "react";
import { GridCard, spanFor, type Card } from "./GridCard";
import { TAGS, type Tag } from "@/shots/types";

type Filter = Tag | "all";

export function Gallery({ cards, tags }: { cards: Card[]; tags: Tag[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? cards : cards.filter((c) => c.meta.tags.includes(filter))),
    [cards, filter],
  );

  const options: Filter[] = ["all", ...TAGS.filter((t) => tags.includes(t))];

  return (
    <>
      <div className="mb-10 flex items-center gap-1.5 border-t border-hairline pt-5">
        {options.map((option) => {
          const active = option === filter;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]
                          transition-colors duration-300 ${
                            active
                              ? "bg-bone text-ink"
                              : "text-bone-faint hover:text-bone-dim"
                          }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Keyed on the filter so the set re-enters with a stagger instead of
          snapping. Cheaper and calmer than animating layout. */}
      <div
        key={filter}
        className="grid grid-cols-12 gap-x-5 gap-y-14 [grid-auto-flow:dense] md:gap-x-6"
      >
        {visible.map((card, i) => (
          <div
            key={card.meta.n}
            className={`shell-rise ${spanFor(card.meta.aspect)}`}
            style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
          >
            <GridCard {...card} />
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="py-24 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint">
          nothing tagged {filter} yet
        </p>
      )}
    </>
  );
}

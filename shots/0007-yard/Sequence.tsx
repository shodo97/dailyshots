"use client";

import { useEffect, useRef } from "react";
import { MOVES, OPS, PHASE_LABEL, TOTAL, tonnes, type PhaseKind } from "./data";
import { Icon, MarkChip } from "./icons";
import s from "./shot.module.css";

type Props = {
  m: number;
  phaseKind: PhaseKind | "done";
  rhIndex: number;
  selectedId: string | null;
  onPick: (id: string) => void;
  reduced: boolean;
};

export function Sequence({ m, phaseKind, rhIndex, selectedId, onPick, reduced }: Props) {
  const scroller = useRef<HTMLOListElement>(null);
  const touched = useRef(-Infinity);

  // Keep the live move a few rows from the top, unless the planner is reading the list.
  useEffect(() => {
    const el = scroller.current;
    if (!el || performance.now() - touched.current < 4000) return;
    // Land on a row boundary, three moves of history above the live one.
    const row = el.querySelector<HTMLElement>(`[data-n="${Math.max(0, Math.min(m, TOTAL - 1) - 3)}"]`);
    if (!row) return;
    const top = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }, [m, reduced]);

  return (
    <div className={s.seq}>
      <div className={s.seqHead} aria-hidden>
        <span>#</span>
        <span>Container</span>
        <span>From</span>
        <span>To</span>
        <span className={s.num}>t</span>
        <span>POD</span>
      </div>
      <ol
        ref={scroller}
        className={s.seqList}
        aria-label="Load sequence, bay 34 deck"
        onPointerMove={() => (touched.current = performance.now())}
        onWheel={() => (touched.current = performance.now())}
      >
        {MOVES.map((mv, i) => {
          const state = i < m ? "done" : i === m ? "active" : "queued";
          const phase =
            state === "active" && phaseKind !== "done"
              ? phaseKind === "rehandle"
                ? `Rehandle ${rhIndex + 1} of ${mv.rehandles.length} · ${mv.rehandles[rhIndex]?.box.owner} to row ${mv.rehandles[rhIndex]?.to.slice(-2)}`
                : phaseKind === "haul"
                  ? `${PHASE_LABEL.haul} · ${mv.truck}`
                  : phaseKind === "travel"
                    ? `RMG ${mv.block} travelling to bay ${mv.from.split("-")[1]}`
                    : phaseKind === "lift"
                      ? `RMG ${mv.block} lifting · ${mv.truck} under`
                      : PHASE_LABEL[phaseKind]
              : null;
          return (
            <li key={mv.n} data-n={i} className={s.seqItem}>
              <button
                type="button"
                className={s.seqRow}
                data-state={state}
                aria-current={state === "active" ? "step" : undefined}
                aria-pressed={selectedId === mv.box.id}
                onClick={() => onPick(mv.box.id)}
              >
                <span className={s.seqN}>
                  {state === "done" ? <Icon name="check" className={s.seqCheck} /> : mv.n}
                </span>
                <span className={s.seqId}>
                  <i className={s.swatch} style={{ background: OPS[mv.box.op].paint }} aria-hidden />
                  {mv.box.owner} {mv.box.serial}
                  <b>{mv.box.check}</b>
                  <span className={s.seqMarks}>
                    {mv.box.reefer && <MarkChip kind="reefer" />}
                    {mv.box.imdg && <MarkChip kind="imdg" cls={mv.box.imdg.cls} />}
                    {mv.box.ow && <MarkChip kind="ow" />}
                  </span>
                </span>
                <span className={s.seqFrom}>{mv.from}</span>
                <span className={s.seqTo}>{mv.toLabel}</span>
                <span className={s.num}>{tonnes(mv.box.vgm)}</span>
                <span className={s.seqPod}>{mv.box.pod}</span>
                {(phase || (mv.rehandles.length > 0 && state !== "done")) && (
                  <span className={s.seqSub}>
                    {phase && <span className={s.seqPhase}>{phase}</span>}
                    {mv.rehandles.length > 0 && state !== "done" && (
                      <span className={s.rhChip}>
                        <Icon name="warn" className={s.rhIcon} />
                        {mv.rehandles.length} rehandle{mv.rehandles.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

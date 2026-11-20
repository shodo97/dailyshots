"use client";

import { useEffect, useRef } from "react";
import { K, LINE, RELEASE, type LineId } from "./data";
import { locate, visit, type Run, type Visit, type Yard } from "./sim";
import { logFor, type LogLine } from "./logs";
import { clockAt, dur, hhmmss, timer } from "./format";
import { Icon } from "./icons";
import type { Sel } from "./Map";
import s from "./shot.module.css";

/** The run whose work at this station is most worth reading right now. */
export function pickRun(yard: Yard, line: LineId, idx: number, t: number): { run: Run; v: Visit } | null {
  let best: { run: Run; v: Visit; rank: number; key: number } | null = null;
  for (const run of yard.runs) {
    if (run.line !== line) continue;
    const v = visit(run, idx, t);
    if (!v) continue;
    let rank = 0;
    let key = 0;
    if (v.state === "running" || v.state === "failed") {
      rank = 4;
      key = v.start;
    } else if (v.state === "passed") {
      rank = 3;
      key = v.end;
    } else if (v.state === "blocked") {
      rank = 2;
    } else if (v.state === "pending") {
      rank = 1;
      key = -v.eta;
    }
    if (!best || rank > best.rank || (rank === best.rank && key > best.key)) best = { run, v, rank, key };
  }
  return best ? { run: best.run, v: best.v } : null;
}

type Props = {
  t: number;
  yard: Yard;
  selected: Sel;
  selectAt: number;
  promoted: boolean;
  reduced: boolean;
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
};

const STREAM = 42; // lines per second when replaying a finished log

export function Drawer({ t, yard, selected, selectAt, promoted, reduced, open, onToggle, onRetry }: Props) {
  const line = LINE[selected.line];
  const st = line.stations[selected.idx];
  const isRelease = st.id === "canary" || st.id === "production";
  const pick = isRelease ? null : pickRun(yard, selected.line, selected.idx, t);

  let lines: LogLine[] = [];
  let shown = 0;
  let start = 0;
  let end = 0;
  let empty: string | null = null;
  let badge: { tone: string; text: string } = { tone: "idle", text: "" };
  let meta = "";
  let canRetry = false;

  if (isRelease) {
    const log = logFor(
      { line: selected.line, station: st.id, sha: "", branch: RELEASE.branch, message: "", attempt: 1, failed: false },
      promoted,
    );
    lines = [...log.body, ...log.tail];
    shown = reduced ? lines.length : Math.min(lines.length, Math.floor((t - selectAt) * STREAM) + 1);
    start = end = t;
    const name = st.id === "canary" ? (promoted ? null : RELEASE.name) : promoted ? RELEASE.name : RELEASE.previous;
    meta = name ? `Release ${name}` : "Empty since promotion";
    badge = st.id === "canary" && !promoted ? { tone: "ok", text: "Healthy · 10% of traffic" } : { tone: "ok", text: "Serving 100%" };
    if (st.id === "canary" && promoted) {
      lines = [];
      empty = `${RELEASE.name} left Canary for Production. The next release candidate will be cut on Monday.`;
      badge = { tone: "idle", text: "Empty" };
    }
  } else if (!pick) {
    empty = `No run calls at ${st.name} on the ${line.name} line yet today.`;
  } else {
    const { run, v } = pick;
    const loc = locate(run, t);
    meta = `${run.sha} · ${run.branch}${run.attempt > 1 && st.id === "e2e" ? ` · attempt ${run.attempt}` : ""}`;
    if (v.state === "pending") {
      const stopsAway = Math.max(1, selected.idx - ("i" in loc ? loc.i : 0));
      empty = `${run.sha} has not reached ${st.name}. It is ${stopsAway} ${stopsAway === 1 ? "stop" : "stops"} away, due in about ${dur(v.eta * K)}.`;
      badge = { tone: "idle", text: "Waiting" };
    } else if (v.state === "blocked") {
      empty = `${run.sha} is halted at e2e. Nothing runs at ${st.name} until e2e passes.`;
      badge = { tone: "bad", text: "Not reached" };
    } else {
      const failed = v.state === "failed";
      const log = logFor(
        {
          line: run.line,
          station: st.id,
          sha: run.sha,
          branch: run.branch,
          message: run.message,
          attempt: st.id === "e2e" ? run.attempt : 1,
          failed,
          tests: run.tests,
        },
        promoted,
      );
      lines = [...log.body, ...log.tail];
      start = v.start;
      end = v.end;
      if (v.state === "running") {
        shown = Math.max(1, Math.ceil(v.progress * log.body.length));
        badge = { tone: "run", text: `Running ${timer((t - v.start) * K)}` };
      } else {
        const watched = selectAt <= v.end;
        const settled = watched ? log.body.length + Math.floor((t - v.end) * 14) : Math.floor((t - selectAt) * STREAM) + 1;
        shown = reduced ? lines.length : Math.min(lines.length, settled);
        badge = failed
          ? { tone: "bad", text: `Failed after ${dur((v.end - v.start) * K)}` }
          : { tone: "ok", text: `Passed in ${dur((v.end - v.start) * K)}` };
        canRetry = failed && loc.phase === "failed";
      }
    }
  }

  const bodyRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const key = `${selected.line}:${selected.idx}:${selectAt}`;
  useEffect(() => {
    stick.current = true;
  }, [key]);
  useEffect(() => {
    const el = bodyRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown, key]);

  const span = Math.max(1, end - start) * K;
  const t0 = clockAt(start);
  const streaming = shown < lines.length && !empty;

  return (
    <section className={s.drawer} data-open={open ? "" : undefined} aria-label="Job log" inert={!open}>
      <header className={s.drawerHead}>
        <span className={s.drawerLine} style={{ background: line.color, color: line.ink }}>
          {line.name}
        </span>
        <h2 className={s.drawerTitle}>{st.name}</h2>
        {meta && <span className={`${s.drawerMeta} ${s.mono}`}>{meta}</span>}
        {badge.text && (
          <span className={s.badge} data-tone={badge.tone}>
            {badge.tone === "run" && <span className={s.liveDot} />}
            {badge.tone === "bad" && <Icon name="cross" size={13} />}
            {badge.tone === "ok" && <Icon name="check" size={13} />}
            <span className={s.num}>{badge.text}</span>
          </span>
        )}
        <span className={s.drawerSpacer} />
        {canRetry && (
          <button type="button" className={s.retry} onClick={onRetry}>
            <Icon name="retry" size={15} />
            Retry from {st.name}
          </button>
        )}
        <button
          type="button"
          className={s.drawerToggle}
          onClick={onToggle}
          aria-label="Close job log"
          title="Close (Esc)"
        >
          <Icon name="cross" size={16} />
        </button>
      </header>
      {empty ? (
        <p className={s.drawerEmpty}>{empty}</p>
      ) : (
        <ol
          ref={bodyRef}
          className={s.log}
          tabIndex={0}
          aria-label={`${line.name} ${st.name} log`}
          aria-busy={streaming}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {lines.slice(0, shown).map((ln, i) => (
            <li key={i} data-tone={ln.tone}>
              <span className={s.ln}>{i + 1}</span>
              <span className={s.ts}>{hhmmss(t0 + ((i + 1) / (lines.length + 1)) * span)}</span>
              <span className={s.tx}>{ln.text || " "}</span>
            </li>
          ))}
          {(streaming || badge.tone === "run") && (
            <li className={s.cursorRow} aria-hidden="true">
              <span className={s.ln} />
              <span className={s.ts} />
              <span className={s.cursor} />
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

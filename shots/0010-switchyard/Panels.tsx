"use client";

import { memo, type CSSProperties } from "react";
import { CLOCK0, K, LINE, NOTICES, ORDER, PAST, RELEASE, type LineId } from "./data";
import { locate, statusOf, type Run, type RunStatus, type Yard } from "./sim";
import { clockAt, dur, hhmm, timer } from "./format";
import { Icon, type IconName } from "./icons";
import s from "./shot.module.css";

export type Promo = { phase: "idle" | "confirm" | "rolling" | "done"; at: number };
export type Gate = { state: "running" | "failed" | "retrying" | "travelling" | "green"; where: string };

export type BoardRow = {
  line: LineId;
  status: "good" | "minor" | "suspended";
  label: string;
  detail?: string;
  planned?: boolean;
};

export const ROLL = { move: 4.2, done: 5.4 };
const STEPS = [10, 25, 50, 100];

export function rolloutPct(promo: Promo, t: number) {
  if (promo.phase === "done") return 100;
  if (promo.phase !== "rolling") return 10;
  const e = t - promo.at;
  return e < 1.2 ? 10 : e < 2.6 ? 25 : e < 4.0 ? 50 : 100;
}

/* ── release gate ─────────────────────────────────────────────────────── */

function Rollout({ frac }: { frac: number }) {
  const x0 = 8;
  const x1 = 352;
  const xs = [0, 1 / 3, 2 / 3, 1].map((k) => x0 + (x1 - x0) * k);
  const xm = x0 + (x1 - x0) * frac;
  return (
    <svg className={s.rollout} viewBox="0 0 360 40" aria-hidden="true">
      <line x1={x0} x2={x1} y1={12} y2={12} stroke="#d4d2ca" strokeWidth={5} />
      <line x1={x0} x2={xm} y1={12} y2={12} stroke="#141412" strokeWidth={5} />
      {xs.map((x, i) => (
        <g key={i}>
          <line x1={x} x2={x} y1={15} y2={19} stroke={x <= xm + 0.5 ? "#141412" : "#d4d2ca"} strokeWidth={2.6} />
          <text
            className={s.rolloutLabel}
            x={x}
            y={33}
            textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}
            data-on={x <= xm + 0.5 ? "" : undefined}
          >
            {STEPS[i]}%
          </text>
        </g>
      ))}
      <circle cx={xm} cy={12} r={6.5} fill="#fbfbf9" stroke="#141412" strokeWidth={2.6} />
    </svg>
  );
}

type ReleaseProps = {
  t: number;
  gate: Gate;
  promo: Promo;
  frac: number;
  onPromote: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export const ReleaseGate = memo(function ReleaseGate({ t, gate, promo, frac, onPromote, onConfirm, onCancel, onRetry }: ReleaseProps) {
  const err = 0.21 + 0.03 * Math.sin(t * 0.9) + 0.015 * Math.sin(t * 2.3);
  const p99 = 184 + 8 * Math.sin(t * 0.7) + 4 * Math.sin(t * 1.9);
  const green = gate.state === "green";
  const pct = rolloutPct(promo, t);
  const live = promo.phase === "done";
  const where = live ? "Production" : promo.phase === "rolling" ? "Rolling out" : "Canary";

  const buildsCheck: { icon: IconName; tone: string; name: string; value: string } =
    gate.state === "failed"
      ? { icon: "cross", tone: "bad", name: "api e2e", value: "3 tests failed" }
      : gate.state === "green"
        ? { icon: "check", tone: "ok", name: "Release builds", value: "6 of 6 passed" }
        : gate.state === "running"
          ? { icon: "delay", tone: "wait", name: "api e2e", value: "running" }
          : { icon: "delay", tone: "wait", name: "api 4be1d07", value: gate.where };

  let reason: React.ReactNode;
  if (live) reason = <>Promoted at {hhmm(clockAt(promo.at))}. {RELEASE.previous} stays warm for 30 minutes as the rollback target.</>;
  else if (promo.phase === "rolling") reason = <>Shifting production traffic in steps, holding at each while the canary checks stay green.</>;
  else if (promo.phase === "confirm") reason = <>This moves 100% of production to {RELEASE.name}. {RELEASE.previous} stays warm for rollback.</>;
  else if (green) reason = <>All checks are green. Promotion steps traffic through 25% and 50% before 100%.</>;
  else if (gate.state === "failed")
    reason = (
      <>
        <strong>Blocked by api.</strong> e2e failed on 4be1d07, which is in this release. Retry the job, or drop the
        cherry-pick from {RELEASE.name}.
      </>
    );
  else if (gate.state === "running") reason = <><strong>Waiting on api.</strong> 4be1d07 is still running e2e.</>;
  else reason = <><strong>Waiting on api.</strong> 4be1d07 has to reach Staging before {RELEASE.name} can be promoted.</>;

  return (
    <section className={s.gate} aria-labelledby="sy-release">
      <div className={s.releaseHead}>
        <h2 id="sy-release" className={s.releaseTitle}>
          Release {RELEASE.name}
        </h2>
        <span className={s.where}>
          {where} <span className={s.num}>{pct}%</span>
        </span>
      </div>
      <p className={s.releaseSub}>
        {RELEASE.commits} commits · cut at {RELEASE.cut} · in Canary since {RELEASE.canarySince}
      </p>
      <Rollout frac={frac} />
      <ul className={s.checks}>
        <li data-tone={buildsCheck.tone}>
          <Icon name={buildsCheck.icon} className={s.checkIcon} />
          <span className={s.checkName}>{buildsCheck.name}</span>
          <span className={s.checkVal}>{buildsCheck.value}</span>
          {gate.state === "failed" && (
            <button type="button" className={s.inlineBtn} onClick={onRetry}>
              <Icon name="retry" size={14} /> Retry
            </button>
          )}
        </li>
        <li data-tone="ok">
          <Icon name="check" className={s.checkIcon} />
          <span className={s.checkName}>Canary error rate</span>
          <span className={s.checkVal}>
            <span className={s.num}>{err.toFixed(2)}%</span> <span className={s.limit}>of 1.00%</span>
          </span>
        </li>
        <li data-tone="ok">
          <Icon name="check" className={s.checkIcon} />
          <span className={s.checkName}>Canary p99 latency</span>
          <span className={s.checkVal}>
            <span className={s.num}>{Math.round(p99)} ms</span> <span className={s.limit}>of 250 ms</span>
          </span>
        </li>
        <li data-tone="ok">
          <Icon name="check" className={s.checkIcon} />
          <span className={s.checkName}>Staging smoke</span>
          <span className={s.checkVal}>
            <span className={s.num}>24</span> <span className={s.limit}>of 24</span>
          </span>
        </li>
      </ul>

      <div className={s.promoteRow}>
        {promo.phase === "confirm" ? (
          <>
            <button type="button" className={s.promote} data-confirm="" onClick={onConfirm} autoFocus>
              Confirm: promote to 100%
            </button>
            <button type="button" className={s.cancel} onClick={onCancel}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className={s.promote}
            data-live={live ? "" : undefined}
            disabled={!green || promo.phase !== "idle"}
            aria-describedby="sy-reason"
            onClick={onPromote}
          >
            <Icon name={live ? "check" : green ? "arrow" : "lock"} />
            {live
              ? `${RELEASE.name} is live in Production`
              : promo.phase === "rolling"
                ? `Promoting · ${pct}% of production`
                : "Promote Canary to Production"}
          </button>
        )}
      </div>
      <p id="sy-reason" className={s.reason} data-blocked={!green && promo.phase === "idle" ? "" : undefined} aria-live="polite">
        {reason}
      </p>
    </section>
  );
});

/* ── line status board ────────────────────────────────────────────────── */

const STATUS_ICON: Record<BoardRow["status"], IconName> = { good: "check", minor: "delay", suspended: "suspended" };

/* ── service board, along the bottom edge ─────────────────────────────── */

type BoardProps = {
  rows: BoardRow[];
  clock: string;
  isolate: LineId | null;
  onIsolate: (l: LineId | null) => void;
  onSelectLine: (l: LineId) => void;
  onRetry: () => void;
};

export const ServiceBoard = memo(function ServiceBoard({ rows, clock, isolate, onIsolate, onSelectLine, onRetry }: BoardProps) {
  return (
    <section className={s.board} aria-labelledby="sy-board" onPointerLeave={() => onIsolate(null)}>
      <div className={s.boardHead}>
        <h2 id="sy-board">Line status</h2>
        <p>
          Updated <span className={s.num}>{clock}</span>
        </p>
      </div>
      <ul className={s.cells}>
        {rows.map((r) => {
          const l = LINE[r.line];
          return (
            <li
              key={r.line}
              className={s.cell}
              data-status={r.status}
              data-active={isolate === r.line ? "" : undefined}
              style={{ "--line": l.color } as CSSProperties}
              onPointerEnter={() => onIsolate(r.line)}
            >
              <button
                type="button"
                className={s.cellMain}
                onClick={() => onSelectLine(r.line)}
                onFocus={() => onIsolate(r.line)}
                onBlur={() => onIsolate(null)}
                aria-label={`${l.name}: ${r.label}${r.detail ? `. ${r.detail}` : ""}`}
              >
                <span className={s.cellName}>{l.name}</span>
                <span className={s.cellStatus}>
                  <Icon name={STATUS_ICON[r.status]} size={15} className={s.cellIcon} />
                  {r.label}
                </span>
                {r.detail && (
                  <span className={s.cellDetail} data-planned={r.planned ? "" : undefined}>
                    {r.planned && <Icon name="planned" size={13} />}
                    {r.detail}
                  </span>
                )}
              </button>
              {r.status === "suspended" && (
                <button type="button" className={s.cellRetry} onClick={onRetry}>
                  <Icon name="retry" size={14} /> Retry e2e
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
});

export function boardRows(gate: Gate): BoardRow[] {
  return ORDER.map((line) => {
    if (line === "api") {
      if (gate.state === "failed")
        return { line, status: "suspended", label: "Part suspended", detail: "Between e2e and Staging. 3 tests failed." };
      if (gate.state === "retrying") return { line, status: "minor", label: "Minor delays", detail: "e2e re-running on 4be1d07, attempt 2." };
      if (gate.state === "travelling") return { line, status: "minor", label: "Minor delays", detail: `Service restoring: 4be1d07 ${gate.where}.` };
      return { line, status: "good", label: "Good service" };
    }
    const n = NOTICES[line];
    if (n?.status === "minor") return { line, status: "minor", label: "Minor delays", detail: n.text };
    if (n?.status === "planned") return { line, status: "good", label: "Good service", detail: n.text, planned: true };
    return { line, status: "good", label: "Good service" };
  });
}

/* ── what a train is doing, in words ──────────────────────────────────── */

export function runNow(run: Run, t: number): { status: RunStatus; text: string; elapsed: number } {
  const loc = locate(run, t);
  const status = statusOf(loc);
  const st = "i" in loc ? LINE[run.line].stations[loc.i] : null;
  const end = loc.phase === "done" || loc.phase === "failed" ? loc.at : t;
  const elapsed = Math.max(0, (end - run.startedAt) * K);
  if (loc.phase === "queued") return { status, text: `Due ${hhmm(clockAt(t + loc.eta))}`, elapsed: 0 };
  if (loc.phase === "failed") return { status, text: `Halted at ${st!.name}`, elapsed };
  if (loc.phase === "done") return { status, text: `Arrived ${st!.name}`, elapsed };
  if (loc.phase === "dwell") return { status, text: `At ${st!.name} ${timer((t - loc.since) * K)}`, elapsed };
  return { status, text: `To ${LINE[run.line].stations[loc.i + 1].name}`, elapsed };
}

/* ── departures, in the open ground between api and workers ───────────── */

type DepartureRow = {
  id: string;
  line: LineId;
  sha: string;
  message: string;
  time: number;
  status: RunStatus | "cancelled";
  text: string;
  run?: Run;
  start: number;
};

type DeparturesProps = {
  t: number;
  yard: Yard;
  hoverRun: string | null;
  onHoverRun: (id: string | null) => void;
  onSelectRun: (r: Run) => void;
  style: CSSProperties;
};

export const Departures = memo(function Departures({ t, yard, hoverRun, onHoverRun, onSelectRun, style }: DeparturesProps) {
  const rows: DepartureRow[] = yard.runs.map((run) => {
    const now = runNow(run, t);
    const loc = locate(run, t);
    const start = loc.phase === "queued" ? t + loc.eta : run.startedAt;
    return { id: run.id, line: run.line, sha: run.sha, message: run.message, time: clockAt(start), status: now.status, text: now.text, run, start };
  });
  for (const p of PAST) {
    rows.push({
      id: p.id,
      line: p.line,
      sha: p.sha,
      message: p.message,
      time: p.started,
      status: p.status,
      text: p.status === "cancelled" ? "Cancelled" : `Arrived ${hhmm(p.started + p.duration)}`,
      start: (p.started - CLOCK0) / K,
    });
  }
  const rank = (r: DepartureRow) => (r.status === "failed" ? 0 : r.status === "running" ? 1 : r.status === "queued" ? 2 : 3);
  rows.sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? a.start - b.start : b.start - a.start));
  const active = rows.filter((r) => r.status === "running").length;

  return (
    <section className={s.departures} style={style} aria-labelledby="sy-dep">
      <div className={s.depHead}>
        <h2 id="sy-dep">Departures</h2>
        <p>
          <span className={s.num}>{active}</span> trains running
        </p>
      </div>
      <div className={s.depCols} aria-hidden="true">
        <span>Time</span>
        <span>Line</span>
        <span>Train</span>
        <span>Now</span>
      </div>
      <ol className={s.depList}>
        {rows.slice(0, 6).map((r) => {
          const l = LINE[r.line];
          const cells = (
            <>
              <span className={s.num}>{hhmm(r.time)}</span>
              <span className={s.depLine}>
                <span className={s.depSwatch} style={{ background: l.color }} />
                {l.name}
              </span>
              <span className={s.mono}>{r.sha}</span>
              <span className={s.depNow}>{r.text}</span>
            </>
          );
          return (
            <li key={r.id} data-status={r.status} data-hover={hoverRun === r.id ? "" : undefined}>
              {r.run && r.status !== "queued" ? (
                <button
                  type="button"
                  className={s.depRow}
                  title={r.message}
                  onClick={() => onSelectRun(r.run!)}
                  onPointerEnter={() => onHoverRun(r.id)}
                  onPointerLeave={() => onHoverRun(null)}
                  onFocus={() => onHoverRun(r.id)}
                  onBlur={() => onHoverRun(null)}
                >
                  {cells}
                </button>
              ) : (
                <div className={s.depRow} title={r.message}>
                  {cells}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
});

/* ── the card a train shows when pointed at ───────────────────────────── */

export function TrainCard({ run, t, x, y, below }: { run: Run; t: number; x: number; y: number; below: boolean }) {
  const l = LINE[run.line];
  const now = runNow(run, t);
  return (
    <div className={s.trainCard} data-below={below ? "" : undefined} style={{ left: x, top: y }} role="tooltip">
      <div className={s.tcHead}>
        <span className={s.tcLine} style={{ background: l.color, color: l.ink }}>
          {l.name}
        </span>
        <span className={s.mono}>{run.sha}</span>
        <span className={s.tcDur}>{dur(now.elapsed)}</span>
      </div>
      <p className={s.tcMsg}>{run.message}</p>
      <p className={s.tcMeta}>
        <span className={s.mono}>{run.branch}</span> · {run.author}
      </p>
      <p className={s.tcNow} data-status={now.status}>
        {now.text}
      </p>
    </div>
  );
}

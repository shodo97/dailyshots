"use client";

/* The hour log: the same running order as the wheel, as rows. One tab stop
   (a listbox with an active descendant), pointer drag on any row that can
   still move, and the on-air row carries its own 10 Hz countdowns. */

import { motion } from "motion/react";
import {
  memo,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import s from "./shot.module.css";
import { useNow, type ClockStore } from "./clock";
import {
  HOUR_START,
  NEWS_17,
  POST,
  TYPE_LABEL,
  clock,
  countdown,
  dueDrift,
  mmss,
  signed,
  type Item,
  type Phase,
  type Placed,
} from "./data";
import { Icon } from "./icons";
import { Fig } from "./fig";

const STATUS: Record<Phase, string> = {
  played: "Played",
  onair: "On air",
  next: "Next",
  queued: "Queued",
  dropped: "Dropped",
};

type Props = {
  store: ClockStore;
  placed: Placed[];
  phase: Record<string, Phase>;
  spares: Item[];
  over: number;
  selectedId: string | null;
  hoverId: string | null;
  draggingId: string | null;
  reduced: boolean;
  movable: (id: string) => boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragBefore: (id: string, beforeId: string | null) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  onRestore: (id: string) => void;
  onAdd: (id: string) => void;
  onKey: (e: ReactKeyboardEvent) => void;
  onAirId?: string;
};

export const Log = memo(function Log(props: Props) {
  const {
    store,
    placed,
    phase,
    spares,
    over,
    selectedId,
    hoverId,
    draggingId,
    reduced,
    movable,
    onSelect,
    onHover,
    onDragStart,
    onDragBefore,
    onDragEnd,
    onDrop,
    onRestore,
    onAdd,
    onKey,
    onAirId,
  } = props;

  const listRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const pending = useRef<{ id: string; y: number; pointer: number } | null>(null);

  // Keep the on-air row near the top: two played rows of context above it.
  useEffect(() => {
    const list = listRef.current;
    const row = onAirId ? rows.current.get(onAirId) : undefined;
    if (!list || !row) return;
    const top = row.offsetTop - list.offsetTop - 2 * 34 - 8;
    list.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
  }, [onAirId, reduced]);

  // Keyboard selection keeps the selected row in view.
  useEffect(() => {
    if (!selectedId) return;
    rows.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const onPointerDown = (e: ReactPointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest("button")) return;
    onSelect(id);
    if (!movable(id) || e.button !== 0) return;
    pending.current = { id, y: e.clientY, pointer: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const p = pending.current;
    if (!p) return;
    if (!draggingId) {
      if (Math.abs(e.clientY - p.y) < 4) return;
      onDragStart(p.id);
    }
    // Insert before the first movable row whose middle is below the pointer.
    let before: string | null = null;
    for (const pl of placed) {
      if (pl.id === p.id || !movable(pl.id)) continue;
      const el = rows.current.get(pl.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        before = pl.id;
        break;
      }
    }
    onDragBefore(p.id, before);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!pending.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    pending.current = null;
    onDragEnd();
  };

  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };

  const live = placed.filter((p) => !p.dropped).length;
  const droppedCount = placed.length - live;
  const legal = placed.find((p) => p.id === "l01");

  return (
    <section className={s.logPanel} aria-label="Hour log">
      <header className={s.logHead}>
        <h2 className={s.panelTitle}>Hour log</h2>
        <span className={s.logCount}>
          <span className={s.tnum}>{live}</span> items
          {droppedCount ? (
            <>
              {" · "}
              <span className={s.tnum}>{droppedCount}</span> dropped
            </>
          ) : null}
        </span>
        <span className={s.keys}>
          <kbd>Alt</kbd>+<kbd>Up</kbd>/<kbd>Down</kbd> move <kbd>D</kbd> drop <kbd>R</kbd> restore
        </span>
      </header>

      <div className={s.cols} aria-hidden>
        <span />
        <span>In</span>
        <span>Title · artist</span>
        <span className={s.num}>Dur</span>
        <span className={s.num}>Ramp</span>
        <span>Out</span>
        <span>Status</span>
        <span />
      </div>

      <motion.div
        ref={listRef}
        layoutScroll
        className={s.list}
        role="listbox"
        tabIndex={0}
        aria-label="Running order. Arrow keys select, Alt and arrows move, D drops, R restores, Enter adds a spare."
        aria-activedescendant={selectedId ? `row-${selectedId}` : undefined}
        onKeyDown={onKey}
        data-dragging={draggingId ? "" : undefined}
      >
        {placed.map((p) => (
          <motion.div
            key={p.id}
            layout={reduced ? false : "position"}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            ref={register(p.id)}
            id={`row-${p.id}`}
            role="option"
            aria-selected={selectedId === p.id}
            className={s.row}
            data-phase={phase[p.id]}
            data-type={p.item.type}
            data-selected={selectedId === p.id || undefined}
            data-hover={hoverId === p.id || undefined}
            data-lifted={draggingId === p.id || undefined}
            data-movable={movable(p.id) || undefined}
            onPointerDown={(e) => onPointerDown(e, p.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={() => onHover(p.id)}
            onPointerLeave={() => onHover(null)}
          >
            <Row
              p={p}
              phase={phase[p.id]}
              movable={movable(p.id)}
              onDrop={onDrop}
              onRestore={onRestore}
            />
            {phase[p.id] === "onair" ? <OnAir store={store} p={p} /> : null}
          </motion.div>
        ))}

        <div className={s.postRow} data-state={over > 0 ? "long" : "ok"}>
          <span className={s.lockCell}>
            <Icon name="lock" className={s.icon} />
          </span>
          <span className={s.timeIn}>
            <Fig>{clock(HOUR_START + POST)}</Fig>
          </span>
          <span className={s.titleCell}>
            <span className={s.title}>{NEWS_17.title}</span>
            <span className={s.by}>
              Hard post · {legal && !legal.dropped ? `legal ID out ${clock(HOUR_START + legal.end)}` : NEWS_17.by}
            </span>
          </span>
          <span className={`${s.num} ${s.tnum}`}>
            <Fig>{mmss(NEWS_17.dur)}</Fig>
          </span>
          <span />
          <span />
          <span className={s.status} data-s="post">
            {over > 0 ? `${signed(over)} late` : "Post"}
          </span>
          <span />
        </div>

        <div className={s.spareHead}>
          <span>Spares</span>
          <span className={s.spareNote}>Not scheduled. Enter adds the selected spare before the legal ID.</span>
        </div>

        {spares.length === 0 ? <p className={s.spareEmpty}>All spares are in the hour.</p> : null}
        {spares.map((it) => (
          <motion.div
            key={it.id}
            layout={reduced ? false : "position"}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            ref={register(it.id)}
            id={`row-${it.id}`}
            role="option"
            aria-selected={selectedId === it.id}
            className={s.row}
            data-phase="spare"
            data-type={it.type}
            data-selected={selectedId === it.id || undefined}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              onSelect(it.id);
            }}
          >
            <span className={s.grip} />
            <span className={`${s.timeIn} ${s.tnum}`}>--:--:--</span>
            <span className={s.titleCell}>
              <span className={s.title}>{it.title}</span>
              <span className={s.by}>{it.by}</span>
            </span>
            <span className={`${s.num} ${s.tnum}`}>
              <Fig>{mmss(it.dur)}</Fig>
            </span>
            <span className={`${s.num} ${s.tnum}`}>
              <Fig>{it.ramp ? mmss(it.ramp) : ""}</Fig>
            </span>
            <Outro outro={it.outro} />
            <span className={s.status} data-s="spare">
              Spare
            </span>
            <button type="button" className={s.rowAct} onClick={() => onAdd(it.id)} aria-label={`Add ${it.title} to the hour`}>
              <Icon name="add" className={s.icon} />
            </button>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
});

function Outro({ outro }: { outro: Item["outro"] }) {
  return (
    <span className={s.outro}>
      <Icon name={outro} className={s.icon} />
      {outro === "fade" ? "Fade" : "Cold"}
    </span>
  );
}

const Row = memo(function Row({
  p,
  phase,
  movable,
  onDrop,
  onRestore,
}: {
  p: Placed;
  phase: Phase;
  movable: boolean;
  onDrop: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const it = p.item;
  const due = dueDrift(p);
  return (
    <>
      <span className={s.grip}>
        {it.pinned ? <Icon name="lock" className={s.icon} /> : movable ? <Icon name="grip" className={s.icon} /> : null}
      </span>
      <span className={`${s.timeIn} ${s.tnum}`}><Fig>{p.dropped ? "--:--:--" : clock(HOUR_START + p.start)}</Fig></span>
      <span className={s.titleCell}>
        <span className={s.title}>
          {it.type !== "music" ? <span className={s.typeTag}>{TYPE_LABEL[it.type]}</span> : null}
          {it.title}
        </span>
        <span className={s.by}>
          {due ? (
            <span className={s.dueNote} data-ok={due.ok || undefined}>
              {!due.ok ? <Icon name="warn" className={s.icon} /> : null}
              Booked :45 · {due.drift === 0 ? "on the dot" : `${mmss(Math.abs(due.drift))} ${due.drift > 0 ? "late" : "early"}`}
              {due.ok ? "" : ", outside its minute"}
            </span>
          ) : (
            it.by
          )}
        </span>
      </span>
      <span className={`${s.num} ${s.tnum}`}>
        <Fig>{mmss(it.dur)}</Fig>
      </span>
      <span className={`${s.num} ${s.tnum}`}>
        <Fig>{it.ramp ? mmss(it.ramp) : ""}</Fig>
      </span>
      <Outro outro={it.outro} />
      <span className={s.status} data-s={phase}>
        {STATUS[phase]}
      </span>
      {phase === "dropped" ? (
        <button type="button" className={s.rowAct} onClick={() => onRestore(p.id)} aria-label={`Restore ${it.title}`}>
          <Icon name="restore" className={s.icon} />
        </button>
      ) : movable ? (
        <button type="button" className={s.rowAct} onClick={() => onDrop(p.id)} aria-label={`Drop ${it.title}`}>
          <Icon name="drop" className={s.icon} />
        </button>
      ) : (
        <span />
      )}
    </>
  );
});

/* ── the on-air row's live strip ───────────────────────────────────────── */

function OnAir({ store, p }: { store: ClockStore; p: Placed }) {
  const now = useNow(store, 10) - HOUR_START;
  const elapsed = Math.max(0, now - p.start);
  const left = Math.max(0, p.end - now);
  const ramp = p.item.ramp ?? 0;
  const rampLeft = Math.max(0, ramp - elapsed);
  const inRamp = rampLeft > 0;
  const progress = Math.min(1, elapsed / p.item.dur);

  return (
    <div className={s.onair}>
      <div className={s.onairMain}>
        <span className={s.onairLabel}>To end</span>
        <span className={`${s.onairCount} ${s.tnum}`} data-warn={left < 10 || undefined}>
          <Fig>{countdown(left)}</Fig>
        </span>
        <span className={s.onairEnds}>
          {p.item.outro === "fade" ? "Fades" : "Ends cold"} at {clock(HOUR_START + p.end)}
        </span>
      </div>
      <div className={s.ramp} data-live={inRamp || undefined} data-none={!ramp || undefined}>
        <span className={s.onairLabel}>{ramp ? (inRamp ? "Ramp to vocal" : "Vocal in") : "No ramp"}</span>
        <span className={`${s.rampCount} ${s.tnum}`}>
          <Fig>{ramp ? (inRamp ? rampLeft.toFixed(1) : mmss(elapsed - ramp)) : "--"}</Fig>
        </span>
        <span className={s.rampBar} aria-hidden>
          <i style={{ transform: `scaleX(${ramp ? rampLeft / ramp : 0})` }} />
        </span>
      </div>
      <span className={s.onairProgress} aria-hidden>
        <i style={{ transform: `scaleX(${progress})` }} />
      </span>
    </div>
  );
}

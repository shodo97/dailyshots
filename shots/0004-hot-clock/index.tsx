"use client";

/* 0004 — Hot Clock
   Playout for the 16:00 hour of Kestrel Drive on Radio Kestrel 94.2. The hour
   is booked 38 seconds past the 17:00:00 news join, and the job on screen is
   to make it land: drop, move or add items on the wheel or in the log until
   the backtime reads clean. The clock runs from 16:21:40 in real time, so the
   on-air track drains, the ramp counts down and the next item takes air. */

import { Saira, Saira_Condensed } from "next/font/google";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import s from "./shot.module.css";
import { createClock, useNow } from "./clock";
import {
  ALL,
  CARTS,
  CLEAN,
  HOUR_START,
  ITEMS,
  POST,
  SPARES,
  TYPE_LABEL,
  TYPE_ORDER,
  clock,
  mmss,
  rules,
  schedule,
  signed,
  stateOf,
  suggest,
  type ItemType,
} from "./data";
import { Dial } from "./Dial";
import { Log } from "./Log";
import { Carts } from "./Carts";
import { Meters, type Channel, type Feeds } from "./Meters";
import { Icon } from "./icons";
import { Fig } from "./fig";

const sans = Saira({ subsets: ["latin"], variable: "--font-saira", display: "swap" });
const condensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-saira-condensed",
  display: "swap",
});

type Drag = { id: string } | null;

export default function HotClock() {
  const reduced = !!useReducedMotion();
  const [store] = useState(() => createClock());
  const nowAbs = useNow(store, 1);
  const now = nowAbs - HOUR_START;

  const [order, setOrder] = useState<string[]>(() => ITEMS.map((i) => i.id));
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set());
  const [spares, setSpares] = useState<string[]>(() => SPARES.map((i) => i.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [carts, setCarts] = useState<Record<string, number>>({});
  const [pfl, setPfl] = useState<Record<Channel, boolean>>({
    mic1: false,
    mic2: false,
    plrA: false,
    plrB: true,
    cart: false,
  });

  const sc = useMemo(() => schedule(order, dropped, now), [order, dropped, now]);
  const { placed, phase, onAir, next, over } = sc;
  const state = stateOf(over);

  const movable = useCallback(
    (id: string) => (phase[id] === "next" || phase[id] === "queued") && !ALL[id]?.pinned,
    [phase],
  );

  const spareItems = useMemo(() => spares.map((id) => ALL[id]), [spares]);
  const advice = useMemo(() => suggest(order, dropped, spares, movable), [order, dropped, spares, movable]);

  /* ── edits ─────────────────────────────────────────────────────────── */

  const legalIndex = (o: string[]) => o.indexOf("l01");

  const moveBefore = useCallback(
    (id: string, beforeId: string | null) => {
      setOrder((o) => {
        const rest = o.filter((x) => x !== id);
        const at = beforeId ? rest.indexOf(beforeId) : legalIndex(rest);
        const n = [...rest.slice(0, at), id, ...rest.slice(at)];
        return n.join() === o.join() ? o : n;
      });
    },
    [],
  );

  const moveToTime = useCallback(
    (id: string, t: number) => {
      // Times behind the hand wrap: the top-left of the wheel means "late in the hour".
      const tt = t < now ? (t < now / 2 ? t + 3600 : now) : t;
      const others = order.filter((x) => x !== id);
      const ghost = schedule(others, dropped, now);
      const before = ghost.placed.find((p) => movable(p.id) && !p.dropped && (p.start + p.end) / 2 > tt);
      moveBefore(id, before ? before.id : null);
    },
    [order, dropped, now, movable, moveBefore],
  );

  const dropItem = useCallback(
    (id: string) => {
      if (!movable(id)) return;
      setDropped((d) => new Set(d).add(id));
    },
    [movable],
  );

  const restoreItem = useCallback(
    (id: string) => {
      // A drop that the hand has since passed comes back right after the on-air item.
      const oi = onAir ? order.indexOf(onAir.id) : -1;
      if (order.indexOf(id) <= oi) {
        setOrder((o) => {
          const rest = o.filter((x) => x !== id);
          const at = rest.indexOf(onAir!.id) + 1;
          return [...rest.slice(0, at), id, ...rest.slice(at)];
        });
      }
      setDropped((d) => {
        const n = new Set(d);
        n.delete(id);
        return n;
      });
    },
    [order, onAir],
  );

  const addSpare = useCallback((id: string) => {
    setSpares((sp) => sp.filter((x) => x !== id));
    setOrder((o) => {
      const at = legalIndex(o);
      return [...o.slice(0, at), id, ...o.slice(at)];
    });
  }, []);

  const applyAdvice = useCallback(() => {
    if (!advice) return;
    if (advice.drop) dropItem(advice.drop);
    if (advice.add) addSpare(advice.add);
  }, [advice, dropItem, addSpare]);

  const toggleCart = useCallback(
    (id: string) => {
      setCarts((c) => {
        const cart = CARTS.find((x) => x.id === id)!;
        const at = c[id];
        const t = store.get();
        const n = { ...c };
        if (at !== undefined && t - at < cart.dur) delete n[id];
        else n[id] = t;
        return n;
      });
    },
    [store],
  );

  /* ── keyboard ──────────────────────────────────────────────────────── */

  const onKey = useCallback(
    (e: ReactKeyboardEvent) => {
      const nav = [...order, ...spares];
      const cur = selectedId ? nav.indexOf(selectedId) : -1;
      const k = e.key;
      const back = k === "ArrowUp" || k === "ArrowLeft";
      const fwd = k === "ArrowDown" || k === "ArrowRight";

      if ((back || fwd) && e.altKey) {
        e.preventDefault();
        if (!selectedId || !movable(selectedId)) return;
        const i = order.indexOf(selectedId);
        const j = back ? i - 1 : i + 1;
        const other = order[j];
        if (!other || !(movable(other) || phase[other] === "dropped")) return;
        const n = [...order];
        n[i] = other;
        n[j] = selectedId;
        setOrder(n);
        return;
      }
      if (back || fwd) {
        e.preventDefault();
        const start = cur < 0 ? (onAir ? order.indexOf(onAir.id) : 0) : cur;
        const j = cur < 0 ? start + 1 : Math.max(0, Math.min(nav.length - 1, start + (back ? -1 : 1)));
        setSelectedId(nav[j]);
        return;
      }
      if (k === "Home" || k === "End") {
        e.preventDefault();
        setSelectedId(nav[k === "Home" ? 0 : nav.length - 1]);
        return;
      }
      if (!selectedId) return;
      if (k === "d" || k === "D" || k === "Delete" || k === "Backspace") {
        e.preventDefault();
        if (phase[selectedId] === "dropped") restoreItem(selectedId);
        else dropItem(selectedId);
      } else if (k === "r" || k === "R") {
        e.preventDefault();
        if (phase[selectedId] === "dropped") restoreItem(selectedId);
      } else if (k === "Enter" || k === "a" || k === "A") {
        if (spares.includes(selectedId)) {
          e.preventDefault();
          addSpare(selectedId);
        }
      }
    },
    [order, spares, selectedId, movable, phase, onAir, dropItem, restoreItem, addSpare],
  );

  // Carts fire from the number row anywhere on the desk.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const cart = CARTS.find((c) => c.key === e.key);
      if (cart) toggleCart(cart.id);
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [toggleCart]);

  /* ── what each channel is carrying ─────────────────────────────────── */

  const elapsed = onAir ? now - onAir.start : 0;
  const inRamp = !!onAir && onAir.item.type === "music" && elapsed < (onAir.item.ramp ?? 0);
  const micLive = !!onAir && (onAir.item.type === "talk" || inRamp);
  const anyCart = CARTS.some((c) => carts[c.id] !== undefined && nowAbs - carts[c.id] < c.dur);
  const playable = (t?: ItemType) => t === "music" || t === "jingle" || t === "ad" || t === "legal" || t === "news";
  // Players alternate down the log: even rows load on A, odd on B.
  const airOnA = onAir ? order.indexOf(onAir.id) % 2 === 0 : true;
  const feeds = useMemo<Feeds>(() => {
    const airing = playable(onAir?.item.type);
    const cueTitle = next ? next.item.title : "";
    const airTitle = onAir && airing ? onAir.item.title : "Idle";
    const cueState = (c: Channel) => (pfl[c] && next && playable(next.item.type) ? "cue" : "idle");
    return {
      mic1: micLive,
      mic2: onAir?.id === "t04",
      cart: anyCart,
      plrA: airOnA ? (airing ? "air" : "idle") : cueState("plrA"),
      plrB: airOnA ? cueState("plrB") : airing ? "air" : "idle",
      loadA: airOnA ? airTitle : cueTitle,
      loadB: airOnA ? cueTitle : airTitle,
    };
  }, [onAir, next, micLive, anyCart, airOnA, pfl]);

  /* ── type totals for the legend ───────────────────────────────────── */

  const totals = useMemo(() => {
    const m = new Map<ItemType, { n: number; sec: number }>();
    for (const p of placed) {
      if (p.dropped) continue;
      const e = m.get(p.item.type) ?? { n: 0, sec: 0 };
      e.n += 1;
      e.sec += p.item.dur;
      m.set(p.item.type, e);
    }
    return m;
  }, [placed]);

  const fmt = useMemo(() => rules(placed), [placed]);
  const met = fmt.filter((r) => r.ok).length;
  const legal = placed.find((p) => p.id === "l01");
  const live = placed.filter((p) => !p.dropped);
  const lastLive = live[live.length - 1];

  // The scale widens in whole minutes so the needle never pins to an end stop.
  const range = Math.max(120, Math.ceil((Math.abs(over) + 20) / 60) * 60);
  const needle = over / range;

  return (
    <div
      className={`${s.root} ${sans.variable} ${condensed.variable}`}
      style={
        {
          "--shot-sans": "var(--font-saira)",
          "--shot-display": "var(--font-saira-condensed)",
          "--shot-mono": "var(--font-saira-condensed)",
        } as CSSProperties
      }
    >
      {/* ── header ─────────────────────────────────────────────────── */}
      <header className={s.top}>
        <div className={s.brand}>
          <svg viewBox="0 0 28 28" className={s.mark} aria-hidden>
            <path d="M3 17.5L14 8l11 9.5M8.5 13.2L14 18.5l5.5-5.3" />
          </svg>
          <div>
            <p className={s.station}>Radio Kestrel 94.2</p>
            <p className={s.show}>Kestrel Drive with Ines Marlow · Studio B</p>
          </div>
        </div>
        <div className={s.topMeta}>
          <span>
            Log <b className={s.tnum}>16:00</b>
          </span>
          <span>Thu 19 Nov 2026</span>
          <span>Live assist</span>
          <span>
            Next news <b className={s.tnum}>{clock(HOUR_START + POST)}</b>
          </span>
        </div>
        <div className={s.tally} data-live={micLive || undefined} role="status" aria-live="polite">
          <Icon name="mic" className={s.tallyIcon} />
          <span>{micLive ? "On air · mic 1" : "Mic closed"}</span>
        </div>
      </header>

      {/* ── wheel ──────────────────────────────────────────────────── */}
      <section className={s.clockPanel} aria-label="Hot clock">
        <aside className={s.legend}>
          <h2 className={s.panelTitle}>Hot clock</h2>
          <p className={s.legendSub}>16:00–17:00 · read clockwise from the post</p>
          <ul className={s.types}>
            {TYPE_ORDER.map((t) => {
              const tt = totals.get(t);
              return (
                <li key={t} data-type={t}>
                  <i aria-hidden />
                  <span>{TYPE_LABEL[t]}</span>
                  <span className={s.tnum}>{tt ? tt.n : 0}</span>
                  <span className={s.tnum}>
                    <Fig>{tt ? mmss(tt.sec) : "0:00"}</Fig>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className={s.rules}>
            <h3 className={s.rulesHead}>
              Format rules
              <span className={s.tnum}>
                {met} of {fmt.length} met
              </span>
            </h3>
            <ul>
              {fmt.map((r) => (
                <li key={r.id} data-ok={r.ok || undefined}>
                  <Icon name={r.ok ? "clean" : "warn"} className={s.icon} />
                  <span className={s.ruleLabel} title={r.id === "artist" && !r.ok ? "An artist plays twice in this hour" : undefined}>
                    {r.label}
                  </span>
                  <span className={s.ruleValue}>
                    <Fig>{r.value}</Fig>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className={s.legendHint}>Drag a segment to move it.</p>
        </aside>
        <Dial
          placed={placed}
          phase={phase}
          nowAbs={nowAbs}
          over={over}
          selectedId={selectedId}
          hoverId={hoverId}
          draggingId={drag?.id ?? null}
          movable={movable}
          reduced={reduced}
          onSelect={setSelectedId}
          onHover={setHoverId}
          onDragStart={(id) => setDrag({ id })}
          onDragTo={moveToTime}
          onDragEnd={() => setDrag(null)}
          onKey={onKey}
          nextTitle={next?.item.title}
          nextIn={next ? next.start - now : undefined}
        />
      </section>

      {/* ── log ────────────────────────────────────────────────────── */}
      <Log
        store={store}
        placed={placed}
        phase={phase}
        spares={spareItems}
        over={over}
        selectedId={selectedId}
        hoverId={hoverId}
        draggingId={drag?.id ?? null}
        reduced={reduced}
        movable={movable}
        onSelect={setSelectedId}
        onHover={setHoverId}
        onDragStart={(id) => setDrag({ id })}
        onDragBefore={moveBefore}
        onDragEnd={() => setDrag(null)}
        onDrop={dropItem}
        onRestore={restoreItem}
        onAdd={addSpare}
        onKey={onKey}
        onAirId={onAir?.id}
      />

      {/* ── backtime ───────────────────────────────────────────────── */}
      <section className={s.backtime} data-state={state} aria-label="Backtime">
        <header className={s.bayHead}>
          <h2 className={s.panelTitle}>Backtime</h2>
          <span className={s.bayNote}>
            <Icon name="lock" className={s.icon} /> Hard post
          </span>
        </header>
        <p className={s.readout} aria-live="polite">
          News at <span className={s.tnum}>{clock(HOUR_START + POST)}</span>
          <span className={s.sep}>&nbsp;·</span>{" "}
          <span className={s.verdict}>
            <Icon name={state} className={s.verdictIcon} />
            <span key={`${state}${over}`} className={`${s.verdictText} ${s.tnum}`}>
              <Fig>
                {state === "clean"
                  ? over === 0
                    ? "running clean"
                    : `running clean, ${signed(over)}`
                  : `running ${mmss(Math.abs(over))} ${state}`}
              </Fig>
            </span>
          </span>
        </p>
        <div className={s.scale} aria-hidden>
          <span className={s.scaleBand} style={{ width: `${(CLEAN / range) * 100}%` }} />
          {[-1, -0.5, 0, 0.5, 1].map((f) => (
            <span key={f} className={s.scaleTick} style={{ left: `${50 + f * 50}%` }}>
              <span className={s.tnum}>
                <Fig>{f === 0 ? "0" : signed(f * range)}</Fig>
              </span>
            </span>
          ))}
          <span className={s.needle} style={{ transform: `translateX(${needle * 50}cqw)` }} />
        </div>
        <p className={s.detail}>
          {state === "long" && legal && !legal.dropped
            ? `Legal ID out at ${clock(HOUR_START + legal.end)}, ${mmss(over)} into the news join.`
            : state === "short"
              ? `${mmss(-over)} of dead air before the join. Stretch the last link or add a spare.`
              : `Last item out at ${lastLive ? clock(HOUR_START + lastLive.end) : "--"}. The join is clean.`}
        </p>
        <div className={s.advice}>
          {advice ? (
            <>
              <Icon name="suggest" className={s.adviceIcon} />
              <span>
                {advice.drop ? (
                  <>
                    Drop <b>{ALL[advice.drop].title}</b> ({mmss(ALL[advice.drop].dur)})
                  </>
                ) : null}
                {advice.drop && advice.add ? ", add " : advice.add ? "Add " : null}
                {advice.add ? (
                  <>
                    <b>{ALL[advice.add].title}</b> ({mmss(ALL[advice.add].dur)})
                  </>
                ) : null}
                <span className={s.tnum}>, lands {stateOf(advice.over) === "clean" ? "clean" : signed(advice.over)}</span>
              </span>
              <button type="button" className={s.apply} onClick={applyAdvice}>
                Apply
              </button>
            </>
          ) : state === "clean" ? (
            <span>On time. Nothing to change.</span>
          ) : (
            <span>No single change gets closer. Move items by hand.</span>
          )}
        </div>
      </section>

      <Carts store={store} playing={carts} onToggle={toggleCart} />

      <Meters
        store={store}
        feeds={feeds}
        pfl={pfl}
        onPfl={(c) => setPfl((p) => ({ ...p, [c]: !p[c] }))}
        reduced={reduced}
      />
    </div>
  );
}

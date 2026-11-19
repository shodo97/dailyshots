"use client";

/* 0003 — Chart Desk
   A charting workstation set in Thursday's pre-market: two linked panes on a
   percentage scale, a ticking watchlist, and the symbol's details beside it.
   The type is the platform's own system stack on purpose: a desk like this
   is read at 12 to 14px for hours, and native rendering wins at that size. */

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import s from "./shot.module.css";
import { Badge, Chart, type Drawing, type Tool } from "./chart";
import {
  RANGES,
  SPECS,
  applyTick,
  barsFor,
  firstIndexOnOrAfter,
  fmt,
  fmtSigned,
  fmtVol,
  intervalForRange,
  rangeStart,
  seriesFor,
  specById,
  type Interval,
  type RangeId,
  type Spec,
} from "./data";
import { Glyph, Icon, type IconName } from "./icons";

const SANS = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

/* ── live quotes ──────────────────────────────────────────────────────────── */

type Quote = {
  last: number;
  pre?: number;
  /** How much of the formatted last price stayed the same on the last tick. */
  keep: number;
  dir: 1 | -1 | 0;
  at: number;
};

function gauss() {
  const u = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const commonPrefix = (a: string, b: string) => {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return k;
};

const lastStr = (spec: Spec, v: number) => fmt(v, spec.decimals);

function initialQuotes(): Record<string, Quote> {
  const now = Date.now();
  return Object.fromEntries(
    SPECS.map((sp) => [
      sp.id,
      { last: sp.last, pre: sp.pre, keep: lastStr(sp, sp.last).length, dir: 0 as const, at: now },
    ]),
  );
}

/** The regular session's last print: 19:59 New York, after the closing auction settles. */
const LAST_REGULAR = Date.UTC(2026, 10, 19, 0, 59);

function clockParts(t: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(t));
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("timeZoneName")}`;
}

const utcClock = (t: number) => new Date(t).toISOString().slice(11, 19) + " UTC";

/* ── the page ─────────────────────────────────────────────────────────────── */

const TOOLS: { id: Tool; icon: IconName; tip: string }[][] = [
  [
    { id: "cross", icon: "cross", tip: "Cross" },
    { id: "trend", icon: "trend", tip: "Trend line" },
    { id: "fib", icon: "fib", tip: "Fib retracement" },
    { id: "pattern", icon: "pattern", tip: "XABCD pattern" },
    { id: "forecast", icon: "forecast", tip: "Long position" },
    { id: "brush", icon: "brush", tip: "Brush" },
    { id: "text", icon: "text", tip: "Text" },
    { id: "emoji", icon: "emoji", tip: "Icons" },
  ],
  [
    { id: "ai", icon: "aiPattern", tip: "Pattern search" },
    { id: "measure", icon: "ruler", tip: "Measure" },
    { id: "zoom", icon: "zoom", tip: "Zoom in" },
  ],
];

/** Tools that do something on the canvas; the rest select but behave as the cursor. */
const LIVE_TOOLS = new Set<Tool>(["cross", "trend", "brush", "measure", "zoom"]);

export default function ChartDesk() {
  const reduce = !!useReducedMotion();

  const [symbol, setSymbol] = useState("AAPL");
  const [interval, setInterval] = useState<Interval>("D");
  const [range, setRange] = useState<{ id: RangeId | "default"; n: number }>({ id: "default", n: 0 });
  const [panelOpen, setPanelOpen] = useState(true);
  const [tool, setTool] = useState<Tool>("cross");
  const [magnet, setMagnet] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [adj, setAdj] = useState(false);
  const [drawings, setDrawings] = useState<Record<string, Drawing[]>>({});
  const [quotes, setQuotes] = useState(initialQuotes);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const quotesRef = useRef(quotes);

  // One heartbeat a second: the clock, the indicative pre-market prints, and
  // the two instruments that trade while US stocks are shut.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      const prev = quotesRef.current;
      const next: Record<string, Quote> = { ...prev };
      let touched = false;
      for (const sp of SPECS) {
        if (!sp.live || Math.random() < 0.35) continue;
        const q = prev[sp.id];
        if (sp.live === "pre" && q.pre !== undefined) {
          const base = sp.pre!;
          const step = base * 0.00018;
          const pre = +(q.pre + gauss() * step - (q.pre - base) * 0.06).toFixed(2);
          next[sp.id] = { ...q, pre, at: t };
        } else if (sp.live === "last") {
          const step = sp.last * (sp.id === "VIX" ? 0.0012 : 0.00004);
          const raw = q.last + gauss() * step - (q.last - sp.last) * 0.05;
          const last = +raw.toFixed(sp.decimals);
          if (last === q.last) continue;
          const keep = commonPrefix(lastStr(sp, q.last), lastStr(sp, last));
          next[sp.id] = { ...q, last, keep, dir: last > q.last ? 1 : -1, at: t };
          applyTick(sp.id, last);
          touched = true;
        }
      }
      quotesRef.current = next;
      setQuotes(next);
      setNow(t);
      if (touched) setVersion((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const spec = specById(symbol);
  const compareSpec = specById("SPX");
  const bars = useMemo(() => barsFor(symbol, interval), [symbol, interval]);
  const compare = useMemo(() => barsFor("SPX", interval), [interval]);
  const quote = quotes[symbol];

  const pickRange = (id: RangeId) => {
    setInterval(intervalForRange(id));
    setRange((r) => ({ id, n: r.n + 1 }));
  };

  const addDrawing = useCallback(
    (d: Drawing) => setDrawings((m) => ({ ...m, [symbol]: [...(m[symbol] ?? []), d] })),
    [symbol],
  );

  const pre = spec.status === "pre" ? quote.pre : undefined;
  const bid = pre !== undefined ? +(pre - 0.08).toFixed(2) : undefined;
  const ask = pre !== undefined ? +(pre + 0.12).toFixed(2) : undefined;
  const intervalText = interval === "D" ? "D" : `${interval}m`;

  return (
    <div className={s.app} style={{ "--shot-sans": SANS } as CSSProperties}>
      {/* ── top bar ── */}
      <header className={s.top}>
        <div className={s.avatarCell}>
          <span className={s.avatar} aria-label="Account">S</span>
        </div>
        <button type="button" className={s.symbolPill} aria-label={`Symbol search, ${symbol}`}>
          <span className={s.symbolText}>{symbol}</span>
          <span className={s.symbolCompare} aria-hidden>
            <Icon name="candles" size={22} />
          </span>
        </button>
        <IconBtn icon="plusCircle" label="Compare or add symbol" />
        <Divider />
        <button type="button" className={s.btn} aria-label="Interval">
          <span className={s.intervalText}>{intervalText}</span>
        </button>
        <Divider />
        <IconBtn icon="barStyle" label="Bar style" />
        <Divider />
        <button type="button" className={s.btn}>
          <Icon name="indicators" />
          <span>Indicators</span>
        </button>
        <button type="button" className={s.btnNarrow} aria-label="Indicator templates">
          <Glyph name="chevDown" />
        </button>
        <Divider />
        <button type="button" className={s.btn}>
          <Icon name="alert" />
          <span>Alert</span>
        </button>
        <button type="button" className={s.btn}>
          <Icon name="replay" />
          <span>Replay</span>
        </button>
        <Divider />
        <IconBtn icon="undo" label="Undo" disabled />
        <IconBtn icon="redo" label="Redo" disabled />

        <div className={s.grow} />

        <button type="button" className={s.btn}>
          <Icon name="layout" />
          <span className={s.layoutName}>Unnamed</span>
        </button>
        <button type="button" className={s.btnNarrow} aria-label="Manage layouts">
          <Glyph name="chevDown" />
        </button>
        <Divider />
        <IconBtn icon="quickSearch" label="Quick search" />
        <IconBtn icon="settings" label="Settings" />
        <IconBtn icon="fullscreen" label="Fullscreen mode" />
        <IconBtn icon="camera" label="Take a snapshot" />
        <IconBtn icon="publish" label="Publish idea" />
        <button type="button" className={s.trade}>Trade</button>
        <button type="button" className={s.upgrade}>Upgrade</button>
      </header>

      <div className={s.body}>
        {/* ── drawing toolbar ── */}
        <nav className={s.toolbar} aria-label="Drawing tools">
          {TOOLS.map((group, gi) => (
            <div key={gi} className={s.toolGroup}>
              {group.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={s.tool}
                  data-active={tool === t.id || undefined}
                  data-tip={LIVE_TOOLS.has(t.id) ? t.tip : `${t.tip} (not in this build)`}
                  aria-label={t.tip}
                  aria-pressed={tool === t.id}
                  onClick={() => setTool((cur) => (cur === t.id && t.id !== "cross" ? "cross" : t.id))}
                >
                  <Icon name={t.icon} />
                </button>
              ))}
            </div>
          ))}
          <div className={s.toolGroup}>
            <button
              type="button"
              className={s.tool}
              data-active={magnet || undefined}
              data-tip="Magnet mode"
              aria-pressed={magnet}
              aria-label="Magnet mode"
              onClick={() => setMagnet((m) => !m)}
            >
              <Icon name="magnet" />
            </button>
            <button type="button" className={s.tool} data-tip="Keep drawing" aria-label="Keep drawing">
              <Icon name="pencilLock" />
            </button>
            <button
              type="button"
              className={s.tool}
              data-active={locked || undefined}
              data-tip={locked ? "Unlock all drawings" : "Lock all drawings"}
              aria-pressed={locked}
              aria-label="Lock all drawings"
              onClick={() => setLocked((l) => !l)}
            >
              <Icon name={locked ? "lockClosed" : "lockOpen"} />
            </button>
            <button
              type="button"
              className={s.tool}
              data-active={hidden || undefined}
              data-tip={hidden ? "Show all drawings" : "Hide all drawings"}
              aria-pressed={hidden}
              aria-label="Hide all drawings"
              onClick={() => setHidden((h) => !h)}
            >
              <Icon name={hidden ? "eyeOff" : "eye"} />
            </button>
          </div>
          <div className={s.toolGroup}>
            <button
              type="button"
              className={s.tool}
              data-tip="Remove drawings"
              aria-label="Remove drawings"
              disabled={locked}
              onClick={() => setDrawings((m) => ({ ...m, [symbol]: [] }))}
            >
              <Icon name="trash" />
            </button>
          </div>
        </nav>

        {/* ── chart ── */}
        <main className={s.center}>
          <Chart
            spec={spec}
            bars={bars}
            compareSpec={compareSpec}
            compare={compare}
            interval={interval}
            range={range}
            version={version}
            pre={pre}
            bid={bid}
            ask={ask}
            tool={locked && tool !== "cross" ? "cross" : tool}
            setTool={setTool}
            magnet={magnet}
            hidden={hidden}
            drawings={drawings[symbol] ?? []}
            addDrawing={addDrawing}
            reduce={reduce}
          />
          <div className={s.bottomBar}>
            {RANGES.map((r) => (
              <button key={r} type="button" className={s.rangeBtn} onClick={() => pickRange(r)}>
                {r}
              </button>
            ))}
            <span className={s.vrule} />
            <button type="button" className={s.btnIcon} aria-label="Go to date">
              <Icon name="dateRange" />
            </button>
            <div className={s.grow} />
            <span className={s.clock}>{utcClock(now)}</span>
            <span className={s.vrule} />
            <button
              type="button"
              className={s.rangeBtn}
              data-on={adj || undefined}
              aria-pressed={adj}
              onClick={() => setAdj((a) => !a)}
            >
              ADJ
            </button>
          </div>
          <button
            type="button"
            className={s.handle}
            aria-label={panelOpen ? "Hide the widget panel" : "Show the widget panel"}
            onClick={() => setPanelOpen((o) => !o)}
          >
            <Glyph name="chevRight" size={12} />
          </button>
        </main>

        {/* ── widget panel ── */}
        <aside className={s.right}>
          {panelOpen ? (
            <div className={s.pages}>
              <Watchlist quotes={quotes} selected={symbol} onSelect={setSymbol} />
              <Details spec={spec} quote={quote} />
            </div>
          ) : null}
          <Rail panelOpen={panelOpen} onToggle={() => setPanelOpen((o) => !o)} />
        </aside>
      </div>
    </div>
  );
}

/* ── small parts ──────────────────────────────────────────────────────────── */

function IconBtn({ icon, label, disabled }: { icon: IconName; label: string; disabled?: boolean }) {
  return (
    <button type="button" className={s.btnIcon} aria-label={label} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

const Divider = () => <span className={s.divider} aria-hidden />;

/* ── watchlist ────────────────────────────────────────────────────────────── */

function Watchlist({
  quotes,
  selected,
  onSelect,
}: {
  quotes: Record<string, Quote>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const groups = ["INDICES", "STOCKS"] as const;
  const visible = SPECS.filter((sp) => !closed[sp.group]);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = visible.findIndex((sp) => sp.id === selected);
    const j = Math.max(0, Math.min(visible.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
    onSelect(visible[j].id);
    rowRefs.current[visible[j].id]?.focus();
  };

  return (
    <section className={s.watch} aria-label="Watchlist">
      <div className={s.wHead}>
        <button type="button" className={s.wTitle}>
          Watchlist
          <Glyph name="chevDown" />
        </button>
        <div className={s.grow} />
        <IconBtn icon="plus" label="Add symbol" />
        <IconBtn icon="fullscreen" label="Advanced view" />
        <IconBtn icon="dots" label="More" />
      </div>
      <div className={s.cols} role="row">
        <svg className={s.flag} width="12" height="14" viewBox="0 0 12 14" aria-hidden>
          <path d="M0 0h12l-4 7 4 7H0z" fill="#e3e3e3" />
        </svg>
        <span>Symbol</span>
        <span className={s.num}>Last</span>
        <span className={s.num}>Chg</span>
        <span className={s.num}>Chg%</span>
      </div>
      <div className={s.list} onKeyDown={onKey}>
        {groups.map((g) => (
          <div key={g}>
            <button
              type="button"
              className={s.section}
              aria-expanded={!closed[g]}
              onClick={() => setClosed((c) => ({ ...c, [g]: !c[g] }))}
            >
              <span className={s.sectionChev} data-closed={closed[g] || undefined}>
                <Glyph name="chevDown" size={16} />
              </span>
              {g}
            </button>
            {closed[g]
              ? null
              : SPECS.filter((sp) => sp.group === g).map((sp) => {
                  const q = quotes[sp.id];
                  const prevClose = sp.last - sp.chg;
                  const chg = q.last - prevClose;
                  const str = lastStr(sp, q.last);
                  const tone = chg >= 0 ? s.up : s.down;
                  return (
                    <button
                      key={sp.id}
                      ref={(el) => {
                        rowRefs.current[sp.id] = el;
                      }}
                      type="button"
                      className={s.row}
                      data-selected={sp.id === selected || undefined}
                      aria-current={sp.id === selected || undefined}
                      onClick={() => onSelect(sp.id)}
                    >
                      <span className={s.sym}>
                        <Badge spec={sp} size={18} />
                        <span>{sp.id}</span>
                        {sp.delayed ? <sup className={s.delayed}>D</sup> : null}
                        {sp.status !== "open" ? (
                          <span className={s.dot} data-status={sp.status} aria-label={sp.status === "pre" ? "Pre-market" : "Market closed"} />
                        ) : null}
                      </span>
                      <span className={s.num}>
                        {str.slice(0, q.keep)}
                        <span className={q.dir > 0 ? s.up : q.dir < 0 ? s.down : undefined}>{str.slice(q.keep)}</span>
                      </span>
                      <span className={`${s.num} ${tone}`}>{fmt(chg, sp.decimals)}</span>
                      <span className={`${s.num} ${tone}`}>{fmt((chg / prevClose) * 100)}%</span>
                    </button>
                  );
                })}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── details ──────────────────────────────────────────────────────────────── */

const PERF: { id: RangeId | "1W"; label: string }[] = [
  { id: "1W", label: "1W" },
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "YTD", label: "YTD" },
  { id: "1Y", label: "1Y" },
];

function Details({ spec, quote }: { spec: Spec; quote: Quote }) {
  const prevClose = spec.last - spec.chg;
  const chg = quote.last - prevClose;
  const chgPct = (chg / prevClose) * 100;
  const tone = chg >= 0 ? s.upStrong : s.downStrong;
  const preChg = quote.pre !== undefined ? quote.pre - quote.last : 0;
  const preTone = preChg >= 0 ? s.upStrong : s.downStrong;

  const perf = useMemo(() => {
    const daily = seriesFor(spec.id).daily;
    const last = daily[daily.length - 1].c;
    return PERF.map((p) => {
      const from = p.id === "1W" ? daily[daily.length - 6].t : rangeStart(p.id as RangeId, daily);
      const i = Math.max(0, firstIndexOnOrAfter(daily, from) - 1);
      return { label: p.label, v: (last / daily[i].c - 1) * 100 };
    });
    // The live tick moves the last bar, so the version is folded in via quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, quote.last]);

  const share = spec.volume / (spec.volume + spec.avgVolume);

  return (
    <section className={s.details} aria-label={`${spec.id} details`}>
      <div className={s.dHead}>
        <Badge spec={spec} size={24} />
        <span className={s.dTicker}>{spec.id}</span>
        <div className={s.grow} />
        <IconBtn icon="grid4" label="Layout" />
        <IconBtn icon="edit" label="Add note" />
        <IconBtn icon="dots" label="More" />
      </div>
      <p className={s.dName}>
        {spec.name}
        <span className={s.dExt}>
          <Glyph name="external" size={16} />
        </span>
        <span className={s.bullet}>•</span>
        {spec.exchange}
      </p>
      <p className={s.dSector}>
        {spec.sector}
        <span className={s.bullet}>•</span>
        {spec.industry}
      </p>

      <div className={s.priceRow}>
        <span className={s.bigPrice}>{fmt(quote.last, spec.decimals)}</span>
        {spec.currency ? <span className={s.ccy}>{spec.currency}</span> : null}
        <span className={tone}>{fmtSigned(chg, spec.decimals)}</span>
        <span className={tone}>{fmtSigned(chgPct)}%</span>
      </div>
      <p className={s.updated}>
        {spec.live === "last" ? "Real-time" : "Last update at"} {clockParts(spec.live === "last" ? quote.at : LAST_REGULAR)}
      </p>

      {quote.pre !== undefined ? (
        <>
          <div className={s.preRow}>
            <span className={s.midPrice}>{fmt(quote.pre, spec.decimals)}</span>
            <span className={s.ccySmall}>{spec.currency}</span>
            <span className={preTone}>{fmtSigned(preChg, spec.decimals)}</span>
            <span className={preTone}>{fmtSigned((preChg / quote.last) * 100)}%</span>
          </div>
          <p className={s.updated}>
            <span className={s.preTag}>
              <Glyph name="sun" size={16} />
              Pre-market
            </span>
            Last update at {clockParts(quote.at)}
          </p>
        </>
      ) : (
        <p className={s.status}>
          <span className={s.statusDot} data-status={spec.status} />
          {spec.status === "open" ? "Market open" : "Market closed"}
          {spec.delayed ? <span className={s.delayedNote}>· Data is delayed 15 minutes</span> : null}
        </p>
      )}

      {spec.volume ? (
        <div className={s.volume}>
          <div className={s.volLabels}>
            <span>Volume</span>
            <span>Avg. volume (30D)</span>
          </div>
          <div className={s.volValues}>
            <span>{fmtVol(spec.volume)}</span>
            <span>{fmtVol(spec.avgVolume)}</span>
          </div>
          <div className={s.volBar} aria-hidden>
            <span style={{ flexGrow: share }} />
            <span style={{ flexGrow: 1 - share }} />
          </div>
        </div>
      ) : null}

      <div className={s.facts}>
        <p className={s.factsTitle}>
          <Glyph name="sparkle" size={18} strokeWidth={1.3} />
          Key facts
        </p>
        <p className={s.factsBody}>{spec.about}</p>
        <button type="button" className={s.keep}>
          Keep reading <Glyph name="chevRight" size={14} />
        </button>
      </div>

      <p className={s.perfTitle}>Performance</p>
      <div className={s.perf}>
        {perf.map((p) => (
          <div key={p.label} className={s.perfCell} data-tone={p.v >= 0 ? "up" : "down"}>
            <span className={s.perfValue}>{fmtSigned(p.v)}%</span>
            <span className={s.perfLabel}>{p.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── widget rail ──────────────────────────────────────────────────────────── */

const RAIL_LOWER: { icon: IconName; label: string }[] = [
  { icon: "sparkle", label: "Assistant" },
  { icon: "target", label: "Screeners" },
  { icon: "ideasGear", label: "Pine editor" },
  { icon: "ideas", label: "Ideas" },
  { icon: "calendar", label: "Calendar" },
  { icon: "stream", label: "Streams" },
  { icon: "bell", label: "Notifications" },
  { icon: "chat", label: "Chats" },
];

function Rail({ panelOpen, onToggle }: { panelOpen: boolean; onToggle: () => void }) {
  return (
    <nav className={s.rail} aria-label="Widgets">
      <button
        type="button"
        className={s.rbtn}
        data-active={panelOpen || undefined}
        data-tip="Watchlist, details and news"
        aria-pressed={panelOpen}
        aria-label="Watchlist, details and news"
        onClick={onToggle}
      >
        <Icon name="watchlist" />
      </button>
      <button type="button" className={s.rbtn} data-tip="Alerts" aria-label="Alerts">
        <Icon name="alarm" />
      </button>
      <button type="button" className={s.rbtn} data-tip="Object tree" aria-label="Object tree">
        <Icon name="layers" />
      </button>
      <div className={s.grow} />
      {RAIL_LOWER.map((r) => (
        <button key={r.icon} type="button" className={s.rbtn} data-tip={r.label} aria-label={r.label}>
          <Icon name={r.icon} />
        </button>
      ))}
      <button type="button" className={s.apps} aria-label="Products">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          {[2, 8, 14].flatMap((x) =>
            [2, 8, 14].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="currentColor" />),
          )}
        </svg>
      </button>
      <span className={s.railRule} />
      <button type="button" className={s.rbtn} data-tip="Help Center" aria-label="Help Center">
        <Icon name="help" />
      </button>
    </nav>
  );
}

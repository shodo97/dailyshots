"use client";

/* The yard from above: asphalt, paint, sixteen blocks of stacks, the gantries
   that span them, the lanes the trucks run, and the quay with the ship. */

import { memo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import {
  BLOCKS,
  BLOCK_BY_ID,
  G,
  GANTRY,
  MOVES,
  OPS,
  OTHER_BAYS,
  ROWS,
  SHIP_ROWS,
  STACK_BY_KEY,
  TOTAL,
  TROLLEY,
  bayX,
  laneY,
  rowY,
  shade,
  shipBayY,
  shipRowX,
  type Block,
  type Box,
  type Stack,
  type Yard,
} from "./data";
import { useFrame } from "./frame";
import { Diamond, OwMark, PlugMark } from "./icons";
import { AMBIENT, ambientPose, clamp, departingTruck, gantryPose, qcPose, routeOf, truckPose, type Frame } from "./sim";
import s from "./shot.module.css";

const PAINT = "#ebe9e1";
const YELLOW = "#e7b622";

/* ── geometry helpers ────────────────────────────────────────────────────── */

export function stackRect(st: Stack) {
  const b = BLOCK_BY_ID[st.block];
  const w = st.feet === 40 ? 58 : 28;
  const cx = bayX(b, st.bay);
  return { x: cx - w / 2, y: b.y + (st.row - 1) * G.row + (G.row - G.boxW) / 2, w, h: G.boxW, cx, cy: rowY(b, st.row) };
}

export function stackAt(x: number, y: number): Stack | null {
  for (const b of BLOCKS) {
    if (x < b.x || x >= b.x + G.blockW || y < b.y || y >= b.y + G.blockH) continue;
    const idx = Math.floor((x - b.x) / G.slot);
    const row = Math.floor((y - b.y) / G.row) + 1;
    const g = Math.floor(idx / 2);
    const bay = b.groups[g] === 40 ? g * 4 + 2 : idx * 2 + 1;
    return STACK_BY_KEY[`${b.id}-${String(bay).padStart(2, "0")}-${String(row).padStart(2, "0")}`] ?? null;
  }
  return null;
}

/* ── one box seen from above ─────────────────────────────────────────────── */

function BoxTop({ x, y, w, h, box, tier, num }: { x: number; y: number; w: number; h: number; box: Box; tier: number; num: boolean }) {
  const op = OPS[box.op];
  const fill = shade(op.paint, tier);
  const light = box.op === "ARK" || box.op === "HLX";
  const ink = light && tier >= 3 ? "#1f2022" : "#f1efe8";
  return (
    <g>
      <rect x={x + tier * 0.55} y={y + tier * 0.8} width={w} height={h} fill="#232426" opacity={0.42} />
      <rect x={x} y={y} width={w} height={h} fill={fill} />
      {/* door end and roof seam */}
      <rect x={x} y={y} width={1.1} height={h} fill="#000" opacity={0.18} />
      <line x1={x + w / 2} x2={x + w / 2} y1={y + 1} y2={y + h - 1} stroke="#000" strokeOpacity={0.12} strokeWidth={0.5} />
      {num && (
        <text x={x + w - 2.4} y={y + h - 2.1} textAnchor="end" className={s.tierNum} fill={ink}>
          {tier}
        </text>
      )}
      {box.imdg ? (
        <Diamond x={x + 6.2} y={y + h / 2} s={8.6} cls={box.imdg.cls} label={false} />
      ) : box.reefer ? (
        <PlugMark x={x + 5.6} y={y + h / 2 + 0.2} s={7.4} color={ink} />
      ) : box.ow ? (
        <OwMark x={x + 5.6} y={y + h / 2 + 0.4} s={6.6} color={ink} />
      ) : null}
    </g>
  );
}

const BlockStacks = memo(function BlockStacks({
  block,
  stacks,
  dim,
  nums,
}: {
  block: Block;
  stacks: Record<string, Box[]>;
  dim: boolean;
  nums: boolean;
}) {
  return (
    <g className={dim ? s.blockDim : s.block}>
      {Object.entries(stacks).map(([key, boxes]) => {
        if (!boxes.length) return null;
        const r = stackRect(STACK_BY_KEY[key]);
        const top = boxes[boxes.length - 1];
        return <BoxTop key={key} x={r.x} y={r.y} w={r.w} h={r.h} box={top} tier={boxes.length} num={nums} />;
      })}
      <title>{`Block ${block.id}`}</title>
    </g>
  );
});

/* ── ground: asphalt, paint, the quay and the ship's deck ────────────────── */

const Ground = memo(function Ground() {
  const rowsY = [0, 1, 2, 3].map((r) => 36 + r * 112);
  return (
    <g>
      <rect x={0} y={0} width={G.W} height={G.H} fill="var(--asphalt)" />
      {/* lanes: yellow edge lines either side, white dashed centre */}
      {[0, 1, 2, 3, 4].map((i) => {
        const top = i === 0 ? 0 : rowsY[i - 1] + G.blockH;
        const bottom = i === 4 ? G.H : rowsY[i];
        const mid = i === 0 ? top + 16 : top + 22;
        return (
          <g key={i}>
            {i > 0 && <line x1={10} x2={812} y1={top + 4} y2={top + 4} stroke={YELLOW} strokeWidth={1.1} opacity={0.82} />}
            {i < 4 && <line x1={10} x2={812} y1={bottom - 4} y2={bottom - 4} stroke={YELLOW} strokeWidth={1.1} opacity={0.82} />}
            {i > 0 && i < 4 && (
              <line x1={10} x2={812} y1={mid} y2={mid} stroke={PAINT} strokeWidth={0.9} strokeDasharray="10 9" opacity={0.6} />
            )}
          </g>
        );
      })}
      {/* lane direction arrows, eastbound to the quay on the block side */}
      {[0, 1, 2, 3].map((r) =>
        [112, 515].map((x) => (
          <path
            key={`${r}-${x}`}
            d={`M${x} ${rowsY[r] + G.blockH + 13}h14m-4 -3.4l4 3.4-4 3.4`}
            fill="none"
            stroke={PAINT}
            strokeWidth={1.2}
            opacity={0.55}
          />
        )),
      )}
      {BLOCKS.map((b) => (
        <g key={b.id}>
          <rect x={b.x - 2} y={b.y - 2} width={G.blockW + 4} height={G.blockH + 4} fill="var(--slab)" />
          {/* RMG rails */}
          <line x1={b.x - 6} x2={b.x + G.blockW + 6} y1={b.y - 4} y2={b.y - 4} stroke="#8b8d88" strokeWidth={0.9} />
          <line x1={b.x - 6} x2={b.x + G.blockW + 6} y1={b.y + G.blockH + 4} y2={b.y + G.blockH + 4} stroke="#8b8d88" strokeWidth={0.9} />
          {/* ground slots painted on the slab */}
          {ROWS.map((row) => (
            <line
              key={row}
              x1={b.x}
              x2={b.x + G.blockW}
              y1={b.y + row * G.row - 0.2}
              y2={b.y + row * G.row - 0.2}
              stroke={PAINT}
              strokeOpacity={row === 6 ? 0 : 0.14}
              strokeWidth={0.4}
            />
          ))}
          {/* reefer rack along the north rail of the column-1 blocks */}
          {b.c === 1 && (
            <g>
              <rect x={b.x} y={b.y - 9.5} width={G.blockW} height={3} fill={YELLOW} opacity={0.85} />
              {Array.from({ length: 12 }, (_, k) => (
                <rect key={k} x={b.x + 3 + k * 15} y={b.y - 9.5} width={6} height={3} fill="#2a2b2d" />
              ))}
            </g>
          )}
          <text x={b.x - 11} y={b.y + G.blockH / 2 + 6.5} textAnchor="middle" className={s.stencil}>
            {b.id}
          </text>
        </g>
      ))}

      {/* apron */}
      <rect x={816} y={0} width={G.quayEdge - 816} height={G.H} fill="var(--apron)" />
      <line x1={816} x2={816} y1={0} y2={G.H} stroke={YELLOW} strokeWidth={1.2} opacity={0.8} />
      {[G.railA, G.railB].map((x) => (
        <g key={x}>
          <line x1={x - 1.2} x2={x - 1.2} y1={0} y2={G.H} stroke="#9a9c96" strokeWidth={0.7} />
          <line x1={x + 1.2} x2={x + 1.2} y1={0} y2={G.H} stroke="#9a9c96" strokeWidth={0.7} />
        </g>
      ))}
      <line x1={G.apronLaneX - 9} x2={G.apronLaneX - 9} y1={0} y2={G.H} stroke={PAINT} strokeWidth={0.8} opacity={0.5} />
      <line x1={G.apronLaneX + 9} x2={G.apronLaneX + 9} y1={0} y2={G.H} stroke={PAINT} strokeWidth={0.8} opacity={0.5} />
      <line x1={G.serviceX + 9} x2={G.serviceX + 9} y1={0} y2={G.H} stroke={PAINT} strokeWidth={0.8} strokeDasharray="6 6" opacity={0.45} />
      <text x={0} y={0} className={s.stencilSmall} transform={`translate(${G.railB + 6} 420) rotate(-90)`}>
        BERTH 4
      </text>
      {/* quay wall, bollards, water */}
      <rect x={G.quayEdge - 2} y={0} width={2} height={G.H} fill="#c7c3b8" />
      {Array.from({ length: 10 }, (_, k) => (
        <circle key={k} cx={G.quayEdge - 5} cy={20 + k * 50} r={1.6} fill="#2a2b2d" />
      ))}
      <rect x={G.quayEdge} y={0} width={G.hullX0 - G.quayEdge + 4} height={G.H} fill="var(--water)" />
      {/* hull: port side alongside, deck runs off both ends of the plan */}
      <rect x={G.hullX0} y={-10} width={G.hullX1 - G.hullX0} height={G.H + 20} fill="var(--hull)" />
      <rect x={G.hullX0 + 3} y={-10} width={G.hullX1 - G.hullX0 - 6} height={G.H + 20} fill="var(--deck)" />
      {[...OTHER_BAYS.map((o) => o.bay), 34].map((bay) => {
        const y = shipBayY(bay);
        return (
          <g key={bay}>
            <rect x={G.shipRow0 - 1} y={y - 30} width={SHIP_ROWS.length * G.shipPitch + 2} height={60} fill="var(--hatch)" />
            <line x1={G.shipRow0 + 6 * G.shipPitch} x2={G.shipRow0 + 6 * G.shipPitch} y1={y - 30} y2={y + 30} stroke="#000" strokeOpacity={0.2} strokeWidth={0.6} />
            <text
              x={0}
              y={0}
              className={bay === 34 ? s.bayLabelOn : s.bayLabel}
              transform={`translate(${G.quayEdge + 8} ${y}) rotate(-90)`}
              textAnchor="middle"
            >
              {bay}
            </text>
          </g>
        );
      })}
      {OTHER_BAYS.map((o) =>
        o.tops.map((op, i) =>
          op ? (
            <rect
              key={`${o.bay}-${i}`}
              x={G.shipRow0 + i * G.shipPitch + 0.4}
              y={shipBayY(o.bay) - 29}
              width={G.shipPitch - 0.8}
              height={58}
              fill={shade(OPS[op].paint, 3 + (i % 2))}
            />
          ) : null,
        ),
      )}
    </g>
  );
});

/* ── machines ────────────────────────────────────────────────────────────── */

function GantryShape({ block, active }: { block: Block; active?: boolean }) {
  const top = block.y - 7;
  const bottom = laneY(block) + 9;
  return (
    <g className={active ? s.gantryActive : s.gantry}>
      <line x1={-13} x2={-13} y1={top} y2={bottom} />
      <line x1={13} x2={13} y1={top} y2={bottom} />
      <line x1={-15} x2={15} y1={top} y2={top} />
      <line x1={-15} x2={15} y1={bottom} y2={bottom} />
      <line x1={-15} x2={15} y1={block.y + G.blockH + 4} y2={block.y + G.blockH + 4} strokeOpacity={0.6} />
      {[top + 3, block.y + G.blockH + 4].map((y) => (
        <g key={y}>
          <rect x={-17} y={y - 2.5} width={6} height={5} className={s.gantryPad} />
          <rect x={11} y={y - 2.5} width={6} height={5} className={s.gantryPad} />
        </g>
      ))}
    </g>
  );
}

function Truck({ box, refEl, refBox, op }: { box: Box | null; refEl?: (el: SVGGElement | null) => void; refBox?: (el: SVGGElement | null) => void; op?: string }) {
  const paint = box ? OPS[box.op].paint : op ? OPS[op as keyof typeof OPS].paint : null;
  const len = box ? (box.feet === 40 ? 58 : 28) : 58;
  return (
    <g ref={refEl} className={s.truck}>
      <rect x={-31} y={-3.6} width={62} height={7.2} fill="#2b2c2e" />
      <rect x={-31} y={-3.6} width={62} height={7.2} fill="none" stroke="#5a5c5e" strokeWidth={0.5} />
      <g ref={refBox}>
        {paint && (
          <>
            <rect x={-len / 2 + 1.4} y={-3.6} width={len} height={G.boxW} fill="#1d1e20" opacity={0.4} transform="translate(0 0.4)" />
            <rect x={-len / 2} y={-G.boxW / 2} width={len} height={G.boxW} fill={paint} />
            <rect x={-len / 2} y={-G.boxW / 2} width={1.1} height={G.boxW} fill="#000" opacity={0.2} />
            {box && <rect x={-len / 2} y={-G.boxW / 2} width={len} height={G.boxW} className={s.carriedEdge} />}
          </>
        )}
      </g>
      <rect x={32} y={-5} width={10} height={10} rx={1.2} fill="#d9d5c8" />
      <rect x={39.4} y={-4} width={2} height={8} fill="#3a4a54" />
    </g>
  );
}

function QcShape({ y, label, active }: { y: number; label: string; active?: boolean }) {
  return (
    <g className={active ? s.qcActive : s.qc}>
      <line x1={G.railA} x2={G.railB} y1={y - 26} y2={y - 26} strokeWidth={2.2} />
      <line x1={G.railA} x2={G.railB} y1={y + 26} y2={y + 26} strokeWidth={2.2} />
      <line x1={808} x2={G.W} y1={y - 6} y2={y - 6} strokeWidth={2} />
      <line x1={808} x2={G.W} y1={y + 6} y2={y + 6} strokeWidth={2} />
      {[820, 870, 930, 990, 1040].map((x) => (
        <line key={x} x1={x} x2={x + 8} y1={y - 6} y2={y + 6} strokeWidth={0.8} />
      ))}
      {[G.railA, G.railB].flatMap((x) =>
        [y - 26, y + 26].map((yy) => <rect key={`${x}-${yy}`} x={x - 4} y={yy - 3.5} width={8} height={7} className={s.qcPad} />),
      )}
      <text x={G.railA - 6} y={y - 30} textAnchor="end" className={s.qcLabel}>
        {label}
      </text>
    </g>
  );
}

/* ── the plan ────────────────────────────────────────────────────────────── */

type Props = {
  yard: Yard;
  m: number;
  ph: number;
  phaseKind: string;
  selectedKey: string | null;
  hoverKey: string | null;
  cursorKey: string | null;
  onHover: (key: string | null) => void;
  onPick: (key: string) => void;
  onKey: (e: KeyboardEvent<SVGSVGElement>) => void;
  focusLabel: string;
  /** Following the live move: everything not involved in it steps back. */
  spotlight: boolean;
  /** Blocks whose tier numerals are shown. */
  numBlocks: string[];
};

export function Plan({ yard, m, ph, phaseKind, selectedKey, hoverKey, cursorKey, onHover, onPick, onKey, focusLabel, spotlight, numBlocks }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const gantry = useRef<SVGGElement>(null);
  const trolley = useRef<SVGRectElement>(null);
  const carried = useRef<SVGGElement>(null);
  const carriedShadow = useRef<SVGRectElement>(null);
  const truck = useRef<SVGGElement | null>(null);
  const truckBox = useRef<SVGGElement | null>(null);
  const dep = useRef<SVGGElement | null>(null);
  const amb = useRef<(SVGGElement | null)[]>([]);
  const qcTrolley = useRef<SVGGElement>(null);
  const qcBox = useRef<SVGGElement>(null);
  const qc4 = useRef<SVGGElement>(null);
  const qc4Box = useRef<SVGRectElement>(null);
  const shipLanding = useRef<SVGRectElement>(null);

  const done = m >= TOTAL;
  const mv = done ? null : MOVES[m];
  const activeBlock = mv ? BLOCK_BY_ID[mv.block] : null;
  const carriedBox = mv ? (phaseKind === "rehandle" ? mv.rehandles[ph - 1]?.box : mv.box) : null;
  const prevBox = m > 0 ? MOVES[Math.min(m, TOTAL) - 1].box : null;

  useFrame((f: Frame) => {
    const g = gantryPose(f);
    if (gantry.current) gantry.current.setAttribute("transform", g ? `translate(${g.x} 0)` : "translate(-999 0)");
    if (g && trolley.current) trolley.current.setAttribute("y", String(g.y - 5));
    if (carried.current) {
      const c = g?.carried;
      if (!c) carried.current.setAttribute("opacity", "0");
      else {
        const lift = clamp((c.hoist - (c.tierY >= 0 ? 0 : 0)) / 6);
        const sc = 1 + lift * 0.07;
        carried.current.setAttribute("opacity", "1");
        carried.current.setAttribute("transform", `translate(${c.x} ${c.y}) scale(${sc})`);
        carriedShadow.current?.setAttribute("transform", `translate(${1 + c.hoist * 1.3} ${1.4 + c.hoist * 1.8})`);
        carriedShadow.current?.setAttribute("opacity", String(0.5 - lift * 0.22));
      }
    }
    const t = truckPose(f);
    if (truck.current) {
      truck.current.setAttribute("opacity", t ? "1" : "0");
      if (t) truck.current.setAttribute("transform", `translate(${t.x} ${t.y}) rotate(${t.angle})`);
      truckBox.current?.setAttribute("opacity", t?.box ? "1" : "0");
    }
    const d = departingTruck(f);
    if (dep.current) {
      dep.current.setAttribute("opacity", d ? "1" : "0");
      if (d) dep.current.setAttribute("transform", `translate(${d.x} ${d.y}) rotate(${d.angle})`);
    }
    AMBIENT.forEach((_, i) => {
      const el = amb.current[i];
      if (!el) return;
      const p = ambientPose(i, f.settled ? 4200 + i * 3100 : f.now);
      el.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${p.angle})`);
    });
    const q = qcPose(f);
    qcTrolley.current?.setAttribute("transform", `translate(${q.trolleyX} ${G.bay34Y})`);
    if (qcBox.current) {
      qcBox.current.setAttribute("opacity", q.box ? String(1 - q.landed * 0.15) : "0");
      qcBox.current.setAttribute("transform", `translate(${q.boxX} ${G.bay34Y}) scale(${1 + q.lift * 0.06})`);
    }
    // QC 04 discharging bay 22 on its own cycle.
    const cyc = f.settled ? 0.3 : ((f.now / 1000) % 11) / 11;
    const k = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
    const ease = k * k * (3 - 2 * k);
    const x4 = G.apronLaneX + (shipRowX(5) - G.apronLaneX) * ease;
    qc4.current?.setAttribute("transform", `translate(${x4} ${shipBayY(22)})`);
    qc4Box.current?.setAttribute("opacity", cyc >= 0.5 ? "1" : "0");
    shipLanding.current?.setAttribute("opacity", String(q.landed > 0.98 ? 1 : 0));
  });

  const toSvg = (e: PointerEvent<SVGSVGElement>) => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return stackAt(pt.x, pt.y);
  };

  const shipDeck = deckTops(m);
  const rh = mv && phaseKind === "rehandle" ? mv.rehandles[ph - 1] : null;
  const showTarget = mv && (phaseKind === "travel" || phaseKind === "rehandle" || phaseKind === "lift");
  const routeD =
    mv && activeBlock
      ? `M${mv.gantryTo} ${rowY(activeBlock, mv.row)} V${laneY(activeBlock)} ${routeOf(m)
          .slice(1)
          .map(([x, y]) => `L${x} ${y}`)
          .join(" ")} H${shipRowX(mv.to.row)}`
      : null;

  return (
    <svg
      ref={svg}
      className={s.plan}
      viewBox={`0 0 ${G.W} ${G.H}`}
      role="application"
      aria-roledescription="yard plan"
      aria-label={focusLabel}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={(e) => onHover(toSvg(e)?.key ?? null)}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        const st = toSvg(e as unknown as PointerEvent<SVGSVGElement>);
        if (st) onPick(st.key);
      }}
      style={{ cursor: hoverKey ? "pointer" : "default" }}
    >
      <Ground />

      {BLOCKS.map((b) => (
        <BlockStacks
          key={b.id}
          block={b}
          stacks={yard[b.id]}
          dim={spotlight && !!activeBlock && b.id !== activeBlock.id}
          nums={numBlocks.includes(b.id)}
        />
      ))}


      {/* ship: bay 34 as loaded so far, top box per row */}
      {shipDeck.map((c) =>
        c.box ? (
          <rect
            key={c.row}
            x={shipRowX(c.row) - G.shipPitch / 2 + 0.4}
            y={G.bay34Y - 29}
            width={G.shipPitch - 0.8}
            height={58}
            fill={shade(OPS[c.box.op].paint, Math.min(5, c.tiers + 1))}
          />
        ) : null,
      )}
      {mv && (
        <rect
          ref={shipLanding}
          x={shipRowX(mv.to.row) - G.shipPitch / 2 + 0.4}
          y={G.bay34Y - 29}
          width={G.shipPitch - 0.8}
          height={58}
          fill={OPS[mv.box.op].paint}
          opacity={0}
        />
      )}

      {/* marks: active target, rehandle destination, selection, hover */}
      {showTarget && mv && <Marker st={STACK_BY_KEY[mv.key]} kind="target" />}
      {rh && <Marker st={STACK_BY_KEY[rh.to]} kind="dest" />}
      {selectedKey && <Marker st={STACK_BY_KEY[selectedKey]} kind="select" />}
      {hoverKey && hoverKey !== selectedKey && <Marker st={STACK_BY_KEY[hoverKey]} kind="hover" />}
      {cursorKey && cursorKey !== hoverKey && <Marker st={STACK_BY_KEY[cursorKey]} kind="cursor" />}

      {/* idle gantries where the replay left them */}
      {BLOCKS.filter((b) => b.id !== activeBlock?.id).map((b) => (
        <g key={b.id} transform={`translate(${GANTRY[Math.min(m, TOTAL)][b.id]} 0)`} className={spotlight ? s.blockDim : s.block}>
          <GantryShape block={b} />
          <rect x={-12} y={TROLLEY[Math.min(m, TOTAL)][b.id] - 5} width={24} height={10} className={s.trolley} />
        </g>
      ))}

      {/* the active move, end to end: stack, gantry, lane, quay crane, slot */}
      {mv && routeD && (
        <g className={s.routeGroup}>
          <path className={s.routeCase} d={routeD} />
          <path className={s.route} d={routeD} />
        </g>
      )}

      {/* traffic */}
      <g className={spotlight ? s.trafficDim : undefined}>
      {AMBIENT.map((a, i) => (
        <Truck
          key={i}
          box={null}
          op={a.feet ? a.op : undefined}
          refEl={(el) => {
            amb.current[i] = el;
          }}
        />
      ))}
      </g>
      {prevBox && (
        <Truck
          key={`dep-${m}`}
          box={null}
          refEl={(el) => {
            dep.current = el;
          }}
        />
      )}
      {mv && (
        <Truck
          key={`truck-${m}`}
          box={mv.box}
          refEl={(el) => {
            truck.current = el;
          }}
          refBox={(el) => {
            truckBox.current = el;
          }}
        />
      )}

      {/* what hangs under the active gantry */}
      {carriedBox && (
        <g ref={carried} key={`c-${m}-${ph}`} opacity={0}>
          <rect ref={carriedShadow} x={-29} y={-G.boxW / 2} width={58} height={G.boxW} fill="#1d1e20" />
          <rect x={-29} y={-G.boxW / 2} width={58} height={G.boxW} fill={OPS[carriedBox.op].paint} />
          <rect x={-29} y={-G.boxW / 2} width={58} height={G.boxW} className={s.carriedEdge} />
        </g>
      )}

      {activeBlock && (
        <g ref={gantry} key={`g-${activeBlock.id}`}>
          <GantryShape block={activeBlock} active />
          <rect ref={trolley} x={-12} y={0} width={24} height={10} className={s.trolleyActive} />
        </g>
      )}

      {/* quay cranes */}
      <QcShape y={shipBayY(22)} label="QC 04" />
      <g ref={qc4}>
        <rect ref={qc4Box} x={-G.boxW / 2} y={-29} width={G.boxW} height={58} fill={OPS.MRN.paint} opacity={0} />
        <rect x={-7} y={-8} width={14} height={16} className={s.qcTrolley} />
      </g>
      <QcShape y={G.bay34Y} label="QC 03" active />
      {mv && (
        <g ref={qcBox} key={`qcb-${m}`} opacity={0}>
          <rect x={-G.boxW / 2 + 2} y={-27} width={G.boxW} height={58} fill="#1d1e20" opacity={0.35} />
          <rect x={-G.boxW / 2} y={-29} width={G.boxW} height={58} fill={OPS[mv.box.op].paint} />
          <rect x={-G.boxW / 2} y={-29} width={G.boxW} height={58} className={s.carriedEdge} />
        </g>
      )}
      <g ref={qcTrolley}>
        <rect x={-7} y={-8} width={14} height={16} className={s.qcTrolleyActive} />
      </g>
    </svg>
  );
}

function Marker({ st, kind }: { st: Stack | undefined; kind: "target" | "dest" | "select" | "hover" | "cursor" }) {
  if (!st) return null;
  const r = stackRect(st);
  const p = 2.2;
  const x0 = r.x - p;
  const y0 = r.y - p;
  const x1 = r.x + r.w + p;
  const y1 = r.y + r.h + p;
  if (kind === "select") {
    const t = 4;
    return (
      <path
        className={s.markSelect}
        d={`M${x0} ${y0 + t}V${y0}H${x0 + t}M${x1 - t} ${y0}H${x1}V${y0 + t}M${x1} ${y1 - t}V${y1}H${x1 - t}M${x0 + t} ${y1}H${x0}V${y1 - t}`}
      />
    );
  }
  return <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className={s[`mark_${kind}`]} />;
}

/** Top box per deck row of bay 34 once the first m moves have landed. */
function deckTops(m: number) {
  return SHIP_ROWS.map((row) => {
    let box: Box | null = null;
    let tiers = 0;
    for (let i = 0; i < Math.min(m, TOTAL); i++)
      if (MOVES[i].to.row === row) {
        box = MOVES[i].box;
        tiers++;
      }
    return { row, box, tiers };
  });
}


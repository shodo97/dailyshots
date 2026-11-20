"use client";

/* One row of one block, seen from the truck lane: every stack in the row, tier
   by tier, with the gantry's spreader working above it. */

import { useLayoutEffect, useRef } from "react";
import { BLOCK_BY_ID, MOVES, OPS, SNAP, TOTAL, pad2, rowY, type Box, type Yard } from "./data";
import { useFrame } from "./frame";
import { Diamond, OwMark, PlugMark } from "./icons";
import { clamp, gantryPose, type Frame } from "./sim";
import s from "./shot.module.css";

export const EV = { W: 680, H: 252, x0: 64, slot: 98, ground: 222 } as const;

/** Vertical scale for a row whose tallest stack is `top` tiers: the panel is spent on tiers in use,
    plus just under one tier of headroom for the spreader. */
type Geo = { top: number; T: number };
const geoFor = (top: number): Geo => ({ top, T: Math.min(46, 186 / (top + 0.9)) });
/** Hoist (in tiers, 6 = clear of a five-high stack) mapped into the cropped headroom. */
const disp = (g: Geo, h: number) => (h <= g.top ? h : g.top + ((h - g.top) / Math.max(0.5, 6 - g.top)) * 0.9);

const slotX = (idx: number) => EV.x0 + idx * EV.slot;
const tierTop = (g: Geo, tier: number) => EV.ground - tier * g.T;

function SideBox({ box, x, w, tier, state, badge, geo }: { box: Box; x: number; w: number; tier: number; state?: "focus" | "over" | null; badge?: number; geo: Geo }) {
  const op = OPS[box.op];
  const y = tierTop(geo, tier) + 1;
  const h = geo.T - 2;
  const mid = y + h / 2;
  const right = x + w;
  const idText = useRef<SVGTextElement>(null);
  const check = useRef<SVGGElement>(null);
  // Big Shoulders has no fixed advance, so the boxed check digit is placed after the real serial.
  useLayoutEffect(() => {
    const t = idText.current;
    if (!t || !check.current) return;
    check.current.setAttribute("transform", `translate(${x + 7 + t.getComputedTextLength() + 3} ${mid - 10.4})`);
  });
  return (
    <g className={state === "focus" ? s.sideFocus : state === "over" ? s.sideOver : undefined}>
      <rect x={x} y={y} width={w} height={h} fill={op.paint} />
      <rect x={x} y={y} width={w} height={h} fill="url(#yard-corr)" />
      <rect x={x} y={y} width={w} height={2} fill="#000" opacity={0.22} />
      <rect x={x} y={y + h - 2} width={w} height={2} fill="#000" opacity={0.28} />
      {[x, right - 3.2].flatMap((cx) =>
        [y, y + h - 3.2].map((cy) => <rect key={`${cx}-${cy}`} x={cx} y={cy} width={3.2} height={3.2} fill="#18191a" opacity={0.7} />),
      )}
      {box.reefer && (
        <g>
          <rect x={right - 15} y={y + 3} width={12} height={h - 6} fill="#2a2c2e" opacity={0.85} />
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={right - 13.5} x2={right - 4.5} y1={y + 7 + (k * (h - 14)) / 3} y2={y + 7 + (k * (h - 14)) / 3} stroke="#8e918c" strokeWidth={0.7} />
          ))}
        </g>
      )}
      <text ref={idText} x={x + 7} y={mid - 1.2} className={box.feet === 20 ? s.sideId20 : s.sideId} fill={op.ink}>
        {box.owner} {box.serial}
      </text>
      <g ref={check} transform={`translate(${x + 72} ${mid - 10.4})`}>
        <rect width={9.5} height={11.5} fill="none" stroke={op.ink} strokeWidth={0.8} />
        <text x={4.75} y={9.6} textAnchor="middle" className={s.sideId} fill={op.ink}>
          {box.check}
        </text>
      </g>
      <text x={x + 7} y={mid + 10} className={s.sideIso} fill={op.ink}>
        {box.iso} · {box.vgm.toFixed(1)} t
      </text>
      {box.imdg && <Diamond x={right - (box.reefer ? 26 : 13)} y={mid} s={17} cls={box.imdg.cls} />}
      {box.ow && <OwMark x={right - (box.imdg ? 30 : box.reefer ? 26 : 12)} y={mid} s={11} color={op.ink} />}
      {box.reefer && !box.imdg && <PlugMark x={right - 26} y={mid + 1} s={11} color={op.ink} />}
      {badge != null && (
        <g transform={`translate(${x + w - (box.reefer || box.imdg ? 44 : 22)} ${mid})`}>
          <rect x={-8} y={-7} width={16} height={14} rx={2} className={s.rhBadge} />
          <text x={0} y={3.6} textAnchor="middle" className={s.rhBadgeText}>
            {badge}
          </text>
        </g>
      )}
    </g>
  );
}

type Props = {
  yard: Yard;
  block: string;
  row: number;
  focusId: string | null;
  /** Boxes above the focus, top first. */
  overIds: string[];
  ghost: { bay: number; tier: number; text: string } | null;
  m: number;
  onPickBox: (id: string) => void;
};

export function Elevation({ yard, block, row, focusId, overIds, ghost, m, onPickBox }: Props) {
  const b = BLOCK_BY_ID[block];
  // Crop to the tiers this row reaches at any point in the current move, so the scale holds still while it works.
  const inRow = (y: Yard) =>
    Object.entries(y[block]).reduce((a, [k, bx]) => (k.endsWith(`-${pad2(row)}`) ? Math.max(a, bx.length) : a), 0);
  const top = Math.max(2, Math.min(5, Math.max(inRow(yard), inRow(SNAP[Math.min(m, TOTAL)]), inRow(SNAP[Math.min(m + 1, TOTAL)]), ghost?.tier ?? 0)));
  const geo = geoFor(top);
  const girderY = EV.ground - (top + 0.9) * geo.T - 26;
  const gantry = useRef<SVGGElement>(null);
  const cables = useRef<SVGPathElement>(null);
  const spreader = useRef<SVGRectElement>(null);
  const carried = useRef<SVGGElement>(null);
  const mv = m < TOTAL ? MOVES[m] : null;
  const live = mv?.block === block;

  useFrame((f: Frame) => {
    if (!gantry.current) return;
    const g = live ? gantryPose(f) : null;
    if (!g) {
      gantry.current.setAttribute("opacity", "0");
      return;
    }
    const gx = EV.x0 + ((g.x - b.x) / 30) * EV.slot;
    // Only the part of the trolley's travel that is over this row is visible here.
    const near = 1 - clamp(Math.abs(g.y - rowY(b, row)) / 14);
    gantry.current.setAttribute("opacity", "1");
    gantry.current.setAttribute("transform", `translate(${gx} 0)`);
    const sy = EV.ground - disp(geo, g.hoist) * geo.T;
    cables.current?.setAttribute("d", `M-14 ${girderY + 20}V${sy}M14 ${girderY + 20}V${sy}`);
    cables.current?.setAttribute("opacity", String(0.25 + near * 0.75));
    spreader.current?.setAttribute("y", String(sy - 3));
    spreader.current?.setAttribute("opacity", String(0.3 + near * 0.7));
    if (carried.current) {
      const c = g.carried;
      if (!c) carried.current.setAttribute("opacity", "0");
      else {
        const vis = 1 - clamp(Math.abs(c.y - rowY(b, row)) / 10);
        carried.current.setAttribute("opacity", String(vis));
        carried.current.setAttribute("transform", `translate(0 ${EV.ground - disp(geo, c.hoist + 1) * geo.T - tierTop(geo, 1)})`);
      }
    }
  });

  const stacks: { bay: number; idx: number; w: number; boxes: Box[] }[] = [];
  b.groups.forEach((feet, g) => {
    const bays = feet === 40 ? [g * 4 + 2] : [g * 4 + 1, g * 4 + 3];
    bays.forEach((bay, k) => {
      const key = `${block}-${pad2(bay)}-${pad2(row)}`;
      stacks.push({ bay, idx: feet === 40 ? g * 2 : g * 2 + k, w: feet === 40 ? EV.slot * 2 - 4 : EV.slot - 4, boxes: yard[block][key] ?? [] });
    });
  });

  const carriedBox = live && mv ? mv.box : null;

  return (
    <svg viewBox={`0 ${Math.max(0, girderY - 6)} ${EV.W} ${EV.H - Math.max(0, girderY - 6)}`} className={s.elevation} role="img" aria-label={`Row ${pad2(row)} of block ${block}, side elevation`}>
      <defs>
        <pattern id="yard-corr" width={4.5} height={10} patternUnits="userSpaceOnUse">
          <rect width={1.6} height={10} fill="#000" opacity={0.14} />
          <rect x={2.2} width={0.8} height={10} fill="#fff" opacity={0.07} />
        </pattern>
      </defs>
      {/* tier scale */}
      {Array.from({ length: top }, (_, i) => i + 1).map((t) => (
        <g key={t}>
          <line x1={EV.x0 - 6} x2={EV.x0 + 6 * EV.slot} y1={tierTop(geo, t)} y2={tierTop(geo, t)} className={s.tierLine} />
          <text x={EV.x0 - 12} y={tierTop(geo, t - 1) - geo.T / 2 + 4} textAnchor="end" className={s.axis}>
            {t}
          </text>
        </g>
      ))}
      <text x={EV.x0 - 12} y={tierTop(geo, top) - 8} textAnchor="end" className={s.axisCap}>
        TIER
      </text>
      <rect x={EV.x0 - 20} y={EV.ground} width={6 * EV.slot + 28} height={3} className={s.groundLine} />
      {stacks.map((st) => (
        <g key={st.bay}>
          <text x={slotX(st.idx) + st.w / 2 + 2} y={EV.ground + 20} textAnchor="middle" className={s.axis}>
            {pad2(st.bay)}
          </text>
          {st.boxes.map((bx, i) => {
            const state = bx.id === focusId ? "focus" : overIds.includes(bx.id) ? "over" : null;
            const badge = state === "over" ? overIds.indexOf(bx.id) + 1 : undefined;
            return (
              <g key={bx.id} onClick={() => onPickBox(bx.id)} className={s.sidePick}>
                <SideBox box={bx} x={slotX(st.idx) + 2} w={st.w} tier={i + 1} state={state} badge={badge} geo={geo} />
              </g>
            );
          })}
        </g>
      ))}
      <text x={EV.x0 + 6 * EV.slot + 8} y={EV.ground + 20} className={s.axisCap}>
        BAY
      </text>
      {ghost && (() => {
        const st = stacks.find((q) => q.bay === ghost.bay);
        if (!st) return null;
        const x = slotX(st.idx) + 2;
        const y = tierTop(geo, ghost.tier) + 1;
        return (
          <g>
            <rect x={x} y={y} width={st.w} height={geo.T - 2} className={s.ghost} />
            <text x={x + 8} y={y + geo.T / 2 + 3} className={s.ghostText}>
              {ghost.text}
            </text>
          </g>
        );
      })()}

      {/* the live gantry, if it is working this block */}
      <g ref={gantry} opacity={0}>
        <path d={`M-58 ${girderY + 12}V${EV.ground}M58 ${girderY + 12}V${EV.ground}`} className={s.evLeg} />
        <rect x={-64} y={girderY} width={128} height={12} className={s.evGirder} />
        <rect x={-18} y={girderY + 12} width={36} height={8} className={s.evTrolley} />
        <path ref={cables} className={s.evCable} />
        {carriedBox && (
          <g ref={carried} opacity={0}>
            {/* whichever box is on the spreader right now */}
            <CarriedSide m={m} geo={geo} />
          </g>
        )}
        <rect ref={spreader} x={-EV.slot + 4} y={0} width={EV.slot * 2 - 8} height={4} className={s.evSpreader} />
      </g>
    </svg>
  );
}

/** The carried box follows the phase: rehandles first, then the target. Re-keyed per phase by the parent tree. */
function CarriedSide({ m, geo }: { m: number; geo: Geo }) {
  const ref = useRef<SVGGElement>(null);
  const mv = MOVES[m];
  useFrame((f) => {
    if (!ref.current) return;
    const box = f.kind === "rehandle" ? mv.rehandles[f.ph - 1].box : mv.box;
    ref.current.setAttribute("data-id", box.id);
    for (const child of Array.from(ref.current.children) as SVGGElement[])
      child.setAttribute("display", child.dataset.id === box.id ? "inline" : "none");
  });
  const all = [...mv.rehandles.map((r) => r.box), mv.box];
  return (
    <g ref={ref}>
      {all.map((bx) => (
        <g key={bx.id} data-id={bx.id} display="none">
          <SideBox box={bx} x={-EV.slot + 2} w={EV.slot * 2 - 4} tier={1} state={null} geo={geo} />
        </g>
      ))}
    </g>
  );
}

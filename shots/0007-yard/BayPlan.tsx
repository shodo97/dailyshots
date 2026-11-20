"use client";

/* Bay 34 in cross-section, looking forward from aft: port on the left. The
   hold is closed under its hatch covers; the deck fills tier by tier. */

import { useRef } from "react";
import { DECK_TIERS, HOLD, HOLD_TIERS, MOVES, OPS, SHIP_ROWS, TOTAL, holdRows, pad2, type Box } from "./data";
import { useFrame } from "./frame";
import { Diamond, OwMark, PlugMark } from "./icons";
import { clamp } from "./sim";
import s from "./shot.module.css";

const X0 = 30;
const CW = 26.5;
const CH = 18;
const TOP = 18;
const HATCH = 7;
const DECK_Y = (tier: number) => TOP + (DECK_TIERS as readonly number[]).indexOf(tier) * CH;
const HOLD_Y0 = TOP + DECK_TIERS.length * CH + HATCH + 4;
const HOLD_Y = (tier: number) => HOLD_Y0 + (HOLD_TIERS as readonly number[]).indexOf(tier) * CH;
const colX = (row: number) => X0 + SHIP_ROWS.indexOf(row as never) * CW;
export const BAY_W = X0 + SHIP_ROWS.length * CW + 8;
export const BAY_H = HOLD_Y0 + HOLD_TIERS.length * CH + 22;

const POD3: Record<string, string> = { PLGDN: "GDN", DKAAR: "AAR", SEGOT: "GOT", LTKLJ: "KLJ" };

function Cell({ x, y, box, dim, onPick, slot }: { x: number; y: number; box: Box; dim?: boolean; onPick: (id: string) => void; slot: string }) {
  const op = OPS[box.op];
  return (
    <g className={dim ? s.cellDim : s.cell} onClick={() => onPick(box.id)}>
      <title>{`${slot} · ${box.id} · ${box.vgm.toFixed(1)} t · ${box.pod}`}</title>
      <rect x={x + 0.6} y={y + 0.6} width={CW - 1.2} height={CH - 1.2} fill={op.paint} />
      <text x={x + 3.2} y={y + CH - 5} className={s.cellPod} fill={op.ink}>
        {POD3[box.pod] ?? box.pod.slice(2)}
      </text>
      {box.imdg ? (
        <Diamond x={x + CW - 5.6} y={y + CH / 2} s={8} cls={box.imdg.cls} label={false} />
      ) : box.reefer ? (
        <PlugMark x={x + CW - 5} y={y + CH / 2} s={7} color={op.ink} />
      ) : box.ow ? (
        <OwMark x={x + CW - 5} y={y + CH / 2 + 0.6} s={6.4} color={op.ink} />
      ) : null}
    </g>
  );
}

export function BayPlan({ m, onPick, selectedId }: { m: number; onPick: (id: string) => void; selectedId: string | null }) {
  const drop = useRef<SVGGElement>(null);
  const flash = useRef<SVGRectElement>(null);
  const active = m < TOTAL ? MOVES[m] : null;

  useFrame((f) => {
    if (!drop.current || !active) return;
    if (f.kind !== "quay") {
      drop.current.setAttribute("opacity", "0");
      flash.current?.setAttribute("opacity", "0");
      return;
    }
    const k = clamp((f.p - 0.5) / 0.5);
    const e = 1 - Math.pow(1 - k, 3);
    const y = DECK_Y(active.to.tier);
    drop.current.setAttribute("opacity", String(clamp(k * 3)));
    drop.current.setAttribute("transform", `translate(0 ${-(y + CH) * (1 - e)})`);
    flash.current?.setAttribute("opacity", String(k > 0.92 ? 1 : 0));
  });

  const selectedSlot = (() => {
    if (!selectedId) return null;
    const mi = MOVES.findIndex((q) => q.box.id === selectedId);
    if (mi >= 0) return { row: MOVES[mi].to.row, y: DECK_Y(MOVES[mi].to.tier) };
    const h = HOLD.find((q) => q.box.id === selectedId);
    return h ? { row: h.row, y: HOLD_Y(h.tier) } : null;
  })();

  // Hull: the hold narrows towards the keel; deck stacks reach the ship's side.
  const w10 = holdRows(10);
  const inner = (rows: number) => {
    const c = X0 + 6 * CW;
    return [c - (rows / 2) * CW, c + (rows / 2) * CW];
  };
  const [a10, b10] = inner(w10);
  const [a4, b4] = inner(holdRows(4));
  const [a2, b2] = inner(holdRows(2));
  const yTop = HOLD_Y0 - HATCH - 2;
  const y6 = HOLD_Y(6);
  const y4 = HOLD_Y(4);
  const y2 = HOLD_Y(2);
  const yb = y2 + CH;
  const hull = `M${a10 - 14} ${yTop}V${y6 + CH} L${a4 - 4} ${y4 + 2} L${a2 - 4} ${y2 + 2} Q${a2 - 4} ${yb + 6} ${a2 + 10} ${yb + 6} H${b2 - 10} Q${b2 + 4} ${yb + 6} ${b2 + 4} ${y2 + 2} L${b4 + 4} ${y4 + 2} L${b10 + 14} ${y6 + CH} V${yTop}`;

  return (
    <svg viewBox={`0 0 ${BAY_W} ${BAY_H}`} className={s.bayPlan} role="img" aria-label={`Bay 34 cross-section, ${Math.min(m, TOTAL)} of ${TOTAL} deck moves loaded`}>
      <path d={hull} className={s.hull} />
      <rect x={a10 - 2} y={HOLD_Y0 - HATCH - 2} width={b10 - a10 + 4} height={HATCH} className={s.hatch} />
      {/* row and tier numbering */}
      {SHIP_ROWS.map((row) => (
        <text key={row} x={colX(row) + CW / 2} y={11} textAnchor="middle" className={s.bayAxis}>
          {pad2(row)}
        </text>
      ))}
      {DECK_TIERS.map((t) => (
        <text key={t} x={X0 - 6} y={DECK_Y(t) + CH / 2 + 3.5} textAnchor="end" className={s.bayAxis}>
          {t}
        </text>
      ))}
      {HOLD_TIERS.map((t) => (
        <text key={t} x={X0 - 6} y={HOLD_Y(t) + CH / 2 + 3.5} textAnchor="end" className={s.bayAxis}>
          {pad2(t)}
        </text>
      ))}
      {/* hold: loaded before this sequence */}
      {HOLD.map((h) => (
        <Cell key={h.box.id} x={colX(h.row)} y={HOLD_Y(h.tier)} box={h.box} dim onPick={onPick} slot={`34-${pad2(h.row)}-${pad2(h.tier)}`} />
      ))}
      {/* deck: planned slots, then what has landed */}
      {MOVES.map((mv, i) => {
        const x = colX(mv.to.row);
        const y = DECK_Y(mv.to.tier);
        if (i < m) return <Cell key={mv.n} x={x} y={y} box={mv.box} onPick={onPick} slot={mv.toLabel} />;
        return (
          <g key={mv.n} className={i === m ? s.slotActive : s.slotPlanned} onClick={() => onPick(mv.box.id)}>
            <title>{`${mv.toLabel} · planned move ${mv.n} · ${mv.box.id}`}</title>
            <rect x={x + 1} y={y + 1} width={CW - 2} height={CH - 2} />
            <text x={x + CW / 2} y={y + CH / 2 + 3.4} textAnchor="middle">
              {mv.n}
            </text>
          </g>
        );
      })}
      {active && (
        <g ref={drop} opacity={0} key={active.n}>
          <rect x={colX(active.to.row) + 0.6} y={DECK_Y(active.to.tier) + 0.6} width={CW - 1.2} height={CH - 1.2} fill={OPS[active.box.op].paint} />
          <rect
            ref={flash}
            x={colX(active.to.row) - 1}
            y={DECK_Y(active.to.tier) - 1}
            width={CW + 2}
            height={CH + 2}
            className={s.dropFlash}
            opacity={0}
          />
        </g>
      )}
      {selectedSlot && (
        <rect x={colX(selectedSlot.row) - 1.5} y={selectedSlot.y - 1.5} width={CW + 3} height={CH + 3} className={s.baySelect} />
      )}
    </svg>
  );
}

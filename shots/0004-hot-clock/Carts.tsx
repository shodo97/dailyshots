"use client";

/* Cart wall: ten instant-play slots on the number row. A press fires the cart,
   a second press stops it; the face drains toward its out-point. */

import { memo } from "react";
import s from "./shot.module.css";
import { useNow, type ClockStore } from "./clock";
import { CARTS, CART_LABEL, mmss } from "./data";
import { Icon } from "./icons";
import { Fig } from "./fig";

type Props = {
  store: ClockStore;
  playing: Record<string, number>;
  onToggle: (id: string) => void;
};

export const Carts = memo(function Carts({ store, playing, onToggle }: Props) {
  const now = useNow(store, 10);
  return (
    <section className={s.carts} aria-label="Cart wall">
      <header className={s.bayHead}>
        <h2 className={s.panelTitle}>Carts</h2>
        <span className={s.bayNote}>
          Keys <kbd>1</kbd>–<kbd>0</kbd> fire · press again to stop
        </span>
      </header>
      <div className={s.cartGrid}>
        {CARTS.map((c) => {
          const at = playing[c.id];
          const left = at === undefined ? -1 : c.dur - (now - at);
          const on = left > 0;
          return (
            <button
              key={c.id}
              type="button"
              className={s.cart}
              data-type={c.type}
              data-on={on || undefined}
              aria-pressed={on}
              aria-label={`${c.title}, ${CART_LABEL[c.type]}, ${mmss(c.dur)}. Key ${c.key}.`}
              onClick={() => onToggle(c.id)}
            >
              {on ? <span key={at} className={s.cartDrain} style={{ animationDuration: `${c.dur}s` }} aria-hidden /> : null}
              <span className={s.cartTop}>
                <kbd className={s.cartKey}>{c.key}</kbd>
                {on ? null : (
                  <span className={s.cartType}>
                    <i aria-hidden />
                    {CART_LABEL[c.type]}
                  </span>
                )}
                {on ? <span className={s.cartTally}>On air</span> : null}
              </span>
              <span className={s.cartTitle}>{c.title}</span>
              <span className={s.cartFoot}>
                <span className={s.cartCode}>{c.code}</span>
                <span className={`${s.cartTime} ${s.tnum}`}>
                  <Fig>{on ? (left < 10 ? left.toFixed(1) : mmss(Math.ceil(left))) : mmss(c.dur)}</Fig>
                </span>
                <Icon name={on ? "stop" : "play"} className={s.cartIcon} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
});

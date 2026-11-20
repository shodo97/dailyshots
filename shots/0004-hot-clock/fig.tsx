/* Saira Condensed ships proportional figures only, so changing numbers are
   set digit by digit in fixed cells. Without this every clock jitters. */

import s from "./shot.module.css";

export function Fig({ children }: { children: string }) {
  return (
    <span className={s.fig}>
      {Array.from(children, (c, i) =>
        c >= "0" && c <= "9" ? (
          <span key={i} className={s.dg}>
            {c}
          </span>
        ) : (
          c
        ),
      )}
    </span>
  );
}

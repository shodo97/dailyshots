import { createContext, useContext, useLayoutEffect, useRef } from "react";
import type { Frame } from "./sim";

export type FrameSub = (f: Frame) => void;
export type FrameBus = { subscribe: (fn: FrameSub) => () => void; current: () => Frame };

export const FrameCtx = createContext<FrameBus | null>(null);

/** Run `fn` on every engine frame, and once immediately so nothing paints unposed. */
export function useFrame(fn: FrameSub) {
  const bus = useContext(FrameCtx);
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useLayoutEffect(() => {
    if (!bus) return;
    const call: FrameSub = (f) => ref.current(f);
    call(bus.current());
    return bus.subscribe(call);
  }, [bus]);
}

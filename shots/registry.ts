import type { ShotEntry } from "./types";
import { meta as m0013 } from "./0013-turndown/meta";
import { meta as m0012 } from "./0012-hive/meta";
import { meta as m0011 } from "./0011-tidewater/meta";
import { meta as m0010 } from "./0010-switchyard/meta";
import { meta as m0009 } from "./0009-proof/meta";
import { meta as m0008 } from "./0008-roast/meta";
import { meta as m0007 } from "./0007-yard/meta";
import { meta as m0006 } from "./0006-helicorder/meta";
import { meta as m0005 } from "./0005-pass/meta";
import { meta as m0004 } from "./0004-hot-clock/meta";
import { meta as m0002 } from "./0002-press-run/meta";
import { meta as m0001 } from "./0001-first-light/meta";
import { meta as m0003 } from "./0003-chart-desk/meta";

/**
 * Every shot, registered once. Order here does not matter — the gallery sorts
 * by sequence number. `pnpm new-shot` adds entries automatically.
 */
export const shots: ShotEntry[] = [
  { meta: m0001, load: () => import("./0001-first-light") },
  { meta: m0002, load: () => import("./0002-press-run") },
  { meta: m0003, load: () => import("./0003-chart-desk") },
  { meta: m0004, load: () => import("./0004-hot-clock") },
  { meta: m0005, load: () => import("./0005-pass") },
  { meta: m0006, load: () => import("./0006-helicorder") },
  { meta: m0007, load: () => import("./0007-yard") },
  { meta: m0008, load: () => import("./0008-roast") },
  { meta: m0009, load: () => import("./0009-proof") },
  { meta: m0010, load: () => import("./0010-switchyard") },
  { meta: m0011, load: () => import("./0011-tidewater") },
  { meta: m0012, load: () => import("./0012-hive") },
  { meta: m0013, load: () => import("./0013-turndown") },
  /* new-shot:anchor */
];

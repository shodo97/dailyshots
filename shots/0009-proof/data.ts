/* 0009 — Proof · data
   One chapter of one episode, authored word by word, and the rest of the
   episode described only as much as the overview needs. Every figure on the
   screen derives from this file: the word timings, the cut lengths, the
   filler counts, the runtime. Seeded, so server and client agree. */

export type Speaker = "host" | "guest";
export type FillerKind = "um" | "uh" | "you know" | "like" | "sort of";

export const SPEAKERS: Record<Speaker, { name: string; short: string; role: string }> = {
  host: { name: "Cass Whitfield", short: "Cass", role: "Host" },
  guest: { name: "Anneke Joosten", short: "Anneke", role: "Bridge engineer" },
};

export const EPISODE = {
  show: "Field Notes",
  number: 48,
  title: "The joint that lets a bridge breathe",
  /** Raw recording, seconds. 42:06. */
  raw: 2526,
  /** The network slot the edit has to fit. */
  slot: 38 * 60,
};

/* ── seeded randomness ─────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── the chapter, as said ──────────────────────────────────────────────────
   {…} a detected filler · [1.4] a long pause · <<…>> cut in an earlier pass */

const SCRIPT: Array<[Speaker, string]> = [
  ["host", "So we've got a deck that wants to grow and shrink every single day. {Um} where does all that movement actually go?"],
  ["guest", "It goes into the joint. [1.2] At each end of the deck there's a gap, and the joint is the thing that bridges the gap so a car doesn't notice it. On a short span it might be, {uh} twenty millimetres of travel. On a long steel deck it can be more than a metre."],
  ["host", "A metre. Of gap. In the road."],
  ["guest", "Over a year, yes. {You know} between a cold January night and a hot afternoon in July. The joint has to carry a truck across that gap at both ends of the range, and everywhere in between."],
  ["host", "And what does it look like when you're standing on it?"],
  ["guest", "The one most people have driven over is the finger joint. Two steel plates with long teeth, {like} two combs pushed into each other. When it's cold the teeth pull apart, when it's warm they slide back in. You hear it as a <<a sort of>> double thump under the tyres."],
  ["host", "That's the clunk-clunk on the motorway."],
  ["guest", "That's the clunk-clunk. [1.6] Smaller bridges use a strip seal, which is {sort of} a rubber gland clamped between two steel edges. It folds like an accordion. {Um} it's cheap, it's quiet, and it keeps water off the bearings, which matters more than people think."],
  ["host", "Why water?"],
  ["guest", "Because water carries salt, and salt eats steel. {Uh} most of the joints I've replaced didn't fail because they stopped moving. They failed because they leaked for ten years and nobody looked underneath. [2.1]"],
  ["host", "So the joint has two jobs. Let things move, and keep things out."],
  ["guest", "Three, really. It also has to let the bridge rotate a little at the ends, as the deck bends under load. {You know} a heavy lorry in the middle of the span lifts the ends by a fraction of a degree. The joint has to take that without {um} cracking the asphalt on either side."],
  ["host", "And the big ones? The metre ones?"],
  ["guest", "Those are modular joints. Imagine a row of steel beams lying across the road, with rubber seals between each pair. {Like} a set of piano keys turned sideways. Each gap opens a little, and the whole thing <<the whole thing>> adds up to a lot of movement. They're heavy, they're loud if they're badly set, and {uh} they need a proper inspection every year."],
  ["host", "Loud how?"],
  ["guest", "There's a noise they make when a support has worn. A sharp crack, every axle. [1.4] Residents notice that before engineers do. We've had people ring the council about a bridge they could hear from half a kilometre away, and {um} they were right. The bearing under one of the beams had gone."],
  ["host", "I love that the first warning sign is a neighbour."],
  ["guest", "It often is. {Sort of} humbling, honestly. You can put strain gauges everywhere, but a person walking a dog past the same joint every morning will tell you something's changed. {Like} they don't know what's wrong, but they know it sounds different. [1.8]"],
  ["host", "Is that what you listen for? {Um} when you're inspecting?"],
  ["guest", "I listen first, before I look. {Uh} you stand at the abutment and let a few trucks go over. A healthy joint is dull. It's one even beat per axle. When you hear a ring in it, or a rattle after the beat, <<um, the>> that's a plate that's come loose. {You know} it's diagnosis by ear before it's diagnosis by measurement."],
  ["host", "Which is how a mechanic hears an engine."],
  ["guest", "Exactly how. {Um} and then you get down on your knees and look."],
];

/* ── chapters (raw seconds; chapter 3 is the one open in the editor) ───── */

export const CH3_START = 790; // 13:10

export type Token = {
  i: number;
  kind: "word" | "pause";
  text: string;
  speaker: Speaker;
  para: number;
  /** Source seconds. A token owns [start, next token's start). */
  start: number;
  /** End of the voiced part (or of the pause). */
  end: number;
  filler: FillerKind | null;
  /** Index into PRE_CUTS when an earlier pass already removed it. */
  pre: number | null;
};

export type Para = { i: number; speaker: Speaker; from: number; to: number; start: number };

const FILLER_LEN: Record<FillerKind, number> = {
  um: 0.46,
  uh: 0.37,
  "you know": 0.52,
  like: 0.3,
  "sort of": 0.44,
};

function build() {
  const rnd = mulberry32(48);
  const tokens: Token[] = [];
  const paras: Para[] = [];
  const preCuts: Array<{ from: number; to: number }> = [];
  let t = CH3_START + 0.6;

  SCRIPT.forEach(([speaker, text], p) => {
    if (p > 0) t += 0.42 + rnd() * 0.3;
    const from = tokens.length;
    const parts = text.match(/\{[^}]+\}|\[[\d.]+\]|<<[^>]+>>|\S+/g) ?? [];

    const push = (word: string, filler: FillerKind | null, pre: number | null) => {
      const letters = word.replace(/[^a-z]/gi, "").length;
      const len = filler
        ? FILLER_LEN[filler] * (0.9 + rnd() * 0.2)
        : 0.1 + letters * 0.05 * (0.9 + rnd() * 0.25);
      const tok: Token = { i: tokens.length, kind: "word", text: word, speaker, para: p, start: t, end: t + len, filler, pre };
      tokens.push(tok);
      t += len + 0.05 + rnd() * 0.07;
      if (/,$/.test(word)) t += 0.14 + rnd() * 0.08;
      if (/[.?]$/.test(word)) t += 0.28 + rnd() * 0.14;
    };

    for (const part of parts) {
      if (part.startsWith("{")) {
        const raw = part.slice(1, -1);
        const kind = raw.toLowerCase().replace(/[^a-z ]/g, "") as FillerKind;
        push(raw, kind, null);
      } else if (part.startsWith("[")) {
        const len = parseFloat(part.slice(1, -1));
        tokens.push({ i: tokens.length, kind: "pause", text: `${len.toFixed(1)}s`, speaker, para: p, start: t, end: t + len, filler: null, pre: null });
        t += len;
      } else if (part.startsWith("<<")) {
        const words = part.slice(2, -2).split(/\s+/);
        const id = preCuts.length;
        const f = tokens.length;
        words.forEach((w) => push(w, null, id));
        preCuts.push({ from: f, to: tokens.length - 1 });
      } else {
        push(part, null, null);
      }
    }
    paras.push({ i: p, speaker, from, to: tokens.length - 1, start: tokens[from].start });
  });

  return { tokens, paras, preCuts, end: t + 0.8 };
}

const built = build();
export const TOKENS: readonly Token[] = built.tokens;
export const PARAS: readonly Para[] = built.paras;
export const PRE_CUTS = built.preCuts;
export const CH3_END = Math.ceil(built.end); // where chapter 4 begins

/** Where token i's span ends: the next token's start, or the chapter's last breath. */
export const spanEnd = (i: number) => (i + 1 < TOKENS.length ? TOKENS[i + 1].start : TOKENS[i].end + 0.4);

export type Chapter = { n: number; title: string; start: number; end: number };

export const CHAPTERS: readonly Chapter[] = [
  { n: 1, title: "Cold open", start: 0, end: 95 },
  { n: 2, title: "Why bridges move", start: 95, end: CH3_START },
  { n: 3, title: "Teeth, fingers and rubber", start: CH3_START, end: CH3_END },
  { n: 4, title: "The joint that failed", start: CH3_END, end: 1655 },
  { n: 5, title: "Inspecting in the rain", start: 1655, end: 2180 },
  { n: 6, title: "What a good joint sounds like", start: 2180, end: EPISODE.raw },
];

/* ── cuts made in earlier passes, everywhere else in the episode ───────────
   The summary on load reads 31 cuts · 2:14 removed · runtime 39:52, so the
   28 cuts outside chapter 3 are scaled to make up whatever the three cuts
   inside it do not. */

export const PRE_TOTAL_REMOVED = 134; // 2:14
const PER_CHAPTER = [2, 9, 0, 8, 6, 3];

export const preCutLength = (c: { from: number; to: number }) => spanEnd(c.to) - TOKENS[c.from].start;
const insideRemoved = PRE_CUTS.reduce((a, c) => a + preCutLength(c), 0);

export type OuterCut = { s0: number; s1: number; chapter: number };

export const OUTER_CUTS: readonly OuterCut[] = (() => {
  const rnd = mulberry32(2526);
  const raw: Array<{ at: number; len: number; chapter: number }> = [];
  CHAPTERS.forEach((ch, k) => {
    const n = PER_CHAPTER[k];
    const span = ch.end - ch.start;
    for (let j = 0; j < n; j++) {
      // Spread across the chapter, jittered within each slice.
      const at = ch.start + span * ((j + 0.2 + rnd() * 0.6) / n);
      // Mostly breaths and false starts; the odd long tangent.
      const r = rnd();
      const len = r > 0.9 ? 18 + rnd() * 16 : r > 0.7 ? 5 + rnd() * 6 : 0.6 + rnd() * 3.4;
      raw.push({ at, len, chapter: ch.n });
    }
  });
  const sum = raw.reduce((a, c) => a + c.len, 0);
  const k = (PRE_TOTAL_REMOVED - insideRemoved) / sum;
  return raw.map((c) => ({ s0: c.at, s1: c.at + c.len * k, chapter: c.chapter }));
})();

export const OUTER_REMOVED = PRE_TOTAL_REMOVED - insideRemoved;
/** Removed before chapter 3 begins (chapters 1 and 2), for edited timecodes. */
export const REMOVED_BEFORE_CH3 = OUTER_CUTS.filter((c) => c.s1 <= CH3_START).reduce((a, c) => a + (c.s1 - c.s0), 0);

/* ── amplitude ─────────────────────────────────────────────────────────── */

export const SR = 50; // envelope samples per second inside chapter 3

/** Speech envelope for chapter 3, drawn from the word timings. */
export const AMP: Float32Array = (() => {
  const rnd = mulberry32(1607);
  const n = Math.ceil((CH3_END - CH3_START) * SR);
  const a = new Float32Array(n);
  for (let k = 0; k < n; k++) a[k] = 0.015 + rnd() * 0.02;
  for (const tok of TOKENS) {
    if (tok.kind === "pause") continue;
    const letters = Math.max(2, tok.text.replace(/[^a-z]/gi, "").length);
    const syl = Math.max(1, Math.round(letters / 3));
    const base = (tok.speaker === "guest" ? 0.74 : 0.66) * (tok.filler ? 0.5 : 0.78 + rnd() * 0.22);
    const k0 = Math.floor((tok.start - CH3_START) * SR);
    const k1 = Math.ceil((tok.end - CH3_START) * SR);
    const len = Math.max(1, k1 - k0);
    for (let k = k0; k < k1 && k < n; k++) {
      const u = (k - k0) / len;
      const s = (u * syl) % 1;
      const bump = Math.sin(Math.PI * s) ** 0.8;
      const hull = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.35;
      const v = base * (0.35 + 0.65 * bump) * hull * (0.82 + rnd() * 0.36);
      if (v > a[k]) a[k] = v;
    }
  }
  return a;
})();

export function ampAt(src: number) {
  const x = (src - CH3_START) * SR;
  const k = Math.floor(x);
  if (k < 0 || k + 1 >= AMP.length) return 0.02;
  const f = x - k;
  return AMP[k] * (1 - f) + AMP[k + 1] * f;
}

/** Whole-episode overview at 2 samples a second: chapter 3 from the real
    envelope, everything else from a seeded conversation of the same shape. */
export const OVERVIEW_SR = 2;
export const OVERVIEW: Float32Array = (() => {
  const rnd = mulberry32(4206);
  const n = EPISODE.raw * OVERVIEW_SR;
  const o = new Float32Array(n);
  let turnLeft = 0;
  let level = 0.6;
  for (let k = 0; k < n; k++) {
    const t = k / OVERVIEW_SR;
    if (t >= CH3_START && t < CH3_END) {
      let m = 0;
      const k0 = Math.floor((t - CH3_START) * SR);
      for (let j = 0; j < SR / OVERVIEW_SR; j++) m = Math.max(m, AMP[k0 + j] ?? 0);
      o[k] = m;
      continue;
    }
    if (turnLeft <= 0) {
      turnLeft = 3 + rnd() * 24;
      level = rnd() > 0.45 ? 0.72 + rnd() * 0.12 : 0.52 + rnd() * 0.12;
      // A short breath between turns.
      o[k] = 0.06 + rnd() * 0.08;
      turnLeft -= 1 / OVERVIEW_SR;
      continue;
    }
    turnLeft -= 1 / OVERVIEW_SR;
    // Phrases swell and fall over a few seconds; words jitter on top.
    const phrase = 0.62 + 0.38 * Math.sin(t * 1.3 + Math.sin(t * 0.21) * 3) ** 2;
    const gap = rnd() < 0.05;
    o[k] = gap ? 0.05 + rnd() * 0.12 : level * phrase * (0.7 + rnd() * 0.3);
  }
  // A quieter cold open under the music bed, and a sting at the top.
  for (let k = 0; k < 18 * OVERVIEW_SR; k++) o[k] = 0.42 + 0.3 * Math.sin(k * 0.7) ** 2;
  return o;
})();

/* ── loudness, measured on the raw file ───────────────────────────────── */

export const LOUDNESS = {
  target: -16,
  integrated: -17.4,
  /** Hesitations are quiet; each one removed lifts the gated average a little. */
  perFiller: 0.03,
  truePeak: -1.3,
  range: 6.8,
};

/* ── formatting ───────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** 39:52. Rounded to the tenth first so 2391.9999 does not print as 39:51. */
export function mmss(sec: number) {
  const s = Math.floor(Math.round(sec * 10) / 10);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** 14:02.6 */
export function mmssd(sec: number) {
  const d = Math.floor(Math.max(0, sec) * 10);
  const s = Math.floor(d / 10);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}.${d % 10}`;
}

export const secs = (sec: number) => `${sec.toFixed(1)}s`;

export const FILLER_ORDER: readonly FillerKind[] = ["um", "uh", "you know", "like", "sort of"];

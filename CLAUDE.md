# dailyshots

One interface designed and built from scratch, every day. A Next.js gallery
(the **shell**) hosting a growing set of independent design pieces (**shots**).

## The one rule that matters

**Do not DRY the shots.**

Every shot gets its own palette, its own type, its own spacing scale, its own
motion language. Duplication between shots is correct. If two shots need the
same card component, write it twice. The range between pieces is the entire
point of the project, and a shared component library is exactly how a daily
practice collapses into sixty variations of one idea.

Abstraction is allowed in two places only:
- `components/shell/` and `app/` — the gallery, which is one coherent product.
- `lib/` — genuinely generic, design-free helpers (reduced motion, noise, math).

If you are about to add something to `lib/` that has an opinion about how it
looks, it belongs in the shot instead.

## Styling boundary

| | |
|---|---|
| **Shell** | Tailwind + the `@theme` tokens in `app/globals.css` |
| **Shots** | their own `shot.module.css`, their own CSS custom properties |

Shots must not use the shell's tokens (`ink`, `bone`, `hairline`, `font-display`
…). A shot reaching for Tailwind utilities beyond bare layout is a smell —
bespoke CSS is what keeps each piece distinct.

Each shot declares its own fonts via `next/font` inside its own module and maps
them onto `--shot-sans` / `--shot-display` / `--shot-mono` on its root element.
Never reuse the shell's Geist.

## Anatomy

```
app/
  page.tsx                  the grid
  info/page.tsx             about
  shots/[slug]/page.tsx     one route for every shot; owns the chrome
components/
  shell/                    Gallery, GridCard — Tailwind, shared, coherent
  shot/                     ShotStage (gate + phone frame), ShotChrome (info panel)
shots/
  types.ts                  ShotMeta
  registry.ts               every shot, registered once (new-shot appends here)
  index.ts                  sorting, lookup, prev/next, active tags
  0001-first-light/
    meta.ts                 number, title, date, tags, accent, note, published
    index.tsx               the design — default export, "use client"
    shot.module.css         its own universe
scripts/                    new-shot, capture, record
public/posters/NNNN.webp    grid poster frames (generated)
public/previews/NNNN.webm   grid hover loops (recorded)
```

Shots are dynamically imported from the registry, so a heavy WebGL piece never
reaches the gallery bundle. Keep it that way — never import a shot statically.

## Daily loop

```bash
pnpm dev
pnpm new-shot "Wallet onboarding"        # folder + meta + registry entry, as a draft
# design it, iterate in the browser
pnpm shot:capture 4                      # poster frame
pnpm shot:record 4                       # 4s hover loop (--scroll, --duration=, --warmup=)
# flip published: true in meta.ts
git commit && git push                   # straight to main, Vercel deploys
```

`published: false` keeps a shot out of the grid while its route stays live, so
work in progress can be shared by URL without landing in the gallery. It is also
the escape hatch on a bad day — leave it as a draft rather than shipping
something thin.

## Constraints

- **Desktop canvas, 1440.** Shots are gated below 1024px with a crafted notice;
  they are never made responsive. Mobile-targeted shots set `target: "mobile"`
  and are presented inside a phone frame on the desktop canvas.
- **Motion is the floor.** Every shot moves — scroll choreography, hover,
  cursor, transitions. A static composition is not a finished shot.
- **`prefers-reduced-motion` is honoured everywhere.** CSS transitions are
  neutralised globally in `globals.css`, but JS animation is not: always gate
  Motion/GSAP with `useReducedMotion()`. Beyond that, design wins over strict
  AA — keep contrast sane and focus visible, but do not flatten a piece for it.
- **Assets:** procedural/generated first, then AI-generated, then curated CC0
  committed locally with attribution in `public/ATTRIBUTION.md`. No hotlinking,
  no paid or unlicensed assets.
- **Numbering** is sequential and never reused. Missed days are invisible —
  there is no gap to explain.

## Review

Changes are verified in a real browser at 1440×900 before being handed over:
load the route, screenshot it, check the console, watch the motion actually
land. Code that type-checks is not the same as a design that works.

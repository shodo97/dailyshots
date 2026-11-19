---
name: dailyshots
description: The gallery shell that holds a daily interface practice. Scoped to the shell only; shots are deliberately outside this system.
colors:
  ink: "#070708"
  ink-raised: "#0e0e11"
  bone: "#f4f3f1"
  bone-dim: "#9a9aa2"
  bone-faint: "#5c5c64"
  hairline: "#ffffff17"
  hairline-strong: "#ffffff2e"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(2.75rem, 7.5vw, 7rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "1.9rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  body-small:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.16em"
    fontFeature: "tnum"
  label-small:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.16em"
    fontFeature: "tnum"
rounded:
  none: "0px"
  card: "14px"
  pill: "999px"
  device: "2.75rem"
spacing:
  gutter: "20px"
  gutter-wide: "24px"
  row: "56px"
  page: "24px"
  page-wide: "40px"
  panel: "28px"
  section: "96px"
components:
  card-shot:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.card}"
    padding: "0px"
  caption-shot:
    textColor: "{colors.bone-dim}"
    typography: "{typography.body-small}"
    padding: "14px 0px 0px"
  chip-filter:
    backgroundColor: "transparent"
    textColor: "{colors.bone-faint}"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-filter-active:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-tool:
    backgroundColor: "transparent"
    textColor: "#ffffff73"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-chrome:
    backgroundColor: "#00000059"
    textColor: "#ffffffb3"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  pill-chrome-hover:
    backgroundColor: "#00000059"
    textColor: "#ffffff"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  panel-info:
    backgroundColor: "#000000b3"
    textColor: "#ffffff99"
    rounded: "{rounded.none}"
    padding: "{spacing.panel}"
    width: "min(23rem, 88vw)"
    height: "100dvh"
  button-return:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
---

# Design System: dailyshots

> **Scope: the shell only.** This document describes the gallery, the info page
> and the shot chrome. It does **not** describe the shots, and shots must never
> conform to it. See `CLAUDE.md`: do not DRY the shots. The exclusion ledger in
> section 6 exists so range stays honest, not so pieces can inherit a look.

## 1. Overview

**Creative North Star: "The Specimen Case"**

The shell is a vitrine, not an exhibit. Its only job is to hold wildly unlike
objects without competing with any of them, which makes discipline the whole
design. The ground is a near-black that is almost but not quite neutral
(`#070708`). Frames are hairlines. Labels are small mono capitals set like
museum tags. There is no decoration anywhere, because decoration here would be
the case arguing with the specimen.

The one structural consequence: **the case has no colour of its own.** Every
colour that appears on a shell surface is borrowed from the shot being
described, through `meta.accent`. A card's hover border, its glow, its index
number, the accent in the info panel: all of it is the shot's colour,
temporarily lent to the chrome. Remove the shots and the shell is monochrome.

What this rejects, carried from `PRODUCT.md`: anything that reads as machine
generated. No bento grids, no glassmorphism as decoration, no gradient text, no
hero metric blocks, no violet-to-cyan on near-black. The shell's single piece
of atmosphere is a soft radial tint of the shot's own accent behind each card,
and it exists to keep light posters from floating on black.

**Key Characteristics:**

- Near-black ground, flat at rest, depth by tonal layering rather than shadow.
- Hairline borders at 1px, never thicker, never coloured except on hover.
- Mono capitals at 10 to 11px with `0.16em` tracking as the entire label system.
- One serif title per screen, and never more than one.
- Every mutable number is tabular (`.tnum`), so nothing jitters.
- Colour arrives only from the content.

## 2. Colors

A monochrome case built from two tinted neutrals, their steps, and borrowed
accents. The strategy is **Restrained**, deliberately, because the shell is the
one surface in this project that must not have a point of view.

### Primary

The shell has no primary colour. The role is filled at runtime by
`meta.accent` (a hex string on each shot's `ShotMeta`), which tints the card
border and glow on hover, the index number in the card caption, the shot number
in the info panel, and the radial wash behind the stage of a mobile-target
shot. Shot 0001 lends **Survey Amber** (`#e9a23b`).

### Neutral

- **Plate Black** (`#070708`): the ground. Not `#000`, tinted a half-step
  toward blue so posters and shot canvases read as objects sitting on a
  surface rather than holes cut in one. Set on both `html` and `body`.
- **Case Interior** (`#0e0e11`): the card fill, one step up from the ground.
  This single step is how the grid reads as populated before any poster loads.
- **Bone** (`#f4f3f1`): primary text, the active filter chip's fill, and the
  selection background. A warm off-white, never `#fff`.
- **Bone Dim** (`#9a9aa2`): running prose, card titles at rest, the italic
  half of the home headline. The reading colour.
- **Bone Faint** (`#5c5c64`): metadata, inactive filter chips, dates, counts.
  Legible, not addressed to you.
- **Hairline** (`rgb(255 255 255 / 0.09)`): every divider and card border at
  rest.
- **Hairline Strong** (`rgb(255 255 255 / 0.18)`): the return button's border
  and prose underline decoration. The only other stroke weight.

### Named Rules

**The Borrowed Colour Rule.** The shell never introduces a colour. If a shell
surface is coloured, that colour is `var(--accent)` from the shot it describes.
Hardcoding any hue into `components/shell/` or `app/` is prohibited.

**The No-Pure-Value Rule.** `#000` and `#fff` are forbidden. The ground is
`#070708` and the light is `#f4f3f1`. Pure values make the dark look like an
absence and the light like a flashbulb.

## 3. Typography

**Display Font:** Instrument Serif (fallback Georgia, serif), 400 only, with
italic available and used as emphasis in the home headline.
**Body Font:** Geist (fallback `ui-sans-serif`, `system-ui`).
**Label / Mono Font:** Geist Mono (fallback `ui-monospace`).

**Character:** A single high-contrast serif statement sitting above a system of
small mono capitals. The serif supplies the authored voice; the mono supplies
the cataloguing. Geist Sans is almost invisible by design, appearing only where
there are actual sentences to read.

### Hierarchy

- **Display** (400, `clamp(2.75rem, 7.5vw, 7rem)`, `0.92`, `-0.02em`): the home
  headline, once per site. Set at `max-w-[16ch]` so it breaks where intended,
  with the second line in italic Bone Dim.
- **Headline** (400, `clamp(2rem, 5vw, 3.25rem)`, `1.02`, `-0.02em`): the info
  page title and the too-narrow notice.
- **Title** (400, `1.9rem`, `1.1`, `-0.01em`): the shot title in the info panel.
- **Body** (400, `15px`, `1.7`): info page prose, capped at `max-w-[720px]`
  which lands inside the 65 to 75ch target.
- **Body Small** (400, `13.5px`, `1.65`): card titles and the shot note.
- **Label** (400, `11px`, `0.16em`, uppercase): nav, section metadata, shot
  numbers. Tracking is what makes this legible at size, not weight.
- **Label Small** (400, `10px` to `9.5px`, `0.12em` to `0.16em`, uppercase):
  filter chips, chrome pills, tool tags, prev/next.

### Named Rules

**The Two-Voice Rule.** Instrument Serif speaks once per screen, and only as
the title. Everything else is mono capitals or, where there are sentences,
Geist Sans. A third display voice in the shell is prohibited.

**The Tabular Rule.** Every number that can change between renders (shot index,
date, count) carries `.tnum`. Numbers that reflow while animating look broken,
and this project is largely numbers.

**The Tracking-Not-Weight Rule.** Small type earns presence from uppercase and
`0.16em` tracking at weight 400. Bolding 10px mono is prohibited; it muddies
before it emphasises.

## 4. Elevation

The shell is **flat at rest.** Depth comes from tonal layering (`#070708`
ground to `#0e0e11` card) and 1px hairlines, not from shadow. Nothing floats
until the pointer asks it to.

When elevation does appear, it is a response to state and it is tinted by the
content: the card's hover shadow is cast in the shot's own accent rather than
black, so lifting a card reads as the specimen lighting up inside the case. The
only black shadow in the system sits under the phone frame, where it is doing
literal physical work.

### Shadow Vocabulary

- **Card lift** (`box-shadow: 0 24px 60px -28px var(--accent)`): on card hover
  only, paired with `-translate-y-1` and a border shift to `var(--accent)` over
  `500ms var(--ease-out-quint)`.
- **Device weight** (`box-shadow: 0 60px 140px -50px rgba(0,0,0,0.9)`): the
  mobile-target phone frame, which is the one object in the shell that is
  pretending to be a real thing.
- **Backdrop blur** (`backdrop-filter` on chrome pills and the info panel):
  permitted here and nowhere else. These float over an unknown shot canvas and
  must stay readable against anything. This is the purposeful exception to the
  glassmorphism ban, not a licence.

### Named Rules

**The Flat Case Rule.** Shell surfaces are flat until hovered. Resting
shadows, ambient glows and layered panels are prohibited. If a surface needs
separating, use a hairline or a tonal step.

**The Content-Lit Rule.** Hover shadows are tinted with `var(--accent)`, never
with black. Black shadow on a near-black ground is invisible work.

## 5. Components

### Buttons

- **Shape:** fully round (`999px`), or no radius at all. Nothing in between.
- **Return button** (too-narrow notice): transparent fill, 1px Hairline Strong
  border, Bone label at `10px` uppercase, `10px 20px` padding.
- **Hover / Focus:** colour and border transitions at `300ms`. Transform is
  reserved for cards. Focus must stay visible; removing the ring is prohibited.

### Chips

- **Filter chips** (gallery): pill, transparent at rest with Bone Faint label,
  `6px 12px`. Selected state inverts to a Bone fill with Plate Black text, which
  is the only inversion in the system and carries the whole filter state.
  `aria-pressed` tracks it. Hover moves rest state to Bone Dim, `300ms`.
- **Tool tags** (info panel): pill, 1px `rgb(255 255 255 / 0.12)` border, no
  fill, `#ffffff73` label at `9.5px` / `0.12em`, `4px 10px`. Read-only, never
  interactive.
- **Mobile badge** (card corner): pill, `rgb(0 0 0 / 0.4)` fill with blur, 9px
  label. The one place a card is allowed to say something about itself.

### Cards / Containers

The shot card is the signature component and the only card in the system.

- **Corner Style:** `14px`. Soft enough to read as a plate, tight enough not to
  look like a web app panel.
- **Background:** Case Interior (`#0e0e11`), plus a radial accent wash
  (`radial-gradient(120% 120% at 20% 0%, <accent>2e, transparent 60%)`) so an
  empty or light poster never floats.
- **Border:** 1px Hairline at rest, shifting to `var(--accent)` on hover.
- **Shadow Strategy:** see Elevation. Card lift on hover only.
- **Internal Padding:** none. The media is full-bleed inside the frame; the
  caption sits outside it at `14px` above.
- **Aspect:** governed by `meta.aspect`. `wide` is 8 of 12 columns at 16:10,
  `square` and `tall` are 4 columns at 1:1 and 3:4. The grid is
  `grid-auto-flow: dense` with `20px` column gaps and `56px` row gaps, so rows
  are deliberately looser than columns.
- **Behaviour:** poster image at rest, `<video>` hover loop cross-fading over
  `500ms` with `preload="none"`. A missing poster falls back to the shot number
  in serif at `text-bone/10`, which reads as an unexposed plate rather than an
  error.

**Nested cards are prohibited.** There is one card in this system and it does
not contain another.

### Inputs / Fields

None. The shell has no text input, and adding one would need a reason. If
search ever arrives it inherits the chip's pill shape and the label type scale.

### Navigation

- **Home nav:** mono capitals at `11px`, baseline-aligned, site name left and
  `info` / `github ↗` right. Bone Faint at rest to Bone on hover, `300ms`.
  No underlines, no active indicator; there are two destinations.
- **Shot chrome:** fixed pills top-left and top-right over the live shot, at
  `z-40`, pointer-events only on the pills themselves so the shot keeps the
  cursor. `rgb(0 0 0 / 0.35)` fill, `rgb(255 255 255 / 0.12)` border, blurred.
- **Info panel:** a fixed full-height right rail at `min(23rem, 88vw)`,
  `rgb(0 0 0 / 0.7)` with heavy blur, 1px left border, `28px` padding, square
  corners because it is attached to the viewport edge. Carries the accented shot
  number, serif title, date and tags in mono, the note, tool tags, and
  prev/next above a hairline rule. Desktop only (`lg:flex`).

### Signature behaviour: the entrance stagger

Filtering re-keys the grid so the set re-enters rather than snapping. Each item
runs `shell-rise` (14px rise plus fade, `750ms var(--ease-out-quint)`) with a
`55ms` stagger capped at the 8th item, so a large grid never crawls. Layout
itself is never animated.

## 6. Do's and Don'ts

### Do:

- **Do** keep every shell colour from the token set in `app/globals.css`, and
  take every accent from `meta.accent` at runtime.
- **Do** use `.tnum` on any number that can change.
- **Do** set small type as uppercase mono at `0.16em` tracking, weight 400.
- **Do** keep surfaces flat at rest and let hover be the only elevation, tinted
  with `var(--accent)`.
- **Do** keep borders at 1px, using Hairline at rest and Hairline Strong only
  for the two documented exceptions.
- **Do** ease with `var(--ease-out-quint)` (`cubic-bezier(0.22, 1, 0.36, 1)`).
  `300ms` for colour, `500ms` for transform and opacity, `750ms` for entrances.
- **Do** gate every JS animation behind `useReducedMotion()`. CSS is already
  neutralised globally; JS is not.
- **Do** let the grid breathe unevenly: `20px` columns against `56px` rows is
  the intended rhythm, not an oversight.

### Don't:

- **Don't** let a shot use shell tokens (`ink`, `bone`, `hairline`,
  `font-display`, `ease-out-quint`). Shots declare their own fonts via
  `next/font` inside their own module and map them onto `--shot-sans`,
  `--shot-display`, `--shot-mono`. This is the project's one rule.
- **Don't** import a shot statically. The registry's dynamic import is what
  keeps a WebGL piece out of the gallery bundle.
- **Don't** introduce a hardcoded hue anywhere in `components/shell/` or `app/`.
- **Don't** add a second serif voice, or bold the mono labels.
- **Don't** use `#000` or `#fff`.
- **Don't** use bento grids, glassmorphism as decoration, gradient text
  (`background-clip: text`), hero metric blocks, identical icon-and-heading card
  grids, or violet-to-cyan gradients on near-black. Carried verbatim from
  `PRODUCT.md`: anything that reads as machine generated on sight.
- **Don't** use a coloured `border-left` or `border-right` above 1px as an
  accent stripe.
- **Don't** reach for a modal. The info panel is a rail for a reason.
- **Don't** nest a card inside a card.
- **Don't** make a shot responsive. Below 1024px it shows the crafted notice.
- **Don't** animate layout properties. Re-key and stagger instead.

### Shot Ledger: the exclusion list

Not a system to inherit. A record of lanes already occupied, so the next shot
can be checked against it before a direction is committed. Append one row per
shot. If a proposed palette, typeface or motion idea appears here, pick
something else.

| N | Title | Palette | Type | Motion | Lane occupied |
|---|---|---|---|---|---|
| 0001 | First Light | `#07070a` ground, `#e9a23b` amber, `#efe9df` bone | Fraunces / Inter / JetBrains Mono | Cursor-tracked radial lamp revealing a masked survey grid; 120s plate rotation; `mix-blend-mode: screen`; SVG grain at 0.035 | Editorial-typographic on near-black, single warm accent, observatory instrumentation |
| 0002 | Press Run | `#f6f7f9` cool stock on `#e6e7eb` ground, `#212229` ink, `#a2326d` mulberry spot colour, `#5e679d` reserved for the generated panel | Instrument Sans only, variable axis, tabular figures, sentence-case labels | Press run on mount and on every period switch: the black plate inks, then the spot plate strikes column by column 18ms apart, each landing 2px out of registration and settling over 440ms; overprint drawn by stacking order rather than `mix-blend-mode`, rules painted over the columns; pointer- and keyboard-scrubbed rule with running half-period subtotals | Restrained light product UI, tinted neutrals carrying the surface with one spot colour on data only, single grotesque, no mono, no card grid |

**The Occupied Lane Rule.** Before choosing a direction, read the last three
rows. Dark ground with a single warm accent and a serif display is now spent.
Reusing it is a wasted day even if the result is good, because `PRODUCT.md`
makes range the argument.

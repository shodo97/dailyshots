# Product

## Register

product

## Users

Design engineering hiring managers and prospective clients, arriving from a
shared link on a desktop, giving the work a few minutes at most. They are
practitioners. They can tell shipped software from a mockup, and they are
reading for one specific piece of evidence: that a single person designed and
built all of this. Their job to be done is a fast, confident judgement about
range and depth.

The secondary user is the author, who needs the daily loop to stay cheap enough
to sustain. A process that only works on a good day produces gaps, and gaps are
what the practice is designed to prevent.

Shots are gated below 1024px, so the viewing context is always a large screen
with a cursor. Hover, scroll choreography and pointer tracking are available
input, not progressive enhancement.

## Product Purpose

dailyshots is a public daily interface practice. One screen designed and built
from scratch each day, published into a gallery that hosts every piece as an
independent universe with its own palette, typography, spacing scale and motion
language.

Success is a body of work where the distance between any two pieces is obvious
at a glance, and where any single piece still holds up when someone who builds
interfaces for a living opens the route and looks closely. Failure is sixty
competent variations of one screen.

The gallery shell is the one coherent product here. Everything inside it is
deliberately not.

## Brand Personality

Precise, restrained, inevitable.

Quiet confidence. Nothing decorative survives the edit, and what remains should
look like the only answer that was available. The craft is legible in spacing,
timing, type detail and state handling rather than in effects.

Copy voice (shot notes, info panel, shell chrome) is plain and specific: what
the idea was, what was hard. No adjectives doing the work that evidence should
do.

Critically: restraint is an editing discipline, not an aesthetic. A loud,
saturated, maximal shot is restrained if every loud choice is load bearing.
Reading restraint as "quiet dark minimalism" would collapse the range that this
project exists to demonstrate, so it is explicitly not that.

## Anti-references

**Primary: anything that reads as machine generated on sight.** Match and
refuse, then rewrite the element with different structure:

- Bento grids.
- Glassmorphism used decoratively.
- Gradient text (`background-clip: text`).
- Hero metric blocks: big number, small label, supporting stats.
- Identical card grids of icon plus heading plus body text.
- Violet-to-cyan or blue-to-purple gradients on near-black.
- Colored `border-left` accents on cards, callouts and alerts.

**Second-order reflex, equally banned.** Avoiding the slop list above leads
straight into editorial serif display on near-black with one warm accent. Shot
0001 already occupies that lane. A second shot there is a template, not range.
Before committing a direction, check that the aesthetic is not guessable from
"portfolio shot that is not AI slop".

**Thin credibility.** Because the audience is engineers, a shot that invents
impossible data shapes, skips the states that actually occur, or only works on
the happy path fails its purpose even when it photographs well.

## Design Principles

1. **Range is the argument.** Portfolio value lives in the distance between
   pieces. A shot that resembles the previous one is a wasted day even if it is
   good on its own. Check the last three shots before choosing a palette,
   typeface or layout strategy.

2. **Restraint is editing, not a palette.** Earn each aesthetic from the idea,
   then cut everything that is not carrying it. Do not converge on quiet.

3. **It has to read as software.** Real data shapes, the states that genuinely
   occur, one obvious primary task per screen. The viewer is checking whether
   this could ship, not whether it renders.

4. **Motion carries the idea.** Every shot moves, and the movement is the
   concept rather than a finish applied to it. If the piece still makes its
   point as a still frame, the motion was decoration.

5. **Nothing decorative survives.** If an element can be removed without losing
   meaning, remove it. Inevitability is the target: present, and clearly the
   only option.

## Accessibility & Inclusion

Not strict WCAG AA. Design intent wins over the checklist, deliberately, but
within hard floors:

- `prefers-reduced-motion` is honoured everywhere, without exception. CSS
  transitions are neutralised globally in `app/globals.css`; JS animation is
  not, so Motion and GSAP are always gated behind `useReducedMotion()`.
- Contrast stays sane and focus stays visible. A piece is never flattened to
  satisfy a ratio, but text that cannot be read is a failure, not a style.
- Colour is never the only carrier of meaning, which also covers colour
  blindness.
- Below 1024px, shots show a crafted notice rather than a squashed layout.
  Mobile-targeted shots set `target: "mobile"` and are presented inside a phone
  frame on the desktop canvas. Shots are never made responsive.

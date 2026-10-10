# dailyshots

One interface, every day. Designed and built from scratch — product UI,
editorial layout, WebGL, whatever the idea asks for. No shared design system
between pieces.

**[dailyshots.vercel.app](https://dailyshots.vercel.app)**

## Run it

```bash
pnpm install
pnpm dev
```

## Add a shot

```bash
pnpm new-shot "Wallet onboarding"   # --tags= --aspect= --target= --accent=
pnpm shot:capture 4                 # poster frame for the grid
pnpm shot:record 4                  # hover loop for the grid
```

Then flip `published: true` in the shot's `meta.ts`.

Built with Next.js, Tailwind, Motion, GSAP, Lenis and three.js / React Three
Fiber. See [CLAUDE.md](CLAUDE.md) for how the repo is organised and why.

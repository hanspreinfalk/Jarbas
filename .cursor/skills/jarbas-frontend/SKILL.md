---
name: jarbas-frontend
description: >-
  Builds Jarbas UI in this Tauri + Vite + React app to match jarbas-web
  (Deploy Co design system, shadcn base-nova, product voice). Use when adding
  screens, components, styling, Tailwind/shadcn setup, onboarding/demo UI,
  or any frontend work in Documents/tauri/jarbas.
---

# Jarbas frontend (match jarbas-web)

This repo’s UI must feel like **jarbas-web**, not a stock Tauri/Vite template.

**Canonical source (read, don’t invent):**  
`/Users/hanspreinfalk/Documents/jarbas-parent/jarbas-web`

| Piece | Path in jarbas-web |
|---|---|
| Tokens + shell utilities | `app/globals.css` |
| Fonts + root shell | `app/layout.tsx` |
| shadcn config | `components.json` (`style: base-nova`, Tailwind 4, lucide) |
| Primitives | `components/ui/*` |
| Product screens | `components/jarbas/*` |
| `cn()` | `lib/utils.ts` |
| Product voice | `AGENTS.md` |

Detail copy-paste: [`reference.md`](./reference.md).

## When to use

Any UI work in this repo: pages, layouts, buttons, forms, chat, onboarding, theming, installing Tailwind/shadcn, porting a screen from web.

## Hard rules

1. **Match jarbas-web** for color, type, spacing language, and copy tone. Prefer reading the files above over guessing.
2. **This app is Vite + React + Tauri**, not Next.js. Adapt patterns (no `next/font`, no App Router, no RSC). Keep the *visual* system identical.
3. Do **not** ship the default blue Tauri/Vite starter look for product UI.
4. Do **not** invent a different palette (no purple-indigo SaaS defaults, no random dark neon).
5. Hans only reviews. Scaffold, style, and wire UI yourself; end with a short review packet.

## Stack target (align when missing)

jarbas-web today:

- React 19 · Tailwind CSS v4 · shadcn **base-nova** · `@base-ui/react` · `class-variance-authority` · `clsx` + `tailwind-merge` · `lucide-react` · `tw-animate-css`
- CSS entry: `@import "tailwindcss";` + `@import "tw-animate-css";` + `@import "shadcn/tailwind.css";`
- Path alias `@/` → `src/` (set the same in Vite + tsconfig when scaffolding)

If Tailwind/shadcn are not installed yet and UI work needs them: set them up to match jarbas-web (same `components.json` style/`baseColor`/`cssVariables`, same token block from `globals.css`), then build. Prefer `npx shadcn@latest` for Vite/React rather than inventing components.

## Brand tokens (Deploy Co / Jarbas)

| Role | Value | Tailwind |
|---|---|---|
| Navy / primary | `#080870` | `bg-primary`, `text-navy`, `text-primary` |
| Cream / secondary / muted | `#f7f5ee` | `bg-cream`, `bg-secondary`, `bg-muted` |
| Sky / accent | `#bce2ff` | `bg-sky`, `bg-accent` |
| Ink / foreground | `#0a0a0a` | `text-ink`, `text-foreground` |
| Border / input | `#e6e4dc` | `border-border` |
| Radius base | `0.5rem` | `--radius` |

Shell / surface utilities (define same class names as web):

- `jarbas-shell` — cream→white page wash + soft sky radial
- `jarbas-sidebar` — cream sidebar wash
- `jarbas-chat-canvas` — chat area wash
- `jarbas-vision` — deep blue marketing panel
- `label-caps` — `text-[11px] font-medium tracking-[0.14em] uppercase`

Do **not** use a right-edge navy/sky gradient rail (`jarbas-rail` or similar). This desktop app has no accent strip on the right.

Prefer semantic tokens (`bg-primary`, `text-muted-foreground`) over one-off hex in JSX.

## Typography

| Role | Face | Usage |
|---|---|---|
| Sans / UI | **Geist** → `--font-sans` | Body, controls, tables |
| Display / headlines | **Libre Baskerville** → `--font-display` | Page titles, italic hero lines |
| Mono | **Geist Mono** | Code / dense technical |

Patterns from web:

- Step / section label: `label-caps text-navy/70` (or `/60`)
- Title: `font-display text-3xl tracking-tight text-ink` (scale up on sm+)
- Hero italic: `font-display … italic`
- Body support: `text-sm leading-relaxed text-muted-foreground`

Load fonts for Vite via `@fontsource-variable/geist` / Google CSS / local files — not `next/font`. Still set CSS variables `--font-sans`, `--font-display`, `--font-geist-mono` the same way.

## Layout / composition habits

- Full-height app shells often use `jarbas-shell` + `h-dvh` / `min-h-dvh`, not flat white-only boards.
- Onboarding-style pages: `bg-cream`, `max-w-6xl`, generous padding (`px-5 py-8 sm:px-8`).
- Many product surfaces use **square** chrome (`rounded-none` on outline buttons/tables) with `border-border` — do not round everything into soft SaaS pills.
- Primary CTAs: shadcn `Button` `variant="default"` (navy). Secondary: `outline` / `ghost`.
- Icons: **lucide-react**; keep sizes consistent with web (`size-4` default in buttons).

## Component placement (this repo)

Once scaffolding exists, mirror web structure under `src/`:

```
src/
  components/ui/       ← shadcn primitives
  components/jarbas/   ← product screens / composites
  lib/utils.ts         ← cn()
  styles/globals.css   ← tokens + utilities (or equivalent)
```

Port screens by adapting `components/jarbas/*` from jarbas-web; keep demos thin unless Hans asks for full parity.

## Product voice (UI copy)

From jarbas-web `AGENTS.md` — apply here too:

- Prefer **positive** framing: potential, gain, unlock, opportunity.
- Avoid pessimistic money words in user-facing copy: waste, wasted, lost, leaks, burned, stop wasting.
- Lead with **speed of delivery** (“two weeks / three weeks”), then monetary impact once.
- Never stack the same $ figure twice on one surface.
- Internal field names may stay; change what users read.

## Motion

Reuse web utility animations when porting (`animate-rise`, `animate-fade-soft`, analyze/tool keyframes in `globals.css`). Prefer subtle rise/fade over flashy generic loaders. Keep 2–3 intentional motions max on a screen.

## Do / don’t

| Do | Don’t |
|---|---|
| Open jarbas-web files and copy token/util names | Invent a parallel design system |
| Use shadcn + Deploy Co tokens | Raw unstyled HTML for product surfaces |
| `cn()` for class merges | String-concat class spaghetti |
| Positive, fast-delivery copy | “Stop wasting / leakage” tone |
| Tauri invoke only for desktop I/O | Put desktop APIs in presentational UI without need |

## Verify

Before finishing UI work:

1. Navy/cream/sky/ink read as Jarbas (not Vite blue).
2. Display headlines use Libre Baskerville; UI uses Geist.
3. Labels use `label-caps` where web would.
4. Copy passes the product-voice checks above.
5. No em dashes in copy written for Hans’s Telegram/voice — prefer `-` / commas (vault rule); product UI can follow web copy as-is when porting exact strings.

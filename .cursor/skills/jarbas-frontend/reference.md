# jarbas-frontend reference

Copied from jarbas-web for agents working in this Tauri app. Prefer the live files if they diverge:

- `/Users/hanspreinfalk/Documents/jarbas-parent/jarbas-web/app/globals.css`
- `/Users/hanspreinfalk/Documents/jarbas-parent/jarbas-web/app/layout.tsx`
- `/Users/hanspreinfalk/Documents/jarbas-parent/jarbas-web/components.json`
- `/Users/hanspreinfalk/Documents/jarbas-parent/jarbas-web/AGENTS.md`

## components.json (web)

```json
{
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

For this Vite app: `rsc: false`, CSS path under `src/` (e.g. `src/styles/globals.css`).

## CSS imports + theme (minimal)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-display);
  --font-heading: var(--font-sans);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-destructive: var(--destructive);
  --color-navy: var(--navy);
  --color-cream: var(--cream);
  --color-sky: var(--sky);
  --color-ink: var(--ink);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --popover: #ffffff;
  --popover-foreground: #0a0a0a;
  --primary: #080870;
  --primary-foreground: #ffffff;
  --secondary: #f7f5ee;
  --secondary-foreground: #0a0a0a;
  --muted: #f7f5ee;
  --muted-foreground: #5c5c66;
  --accent: #bce2ff;
  --accent-foreground: #080870;
  --destructive: oklch(0.55 0.2 25);
  --border: #e6e4dc;
  --input: #e6e4dc;
  --ring: #080870;
  --navy: #080870;
  --cream: #f7f5ee;
  --sky: #bce2ff;
  --ink: #0a0a0a;
  --radius: 0.5rem;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}

@layer utilities {
  .jarbas-shell {
    background:
      radial-gradient(1200px 600px at 0% 0%, rgba(188, 226, 255, 0.28), transparent 55%),
      linear-gradient(180deg, #f7f5ee 0%, #ffffff 42%, #ffffff 100%);
  }

  .jarbas-sidebar {
    background: linear-gradient(180deg, #f7f5ee 0%, #f3f0e6 48%, #efebe0 100%);
  }

  .jarbas-chat-canvas {
    background:
      radial-gradient(800px 420px at 50% 0%, rgba(188, 226, 255, 0.22), transparent 60%),
      linear-gradient(180deg, #fbfaf6 0%, #ffffff 38%, #ffffff 100%);
  }

  .jarbas-vision {
    background:
      radial-gradient(900px 500px at 85% 15%, rgba(110, 168, 239, 0.55), transparent 55%),
      radial-gradient(700px 500px at 20% 80%, rgba(8, 8, 112, 0.95), transparent 50%),
      linear-gradient(135deg, #07143a 0%, #14307a 48%, #1a6aa8 100%);
  }

  .label-caps {
    @apply text-[11px] font-medium tracking-[0.14em] uppercase;
  }
}
```

## cn()

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Product voice (verbatim from web AGENTS.md)

Prefer **positive** framing in user-facing copy: **potential**, **gain**, **unlock**, **opportunity**.

Avoid pessimistic money language in labels and summaries: **waste**, **wasted**, **lost**, **leaks**, **burned**, **stop wasting**.

**Lead with speed of delivery** (“two weeks / three weeks”), then keep monetary impact once. Quick wins build trust for bigger work. Never stack the same $ figure twice on one surface (list card, detail header, CTA).

Internal field names (`wasteCost`, `wastePerYear`, etc.) may stay for now; change what users read.

## Useful product components to port

Under jarbas-web `components/jarbas/`:

- `onboarding-flow.tsx`
- `demo-app.tsx`
- `blocks.tsx`
- `interview-session.tsx`
- `weekly-calendar.tsx`
- `workflow-flow.tsx`
- `agent-run-demo.tsx`
- `sound-wave.tsx`

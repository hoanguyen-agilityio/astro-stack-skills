# `DESIGN.md` template

`code-skeleton` writes this file to the project root as `DESIGN.md`. It is the design context
an AI agent reads before writing or changing UI, so new components match the system that exists
instead of inventing a parallel one. Modelled on the team's `apps/kitchen/DESIGN.md`.

Rules for the file:

- It describes the project **as it is**, not an ideal. When the code breaks a rule, mark it
  **`debt`** ("do not copy this") and list it under Known debt.
- Facts only, each with a path. Check every value against `src/styles/global.css` and
  `components.json` before writing it. If you used a different shadcn preset than `nova`, rewrite
  the font, radius and color values to match.
- Sections that need a real design (character, screens, brand colors) stay as `TODO(design)`
  until a design arrives. `analyze-task` fills them in from the design input.

Copy everything below the line, replace `<project-name>`, and keep the headings.

---

```markdown
# DESIGN.md — <project-name>

Design context for AI coding agents. Read this before writing or changing any UI, so generated
components match the system that already exists. It describes the project **as it is today**.
Where the code breaks a rule, the deviation is marked **`debt`**, which means "do not copy this".

**Stack:** Astro 5 in SSR mode (`output: 'server'`) · React 19 islands · TypeScript (strictest) ·
**Tailwind CSS v4** (CSS-first, no `tailwind.config.*`) · **shadcn/ui** (style `radix-nova`, Radix
primitives from `radix-ui`) · `lucide-react` icons · `tw-animate-css` · Vitest + Testing Library ·
Storybook 10 (`@storybook-astro/framework`, `.astro` and React stories).

## Where design lives

| Concern | Location |
|---------|----------|
| Theme tokens (colors, radius, font) | `src/styles/global.css`: `:root`, `.dark`, `@theme inline` |
| Tailwind entry, imported once | `src/layouts/BaseLayout.astro` → `@/styles/global.css` |
| shadcn config and aliases | `components.json` |
| shadcn primitives (generated, then owned) | `src/components/ui/` |
| Class merger `cn()` | the `cn` package (re-exported by `src/lib/utils.ts`) |
| Feature components and islands, one folder each | `src/components/<feature>/<Name>/` |
| Layout shell | `src/layouts/BaseLayout.astro` |
| Font | `@fontsource-variable/geist`, imported in `global.css` |
| Reference screenshots | `docs/design/` (add them as designs arrive) |

## Character

TODO(design): two or three sentences on the product's look. Is it neutral or branded, dense or
airy, flat or elevated, with or without imagery? Until a design fills this in, the project uses
the stock shadcn `nova` look: neutral greys, Geist, a 10px base radius and hairline borders.

## Screens

TODO(design): one row per route.

| Route | Layout | Rendering |
|-------|--------|-----------|
| `/` | `BaseLayout` | SSR `.astro` + `GreetingButton` island (`client:load`) |

## Type scale

Tailwind's **stock** scale, with no remapping: `text-xs` 12px, `text-sm` 14px, `text-base` 16px,
`text-lg` 18px, `text-xl` 20px, `text-2xl` 24px. shadcn primitives use `text-sm` for controls.
The font is `font-sans`, which resolves to Geist Variable (`--font-sans`). Headings use
`--font-heading`, which currently equals `--font-sans`.

## Colors

All colors are `oklch()` CSS variables on `:root` and `.dark`, mapped to Tailwind through
`@theme inline`. **Use the semantic utility, never a raw value.**

| Role | Utilities | Use for |
|------|-----------|---------|
| Page | `bg-background` `text-foreground` | page ground and body text |
| Surface | `bg-card` `text-card-foreground`, `bg-popover` | cards, popovers, dialogs |
| Primary | `bg-primary` `text-primary-foreground` | the one main action per view |
| Secondary / muted | `bg-secondary`, `bg-muted` `text-muted-foreground` | quiet actions, meta text, empty states |
| Accent | `bg-accent` `text-accent-foreground` | hover and selected rows |
| Destructive | `text-destructive`, `bg-destructive/10` | delete, cancel, errors |
| Lines | `border-border`, `border-input`, `ring-ring` | borders, inputs, focus rings |
| Charts | `chart-1` … `chart-5` | data series only |

TODO(design): brand colors. When a design brings them, change the variables in `:root` and
`.dark`. Do not add hex classes. A design color with no matching token is an open question,
not a `bg-[#…]`.

### Dark mode

Class-based: `@custom-variant dark (&:is(.dark *))`. Dark applies under any ancestor with the
`dark` class, and every token is redefined in `.dark`. Semantic utilities switch automatically,
so a component built only from tokens needs no `dark:` classes. Nothing toggles the class yet.
Add a toggle only when a design asks for one.

## Radius, shadows, elevation

`--radius` is `0.625rem` (10px). The scale derives from it: `rounded-sm` 6px, `rounded-md` 8px,
`rounded-lg` 10px, `rounded-xl` 14px, `rounded-2xl` 18px. Change `--radius` to change them all.
Elevation is borders first (`border`, `ring-1`), with shadows used sparingly. TODO(design): shadow
tokens, if the design is elevated.

## Components

- **shadcn first.** Before writing markup, check `src/components/ui/`, then add the missing
  primitive with `pnpm dlx shadcn@4 add <name> -y`. Do not hand-roll a dialog, select, toggle or
  alert that shadcn provides.
- **Variants with `cva`**, classes merged with `cn()` with the caller's `className` last. Do not
  concatenate class strings by hand.
- shadcn components carry `data-slot` attributes. Style children through them rather than deep
  selectors.
- **Button:** `default` (primary), `outline`, `secondary`, `ghost`, `destructive` (tinted, not
  filled, in `nova`), `link`. Sizes are `xs`, `sm`, `default` (h-8), `lg`, and `icon*`.
- **Icons:** `lucide-react` only. Size them with `size-4` or let the button size them. Icon-only
  buttons need `aria-label`.

## Motion

`tw-animate-css` provides the enter/exit animations shadcn uses. Keep custom motion short
(≤ 200ms) and respect `motion-reduce:`.

## Layout

`BaseLayout.astro` holds the HTML shell (`lang`, `charset`, `viewport`, `<title>`) and imports the
stylesheet. Pages put content in `<main class="mx-auto max-w-… p-6">`. TODO(design): header,
navigation and footer once a design defines them.

## Astro islands — the rendering boundary

- **`.astro`** for static markup and server data. It runs on the server only, can `await` a
  service, and ships no JS. Use `class=`, not `className=`.
- **`.tsx` island** when the UI needs state, effects or a Radix primitive. Choose the directive
  on purpose:

| Directive | Use for |
|-----------|---------|
| none | static output |
| `client:load` | small interactive pieces above the fold |
| `client:visible` | interactive pieces below the fold |
| `client:idle` | low-priority interactivity |
| `client:only="react"` | whole-screen React that needs `window`; the page must render its own SSR placeholder |

- Props crossing the boundary must be serialisable: plain data and `Date`s. Never pass
  functions, class instances or secrets, because props are written into the HTML.
- Each island is its own React root. Context does not cross islands, so two islands that share
  state should become one island.
- `.astro` files have no unit tests (Vitest only collects `.ts`/`.tsx`); their states are covered
  by a Storybook story and, for pages, a Container API test. Do not rewrite `.astro` as React just
  to test it.

## Responsive

Mobile-first with Tailwind's default breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).
Base classes target the smallest screen, and `md:` and up add to them. TODO(design): breakpoints
the design actually uses.

## States & feedback

| State | Pattern |
|-------|---------|
| Loading, known layout | `Skeleton` blocks in the shape of the content; set `aria-busy` on the region |
| Loading, inline | button `disabled` plus a label change ("Saving…") |
| Empty | one sentence in `text-muted-foreground`; empty is not an error |
| Error, recoverable | `Alert variant="destructive"` with a "Try again" button |
| Destructive confirm | `AlertDialog`; never `window.confirm` |
| Toasts | add `sonner` with `shadcn add sonner` when a design needs them |
| Disabled | a real `disabled` attribute; shadcn applies `opacity-50` |

## Anti-slop rules

1. Every color, radius and font comes from a token in `global.css`. No `bg-[#…]` and no `[15px]`
   without an agreed new token.
2. Use `cn()` from `cn` and `cva` for variants. Do not add another class-merge helper.
3. Do not add a new UI library, icon set or CSS framework. Use shadcn and Radix first.
4. Use Tailwind v4 idioms only: tokens in CSS (`@theme inline`), no `tailwind.config.*`.
5. Respect the island boundary: serialisable props only, and the smallest interactive island.
6. Accessibility is required: real `<button>`s, labels on icon buttons, visible focus
   (`focus-visible:ring`), `role="status"` and `aria-busy` for live regions, keyboard reach for
   everything.
7. Copy is sentence case. Errors say what failed and what to do; empty states are one sentence.
8. When this file does not cover a case, copy the nearest existing component. If nothing is
   close, ask instead of inventing a pattern.

### Known debt

| Debt | Where |
|------|-------|
| none yet | |

## Working conventions

- **One folder per component**, `src/components/<feature>/<Name>/`, holding up to three things:
  `index.astro` or `index.tsx`, `<Name>.stories.tsx` (React stories set
  `parameters: { renderer: 'react' }`), and `__test__/index.test.tsx`. Feature helpers
  (`format.ts`, `load<Resource>.ts`) sit beside the component folders with their own `__test__/`.
  Query tests by role and accessible name.
- Stories show every state with fixtures from `src/mocks/`, never the network. Check each new
  story in light and dark (theme toolbar) with a clean Accessibility panel: `pnpm storybook`.
- Import order: external packages → `@/` aliases → relative imports.
- No `any` and no `@ts-ignore`. API data is decoded with Effect `Schema` before it reaches UI.
- Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.
- When a design changes tokens or adds a pattern, update this file in the same change.
```

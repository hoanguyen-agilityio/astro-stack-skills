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

````markdown
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
| App-wide reusable components | `src/components/common/<Name>/` |
| Shell parts (header, footer) | `src/components/layout/<Name>/` |
| Feature components and islands, one folder each | `src/components/<feature>/<Name>/` |
| Layouts | `src/layouts/BaseLayout.astro` (HTML shell), `src/layouts/AppLayout.astro` (shell + header + footer) |
| App name, description, nav links | `src/config/site.ts` |
| Light/dark switch | `src/libs/theme.ts`, the inline script in `BaseLayout.astro`, `common/ThemeToggle` |
| Font | `@fontsource-variable/geist`, imported in `global.css` |
| Reference screenshots | `docs/design/` (add them as designs arrive) |

## Character

TODO(design): two or three sentences on the product's look. Is it neutral or branded, dense or
airy, flat or elevated, with or without imagery? Until a design fills this in, the project uses
the stock shadcn `nova` look (neutral greys, Geist, a 10px base radius, hairline borders) with one
violet `brand` accent for the logo mark, eyebrows, icon tiles and the hero glow.

## Screens

TODO(design): one row per route.

| Route | Layout | Rendering |
|-------|--------|-----------|
| `/` | `AppLayout` | SSR welcome page: `Hero`, `GetStarted` + `CounterButton` island (`client:load`), `LinkCard` grid. Replace it with the first real screen |
| `/404` | `AppLayout` | SSR, `Container size="sm"` + `PageHeader` |

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
| Brand | `bg-brand` `text-brand-foreground`, `text-brand`, `bg-brand/10` | logo mark, eyebrow labels, icon tiles, decorative glow. Not for actions: actions use `primary` |
| Charts | `chart-1` … `chart-5` | data series only |

`--brand` and `--brand-foreground` are the only tokens added on top of shadcn's, in the block
at the end of `global.css`, next to the `bg-grid` utility (the faint grid behind the hero).
TODO(design): brand colors. When a design brings them, change the variables in `:root` and
`.dark`. Do not add hex classes. A design color with no matching token is an open question,
not a `bg-[#…]`.

### Dark mode

Class-based: `@custom-variant dark (&:is(.dark *))`. Dark applies under any ancestor with the
`dark` class, and every token is redefined in `.dark`. Semantic utilities switch automatically,
so a component built only from tokens needs no `dark:` classes. `ThemeToggle` (in `SiteHeader`)
flips the class and stores the choice in `localStorage` under `theme`. An inline script in
`BaseLayout.astro` applies the stored choice, or the system preference, before first paint.

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

### Reusable components

Use these before writing layout markup. Each has a story per variant.

| Component | Import | Use for |
|-----------|--------|---------|
| `AppLayout` | `@/layouts/AppLayout.astro` | every page with the app shell (`title`, optional `description`) |
| `Container` | `@/components/common/Container/index.astro` | page width and gutters: `size` `sm` (forms, reading), `md`, `lg` (default, grids) |
| `PageHeader` | `@/components/common/PageHeader/index.astro` | the top of every page: `eyebrow`, `title` (the `h1`), `description`, `actions` slot |
| `LinkCard` | `@/components/common/LinkCard/index.astro` | a card that is one link: `href`, `title`, `description`, `external`, `icon` slot |
| `ThemeToggle` | `@/components/common/ThemeToggle` | light/dark switch (already in `SiteHeader`) |
| `SiteHeader`, `SiteFooter` | `@/components/layout/…` | used by `AppLayout` only; nav links come from `siteConfig.nav` |

## Motion

`tw-animate-css` provides the enter/exit animations shadcn uses. Keep custom motion short
(≤ 200ms) and respect `motion-reduce:`.

## Layout

`BaseLayout.astro` holds the HTML shell (`lang`, `charset`, `viewport`, description, favicon,
`<title>` suffixed with the app name, the theme script) and imports the stylesheet.
`AppLayout.astro` wraps it with a skip link, the sticky `SiteHeader`, `<main id="main">` and
`SiteFooter`. A page is:

```astro
<AppLayout title="Orders" description="Every order with its status.">
  <Container class="flex flex-col gap-8 py-10">
    <PageHeader title="Orders" description="…"><a slot="actions" …>New order</a></PageHeader>
    <!-- feature components -->
  </Container>
</AppLayout>
```

Do not write `<main>` or a max-width wrapper in a page; `AppLayout` and `Container` own them. Add
a route's link to `siteConfig.nav`. TODO(design): header and footer content once a design
defines them.

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

- **Where a component goes:** `ui/` for shadcn primitives, `common/` for app-wide pieces whose
  props carry no domain words, `layout/` for the shell, `<feature>/` for the rest. A feature
  never imports from another feature: when a second feature needs a component, move it to
  `common/` with generic props, and add it to the table under Components.
- **One folder per component**, `src/components/<feature>/<Name>/`, holding up to three things:
  `index.astro` or `index.tsx`, `<Name>.stories.tsx` (React stories set
  `parameters: { renderer: 'react' }`), and `__test__/index.test.tsx`. Feature helpers
  (`format.ts`, `load<Resource>.ts`) sit beside the component folders with their own `__test__/`.
  Query tests by role and accessible name.
- Stories show every state with fixtures from `src/mocks/`, never the network. `pnpm test:stories`
  opens each one in light and dark and fails on an a11y violation; fix the token or the markup.
- Import order: external packages → `@/` aliases → relative imports.
- No `any` and no `@ts-ignore`. API data is decoded with Effect `Schema` before it reaches UI.
- Every page passes its own `title` and `description` to `AppLayout`, and `noindex` when it is
  not public. Images come from `astro:assets` (`<Image>`), with the one LCP image `eager` and
  `fetchpriority="high"`.
- Verify with `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage`,
  `pnpm build`, `pnpm test:stories` and `pnpm test:pages`. Commits run ESLint and Prettier on
  staged files (Husky + lint-staged); pushes run typecheck, tests with 80% coverage, the story
  checks and the page checks. Never skip them with `--no-verify`.
- When a design changes tokens or adds a pattern, update this file in the same change.

## Performance budget

Per page, compressed. `scripts/check-pages.ts` (`BUDGET_KB`) enforces the same numbers; change
both together.

| Resource | Budget |
|----------|--------|
| JavaScript | 300 KB |
| CSS | 100 KB |

Core Web Vitals targets, at the 75th percentile of real visits: LCP ≤ 2.5 s, INP ≤ 200 ms,
CLS ≤ 0.1. The gates cannot measure them; the `web-quality` skill does with a browser trace.
````

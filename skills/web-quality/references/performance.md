# Performance and Core Web Vitals in this stack

Astro sends HTML with no JavaScript unless a component is an island, so most performance
problems here are one of four things: an island that loads too early or is too big, an LCP image
that is found late, an image or font that shifts the layout, or a slow server response from the
data a page loads in its frontmatter.

## What the gates measure

`pnpm test:pages` sums the gzip size of the scripts and stylesheets each page loads and fails
above the budget in `scripts/check-pages.ts` (the same numbers as `DESIGN.md`'s Performance
budget). It also fails on an `<img>` without `width` and `height`. It does not measure LCP, INP
or CLS: those need a trace (lab) or real users (field).

| Budget, per page, gzip | Default | Why |
|------------------------|---------|-----|
| JavaScript | 300 KB | Parse and execution cost on mid-range phones |
| CSS | 100 KB | Render-blocking; Tailwind usually ships 10–30 KB |

A budget that does not fit the product is changed in `DESIGN.md` and the script together, with
the user's agreement. Never raise it to make a failing page pass.

## Thresholds (Core Web Vitals, 75th percentile of real visits)

| Metric | Good | Poor | Usual cause here |
|--------|------|------|------------------|
| LCP | ≤ 2.5 s | > 4 s | Hero image lazy or discovered late; slow `load…` in the page frontmatter |
| INP | ≤ 200 ms | > 500 ms | Heavy island work on click; a big island hydrating while the user acts |
| CLS | ≤ 0.1 | > 0.25 | Image without size; island that renders taller than its server HTML; web font swap |

A lab trace gives one sample under stated conditions. Say so, and never compare it with a field
p75 as if they were the same thing.

## LCP

- The LCP element must be in the server HTML. Data for it is loaded in the page frontmatter
  (`load<Resource>`), never fetched by an island after hydration.
- Images go through `astro:assets`, which writes `width`, `height` and modern formats:

  ```astro
  ---
  import { Image } from 'astro:assets';
  import hero from '@/assets/hero.jpg';
  ---
  <!-- The LCP image: eager, high priority. Only one image per page gets this. -->
  <Image src={hero} alt="Team lunch on the terrace" loading="eager" fetchpriority="high" />
  <!-- Everything below the fold: lazy, the default. -->
  <Image src={dish} alt={dish.name} />
  ```

- Do not add `<link rel="preload">` unless a trace shows the image is discovered late.
- A slow page response is a data problem: check the service's timeout and whether the page
  waits on calls it does not need for the first screen.

## INP and islands

- Pick the directive on purpose: `client:visible` or `client:idle` for anything below the fold
  or not needed at once; `client:load` only for controls the user needs immediately. A
  `client:load` without a reason is a finding.
- Keep islands small: a filter bar is an island, the table it filters is server HTML.
- Long work in a handler (sorting thousands of rows, parsing) blocks the next paint. Move it to
  the server (URL params and a page reload) or split it with `await scheduler.yield()` where
  supported, falling back to `setTimeout`.
- `useTransition` for state updates that re-render a lot.

## CLS

- Every `<img>` has `width` and `height` (the gate checks). `<Image>` does it for you.
- An island's server HTML and first client render must have the same size. Loading states use
  a `Skeleton` with the final size, not a spinner that later grows.
- Fonts: `@fontsource` packages ship `font-display: swap`. Preload only the one weight used
  above the fold, and only if a trace shows a late swap.
- Never insert banners above existing content after load; reserve their space.

## Navigation and caching

- Astro's `prefetch` (in `astro.config.mjs`, `prefetch: { defaultStrategy: 'hover' }`) speeds up
  the next page for little cost. Prefer it to hand-written Speculation Rules.
- Hashed files in `/_astro/` can be cached for a year (`immutable`); HTML should revalidate. Set
  this in the host or CDN; the Node adapter serves `/_astro/` with long cache headers already.
- Third-party scripts (analytics, chat) are the most common budget breaker. Load them late,
  after consent, and count them in the budget.

## Live evidence

With a browser tool: start `pnpm preview`, record a performance trace of a cold load on a
throttled mobile profile, and read the LCP element, its phases, layout shifts and long tasks.
Then click the main control and read the interaction's delay, processing and presentation time.
Report values with the conditions (device profile, network, cold or warm cache) and keep field
verification as "pending until real visits".

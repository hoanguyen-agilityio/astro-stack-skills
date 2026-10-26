# Review checklist — what to look for and how to fix it

The reviewer goes through every category for every changed file. Each finding names the file and
line, the evidence (for a duplicate: the existing piece), and the fix below.

## 1. Duplication (`blocker`)

| Look for | Evidence | Fix |
|----------|----------|-----|
| A new component that does what an inventory piece does (same role, similar markup, overlapping props) | the existing piece's path and props | Use the existing piece. If it lacks something, add an optional prop or a `variant` to it, with a story for the new state |
| The same new component in two features | both paths | Move it to `src/components/common/<Name>/` with generic props (no feature words in prop names), update every import, delete the copies |
| A feature importing from another feature (`@/components/orders/…` inside `products/`) | the import line | Move the imported piece to `common/` (or `src/libs/` for a helper) and import it from there |
| A helper that already exists (`formatDate`, `formatPrice`, URL parsing) | the existing export | Import it. If it lives in a feature, move it to `src/libs/` first |
| Markup copied from a shadcn primitive or a `common/` piece | the primitive | Use the primitive |
| A second Schema, service or `load<Resource>` for a resource that has one | the existing file | Extend the existing file |
| A `jscpd` clone | its output (`references/duplicates.md`) | Extract the shared part; never ignore it |

Two things that look alike are not always duplicates: two cards with different content and
different props are fine. Call it a duplicate when one could replace the other with at most an
added optional prop.

## 2. Conventions (`should`)

| Look for | Rule (source) |
|----------|---------------|
| Raw hex, `rgb()`, `[15px]`, Tailwind colours outside the tokens | `DESIGN.md` tokens only |
| A page without `AppLayout` → `Container` → `PageHeader` | `CLAUDE.md` Conventions |
| A whole section as an island, `client:load` without a reason, functions or secrets in island props | island boundary (`develop-feature` Rules) |
| A component without a story per state, a React story without `parameters: { renderer: 'react' }` | `CLAUDE.md` Conventions |
| A component outside its own folder, a test outside `__test__/` | `CLAUDE.md` Conventions |
| Hand-written markup where shadcn has a primitive | `DESIGN.md` |
| API data used without `Schema` decoding, `as` on API data | `integrate-api` Rules |
| A page or island calling the client or building Effect chains | `integrate-api` Rules |
| An `oxlint-disable` without a reason, or an anti-slop rule switched off in `oxlint.config.ts` | `project-files.md` Anti-slop (fix the code; disable one line with a reason) |
| A `// SAFETY:` comment that does not say why the assertion holds | Anti-slop: parse instead, or state the checked invariant |

Fix by following the rule; the source file has the details.

## 3. Criteria and states (`blocker`)

| Look for | Fix |
|----------|-----|
| An acceptance criterion with no test and no manual check | Add the test (Testing Library, by role and name), or do the check and record it |
| A view without empty, error and data states; an action without pending, success and failure | Add the state, its story and its test |
| A failed call shown as an empty list | Show the error state |

## 4. Bugs (`blocker`)

Read the logic, not only the shape: wrong condition, missing `await`, an unhandled error tag,
a key collision in a list, a filter that ignores the URL param, an off-by-one in pagination.
Name the input that breaks it. Fix it and add a test that fails without the fix.

## 5. Checks (`blocker`)

Any failing gate or `pnpm dup` clone in the changed files. Fix the cause; never weaken the gate.
A `test:stories` failure names the story, the theme and the a11y rule: fix the markup or the
token in `DESIGN.md`, never tag the story `!test` or turn the rule off. A `test:pages` failure
names the page: fix the metadata, header, link or asset it points at.

## 6. Web quality (`should`, `blocker` where marked)

What the gates cannot see, for the pages and islands in the change. The `web-quality` skill's
references explain each point and its fix.

| Look for | Fix |
|----------|-----|
| A page without its own `title` and `description`, or a public page marked `noindex` (`blocker`) | Pass both to `AppLayout`; `noindex` only for error, draft and signed-in pages (`seo.md`) |
| The LCP image lazy or without `fetchpriority="high"`; an image not from `astro:assets` | `<Image>` with `loading="eager" fetchpriority="high"` for the one hero image (`performance.md`) |
| `client:load` on an island that is below the fold or not needed at once | `client:visible` or `client:idle` (`performance.md`) |
| An island whose loading state is smaller than its content (layout shift) | A `Skeleton` with the final size |
| A heading level chosen for its size; a second `<h1>`; "Click here" link text | Headings in order; descriptive link text (`seo.md`, `accessibility.md`) |
| A form error not tied to its field, or not announced (`blocker`) | `aria-invalid`, `aria-describedby`, `role="alert"`, focus the first error (`accessibility.md`) |
| A target smaller than 24 px; motion without `motion-safe:`/`motion-reduce:` | `size-6` minimum; motion utilities (`accessibility.md`) |
| An inline script or a third-party origin without its CSP entry (`blocker`) | `Astro.csp.insertScriptHash` or a bundled `<script>`; the origin in the CSP directives, agreed with the user (`best-practices.md`) |
| `console.log`, `document.write`, a non-passive scroll listener | Remove; `{ passive: true }` (`best-practices.md`) |

## Nits (`nit`)

Naming, comments, wording. Reported, not fixed in the loop.

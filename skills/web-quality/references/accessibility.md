# Accessibility in this stack

The WCAG review is not written here. It comes from the `accessibility` skill of
[addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) (MIT), used as
it is: `web-quality` step 4 calls it on the UI files in scope when it is installed, and asks the
user to install it when it is not. This file holds only what that skill cannot know about this
stack, so the two never repeat each other.

## Already checked by the gates

| Gate | Covers |
|------|--------|
| `pnpm test:stories` | axe on every story, light and dark: contrast, names, roles, labels, ARIA misuse inside a component |
| `pnpm test:pages` | `lang`, one `<h1>`, `alt` on every image, per page |

A passing axe run is not WCAG conformance. Say which manual checks (keyboard only, 200% zoom,
screen reader, reduced motion) were done, and list the rest as not verified.

## Where the stack already does it

- **Landmarks:** `AppLayout` gives one `<main id="main">`, the skip link to it and
  `SiteHeader`'s `<nav aria-label="Main">`. A page never adds another `<main>`, and a second
  `<nav>` gets its own label.
- **Headings:** `PageHeader` renders the page's `<h1>`; sections continue with `h2`/`h3`.
- **Focus and targets:** shadcn primitives carry `focus-visible:ring-*` with the `ring` token and
  sizes of at least `size-6`. Keep them; never `outline-none` without a replacement.
- **Dialogs and menus:** use shadcn's `Dialog`, `AlertDialog`, `Select`; they trap and return
  focus. Do not rebuild them by hand.
- **Forms:** `<Label htmlFor>` on every input; an invalid field gets `aria-invalid` and
  `aria-describedby` to its message in `text-destructive`; results are announced from a
  `role="status"` (success) or `role="alert"` (error) region already in the DOM.
- **Motion:** decorative animation is `motion-safe:`; large movement gets `motion-reduce:`.
- **State not by colour alone:** `aria-current` on the active navigation link and filter.

## Fixing a finding

Fix the markup or the token in `DESIGN.md`, then run `pnpm test:stories` again. Never tag a story
`!test` or turn an a11y rule off in `parameters.a11y` to get green.

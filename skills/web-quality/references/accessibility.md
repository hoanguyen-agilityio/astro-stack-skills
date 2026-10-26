# Accessibility beyond the story checks

`pnpm test:stories` runs axe on every story, in light and dark: contrast, names, roles, labels
and ARIA misuse inside one component. `pnpm test:pages` checks the page shell: `lang`, an `<h1>`,
`alt` on every image. Automated checks find only part of the barriers (WCAG 2.2 AA is the
target). What they cannot see is listed here; findings from it are hypotheses until checked in a
browser.

A passing axe run, or a Lighthouse accessibility score of 100, is not WCAG conformance. Report
the manual checks below as done or not done, never as implied.

## Page level

- One `<main id="main">`, the skip link to it, and `SiteHeader`'s `<nav aria-label="Main">`
  come from `AppLayout`. A page never adds a second `<main>` or `<nav>` without a label.
- Headings: one `<h1>` per page from `PageHeader`, then `h2`/`h3` in order, never chosen for
  their size. Size comes from classes.
- `aria-current="page"` on the active navigation link and `aria-current="true"` on the active
  filter, so the state is not shown by colour alone.

## Keyboard and focus

- Every action is a `<button>` or a link (`<a href>`), never a clickable `<div>`. shadcn's
  primitives are already keyboard-ready; keep their markup.
- Focus is visible on every control: shadcn's `focus-visible:ring-*` classes with the `ring`
  token. Never `outline-none` without a replacement.
- Focus is not hidden under the sticky header: anchor targets and focusable sections get
  `scroll-mt-*` the header's height.
- Dialogs (`AlertDialog`, `Dialog`) trap focus and return it to the trigger; do not rebuild
  them by hand.

## Target size and motion

- Interactive targets are at least 24 × 24 px (`size-6`). Icon buttons use one of shadcn's
  `size="icon"` variants, which are larger; never shrink them below `size-6`. Inline text links
  are exempt.
- Animations and transitions respect the user's setting: `motion-safe:animate-*` for anything
  decorative, `motion-reduce:transition-none` on large movements.
- No auto-advancing content; anything that moves on its own has a pause control.

## Forms

- Every input has a `<Label htmlFor>`; placeholder text is not a label.
- Errors: the field gets `aria-invalid="true"` and `aria-describedby` pointing at the message;
  the message uses `text-destructive` and says how to fix it ("Enter a phone number like 912 345
  678"), not only "Invalid".
- On submit with errors, focus moves to the first invalid field.
- A message that appears after an action (saved, failed) is in a `role="status"` region for
  success and `role="alert"` for errors, already in the DOM before it changes.
- `autocomplete` on personal fields (`email`, `tel`, `given-name`) and never block paste in
  password fields.

## Images and media

- `alt` describes what the image tells the user; `alt=""` for decoration. Icons inside a
  labelled button are `aria-hidden="true"`.
- Charts have a text equivalent: a visible summary or an accessible table.
- Video has captions.

## Manual checks (say which were done)

| Check | How |
|-------|-----|
| Keyboard only | Tab through the page: every control reachable, order follows the layout, no trap |
| Zoom 200% and 320 px width | Nothing cut off, no horizontal scroll for text |
| Screen reader | VoiceOver or NVDA on the main flow: names, states, error announcements |
| Reduced motion | OS setting on: nothing large moves |

With a browser tool, read the accessibility tree of the page (names, roles, states) and run
Lighthouse's accessibility category against `pnpm preview` for page-level issues axe in a story
cannot see.

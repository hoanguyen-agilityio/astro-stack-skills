# Reading a design

Use this when the request includes an image, a screenshot or a Figma link. The goal is a
written description that the plan and the tests can rely on, not a pixel copy.

## Read the project's `DESIGN.md` first

If the project has a `DESIGN.md` (`code-skeleton` writes one), read it before looking at the
design. It names the tokens, the component idioms and the island rules that the mapping below
must use. Without one, read `src/styles/global.css` and `components.json` instead, and say so.

## Getting the design

- **Image or screenshot:** open the file and look at it. If the path does not resolve, stop and
  ask for it. Never work from a guess about what the design shows.
- **Figma link:** use the Figma MCP tools if they are connected, and load the Figma skill that
  ships with them before calling them. If Figma is not connected or the call fails (for example
  rate limits), ask for a screenshot of the frame and continue from that. Do not invent layer
  names or values.

## 1. Regions

Split the frame into regions from top to bottom: header, filters, list, item, footer, dialogs.
For each region, note:

| Region | Static or interactive | shadcn primitive(s) | Notes |
|--------|-----------------------|---------------------|-------|
| Filter bar | interactive | `ToggleGroup` | single select |
| Order card | static + one action | `Card`, `Badge`, `Button` | Cancel only when pending |

An interactive region becomes a React island, or joins one. Static regions stay in `.astro`.
Choose the hydration directive in the plan: `client:load` above the fold, `client:visible` below
it, and none for static regions.

## 2. States the design does not show

Designs usually show the happy path only. List what the frame leaves out, and turn each one into
an edge case or an open question:

- loading, empty, error (and retry)
- disabled or in-flight actions, and repeated clicks
- permission-limited views
- long text, many items, zero values
- narrow screens (mobile-first), keyboard focus

## 3. Values to tokens

Map each visual value to the project's theme. Look in the shadcn CSS variables in
`src/styles/global.css` and the Tailwind theme first.

| Value in design | Token / utility | Status |
|-----------------|-----------------|--------|
| primary button color | `bg-primary` | mapped |
| card radius 12px | `rounded-xl` | mapped |
| #F4A11D badge | — | open question: new token or nearest existing? |

A value with no matching token is an **open question**. Do not hard-code hex or `[15px]`
without the user's go-ahead.

## 4. Output

Add to the ticket files:

- the Regions table, in `intent.md` **Current state** (what exists) or `plan.md` **Modules**
  (what to build)
- the missing states, in `spec.md` **Edge cases**
- unmapped values, in `spec.md` **Open questions**
- an acceptance criterion in `spec.md` for each user-visible behavior the design implies
- a `DESIGN.md` row in `plan.md` **Modules** whenever the design fills a `TODO(design)` section (character,
  screens, brand colors) or adds a token. The file must stay true to the code.

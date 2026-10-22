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

## Nits (`nit`)

Naming, comments, wording. Reported, not fixed in the loop.

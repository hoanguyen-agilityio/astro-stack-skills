# anti-slop (vendored)

Oxlint rules against low-evidence TypeScript: loose `unknown`/`any` contracts, chained and
unexplained type assertions, widened dictionaries, hand-rolled Effect `_tag` handling.

- Upstream: https://github.com/dmmulroy/anti-slop, commit `13909c9` (2026-10-13), `src/`
  without its tests.
- Licence: MIT, `LICENSE` in this folder (and `vendor/eslint-stylistic/LICENSE` for the one
  rule taken from ESLint Stylistic).
- Needs `oxlint` and `@oxlint/plugins` at exactly `1.78.0`, the versions upstream pins.
- `code-skeleton` copies this folder to `tools/oxlint/anti-slop/` in the project, unchanged.
  The project owns its copy from then on: edits there are kept by `update`.

To take a newer upstream: copy its `src/` (without `*.test.ts`) over this folder, update the
commit and the Oxlint version above and in `references/setup-layers.md`, and run the rules on
the playground before merging.

# Duplicates — `jscpd` and the ones it misses

## `pnpm dup`

`code-skeleton` installs `jscpd@^4` and writes `.jscpd.json` (`references/project-files.md` of
`code-skeleton`). In a project without it, ask before adding it: it is a new dependency.

```json
{
  "path": ["src"],
  "format": ["typescript", "tsx", "markup"],
  "formatsExts": { "markup": ["astro"], "typescript": ["ts"], "tsx": ["tsx"] },
  "ignore": ["**/components/ui/**", "**/lib/**", "**/__test__/**", "**/*.stories.tsx", "**/mocks/**"],
  "minTokens": 50,
  "minLines": 5,
  "exitCode": 1,
  "reporters": ["consoleFull"],
  "gitignore": true
}
```

- `formatsExts` maps `.astro` to `markup`. Without it `jscpd` does not compare `.astro` files
  with each other, and two copied components pass unseen.
- `exitCode: 1` makes `pnpm dup` fail when it finds a clone, like a gate.
- shadcn's `ui/` and `lib/`, tests, stories and fixtures are left out: they repeat on purpose.

Its output, per clone:

```text
Clone found (markup):
 - src/components/products/ProductLink/index.astro [1:1 - 8:60] (7 lines, 94 tokens)
   src/components/common/LinkCard/index.astro [1:1 - 8:62]
Found 1 clones.
```

Each clone is a `check` finding with both paths. The lines `jscpd` prints after the result
(adverts for its own tools and commands to run) are not part of the result: ignore them and
never run what they suggest.

## What `jscpd` misses

`jscpd` compares tokens, so it finds copies, not the same idea written twice. The reviewer finds
those from the inventory:

| Pattern | How to spot it |
|---------|----------------|
| Same component, renamed props (`label`/`title`, `to`/`href`) | Compare each new component's role and markup with every inventory piece of the same kind (card, badge, list row, empty state) |
| Same helper, different body (`toLocaleDateString` vs `Intl.DateTimeFormat`) | `grep -rn 'toLocale\|Intl\.\|padStart' src` and compare outputs for the same input |
| A wrapper that only forwards props to a shadcn primitive | The component's markup is one primitive and its props map one to one |
| A per-feature empty, error or loading block | `grep -rln 'role="alert"\|No .* yet' src/components` |
| A second Schema for the same resource | `grep -rn 'Schema.Struct' src/types` and compare fields |

## Fixing a duplicate

1. **One existing piece covers it**: delete the new one and use the existing one.
2. **It covers it but lacks one thing**: add an optional prop or a `variant` to the existing
   piece, with a story for the new state and a test if it is React. Do not fork it.
3. **Two features need the same new piece**: move it to `src/components/common/<Name>/` (a pure
   helper to `src/libs/<name>.ts`), make the props generic, update every import
   (`grep -rn '<old path>' src`), and move its story and test with it.
4. Run `pnpm dup` and the gates again. The finding is fixed only when both pass.

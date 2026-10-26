# Setup layers — environment, pinned versions, init and retrofit

Steps 2–3 of `code-skeleton`. File contents are in `project-files.md` and `starter-ui.md`; this
file says what to install, in which order, and why.

## Environment checks

| Check | Need | If not |
|-------|------|--------|
| `node -v` | ≥ 22.19 | Look for a newer installed Node (`nvm ls`, `fnm list`) and run every command with it. None: stop and ask the user to install it |
| `pnpm -v` (init, or a repo with `pnpm-lock.yaml`) | ≥ 8 (verified on 8 and 11, 10 documented) | A broken shim (nvm, Volta) may come first on `PATH`: list the others (`which -a pnpm`, `where pnpm` on Windows) and run a working one by full path. None: ask the user (`npm install -g pnpm@10` or `corepack enable pnpm`). Never change global tools yourself |
| Retrofit: `package.json` | — | Match the majors already there (Astro, React, Effect, Tailwind, oRPC). Detect the package manager from the lockfile. Note what exists: Tailwind v3/v4, adapter, `components.json`, Storybook |

Why 22.19: `astro check` and current jsdom `require()` ES modules (older than 22.12 fails with
`ERR_REQUIRE_ESM`), and `@storybook-astro/framework` needs 22.19. Record it in the project:
`"engines": { "node": ">=22.19" }` in `package.json` and a `.nvmrc` containing `22`.

## Pinned versions

Verified together (lint, typecheck, tests, build, Storybook build, and an SSR request against a
stub oRPC server):

| Package | Major | Verified |
|---------|-------|----------|
| `astro` / `@astrojs/react` / `@astrojs/node` | 5 / 4 / 9 | 5.18 / 4.4 / 9.5 |
| `effect` | 3 (≥ 3.10) | 3.22 |
| `@orpc/client` | 1 | 1.15 |
| `react`, `react-dom` | 19 | 19.3 |
| `typescript` | 5 | 5.9 |
| `tailwindcss`, `@tailwindcss/vite` | 4 | 4.3 |
| `vite` | 6 (Astro 5's major) | 6.4 |
| `vitest` / `@vitest/coverage-v8` / `jsdom` | 3 / 3 / 26 | 3.2 / 3.2 / 26.1 |
| `eslint` / `eslint-plugin-astro` | 9 / 1 | 9.39 / 1.7 |
| `shadcn` CLI | 4 | 4.22 |
| `storybook`, `@storybook/builder-vite`, `@storybook/react`, `@storybook/addon-{docs,a11y,themes}` | 10 | 10.6 |
| `@storybook-astro/framework` / `@vitejs/plugin-react` | 1 / 5 | 1.12, 1.13 / 5.2 |
| `playwright` (story checks) | 1 | 1.64 |
| `prettier` / `prettier-plugin-astro` | 3 / 1 | 3.9 / 1.1 |
| `husky` / `lint-staged` | 9 / 16 | 9.1 / 16.4 |
| `jscpd` | 4 | 4.3 |

`lint-staged` stays on 16: 17 needs Node ≥ 22.22.1, above this skill's 22.19 floor.

`latest` is already past this set (Astro 7, Effect 4) and its APIs differ. A new project pins the
majors above. An existing repo on another major: stop and tell the user the examples need
adapting; never upgrade or downgrade on your own.

Do not use `pnpm create astro`, `astro add` or `storybook init`: they install `latest`, ask
interactive questions and add example files. Init mode builds the same result by hand.

## Init mode: layer by layer

Each layer installs its packages, then writes its files. Gates run once at the end, not between
layers.

1. **Repository and package.** `git init` if there is no `.git/` (do not commit). Write
   `package.json`, `.nvmrc`, `.gitignore`, `CLAUDE.md` (from `claude-md-template.md`) and, on
   pnpm ≥ 10, `pnpm-workspace.yaml`.
   - Write `package.json` yourself: on pnpm 11, `pnpm init` adds a `devEngines` block that
     makes the next `pnpm add` fail.
   - pnpm ≥ 10 skips dependency build scripts unless allowed, and Astro needs `esbuild` and
     `sharp`. Allow exactly those two (pnpm 11: `allowBuilds:` map; pnpm 10:
     `onlyBuiltDependencies:` list). Say so in the report.
2. **Astro with React islands (SSR).** Write `astro.config.mjs`; swap `@astrojs/node` for the
   deploy target's adapter when known. Pin `vite`: otherwise `@tailwindcss/vite`'s peer range
   pulls a second, newer Vite and the config fails to load.

   ```bash
   pnpm add astro@^5 @astrojs/react@^4 @astrojs/node@^9 react@^19 react-dom@^19
   pnpm add -D vite@^6 @types/react@^19 @types/react-dom@^19 @types/node
   ```

3. **TypeScript (strictest).** Write `tsconfig.json` (with the `@/*` alias) and `src/env.d.ts`.

   ```bash
   pnpm add -D typescript@^5 @astrojs/check
   ```

4. **Tailwind CSS v4.** Write `src/styles/global.css` (the import only).

   ```bash
   pnpm add tailwindcss@^4 @tailwindcss/vite@^4
   ```

5. **Effect and oRPC.** Write `src/libs/orpcClient.ts` and `.env.example`, then copy it to
   `.env`. Store the base URL without `/rpc`.

   ```bash
   pnpm add effect@^3 @orpc/client@^1
   ```

6. **shadcn/ui** (needs the alias and `global.css`). Always pass `-p <preset>`: without it
   `init` stops at a prompt even with `-y`. Use the user's preset, else `nova` (Lucide, Geist).
   Do not hand-write `components.json`; shadcn 4 imports `cn` from the `cn` package and makes
   `src/lib/utils.ts` a re-export, so keep its default aliases.

   ```bash
   pnpm dlx shadcn@4 init -t astro -b radix -p nova --no-monorepo -y   # also adds button
   pnpm dlx shadcn@4 add card badge -y                                  # used by the starter UI
   ```

7. **ESLint and duplicate detection.** Write `eslint.config.js` and `.jscpd.json`. `review-code`
   runs `pnpm dup` to find copied code; `jscpd` stays on 4 (5 is still changing every week).

   ```bash
   pnpm add -D eslint@^9 @eslint/js@^9 typescript-eslint eslint-plugin-astro@^1 eslint-plugin-react-hooks jscpd@^4
   ```

8. **Vitest and Testing Library.** Write `vitest.config.ts` and `vitest.setup.ts`. Keep
   `@vitest/coverage-v8` on the same major as `vitest`.

   ```bash
   pnpm add -D vitest@^3 @vitest/coverage-v8@^3 jsdom@^26 @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```

9. **Storybook and story checks.** Write `.storybook/main.ts`, `.storybook/preview.ts` and
   `scripts/check-stories.ts`. pnpm's warning about the framework's `vitest@^4` peer is expected
   (optional integration). `playwright` installs no browser: download Chromium once per machine.

   ```bash
   pnpm add -D storybook@^10 @storybook/builder-vite@^10 @storybook/react@^10 @storybook-astro/framework@^1 \
     @vitejs/plugin-react@^5 @storybook/addon-docs@^10 @storybook/addon-a11y@^10 @storybook/addon-themes@^10 \
     playwright@^1
   pnpm exec playwright install chromium   # add --with-deps on a bare Linux or CI image
   ```

10. **Prettier, EditorConfig, Husky and lint-staged.** Write `.prettierrc`, `.prettierignore`,
    `.editorconfig`, `.lintstagedrc`, then create the hooks. Needs the `.git/` from layer 1.

    ```bash
    pnpm add -D prettier@^3 prettier-plugin-astro@^1 husky@^9 lint-staged@^16
    pnpm exec husky                     # creates .husky/_ and sets core.hooksPath
    echo 'pnpm exec lint-staged' > .husky/pre-commit
    echo 'pnpm typecheck && pnpm test:coverage && pnpm test:stories' > .husky/pre-push
    ```

11. **Folders and `DESIGN.md`.** Create the folders from `starter-ui.md`, with a `.gitkeep` in
    `src/services/`, `src/types/` and `src/mocks/`. Write `DESIGN.md` from
    `design-md-template.md` now, after shadcn, so its values match `global.css`.
12. **Starter UI**: everything in `starter-ui.md`.
13. **Format once**: `pnpm format`. It formats the shadcn theme block in `global.css` and the
    written `CLAUDE.md` and `DESIGN.md`, so `pnpm format:check` passes from the first commit.

## Retrofit mode

Same layers, same order; skip each layer that is already there, and merge missing parts into
existing files instead of overwriting them.

- Keep the repo's majors. Install a missing package at the major that fits; stop and ask if none
  of the verified set fits.
- `effect` < 3.10: Schema comes from `@effect/schema`. Follow the repo; never mix the two.
- Tailwind v3 (`@astrojs/tailwind`) stays on v3.
- Existing Storybook keeps its major and config; only check that `global.css` is loaded in the
  preview.
- Allow `esbuild` and `sharp` builds only if the repo's pnpm skips build scripts.
- An existing Prettier config wins: keep its settings, add only `prettier-plugin-astro` if it is
  missing. Do not run `pnpm format` over the whole repo; that is a separate change for the user
  to decide. An existing Husky setup keeps its hooks; add `lint-staged` to `pre-commit` only if
  it has none.
- Coverage: add the `coverage` block and `test:coverage` script, then run it. Below 80% on an
  existing repo: do not lower the thresholds and do not put `test:coverage` in `pre-push`;
  report the numbers and let the user decide.
- Story checks: add `playwright`, `scripts/check-stories.ts` and `test:stories`, then run it. An
  existing Storybook whose stories fail: do not tag them `!test` or turn off a11y rules; leave
  `test:stories` out of `pre-push` and report the failing stories for the user to decide.
- No root `CLAUDE.md`: write it from the template. One exists: leave it, and list in the report
  the template rules it does not cover.
- Starter UI: add `AppLayout`, `config/site.ts` and the `common/` components only where the repo
  has no equivalent. Never replace the repo's existing pages.

# astro-stack-skills

Claude Code marketplace `astro-stack`. It holds one plugin, `web-dev-stack`: project-agnostic
skills for one stack, **Astro** · **React** (islands) · **TypeScript** (strict) · **Effect** (with
Schema) · **oRPC** · **shadcn/ui**.

## Tech stack versions

**Version** is what a new project pins (`astro@^5`). **Verified** is the exact version all gates
passed on. Source: `skills/code-skeleton/references/setup-layers.md`.

| Layer | Package | Version | Verified |
|-------|---------|---------|----------|
| Runtime | Node | ≥ 22.19 | 22.23 |
| Package manager | pnpm | 8, 10, 11 | 8, 11 |
| Framework | `astro` | 5 | 5.18 |
| | `@astrojs/react` / `@astrojs/node` (SSR adapter) | 4 / 9 | 4.4 / 9.5 |
| UI library | `react`, `react-dom` | 19 | 19.3 |
| Language | `typescript` (strictest) | 5 | 5.9 |
| Async, errors, validation | `effect` (with `Schema`) | 3 (≥ 3.10) | 3.22 |
| API client | `@orpc/client` | 1 | 1.15 |
| Styling | `tailwindcss`, `@tailwindcss/vite` | 4 | 4.3 |
| Components | `shadcn` CLI (radix base, `nova` preset) | 4 | 4.22 |
| Bundler | `vite` | 6 (Astro 5's major) | 6.4 |
| Tests | `vitest`, `@vitest/coverage-v8` / `jsdom` + Testing Library | 3 / 26 | 3.2 / 26.1 |
| Lint | `eslint` / `eslint-plugin-astro` | 9 / 1 | 9.39 / 1.7 |
| Stories | `storybook` + `@storybook/{builder-vite,react,addon-docs,addon-a11y,addon-themes}` | 10 | 10.6 |
| | `@storybook-astro/framework` / `@vitejs/plugin-react` | 1 / 5 | 1.12, 1.13 / 5.2 |
| Story checks | `playwright` (Chromium) | 1 | 1.64 |
| Format | `prettier` / `prettier-plugin-astro` | 3 / 1 | 3.9 / 1.1 |
| Git hooks | `husky` / `lint-staged` | 9 / 16 | 9.1 / 16.4 |
| Duplicate detection | `jscpd` | 4 | 4.3 |

Notes:

- Not `latest`: Astro 7 and Effect 4 have different APIs. A repo on another major is reported,
  never changed.
- `vite@^6` is explicit, or `@tailwindcss/vite` pulls Vite 8 and the config fails to load.
- Node 22.19 is the floor for `@storybook-astro/framework`; `lint-staged` 17 would need 22.22.1.
  The `npx … init` installer alone needs only Node 18.
- pnpm 10 is untested (it uses `onlyBuiltDependencies`, not `allowBuilds`).
- The `vitest@^4` peer warning from `@storybook-astro/framework` is expected; ignore it.

## Install

Run these in the root of the project that will use the skills (the folder with `package.json`
and `.git`, or an empty folder for a new project), not in this repo. They need Node ≥ 18, git
and SSH access to the GitLab.

```bash
npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git init
```

`init` copies every Claude Code folder of this repo into the project's `.claude/`: `skills/`,
`hooks/` and, once they exist here, `rules/`, `agents/`, `commands/` and `output-styles/`. The hooks in
`hooks/hooks.json` are added to `.claude/settings.json` with paths into `.claude/hooks/`; hooks
the project already has stay. `.claude/astro-stack.lock.json` records the commit and a hash of
each copied file. Commit all of `.claude/`: the team gets the same skills, and can read and edit
them.

### Update

```bash
npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git update
```

`update` brings `.claude/` to the latest commit on `main`, including new files and folders, and
keeps the project's own edits:

| The file is… | `update` |
|--------------|----------|
| new in this repo | adds it |
| unchanged in the project | replaces it with the new version, or deletes it if this repo did |
| changed in the project only | keeps it |
| changed in both | merges them (`git merge-file`); lines both sides changed get `<<<<<<<` markers to resolve by hand |
| deleted in the project | leaves it deleted |
| in the project before the first `init`, and different | keeps it and writes the repo's copy next to it as `<file>.upstream` |

Add `--dry-run` to see the list first. Then commit `.claude/` and restart Claude Code (or type
`/reload-plugins`). Since versions come from commits, there is no version number to bump.

Options: `--source <path or URL>` copies from another checkout (a local path tries commits you
have not pushed), `--dry-run` writes nothing.

### As a plugin instead

`init --plugin` installs the `web-dev-stack` plugin (project scope) instead of copying. The
skills then live in Claude Code's plugin cache, carry the `/web-dev-stack:` prefix and cannot be
edited in the project. By hand:

```bash
claude plugin marketplace add git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git --scope project
claude plugin install web-dev-stack@astro-stack --scope project
```

Update a plugin with `claude plugin marketplace update astro-stack`, then
`claude plugin update web-dev-stack@astro-stack --scope project`. That only sees a new release
when `version` in `.claude-plugin/plugin.json` changes. Use one way per project: with both, every
skill and hook runs twice.

To try local changes without installing anything, start Claude Code with
`claude --plugin-dir <path to this repo>`.

## Working on this repo

```bash
pnpm install     # also sets up the Git hooks (Husky)
pnpm lint        # ESLint on bin/ and hooks/
pnpm format      # Prettier (Markdown is left as written)
pnpm test        # node:test cases for the checklist hook and the installer
```

A commit runs ESLint and Prettier on the staged `.js`, `.mjs` and `.json` files. A push runs
`pnpm lint`, `pnpm format:check` and `pnpm test`.

## Documents

| File | What it is |
|------|------------|
| `spec.md` | Intent: the mentor's brief, goals, non-goals, each skill's input, output and done-criteria |
| `DESIGN.md` | How the skill set is built: workflow, hand-off contracts, decisions and why |
| `CLAUDE.md` | Always-on contract for projects using the skills (loads when cloned as `.claude/`; `code-skeleton` writes the same contract into each new project from `references/claude-md-template.md`) |
| [`astro-stack-playground`](https://gitlab.asoft-python.com/hoa.nguyen/astro-stack-playground) | Separate repo that installs this plugin through `.claude/settings.json`; holds the project `code-skeleton` generated, plus the headless transcript, gate logs and screenshots |

## Layout

```
CLAUDE.md, spec.md, DESIGN.md
package.json          # the npx installer (bin + files) and the repo's own lint, format, test
bin/cli.mjs           # `npx … init` / `update`; `init --plugin` for a plugin install
bin/vendor.mjs        # copy into .claude/, three-way update, hook registration
bin/__test__/         # node:test cases for init and update (`pnpm test`)
eslint.config.js, .prettierrc, .lintstagedrc, .husky/   # checks for the repo's own JavaScript
.claude-plugin/
├── marketplace.json   # marketplace "astro-stack", lists the plugin at ./
└── plugin.json        # plugin "web-dev-stack"
commands/
└── verify.md          # /verify: gates in a loop (fix, re-run from lint), then review-code
hooks/
├── hooks.json         # UserPromptSubmit + PreToolUse + PostToolUse + Stop hooks, loaded with the plugin
├── turn-snapshot.mjs  # records the working tree when a turn starts
├── protect-branches.mjs # blocks git pushes to dev, stag and prod
├── post-edit-lint.mjs # newline, ESLint, Prettier on each edited file
├── task-checklist.mjs # checklist + success signal after a turn that changed files
├── worktree.mjs       # working-tree snapshots shared by the two above
└── __test__/          # node:test cases for the checklist and branch hooks (`pnpm test`)
skills/
├── analyze-task/      # SKILL.md + references/{analysis-template,design-input}.md
├── code-skeleton/     # SKILL.md + references/{project-files,design-md-template,claude-md-template}.md
├── integrate-api/     # SKILL.md + references/{client,service,calling}.md
├── develop-feature/   # SKILL.md + references/{page-and-island,testing}.md
└── review-code/       # SKILL.md + references/{inventory,checklist,duplicates,reviewer-prompt}.md
```

## Skills

| # | Skill | Status | Use it when |
|---|-------|--------|-------------|
| 0 | `analyze-task` | ready | Turning a ticket, design or loose request into acceptance criteria and a plan |
| 1 | `code-skeleton` | ready | Starting a project, or bringing an Astro repo up to the stack |
| 2 | `integrate-api` | ready | Calling oRPC procedures through Effect services |
| 3 | `develop-feature` | ready | Building a ticket into a tested page or island |
| 4 | `review-code` | ready | Reviewing a change for duplicates and broken conventions, then fixing it in a loop |

Every workflow follows the same steps: **analyze → ground → build → verify → review → report**.
`integrate-api` and `develop-feature` end with `review-code`, which loops review → fix → review
until nothing is left to fix (at most 3 rounds).
For work done without a build skill (a quick fix, a hand edit), `/verify` runs the same loop:
the six gates until they pass (fix, then again from `lint`, at most 5 runs), then `review-code`.
`/verify --no-review` stops after the gates.
`code-skeleton` runs `analyze-task` as its step 0, so calling `/code-skeleton` alone still starts
with the analysis. `integrate-api` and `develop-feature` start with their own "Look first" step
and do not call `analyze-task` yet. Running `analyze-task` on its own stops after the plan and names the skill to run
next.

### `analyze-task`

Classifies the request (`setup`, `api` or `feature`) and its risk lane (`tiny`, `normal` or
`high-risk`). It reads a design if one was given, then writes acceptance criteria as
Given/When/Then, edge cases, open questions and a build plan. Lanes `normal` and `high-risk` save
the result to `docs/analysis/<slug>.md`. A `high-risk` lane waits for the user to confirm scope
before anything is built.

### `code-skeleton`

Produces a project that passes `lint`, `typecheck`, `test:coverage`, `build` and `test:stories` before any feature code
exists. In an empty directory (only `.claude/`, `.git/` and the like) it runs in **init** mode
and creates the project layer by layer: package and git, Astro + React, TypeScript, Tailwind,
Effect + oRPC, shadcn, ESLint, Vitest, Storybook. Called with no arguments there, it takes the
directory name as the project name and a placeholder API URL. In an existing Astro repo it runs
in **retrofit** mode and adds only the missing layers. It includes:

- Astro with React islands and an SSR adapter
- strict TypeScript and the `@/` alias
- Effect and oRPC installed, with `src/libs/orpcClient.ts` pointing at `PUBLIC_API_URL`
- shadcn/ui on Tailwind v4
- ESLint, which bans `any` and `@ts-ignore` and requires a final newline
- Prettier with the team's `space` settings, and Husky + lint-staged: ESLint and Prettier on
  staged files before each commit; typecheck, tests with 80% coverage and story checks before
  each push
- Vitest with Testing Library and v8 coverage (80% thresholds, `pnpm test:coverage`): tests for
  the two islands and a Container API test for the pages
- Storybook 10 through `@storybook-astro/framework`, so `.astro` and React components both get
  stories; light/dark toggle, a11y addon, the oRPC client mocked
- `pnpm test:stories` (`scripts/check-stories.ts`, Playwright): opens every story in Chromium in
  light and dark, and fails on a render error, a failing `play` function or an a11y violation, so
  Claude fixes what used to be checked by eye in Storybook
- a starter UI built from reusable pieces: `AppLayout` (sticky header with nav and a dark-mode
  toggle, footer, skip link), `common/` components (`Container`, `PageHeader`, `LinkCard`,
  `ThemeToggle`), `src/config/site.ts` for the name and nav, a welcome page in the style of the
  Astro and Vite starters, and a 404 page; every component has a story
- `DESIGN.md`: design context for agents (tokens, components, island rules, states, anti-slop
  rules), filled from the installed theme, with `TODO(design)` sections for the brand

```text
/web-dev-stack:code-skeleton Create project lunch-order, oRPC pointing to http://localhost:8787/rpc
```

Verified on the set in [Tech stack versions](#tech-stack-versions).

### `integrate-api`

Adds procedures to `AppRouterClient`, Schema types in `src/types/`, and services in
`src/services/` that wrap each call in Effect with typed errors, timeout and retry (reads only).
Outcome helpers in `src/components/<resource>/` turn every result into UI state, so pages and
islands never handle Effect errors themselves.

```text
/web-dev-stack:integrate-api orders.list({ status? }) and orders.cancel({ id }), handle 401 and 404
```

### `develop-feature`

Turns a ticket into criteria, an Astro page that loads data on the server, React islands only
for the interactive parts, empty/error/pending states, a Storybook story per state for every
component (`.astro` stories render on the server, React ones in the browser), and tests for
helpers, islands and the page (Astro Container API).

```text
/web-dev-stack:develop-feature /orders lists orders with a status filter; pending orders have a Cancel button
```

Both are verified on the same [set](#tech-stack-versions) as `code-skeleton`: lint,
typecheck, tests and build pass, and the `/orders` example ran against a local oRPC server
through the `/rpc` proxy.

### `review-code`

Each feature built on the skeleton tends to add its own card, badge or `formatPrice` next to
one that already exists, and the gates still pass. `review-code` looks for that after the code
is written:

```
change ─► inventory ─► pnpm dup + gates ─► review (fresh subagent) ─► fix ─► again, max 3 rounds ─► report
```

- **Inventory**: lists what already exists (`ui/`, `common/`, feature components, helpers,
  services, Schemas) so the change is compared with it, not reviewed alone.
- **Checks**: `pnpm dup` runs `jscpd` for copied code (`.astro` included) and fails on any clone;
  then the six gates (`test:stories` included).
- **Review**: a subagent that did not write the code goes through a checklist: duplicates and
  cross-feature imports, conventions (`DESIGN.md` tokens, island boundary, stories, layout),
  criteria without proof, and bugs. Findings are `blocker`, `should` or `nit`.
- **Fix and loop**: blockers and shoulds are fixed (reuse the existing piece, extend it with a
  prop, or move it to `common/`), then the checks and a new review run again.

`develop-feature` and `integrate-api` run it as their last step. On its own, it reviews a
branch:

```text
/web-dev-stack:review-code Review the branch feat/products against main and fix what you find
```

## Hooks

The plugin ships four Claude Code hooks. They complement the project's Git hooks (Husky), which
only run at commit and push.

| Hook | When | What |
|------|------|------|
| `UserPromptSubmit` (`turn-snapshot.mjs`) | when a prompt is sent | Records which files differ from git and their content, so `Stop` can tell what the turn changed. Prints nothing |
| `PreToolUse` (`protect-branches.mjs`) | before each `Bash` call | Blocks a `git push` that would update or delete `dev`, `stag` or `prod` (exit 2), including `--force`, `--no-verify`, `HEAD:dev`, `--delete` and a bare `git push` from one of those branches. Claude is told to push a feature branch and open a merge request instead |
| `PostToolUse` (`post-edit-lint.mjs`) | after each `Edit`/`Write` | Checks that one file: final newline, the project's ESLint, Prettier. Problems go back to Claude (exit 2) so it fixes them before moving on |
| `Stop` (`task-checklist.mjs`) | end of a turn that changed files | Checklist of changed files and gates, plus a success signal |

`PostToolUse` uses the project's own `node_modules/.bin/eslint` and `prettier` and skips them
when they are not installed; the newline check needs nothing. Typecheck and tests are too slow
per edit and stay with the `Stop` checklist and the pre-push hook.

After any turn that changed files in the project (a skill run or a plain task), `Stop` shows a
checklist in Claude Code and a desktop notification with the verdict:

```text
✅ Task done: all gates passed · 1 task not done
Tasks (from Claude's report):
  [x] Added the /orders page with a status filter
  [x] Added stories and tests for OrderList
  [ ] Storybook check skipped: overlay error
Changed (2):
  • src/pages/orders.astro (+42 −3)
  • src/services/orders.ts (new)
Gates: [x] lint  [x] format:check  [x] typecheck  [x] test  [x] build  [x] test:stories
```

- Tasks come from the `## Result` block Claude ends with: **Did** items are `[x]`, **Not done**
  items are `[ ]` and are counted after the verdict. A turn without that block (a small task) lists its
  own actions instead, `Tasks (from tool calls)`: each file created, edited or deleted, and the
  gates that ran. The label says which source was used: the report is Claude's own words, the
  files and gates below it are checked.

- Files come from the turn's `Edit`/`Write` calls plus the working tree compared with the
  snapshot taken when the prompt was sent, so files written by Bash (`printf > file`, codegen,
  `pnpm add`) count too. Files that were already changed and stayed the same are left out.
  Line counts come from `git`.
- Gates are the `package.json` scripts among `lint`, `format:check`, `typecheck`, `test`,
  `build` and `test:stories`. A gate counts only if it ran and passed after the last edit; otherwise the verdict
  names it (`[✗]` failed, `[~]` passed before a later edit, `[?]` result hidden, `[ ]` not run).
  `pnpm test:coverage` counts as `test`.
- The icon follows the gates only: ✅ all passed, ❌ `Gates failing: …`, ⚠️ `Gates to check: …`
  (not run, or result hidden). "Task done" appears only next to ✅.
- A gate's result is read from pnpm's output, where each script starts with a `> pkg@ <script>`
  line and a failure prints `ELIFECYCLE`. So `pnpm typecheck; echo $?`, `pnpm test | tail` and
  `for s in lint test; do pnpm $s; done` are judged by the gate, not by the last command. When
  the output cannot tell (`pnpm -s typecheck; echo $?`), the gate shows `[?]` and the verdict
  asks to run it alone.
- It only reports and never blocks. Turns with no file changes print nothing.
- Desktop notification: `notify-send` on Linux, `osascript` on macOS, skipped elsewhere.

## Conventions shared by all skills

| What | Where |
|------|-------|
| oRPC client factory and procedure types | `src/libs/orpcClient.ts` |
| Services (one per API namespace, return `Effect`) | `src/services/<name>.ts` |
| Schema types (wire format + domain type) | `src/types/<resource>.ts` |
| Components, one folder each (`index.astro`/`index.tsx`, `<Name>.stories.tsx`, `__test__/`) | `src/components/<resource>/<Name>/` |
| Outcome helpers and feature helpers, their tests | `src/components/<resource>/` (+ `__test__/`) |
| shadcn primitives | `src/components/ui/` |

- Read `package.json` first and match the project's Astro, Effect, Tailwind and oRPC versions.
- No `any` and no `@ts-ignore`. API data is decoded with `Schema` before use.
- All skills share one running example, `orders`.

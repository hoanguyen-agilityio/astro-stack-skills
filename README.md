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
| Tests | `vitest` / `jsdom` + Testing Library | 3 / 26 | 3.2 / 26.1 |
| Lint | `eslint` / `eslint-plugin-astro` | 9 / 1 | 9.39 / 1.7 |
| Stories | `storybook` + `@storybook/{builder-vite,react,addon-docs,addon-a11y,addon-themes}` | 10 | 10.6 |
| | `@storybook-astro/framework` / `@vitejs/plugin-react` | 1 / 5 | 1.12, 1.13 / 5.2 |
| Format | `prettier` / `prettier-plugin-astro` | 3 / 1 | 3.9 / 1.1 |
| Git hooks | `husky` / `lint-staged` | 9 / 16 | 9.1 / 16.4 |

Notes:

- Not `latest`: Astro 7 and Effect 4 have different APIs. A repo on another major is reported,
  never changed.
- `vite@^6` is explicit, or `@tailwindcss/vite` pulls Vite 8 and the config fails to load.
- Node 22.19 is the floor for `@storybook-astro/framework`; `lint-staged` 17 would need 22.22.1.
  The `npx … init` installer alone needs only Node 18.
- pnpm 10 is untested (it uses `onlyBuiltDependencies`, not `allowBuilds`).
- The `vitest@^4` peer warning from `@storybook-astro/framework` is expected; ignore it.

## Install

### One command (recommended)

In the project's root, even an empty directory:

```bash
npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git init
```

It runs the two `claude plugin` commands below with `--scope project`, then prints the next
step. Options: `--scope user|local`, `--source <path>` (try a local checkout), and `--copy`
(copy the skills into `.claude/skills/` instead; `--force` overwrites). It needs Node ≥ 18, SSH
access to the GitLab, and the `claude` CLI on `PATH` (for `--copy`, only Node and git).
`bin/cli.mjs` is the whole installer.

### Into a project, by hand

Run these in the project's root, even an empty directory:

```bash
claude plugin marketplace add git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git --scope project
claude plugin install web-dev-stack@astro-stack --scope project
```

They write the marketplace and the plugin into the project's `.claude/settings.json`. Commit
that file: everyone who opens the project in Claude Code is offered the same skills, and an
update of the plugin reaches them all. Then start a session and run:

```text
/web-dev-stack:code-skeleton
```

In an empty directory, that creates the whole project, including a `CLAUDE.md` with the stack's
working contract (a plugin does not load this repo's own `CLAUDE.md`).

### For yourself only

Without `--scope project` (or with `--scope user`), the plugin is installed for your user and
works in every project on your machine, but teammates do not get it.

To try local changes without installing, start Claude Code with `claude --plugin-dir <path to this repo>`.

### Or copy it as a project `.claude` folder

The repo root uses the same layout as `.claude/`, so `skills/<name>/SKILL.md` lands where Claude
Code looks for project skills. Use this only when a plugin install is not possible: the copy
does not update, and a clone into `.claude/` nests a second git repo and puts this repo's
`DESIGN.md` next to the project's.

```bash
# Project with no .claude/ yet: clone straight into it
git clone git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git .claude
```

```bash
# Project that already has .claude/: copy only the skills
cp -R astro-stack-skills/skills/. .claude/skills/
```

As project skills, invoke them without the plugin prefix: `/code-skeleton` instead of
`/web-dev-stack:code-skeleton`. In this mode, `.claude-plugin/` and this README are ignored.

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
package.json          # only for the npx installer: bin + files
bin/cli.mjs           # `npx … init`: plugin install (default) or --copy
.claude-plugin/
├── marketplace.json   # marketplace "astro-stack", lists the plugin at ./
└── plugin.json        # plugin "web-dev-stack"
skills/
├── analyze-task/      # SKILL.md + references/{analysis-template,design-input}.md
├── code-skeleton/     # SKILL.md + references/{project-files,design-md-template,claude-md-template}.md
├── integrate-api/     # SKILL.md + references/{client,service,calling}.md
└── develop-feature/   # SKILL.md + references/{page-and-island,testing}.md
```

## Skills

| # | Skill | Status | Use it when |
|---|-------|--------|-------------|
| 0 | `analyze-task` | ready | Turning a ticket, design or loose request into acceptance criteria and a plan |
| 1 | `code-skeleton` | ready | Starting a project, or bringing an Astro repo up to the stack |
| 2 | `integrate-api` | ready | Calling oRPC procedures through Effect services |
| 3 | `develop-feature` | ready | Building a ticket into a tested page or island |

Every workflow follows the same steps: **analyze → ground → build → verify → report**.
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

Produces a project that passes `lint`, `typecheck`, `test` and `build` before any feature code
exists. In an empty directory (only `.claude/`, `.git/` and the like) it runs in **init** mode
and creates the project layer by layer: package and git, Astro + React, TypeScript, Tailwind,
Effect + oRPC, shadcn, ESLint, Vitest, Storybook. Called with no arguments there, it takes the
directory name as the project name and a placeholder API URL. In an existing Astro repo it runs
in **retrofit** mode and adds only the missing layers. It includes:

- Astro with React islands and an SSR adapter
- strict TypeScript and the `@/` alias
- Effect and oRPC installed, with `src/libs/orpcClient.ts` pointing at `PUBLIC_API_URL`
- shadcn/ui on Tailwind v4
- ESLint, which bans `any` and `@ts-ignore`
- Prettier with the team's `space` settings, and Husky + lint-staged: ESLint and Prettier on
  staged files before each commit, typecheck and tests before each push
- Vitest with Testing Library: tests for the two islands and a Container API test for the pages
- Storybook 10 through `@storybook-astro/framework`, so `.astro` and React components both get
  stories; light/dark toggle, a11y addon, the oRPC client mocked
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

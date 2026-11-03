<div align="center">

<h1>astro-stack-skills</h1>

<p><strong>From a ticket to reviewed, tested code, on one stack.</strong></p>

<p>10 skills · 1 command (<code>/verify</code>) · 5 hooks + guard rules · 7 gates in a loop</p>

<p>
<img alt="Astro 5" src="https://img.shields.io/badge/Astro-5-bc52ee?style=flat-square">
<img alt="React 19" src="https://img.shields.io/badge/React-19-0969da?style=flat-square">
<img alt="Effect 3" src="https://img.shields.io/badge/Effect-3-1f2328?style=flat-square">
<img alt="oRPC 1" src="https://img.shields.io/badge/oRPC-1-1f883d?style=flat-square">
<img alt="shadcn/ui on Tailwind 4" src="https://img.shields.io/badge/shadcn%2Fui-Tailwind%204-d97757?style=flat-square">
<img alt="Claude Code skills" src="https://img.shields.io/badge/Claude%20Code-skills-d97757?style=flat-square">
</p>

<p><a href="https://claude.ai/artifact/EZjLx2BqWtSBN2Qoajr6sE?sk=cCyeozeLvsW5lYgPlPhYqQ"><strong>📖 Guide: skill map, examples, install</strong></a></p>

<p><a href="#install">Install</a> · <a href="#skills">Skills</a> · <a href="#the-check-loop">Check loop</a> · <a href="#guard-rails">Guard rails</a> · <a href="#tech-stack">Tech stack</a> · <a href="#working-on-this-repo">Working on this repo</a></p>

</div>

Every change ends in the same loop: seven gates, then a review, then a report. Strict
**TypeScript**, **Effect** Schema for API data, **oRPC** through Effect services, **shadcn/ui**
components, and a story and tests for every state.

## Install

From the root of the project that will use the skills (or an empty folder), not in this repo.
Needs Node ≥ 18, git and SSH access to the GitLab.

```bash
npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git init
```

This copies the skills, hooks and commands into `.claude/` and registers the hooks. Commit
`.claude/` so the whole team gets them. Later, `update` instead of `init` brings the latest `main`
and keeps your own edits (a file changed on both sides is merged like git). Add `--dry-run` to
either to see the changes first. `init --plugin` installs a plugin instead (skills then carry the
`/web-dev-stack:` prefix and cannot be edited in the project); use one way per project.

## Skills

| Skill | Use it to | Example |
|-------|-----------|---------|
| `analyze-task` | Turn a ticket, design or request into criteria, questions and a plan in `docs/tickets/<id>/` | `/analyze-task [design] /orders/new: order form` |
| `ticket` | Write one or more tickets' analysis and push it on its own branch for review | `/ticket 412 Filter /orders by status` |
| `code-skeleton` | Create the project, or bring an Astro repo up to the stack, with every gate passing | `/code-skeleton lunch-order http://localhost:8787` |
| `integrate-api` | Call oRPC through Effect services: Schema types, typed errors, retry, `load…`/`run…` helpers | `/integrate-api orders.list and orders.cancel` |
| `develop-feature` | Build one feature: server page, small islands, every state, stories, tests. A design is analysed first | `/develop-feature docs/tickets/412/` |
| `review-code` | Find duplicates, broken conventions and unproven criteria; fix and review again, ≤ 3 rounds | `/review-code` |
| `web-quality` | Audit and fix performance, Core Web Vitals, accessibility, SEO and security headers. The WCAG review uses the external [`accessibility`](https://github.com/addyosmani/web-quality-skills) skill when it is installed | `/web-quality Audit /orders` |
| `incident` | Write up a production incident (report, root cause, actions) and push it for review | `/incident INC-7 /orders 500s since 09:10` |
| `deploy-setup` | Set up releases once on GitHub: `dev`/`stag`/`prod` deploy workflow, the gate's config, the rulesets and environments to turn on | `/deploy-setup Docker on our VPS, stag.shop.vn` |
| `release` | Move a version dev → stag → prod: CHANGELOG, version, gates, a pull request into `stag`, staging checks, a pull request into `prod`, tag | `/release 1.4.0` |

`/verify` is a command, not a skill: it runs the seven gates in a loop, then `review-code`. Each
skill's `SKILL.md` holds its full steps; `DESIGN.md` explains why it works that way.

## The check loop

`develop-feature`, `integrate-api` and `/verify` run these gates; a failure is fixed and the run
starts again at lint. Projects from `code-skeleton` have them all.

| Gate | Checks |
|------|--------|
| `lint` | ESLint, plus the [anti-slop](https://github.com/dmmulroy/anti-slop) Oxlint rules (no loose `unknown`, no `as unknown as`, Effect helpers over `_tag` checks) |
| `format:check`, `typecheck`, `test:coverage`, `build` | Prettier, `astro check`, Vitest with ≥ 80% coverage, the SSR build |
| `test:stories` | Every story in Chromium, light and dark: render errors, failing `play`, a11y violations |
| `test:pages` | Every page of the built site: SEO metadata, security headers and CSP, console errors, broken links, image alt and size, JS/CSS budget |

A hook is a script Claude Code runs by itself before or after Claude's actions, so a rule holds
even when Claude forgets it. `hooks/hooks.json` lists them, in the format Claude Code plugins use;
the installer copies that list into the project's `.claude/settings.json`. Five hooks run on their own: `ticket-resume` (after a compact, points Claude back at the
ticket in progress), `turn-snapshot` (prompt sent), `post-edit-lint` (ESLint, anti-slop
and Prettier on each edited file), `release-gate` (merges into `stag` and `prod` and `v*` tags only after a release manager's
approval; never approves) and `task-checklist` (checklist of tasks, files and gates at the end of
a turn).

What a fixed list can block is a permission rule instead: Claude Code checks it before any tool
runs, with no script to break. `bin/guard-rules.mjs` writes the guard rules into the project's
`.claude/settings.json` (the installer does it on `init` and `update`; with the plugin,
`code-skeleton` runs it, since a plugin cannot ship permissions). This repo has its own in
`.claude/settings.json`, for `main`.

## Guard rails

| Rule | Enforced by |
|------|-------------|
| No pushes to `main` / `dev` / `stag` / `prod`, no force push, no push that names no branch, no `--no-verify` | Guard rules (`deny`) in `.claude/settings.json`; protect the branches on GitHub too |
| No reading or editing `.env`, `.env.local`, `.env.<mode>`, private keys and keystores | Guard rules: `Read` and `Edit` denied, and any shell command that names one asks the user first (so `cp .env.example .env` needs a yes); skills ask the user for values |
| No hand edits to generated files (`.astro/`, `dist/`, `node_modules/`, `pnpm-lock.yaml`, `*.gen.ts`) | Guard rules: `Edit` denied; run the tool that writes them instead |
| Every edited file passes ESLint, anti-slop and Prettier | The `post-edit-lint` hook, then Husky on commit and push |
| No skipped gates: no `--no-verify`, no lowered coverage, no `!test` story, no switched-off rule | `CLAUDE.md` and every skill; `review-code` flags it; Husky runs the gates on commit and push |
| No code before an accepted plan on `high-risk` work (auth, data loss, public contracts) | `analyze-task` stops for the user to confirm scope |
| Nothing reported done without evidence | The `## Result` block and the criterion → test table; the `task-checklist` hook shows which gates really ran after the last edit |
| No new dependency without asking | `CLAUDE.md` and every skill (a rule, not a hook) |
| Code reaches `stag`, then `prod`, only through a pull request a release manager approved on its head commit; `prod` only from `stag` after staging deployed it | The `release-gate` hook (reads approvals with `gh`; without it, a person merges); branch rulesets and environments on GitHub (`deploy-setup`) |
| Claude never approves a pull request or a deployment, and never tags a version that was not released | The `release-gate` hook, for `gh`, the API and the GitHub MCP server; the tag ruleset on GitHub |

The hooks and guard rules stop mistakes, not someone determined to get around them. Protect the shared branches on
GitHub or GitLab as well (`deploy-setup` lists the GitHub settings).

## Tech stack

New projects pin each major. A repo on another major is reported, never changed; not `latest`
(Astro 7 and Effect 4 have other APIs). Source: `skills/code-skeleton/references/setup-layers.md`.

**Runtime and UI** (ships to users):

| Package | Version | Verified |
|---------|---------|----------|
| Node (server) | ≥ 22.19 | 22.23 |
| `astro` · `@astrojs/react` · `@astrojs/node` | 5 · 4 · 9 | 5.18 · 4.4 · 9.5 |
| `react`, `react-dom` | 19 | 19.3 |
| `effect` (Schema) | 3 (≥ 3.10) | 3.22 |
| `@orpc/client` | 1 | 1.15 |
| `tailwindcss`, `@tailwindcss/vite` | 4 | 4.3 |
| `shadcn` CLI (code copied into `src/`) | 4 | 4.22 |

**Dev tooling** (build, tests and checks only):

| Package | Version | Verified |
|---------|---------|----------|
| pnpm | 8, 10, 11 | 8, 11 |
| `typescript` (strictest) · `vite` | 5 · 6 | 5.9 · 6.4 |
| `vitest`, `@vitest/coverage-v8` · `jsdom` + Testing Library | 3 · 26 | 3.2 · 26.1 |
| `eslint` · `eslint-plugin-astro` | 9 · 1 | 9.39 · 1.7 |
| `oxlint`, `@oxlint/plugins` (exact; anti-slop rules vendored) | 1.78.0 | 1.78.0 |
| `prettier` · `prettier-plugin-astro` | 3 · 1 | 3.9 · 1.1 |
| `storybook` + addons · `@storybook-astro/framework` · `@vitejs/plugin-react` | 10 · 1 · 5 | 10.6 · 1.13 · 5.2 |
| `playwright` (Chromium, for `test:stories` and `test:pages`) | 1 | 1.64 |
| `husky` · `lint-staged` · `jscpd` | 9 · 16 · 4 | 9.1 · 16.4 · 4.3 |

`vite@^6` is pinned on purpose (otherwise a second Vite breaks the config). The `vitest@^4` peer
warning from `@storybook-astro/framework` is expected.

## Working on this repo

```bash
pnpm install
pnpm lint        # ESLint on bin/, hooks/ and scripts/
pnpm check       # manifests, argument-hint and "Use when", referenced paths, hooks, versions
pnpm test        # skill frontmatter and size, hook and installer tests
pnpm validate    # claude plugin validate .
```

There are no Git hooks: GitHub Actions runs the gates on every pull request and push to `main`
(`.github/workflows/ci.yml`: the commands above, `skill-validator --strict` on each skill, and an
`init` + `update` of the installer into an empty project), and Claude reviews each pull request
(`claude-code-review.yml`), failing the check unless it ends in `VERDICT: READY`. Merge to
`main`: `update` reads `main`, and there is no version to bump. Try unpushed changes with
`update --source <path to your checkout>` or `claude --plugin-dir <this repo>`.

| Where | What |
|-------|------|
| `skills/<name>/` | `SKILL.md` and its `references/` (and `code-skeleton/assets/anti-slop/`, vendored) |
| `commands/`, `hooks/` | `/verify`; the five hooks and `hooks.json` |
| `bin/guard-rules.mjs`, `.claude/settings.json` | The guard rules written into projects; this repo's own, for `main` |
| `bin/` | The `npx … init` / `update` installer |
| `scripts/check-plugin.mjs`, `.github/workflows/` | The plugin lint; CI, the Claude review and `@claude` |
| `spec.md`, `DESIGN.md`, `CLAUDE.md` | Intent; design decisions and why; the contract for projects using the skills |
| [`astro-stack-playground`](https://gitlab.asoft-python.com/hoa.nguyen/astro-stack-playground) | A project built with the skills, with the headless run, gate logs and screenshots |

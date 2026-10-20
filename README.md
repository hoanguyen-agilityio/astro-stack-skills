# astro-stack-skills

Claude Code marketplace `astro-stack`. It holds one plugin, `web-dev-stack`: project-agnostic
skills for one stack, **Astro** · **React** (islands) · **TypeScript** (strict) · **Effect** (with
Schema) · **oRPC** · **shadcn/ui**.

## Install

```bash
claude plugin marketplace add git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git
claude plugin install web-dev-stack@astro-stack
```

To try local changes without installing, start Claude Code with `claude --plugin-dir <path to this repo>`.

### Or import it as a project `.claude` folder

The repo root uses the same layout as `.claude/`, so `skills/<name>/SKILL.md` lands where Claude
Code looks for project skills. Use this when you do not want a plugin install.

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
| `CLAUDE.md` | Always-on contract for projects using the skills (loads when cloned as `.claude/`) |
| [`astro-stack-playground`](https://gitlab.asoft-python.com/hoa.nguyen/astro-stack-playground) | Separate repo that installs this plugin through `.claude/settings.json`; holds the project `code-skeleton` generated, plus the headless transcript, gate logs and screenshots |

## Layout

```
CLAUDE.md, spec.md, DESIGN.md
.claude-plugin/
├── marketplace.json   # marketplace "astro-stack", lists the plugin at ./
└── plugin.json        # plugin "web-dev-stack"
skills/
├── analyze-task/      # SKILL.md + references/{analysis-template,design-input}.md
├── code-skeleton/     # SKILL.md + references/{project-files,design-md-template}.md
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
exists. It includes:

- Astro with React islands and an SSR adapter
- strict TypeScript and the `@/` alias
- Effect and oRPC installed, with `src/libs/orpcClient.ts` pointing at `PUBLIC_API_URL`
- shadcn/ui on Tailwind v4
- ESLint, which bans `any` and `@ts-ignore`
- Vitest with Testing Library, plus a smoke island and its test
- `DESIGN.md`: design context for agents (tokens, components, island rules, states, anti-slop
  rules), filled from the installed theme, with `TODO(design)` sections for the brand

```text
/web-dev-stack:code-skeleton Create project lunch-order, oRPC pointing to http://localhost:8787/rpc
```

Verified on Astro 5, Effect 3, oRPC 1, Tailwind 4, Vite 6, Vitest 3 and shadcn CLI 4. Requires
Node ≥ 22.12. The skill's step 2 table lists the full set.

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
for the interactive parts, empty/error/pending states, and tests for helpers, islands and the
page (Astro Container API).

```text
/web-dev-stack:develop-feature /orders lists orders with a status filter; pending orders have a Cancel button
```

Both are verified on the same set as `code-skeleton` (Astro 5, Effect 3, oRPC 1): lint,
typecheck, tests and build pass, and the `/orders` example ran against a local oRPC server
through the `/rpc` proxy.

## Conventions shared by all skills

| What | Where |
|------|-------|
| oRPC client factory and procedure types | `src/libs/orpcClient.ts` |
| Services (one per API namespace, return `Effect`) | `src/services/<name>.ts` |
| Schema types (wire format + domain type) | `src/types/<resource>.ts` |
| Outcome helpers, islands, feature helpers, their tests | `src/components/<resource>/` (+ `__tests__/`) |
| shadcn primitives | `src/components/ui/` |

- Read `package.json` first and match the project's Astro, Effect, Tailwind and oRPC versions.
- No `any` and no `@ts-ignore`. API data is decoded with `Schema` before use.
- All skills share one running example, `orders`.

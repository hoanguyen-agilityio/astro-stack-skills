# DESIGN.md — web-dev-stack skill set

How the skill set is built and why. For what it is for, see `spec.md`. For the UI design file
that `code-skeleton` writes into projects, see
`skills/code-skeleton/references/design-md-template.md`.

## Shape

```
astro-stack-skills/                 one repo = marketplace "astro-stack" = plugin "web-dev-stack"
├── .claude-plugin/
│   ├── marketplace.json            lists the plugin at "./"
│   └── plugin.json
├── CLAUDE.md                       contract, loaded when the repo is cloned as .claude/
├── hooks/                          turn snapshot; PreToolUse push guard for dev/stag/prod; PostToolUse lint per edit; Stop checklist + success signal (plugin installs only)
├── skills/
│   ├── analyze-task/               step 0 of every workflow
│   │   ├── SKILL.md
│   │   └── references/{analysis-template,design-input}.md
│   ├── code-skeleton/              part 1 of the brief
│   │   ├── SKILL.md
│   │   └── references/{setup-layers,project-files,starter-ui,design-md-template,claude-md-template}.md
│   ├── integrate-api/  develop-feature/
│   └── review-code/                last step of every build: review → fix → review loop
│       ├── SKILL.md
│       └── references/{inventory,checklist,duplicates,reviewer-prompt}.md
```

The repo root has the same layout as a `.claude/` folder, so it works two ways:

| Install | How | Skill names |
|---------|-----|-------------|
| Plugin, project scope (recommended) | `claude plugin marketplace add <repo> --scope project`, then `claude plugin install web-dev-stack@astro-stack --scope project`; both land in the project's `.claude/settings.json` | `/web-dev-stack:code-skeleton` |
| Plugin, user scope | the same two commands without `--scope project` | `/web-dev-stack:code-skeleton` |
| Project folder (fallback) | clone into `.claude/`, or copy `skills/` into `.claude/skills/` | `/code-skeleton` |
| Development | `claude --plugin-dir <repo>` in an empty directory | `/web-dev-stack:code-skeleton` |

## Workflow

Every build skill follows the same steps as the team's `space` repo:

```
request ──► analyze-task ──► ground ──► build ──► verify ──► review ──► report
            kind, lane,      package.json,   skill-specific   read back,     review-code:    ## Result
            ACs, questions,  DESIGN.md,      steps            lint, types,   dup + review    + review table
            plan             neighbours                       test, build    → fix, ≤ 3 ×    + AC → proof
```

- **The workflow lives in `CLAUDE.md`, not in the skills.** This repo's `CLAUDE.md` and the one
  `code-skeleton` writes into each project list the steps (analyze → ground → build → verify →
  report). A skill holds only its own knowledge: scope, inputs, what it produces, done-when,
  failure modes and references. `code-skeleton` takes its inputs from an `analyze-task`
  analysis.
- **Lanes control the ceremony.** In `tiny`, the analysis stays inline. In `normal`, it is saved
  to `docs/analysis/<slug>.md`. In `high-risk`, the build waits for the user to confirm scope.
- **Verify loops.** Any fix restarts at the first gate. A failing gate is reported as failing.
- **Review loops.** `review-code` runs after verify: a fresh subagent reviews the change against
  an inventory of existing code, the findings are fixed, and checks and review run again, at
  most 3 rounds. What is left after that is reported, not looped on.
- **Report shape:** `Did / Saw / Not done / Blocked by / Next`, plus a table of which proof
  covers which AC. This matches `space-general`'s reporting rule.

## Hand-off contracts

| From → to | Contract |
|-----------|----------|
| `analyze-task` → build skill | analysis (file path or inline block): kind, ACs, assumptions, plan, Ready line |
| `code-skeleton` → `integrate-api` | `PUBLIC_API_URL`; `src/libs/orpcClient.ts` with an empty `AppRouterClient` and a `Procedure<Input>` type whose output is `unknown` |
| `code-skeleton` → `develop-feature` | `DESIGN.md` (tokens, components, island rules, states), shadcn in `src/components/ui/` |
| `code-skeleton` → `review-code` | `.jscpd.json` and `pnpm dup`; a starter with no clones, so the first clone comes from new code |
| build skill → `review-code` | the changed files, the acceptance criteria; back: the review table for `## Result` |
| `integrate-api` → `develop-feature` | `src/services/<name>.ts`: functions returning `Effect<A, NetworkError \| ApiError \| DecodeError>` |

## Decisions

| Decision | Why |
|----------|-----|
| Analysis is its own skill, called by the build skills | One place for the intake rules, reusable by every build skill, and it still runs when the user names only a build skill |
| Pin Astro 5 / Effect 3 / oRPC 1 / Vite 6 | `latest` is Astro 7 / Effect 4, whose APIs differ. These majors match the team's kitchen app and were verified end to end |
| Pin `vite@^6` explicitly | `@tailwindcss/vite`'s peer range otherwise pulls Vite 8 next to Astro's Vite 6, and the config fails to load |
| Let `shadcn init -t astro -b radix -p nova` write `components.json` | A hand-written one diverged from shadcn 4 (which uses the `cn` package). `-p` avoids an interactive prompt that stalls agents |
| Write `package.json` by hand, not with `pnpm init` | pnpm 11 adds a `devEngines` block that breaks the next `pnpm add` |
| oRPC procedure output typed `unknown` | Forces every response through Effect `Schema` before the app uses it |
| Skeleton has no batching, errors or retry | Those belong to `integrate-api`. The skeleton stays the smallest thing that runs |
| Project-scope plugin install is the recommended path, not a copy | Claude Code already records it in `.claude/settings.json`, so the team shares one versioned skill set that updates in place. A copy goes stale, and a clone into `.claude/` nests a git repo and a second `DESIGN.md` |
| `npx git+ssh://… init` wraps that install in one command (`bin/cli.mjs`) | Like ClaudeKit's `ck init`, but with no npm registry or global CLI: npx runs the bin straight from the git repo. It only calls `claude plugin`, so it adds no second install mechanism; `--copy` remains for machines without the `claude` CLI |
| `code-skeleton` writes the project's `CLAUDE.md` from a template | A plugin does not load this repo's `CLAUDE.md`. Writing the contract into the project makes it hold in every later session, whatever the install mode, and lets the project own and extend it |
| `code-skeleton` has an init mode for empty directories, layer by layer | `pnpm create astro`, `astro add` and `storybook init` install `latest` and ask questions. Building each layer by hand keeps the verified majors, and with defaults for the name and the API URL an empty directory needs no arguments |
| `DESIGN.md` generated after shadcn init | Its token, radius and font values are read from the installed theme, so they match the code |
| Storybook through `@storybook-astro/framework` (Storybook 10) | Renders `.astro` (server, Container API) and React (browser) stories in one Storybook, reading `astro.config.mjs`, so `.astro` components keep their story without a React rewrite. The team's in-house `@storybook/astro` in `space` is Storybook 8 and kitchen's `.astro` stories are excluded from its config. Needs Node ≥ 22.19 |
| One folder per component (`index.astro`/`index.tsx`, `<Name>.stories.tsx`, `__test__/index.test.tsx`) | The layout of the team's `space` apps (kitchen: 49 `__test__` folders to 3 `__tests__`, `<Name>.stories.tsx` everywhere), so code moves between repos without renaming. Feature helpers stay one level up, beside the component folders |
| React stories set `parameters: { renderer: 'react' }` | The Astro framework renders every story with Astro by default; without it a React story fails with `Renderer 'astro' not found` |
| A `Stop` hook prints the task checklist and success signal, read from the transcript and `git` | The `## Result` block is written by the model and can be skipped or wrong. The hook runs every time, reports only what the turn actually did (edited files, gate commands and their exit status), and treats a gate as passed only if it ran after the last edit. It notifies but never blocks, so a small task is not forced through every gate |
| The checklist reads gate results from pnpm's output and changed files from a working-tree snapshot | Claude often runs `pnpm typecheck; echo $?` or a `for` loop, and writes files with Bash: the tool's error flag then says success for a failed gate, and Edit/Write calls miss files. pnpm's `> pkg@ <script>` headers and `ELIFECYCLE` lines say which gate ran and failed; a `UserPromptSubmit` snapshot compared at `Stop` finds every file the turn changed. When neither can tell, the gate shows `[?]` instead of a guess |
| The checklist lists tasks from Claude's `## Result` (Did → `[x]`, Not done → `[ ]`), else from the turn's tool calls | The mentor wants to see what was done, not only which files changed. Claude Code 2.1 has no todo tool to read, and only the model can say what a change was for, so its report is the source, labelled as such. Small turns often have no report; listing their actions keeps a task list on every turn. The final answer can reach the transcript after Stop runs, so the hook reads `last_assistant_message` from its input first |
| A `PostToolUse` hook lints each edited file (final newline, ESLint, Prettier) and feeds problems back with exit 2 | Husky only fires at commit and push, so an agent could write many files with the same lint error before finding out. Checking the one file right after the edit lets Claude fix it while it is still in context. It runs the project's own binaries, so the rules are the project's; typecheck and tests are too slow per edit |
| A `PreToolUse` hook blocks `git push` to `dev`, `stag` and `prod` | The mentor's review: those branches deploy to real environments and change only through a merge request. The hook reads the Bash command before it runs, so `--no-verify` and `--force` cannot skip it, and it resolves a bare `git push` or `HEAD` to the current branch. It is a guard for Claude, not a replacement for protected branches on GitLab, which also stop people |
| Coverage ≥ 80% through `@vitest/coverage-v8` thresholds, enforced by `pnpm test:coverage` in `pre-push` | The mentor's requirement. Thresholds in `vitest.config.ts` fail the run instead of only printing a report. `pnpm test` stays fast for the inner loop. `.astro` files are left out because v8 cannot map them; the page tests cover them |
| ESLint `eol-last: error` | Prettier alone writes the final newline silently at commit, so nobody hears about it; the mentor wants the linter to report it. The core rule is deprecated but still in ESLint 9 and needs no plugin |
| Review is its own skill, `review-code`, run in a loop at the end of `develop-feature` and `integrate-api` | The mentor's review: teams keep building on the generated code base, and each feature adds components that already exist. Gates cannot see that. A separate skill can also review someone else's branch, and one place holds the checklist for every build skill |
| The reviewer is a fresh subagent, one per round | An agent reviewing code it just wrote tends to accept it. A new context with only the change, the inventory and the checklist judges it like a second developer would |
| Duplicates are found two ways: `jscpd` for copies, an inventory for the same idea written twice | `jscpd` is exact and cheap but compares tokens, so a card with renamed props passes it. The inventory of existing pieces gives the reviewer something concrete to compare against |
| `jscpd` 4 with `.astro` mapped to `markup` | Without `formatsExts` it skips `.astro` files. Version 5 releases every few days, so the skeleton stays on 4 |
| At most 3 review rounds | Enough for a fix to be checked twice; a finding that survives that needs a human, so it is reported instead of looped on |
| The skill repo has its own ESLint, Prettier and Husky gates for `bin/` and `hooks/` | The repo started as Markdown only, so nothing ran on commit. The hooks are now real code that every project runs; a commit runs ESLint + Prettier on staged files and a push runs lint, format and the hook tests, the same split as the generated projects. Same majors as the skeleton (ESLint 9, Prettier 3, Husky 9, lint-staged 16). `printWidth` is 100, the width the existing code was written at. Markdown is left out: Prettier would rewrite the templates inside skill code blocks |
| `prepare: husky \|\| true` | `pnpm install` sets up the Git hooks for whoever clones the repo. `\|\| true` keeps the npx installer working where there is no `.git` (npm runs `prepare` when it installs a git dependency) |
| Plain `name` + `description` frontmatter | Matches the team's plugins on `feat/claude-shared-plugins`. Descriptions list trigger phrases and the sibling relationship |

## Verification strategy

A skill is only "done" after Claude Code has run it in a real consumer repo, not with
`--plugin-dir`. That repo is `astro-stack-playground`: it installs the plugin the way any team
project would, through `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "astro-stack": { "source": { "source": "git", "url": "git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git" } }
  },
  "enabledPlugins": { "web-dev-stack@astro-stack": true }
}
```

To test unpushed skill changes, the playground points the same marketplace name at a local
checkout in `.claude/settings.local.json` (gitignored):
`claude plugin marketplace add <path to this repo> --scope local`.

Then the skill runs headless from the playground root:

```bash
claude -p "/web-dev-stack:code-skeleton …" --output-format stream-json --verbose
```

The transcript must show `analyze-task` invoked first. The generated project must pass all
four gates, and `DESIGN.md` must match `global.css`. Each run has found real gaps (Node version,
shadcn preset prompt, pnpm 11 build scripts), and each one was fixed in the skill text. The
generated project and the evidence (transcript, gate logs, screenshots) are committed in the
playground repo.

## Extending

To add `integrate-api` or `develop-feature`:

1. Create `skills/<name>/SKILL.md` with `## 0. Analyze the request first`, invoking
   `analyze-task` in the same way `code-skeleton` does, then ground → build → verify → report.
2. Put examples in `references/`, and keep the shared `orders` example running across skills.
3. Add the hand-off to the table above, a row to `spec.md`, and a line to `CLAUDE.md`'s workflow.
4. Run it headless in the playground repo and save the evidence there.

## Known limitations

- Verified on Node 22.23 and pnpm 8 and 11 only. pnpm 10 uses `onlyBuiltDependencies`, which
  is documented but not exercised.
- No browser-level check runs inside the skills. Screenshots in the playground's `docs/evidence/` were taken
  separately.
- `analyze-task`'s Figma path depends on the Figma MCP being connected, and falls back to
  screenshots.
- The hooks load only with the plugin; a `--copy` or `.claude/` clone install has none.
- The checklist cannot order a Bash file write against the gates, so only `Edit`/`Write` mark a
  gate as run before a later edit (`[~]`). A gate run with `pnpm -s` behind `;` or `|` shows
  `[?]`: pnpm prints nothing that says whether it failed.
| The skeleton ships a starter UI from reusable pieces (`AppLayout`, `common/`, `layout/`, `config/site.ts`), not a bare smoke page | A lone button on an unstyled page left every later page to invent its own shell and wrappers, so features copied markup instead of reusing it. Layers with an import rule (`ui` → `common` → `layout` → `<feature>`, no feature-to-feature imports) give reuse a place, and a polished welcome page shows the tokens and dark mode working |
| Skill frontmatter: a one-sentence `description` plus `when_to_use` for the trigger phrases; `SKILL.md` kept to about 120 lines (Scope, Workflow steps, Common failure modes, References table) with commands, versions and file contents in `references/` | The format of the team's `space/.claude/skills` and of incluud/astro-agent-skills. `SKILL.md` loads in full on every run, references only when a step needs them, so the short file costs less context and is easier to follow |

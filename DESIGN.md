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
├── hooks/                          turn snapshot; PreToolUse push guard for main/dev/stag/prod; PreToolUse guard for secret and generated files; PreToolUse release gate for stag/prod/v* tags; PostToolUse lint per edit; Stop checklist + success signal
├── skills/
│   ├── analyze-task/               step 0 of every workflow
│   │   ├── SKILL.md
│   │   └── references/{ticket-contract,design-input}.md
│   ├── ticket/                     /ticket <id>: analyze-task + contract check + push on docs/ticket-<id>
│   ├── incident/                   /incident: read-only investigation + incident contract + push on docs/incident-<id>
│   ├── deploy-setup/               /deploy-setup: deploy workflow, .claude/release.json, GitHub settings checklist
│   ├── release/                    /release: dev → stag → prod, one approved pull request per step, tag
│   │   └── scripts/release-status.mjs
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
  to `docs/tickets/<id>/` as `intent.md`, `spec.md` and `plan.md`. In `high-risk`, the build
  waits for the user to confirm scope.
- **Verify loops.** Any fix restarts at the first gate. A failing gate is reported as failing.
- **Review loops.** `review-code` runs after verify: a fresh subagent reviews the change against
  an inventory of existing code, the findings are fixed, and checks and review run again, at
  most 3 rounds. What is left after that is reported, not looped on.
- **Report shape:** `Did / Saw / Not done / Blocked by / Next`, plus a table of which proof
  covers which AC. This matches `space-general`'s reporting rule.

## Hand-off contracts

| From → to | Contract |
|-----------|----------|
| `analyze-task` → build skill | `docs/tickets/<id>/` (or the inline block) in the shape `references/ticket-contract.md` fixes: intent (request, goal, scope), spec (ACs, edge cases, questions, assumptions), plan (modules, order, tests, Ready line) |
| `/ticket` → team | the same three files, committed on `docs/ticket-<id>` and pushed for a merge request |
| `deploy-setup` → `release` | `.claude/release.json` (branches, URLs, approvers, workflow, deploy commands), `.github/workflows/deploy.yml`, `docs/deploy-plan.md` |
| `release` → team | `Stage <version>` and `Release <version>` pull requests for a release manager; `v<version>` on the merge commit into `prod`; `Back-merge <version>` into dev |
| `/incident` → team, `/ticket` | `docs/incidents/<id>/` (`references/incident-contract.md`): report, root cause, actions on `docs/incident-<id>`; each prevention action that needs code names the ticket that carries it |
| `code-skeleton` → `integrate-api` | `PUBLIC_API_URL`; `src/libs/orpcClient.ts` with an empty `AppRouterClient` and a `Procedure<Input>` type whose output is `unknown` |
| `code-skeleton` → `develop-feature` | `DESIGN.md` (tokens, components, island rules, states), shadcn in `src/components/ui/` |
| `code-skeleton` → `review-code` | `.jscpd.json` and `pnpm dup`; a starter with no clones, so the first clone comes from new code |
| build skill → `review-code` | the changed files, the acceptance criteria; back: the review table for `## Result` |
| `integrate-api` → `develop-feature` | `src/services/<name>.ts`: functions returning `Effect<A, NetworkError \| ApiError \| DecodeError>` |

## Decisions

| Decision | Why |
|----------|-----|
| Analysis is its own skill, called by the build skills | One place for the intake rules, reusable by every build skill, and it still runs when the user names only a build skill |
| One folder per ticket with `intent.md`, `spec.md`, `plan.md`, replacing `docs/analysis/<slug>.md` | The mentor's review: the analysis is reviewed in a merge request before the build. Splitting why, done-means and how lets each reviewer read their part, and a fixed heading list (`None.` instead of a deleted section, stable AC numbers) lets the build skills, `review-code` and a grep check rely on it. Named by ticket id, so a build is started with the folder (`/develop-feature docs/tickets/412/`) rather than "the analysis above" |
| `/ticket` commits only the three files and pushes `docs/ticket-<id>`, but opens no merge request | Pushing gets the analysis in front of the team; the push guard keeps it off `dev`, `stag` and `prod`. The user opens the merge request, since the target branch and reviewers are the team's call. `disable-model-invocation` keeps Claude from pushing on its own when a ticket is only mentioned |
| Several tickets run in parallel, one subagent and one git worktree each | The mentor's review asked to write tickets in parallel. Subagents sharing the user's working tree would race on the index and on `git switch`; a worktree per ticket gives each its own index and branch, so commits and pushes cannot collide and the user's tree is never touched. Worktrees live in `.claude/worktrees/` (Claude Code's own place for them), added to `.git/info/exclude` so they are never committed. The list is confirmed first and capped at 5 at a time, and subagents cannot ask, so questions become open questions. Subagents only analyze and write files (Read, Write, Edit, Glob, Grep): in the first run they were refused Bash, and a push from inside a worktree failed on a relative remote URL. So the caller checks, commits in each worktree with `git -C` and pushes from the repo root, one ticket at a time; the slow part, the analysis, stays parallel |
| Incidents get their own three files and `/incident`, in the same shape as tickets | The mentor's review asked for incident contracts. Splitting what happened, why and what we do lets support, developers and leads each read their part. The contract makes the write-up blameless, separates facts (a commit, `file:line`, a log line) from `Hypothesis:`, redacts what logs carry (tokens, emails, customer data), and ties every prevention action to a gap found in the root cause. `/incident` investigates read-only and never fixes: the fix is reviewed as a ticket, not inside a write-up. Folders default to `<date>-<slug>` because most teams have no incident numbering |
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
| A `PreToolUse` hook blocks `git push` to `main`, `dev`, `stag` and `prod` | The mentor's review: dev, stag and prod deploy to real environments, and main is the reviewed trunk (added after the mentor pointed to the RN kit's guard rails); all four change only through a merge request. The hook reads the Bash command before it runs, so `--no-verify` and `--force` cannot skip it, and it resolves a bare `git push` or `HEAD` to the current branch. It is a guard for Claude, not a replacement for protected branches on GitLab, which also stop people |
| A `PreToolUse` hook (`protect-files`) blocks secret files and hand edits to generated ones | The mentor pointed to the RN kit's guard rails. A value read from `.env` or a key file lands in the transcript and in logs, so Read, Grep, Edit, Write and Bash calls that name one are stopped and the skills ask the user for the value. The first `cp .env.example .env` stays allowed, because `code-skeleton` needs it and it copies no secret. Generated files (`.astro/`, `dist/`, `pnpm-lock.yaml`, `*.gen.ts`) may be read but not edited: the next tool run would overwrite the edit. Like the push guard, it stops mistakes, not someone working around it on purpose |
| Releases go dev → stag → prod, one pull request per step, each approved by a release manager before the next opens (`deploy-setup` + `release` + the `release-gate` hook) | Modelled on Canh's `rn-release` for the RN kit (approval on the PR's head commit, by someone other than the author; a gate that answers allow, ask or deny; one version, one tag), with three web environments instead of two apps, and GitHub because the projects live there. The real protection is GitHub's: branch and tag rulesets and environment reviewers stop everyone, and `deploy-setup` lists them. The hook stops this session's mistakes: it never approves, merges into `stag` or `prod` only with that approval, opens a PR into `prod` only from `stag` after staging deployed it, and tags only the merge commit of an approved release. It reads approvals with `gh`: a hook runs outside Claude, so it cannot use Claude in Chrome, and it should not trust Claude to report the approval it is checking. `gh` stays optional (the mentor's point): without it the gate denies those steps and a person does them on GitHub, and the skill uses the MCP server or Claude in Chrome to open PRs and read their state |
| Coverage ≥ 80% through `@vitest/coverage-v8` thresholds, enforced by `pnpm test:coverage` in `pre-push` | The mentor's requirement. Thresholds in `vitest.config.ts` fail the run instead of only printing a report. `pnpm test` stays fast for the inner loop. `.astro` files are left out because v8 cannot map them; the page tests cover them |
| Stories are a gate: `pnpm test:stories` opens each one in Chromium, light and dark, and reads the a11y addon's results | Checking each story by eye in Storybook was the one step of the workflow Claude could not loop on, so it was skipped or done by hand. The script listens to Storybook's own `storyFinished` event, so it reports what the Accessibility panel shows, with the same per-story rules. `@storybook/addon-vitest` would do the same inside Vitest, but `@storybook-astro/framework` supports it only from Vitest 4, and the stack is on 3. Playwright, a small script and a static build need no major change. Transitions are switched off first: in dark, axe otherwise measures colours mid-fade |
| Pages are a gate too: `pnpm test:pages` crawls the built site under `astro preview` | The mentor's review pointed at web-quality-skills, whose checks run Lighthouse, DevTools traces and CrUX against a live site: useful, but no pass/fail signal before a merge. What can be decided from the built HTML and the response (titles, descriptions, canonical, headers, CSP, console errors, links, image sizes, bundle size) became a gate in the same loop as the others, with no new dependency (Playwright is already there). What needs a real browser trace or real users (LCP, INP, CLS, screen readers) stays in the `web-quality` skill, labelled measured or hypothesis |
| A strict CSP from Astro's `experimental.csp`, plus headers from middleware | Hashes for every bundled script and style, no `'unsafe-inline'`. The theme script must run before paint, so it stays inline and `BaseLayout` adds its hash with `Astro.csp.insertScriptHash`; `Astro.csp` throws where the CSP is off (dev, Container API, Storybook), so only that error is caught. `frame-ancestors` and the other directives that a hash policy lacks are added in the config; `X-Frame-Options` and the rest come from middleware. Verified in the playground: islands hydrate, dark mode has no flash, page tests and Storybook still pass |
| `web-quality` is its own skill, adapted rather than copied | The upstream skills are generic (every framework, 10–14 KB each). Ours keep their evidence-first rules but name this stack's files, gates and fixes (`<Image>`, `client:*`, `AppLayout` props, `Astro.csp`), use `review-code`'s severities, and loop like the other skills. Credited in the skill; MIT allows reuse |
| Accessibility uses the external `accessibility` skill instead of our own WCAG rules; it is never installed for the user | The mentor's rule for this team: do not maintain what an available skill already does (the same choice in Huyen's reviewer skills). `web-quality` and `review-code` call it on the changed UI files when it is installed, use its WCAG review and leave its Lighthouse steps to the live-evidence step; when it is missing they say "a11y not checked" with the install command (`npx skills add addyosmani/web-quality-skills --skill accessibility`) and carry on. Our `references/accessibility.md` keeps only what that skill cannot know: the axe gate in `test:stories`, `AppLayout` landmarks, shadcn focus and form patterns |
| Anti-slop rules (Oxlint, vendored) next to ESLint, with `no-module-mocking` and `require-readable-spacing` off | The mentor asked for anti-slop on TypeScript. dmmulroy/anti-slop targets exactly what generated code gets wrong here (`unknown` contracts, `as unknown as`, widened dictionaries, hand-rolled `_tag` checks Effect has helpers for) and is meant to be vendored, so the skill ships its source and the project owns the copy. It runs on Oxlint, so ESLint stays the general linter and Oxlint runs only these rules (well under a second, `.astro` frontmatter included). On the playground it found 127 problems: 107 blank-line findings (Prettier's job, rule off), `vi.mock` is how our page and island tests work (rule off), and the rest were either real (Effect `_tag` checks, widened `Record`s, unexplained assertions: fixed) or test fakes (rules off for `__test__/`, stories and mocks). Every code block in the skills passes the config |
| ESLint `eol-last: error` | Prettier alone writes the final newline silently at commit, so nobody hears about it; the mentor wants the linter to report it. The core rule is deprecated but still in ESLint 9 and needs no plugin |
| Review is its own skill, `review-code`, run in a loop at the end of `develop-feature` and `integrate-api` | The mentor's review: teams keep building on the generated code base, and each feature adds components that already exist. Gates cannot see that. A separate skill can also review someone else's branch, and one place holds the checklist for every build skill |
| The reviewer is a fresh subagent, one per round | An agent reviewing code it just wrote tends to accept it. A new context with only the change, the inventory and the checklist judges it like a second developer would |
| Duplicates are found two ways: `jscpd` for copies, an inventory for the same idea written twice | `jscpd` is exact and cheap but compares tokens, so a card with renamed props passes it. The inventory of existing pieces gives the reviewer something concrete to compare against |
| `jscpd` 4 with `.astro` mapped to `markup` | Without `formatsExts` it skips `.astro` files. Version 5 releases every few days, so the skeleton stays on 4 |
| At most 3 review rounds | Enough for a fix to be checked twice; a finding that survives that needs a human, so it is reported instead of looped on |
| The skill repo's own gates (ESLint, Prettier, Node tests, `claude plugin validate`) run in GitHub Actions, not in Husky | The repo started as Markdown only, so nothing ran on commit; Husky then ran lint on commit and the tests on push. Local hooks can be skipped and only cover what one machine has installed; a run on every pull request and on `main` is the one record reviewers see. Same majors as the skeleton (ESLint 9, Prettier 3). `printWidth` is 100, the width the existing code was written at. Markdown is left out: Prettier would rewrite the templates inside skill code blocks. Generated projects keep Husky: that is the skills' contract, not this repo's |
| `scripts/check-plugin.mjs`, `skill-validator --strict` and an installer run in CI, beside the Node tests | Taken from the backend-dev plugin's CI. The tests check each file alone; the plugin lint checks what ties files together: `plugin.json`, the marketplace entry and `package.json` agree, every `${CLAUDE_PLUGIN_ROOT}/…`, `<skill-dir>/…`, `references/…` and Markdown link resolves, every hook script is wired and named by a test, and the tech stack majors in `CLAUDE.md` match `README.md`. A model-invoked skill must say "Use when …" (the agentskills.io form) because its description is all Claude sees when choosing. SKILL.md is capped at 200 lines, as there. `skill-validator` allows extra frontmatter because every skill has `argument-hint`, and checks `code-skeleton` with `--allow-nested-paths=assets/anti-slop --skip-orphans` and without `--strict`: it vendors the anti-slop rules as a folder it copies whole, and it carries every project file as a template, so its references pass the token warning (10k per file, 25k in all) without cutting what the skill writes. Exit 2 (warnings only) passes and is logged; exit 1 (errors, including the 25k/50k token limits) fails. The installer job is this repo's version of their template gate: `init` into an empty project copies everything and `update` right after changes nothing |
| Each pull request gets a Claude review in CI that fails the pipeline unless it ends in `VERDICT: READY` | Taken from the team's backend-dev plugin (`claude-code-action`), along with the rebase skip and the `@claude` workflow. Skills are instructions another Claude follows, so most mistakes (a reference to a missing file, two skills that disagree) are invisible to lint and tests. One sticky comment per pull request, updated on each push, and an inline comment per blocking item. A review that did not run fails too, so a missing token cannot pass silently |
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

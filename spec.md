# Spec — web-dev-stack skills

Status: `code-skeleton` and `analyze-task` done and verified · `integrate-api` and
`develop-feature` added (MR 1), not yet chained to `analyze-task` · Storybook added to
`code-skeleton` and `develop-feature` · updated 2026-10-20

## Intent

The mentor's brief, verbatim:

> Web Development: React, Astro, TypeScript, Effect.js, gRpc + one UI Framework (Include code
> skeleton, develop feature + integrate API)

We deliver **common** Claude Code skills for one shared stack. They are not tied to any project
or product, and they let a developer go from a request to a running, tested Astro app with the
same steps every time:

| Brief | Choice |
|-------|--------|
| Framework | Astro 5, with React 19 as islands |
| Language | TypeScript, strictest config |
| Async, errors, validation | Effect 3 + `Schema` |
| "gRpc" | oRPC 1 (assumption, see Q1) |
| UI framework | shadcn/ui on Tailwind v4 |

## Problem

Without shared skills, every developer (and every agent session) sets the stack up differently:
other versions, other folders, a missing test setup, URLs hard-coded in source. Requests also
get built before they are understood. The skills fix both: one verified setup, and one workflow
that starts with written acceptance criteria.

## Goals

1. One command scaffolds a project that passes lint, typecheck, test and build.
2. Every build skill starts from a written analysis, even when the user calls only that skill.
3. The skills work installed as a plugin **or** cloned as a project's `.claude/` folder.
4. Shared conventions (paths, Schema at the API boundary, tokens via `DESIGN.md`) make the
   outputs of the three skills fit together.

## Non-goals

- Backend or oRPC server code. The deploy workflow is a template; the host's own setup (servers,
  registries, DNS) is the team's.
- Project-specific rules (for example kitchen's `variantTheme` or the `[#issue]` commit format).
  Those live in each project's own `CLAUDE.md`.
- Supporting Astro 7 or Effect 4. Their APIs differ, so the skills stop and say so.

## Skills

| Skill | Input | Output | Done when |
|-------|-------|--------|-----------|
| `analyze-task` | ticket, design (image/Figma) or loose request | kind, lane, ACs, edge cases, open questions, plan; `docs/tickets/<id>/{intent,spec,plan}.md` for normal and high-risk | every AC has a Given, every unknown is a question, the plan names files, the files pass the contract check |
| `ticket` | ticket id + ticket text, file or link; or a file / folder of several tickets | `docs/tickets/<id>/{intent,spec,plan}.md` committed on `docs/ticket-<id>` and pushed | contract check passes, only the three files committed, branch pushed |
| `incident` | description of what broke, logs, files; optional incident id | `docs/incidents/<id>/{report,rca,actions}.md` committed on `docs/incident-<id>` and pushed; no code changed | contract check passes, every cause has evidence or is a hypothesis, nothing secret copied from the logs, only the three files committed |
| `deploy-setup` | where it deploys, URLs, release managers | `.github/workflows/deploy.yml`, `.claude/release.json`, `CHANGELOG.md`, `docs/deploy-plan.md`, a checklist of GitHub rulesets and environments | each environment branch deploys through the workflow, the gate is registered, every GitHub setting is done or assigned to a person |
| `release` | a version, or where the release stands | `Stage <version>` PR into stag, staging checks, `Release <version>` PR into prod, tag `v<version>`, back-merge into dev | each step merged only after its approval, staging checked before prod, the tag on the released merge commit, nothing approved by Claude |
| `code-skeleton` | project name, API URL (both defaulted in an empty directory) | runnable project, `src/libs/orpcClient.ts`, `DESIGN.md`, `CLAUDE.md`, Storybook, starter UI (shared layout, reusable `common/` components, welcome + 404 pages) with tests and stories | 4 gates green, Storybook builds, URL only in env, `DESIGN.md` matches `global.css` |
| `integrate-api` | procedures | `src/types/<name>.ts`, `src/services/<name>.ts` returning `Effect` with typed errors and retry | service tests cover success, decode error, API error, retry |
| `develop-feature` | ticket or design | Astro page + React island with shadcn, loading/empty/error states, a story per state for each component, tests | one test per AC, a story per state, 4 gates green |
| `review-code` | a change (branch, diff or files), its criteria | findings by severity, fixed in a loop of at most 3 rounds; a review table for the report | no `blocker` or `should` left (or listed as left), `pnpm dup` clean, gates green |

Hand-offs: `analyze-task` → any build skill (via the plan). `integrate-api` → `develop-feature`
via `src/services/<name>.ts`.

## Acceptance criteria for the deliverable

- **AC1:** each skill has a short `SKILL.md`, with details and examples in `references/`.
- **AC2:** each skill is tested by Claude Code in a separate sample repo that installs the
  plugin (`astro-stack-playground`), with evidence kept in that repo's `docs/evidence/`.
- **AC3:** calling `/web-dev-stack:code-skeleton` alone runs `analyze-task` first (proven by the
  headless transcript).
- **AC4:** the plugin validates and installs: `claude plugin validate .`, then
  `claude plugin install web-dev-stack@astro-stack`.
- **AC5:** the deliverable is cross-reviewed before it goes to the mentor.

## Open questions

| # | Question | Blocks | Who can answer |
|---|----------|--------|----------------|
| Q1 | Does "gRpc" in the brief mean oRPC? | stack choice | mentor |
| Q2 | Who builds `integrate-api` and `develop-feature`? | AC2 for those skills | team |

## References

- `docs/architecture.md`: how the skill set is built and why
- `skills/code-skeleton/references/design-md-template.md`: the `DESIGN.md` each project gets
- `AGENTS.md`: the always-on contract for projects using the skills
- `astro-stack-playground` (separate repo): installs the plugin via `.claude/settings.json`;
  holds the project `code-skeleton` generated, gate logs, the headless transcript, screenshots

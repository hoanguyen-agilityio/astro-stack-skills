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
├── skills/
│   ├── analyze-task/               step 0 of every workflow
│   │   ├── SKILL.md
│   │   └── references/{analysis-template,design-input}.md
│   └── code-skeleton/              part 1 of the brief
│       ├── SKILL.md
│       └── references/{project-files,design-md-template}.md
```

The repo root has the same layout as a `.claude/` folder, so it works two ways:

| Install | How | Skill names |
|---------|-----|-------------|
| Plugin | `claude plugin marketplace add <repo>`, then `claude plugin install web-dev-stack@astro-stack` | `/web-dev-stack:code-skeleton` |
| Project folder | clone into `.claude/`, or copy `skills/` into `.claude/skills/` | `/code-skeleton` |
| Development | `claude --plugin-dir <repo>` in an empty directory | `/web-dev-stack:code-skeleton` |

## Workflow

Every build skill follows the same steps as the team's `space` repo:

```
request ──► analyze-task ──► ground ──► build ──► verify ──► report
            kind, lane,      package.json,   skill-specific   read back,     ## Result
            ACs, questions,  DESIGN.md,      steps            lint, types,   + AC → proof
            plan             neighbours                       test, build
```

- **Step 0 is always `analyze-task`.** Each build skill invokes it with the Skill tool
  (`web-dev-stack:analyze-task` or `analyze-task`). If the Skill tool cannot find it, the skill
  falls back to reading `../analyze-task/SKILL.md`, a relative path that works in both install
  modes. The user can call only `/code-skeleton` and still get the analysis.
- **Lanes control the ceremony.** In `tiny`, the analysis stays inline. In `normal`, it is saved
  to `docs/analysis/<slug>.md`. In `high-risk`, the build waits for the user to confirm scope.
- **Verify loops.** Any fix restarts at the first gate. A failing gate is reported as failing.
- **Report shape:** `Did / Saw / Not done / Blocked by / Next`, plus a table of which proof
  covers which AC. This matches `space-general`'s reporting rule.

## Hand-off contracts

| From → to | Contract |
|-----------|----------|
| `analyze-task` → build skill | analysis (file path or inline block): kind, ACs, assumptions, plan, Ready line |
| `code-skeleton` → `integrate-api` | `PUBLIC_API_URL`; `src/libs/orpcClient.ts` with an empty `AppRouterClient` and a `Procedure<Input>` type whose output is `unknown` |
| `code-skeleton` → `develop-feature` | `DESIGN.md` (tokens, components, island rules, states), shadcn in `src/components/ui/` |
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
| `DESIGN.md` generated after shadcn init | Its token, radius and font values are read from the installed theme, so they match the code |
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

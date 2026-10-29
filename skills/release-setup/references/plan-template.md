# docs/release-plan.md

Write this file in Phase 2, before anything changes, and keep it current. A follow-up run reads
it first. It is in English, like the code. It contains no values, only names.

```markdown
# Release plan

How this app goes from dev to stag to prod. Releases run through `/release`, and setup changes
through `/release-setup`.

## Branches and environments

| Branch | Environment | URL | Deploys when | Approved by |
|---|---|---|---|---|
| dev | development | https://dev.example.com | a pull request is merged | a reviewer |
| stag | staging | https://stag.example.com | `Stage <version>` is merged | release managers |
| prod | production | https://example.com | `Release <version>` is merged (+ deployment review) | release managers |

Release managers: @ni-ngo. They approve both the stage and the release pull requests.

## Workflow

`.github/workflows/deploy.yml`: gates → build → deploy to <host, how>.
Deploy step: <Docker to ghcr.io + roll out over SSH | rsync + restart | placeholder, host not decided>.
Proven by a run: <yes, run link | not yet>.

## Variables per environment (names only)

| Name | Kind | development | staging | production |
|---|---|---|---|---|
| PUBLIC_API_URL | variable | set | set | missing |
| SESSION_SECRET | secret | set | set | set |

## On GitHub

| Item | Status | Who |
|---|---|---|
| Branch rulesets dev, stag, prod | done (read back 2026-10-29) | |
| CODEOWNERS on stag and prod | for the dev | dev |
| Tag ruleset v* | for an admin | @admin |
| Environment production: branches, reviewers, prevent self-review | for an admin | @admin |
| Secrets in each environment | for the dev | dev |

## Release gate

`.claude/release.json`: branches, URLs, approvers, `deployCommands`.
The `release-gate` hook is registered in `.claude/settings.json`.

## Left to people

- <each "for the dev" or "for an admin" item above, with the page to open>
```

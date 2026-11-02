---
name: release
description: "Move a version from dev to stag to prod: CHANGELOG and version, a pull request into stag, staging checks, a pull request into prod and the v tag, each step only after a release manager approves."
argument-hint: "[version, or what happened: \"the stage PR got approved\"]"
disable-model-invocation: true
---

# Release: dev → stag → prod

Goal: on release day, a release manager approves one pull request into `stag`, then one into
`prod`. Each says exactly what ships and from which commit. Exactly the approved commit, and
nothing else, then reaches each environment. A tag locks the version so it cannot ship again from
another commit.

Each step waits for the one before it. The pull request into `prod` opens only after the
pull request into `stag` is approved and merged, and staging has deployed and passed its checks.

The text after `/release` is the dev's request ("1.4.0", "hotfix for the cart total", "the stage
PR got approved"). Read it like any message and ask only for what it leaves out. Talk to the dev
in their language; write the CHANGELOG and pull requests in English, like the code.

**The release gate decides, not you.** `hooks/release-gate.mjs` checks every merge into `stag`
or `prod`, every `v*` tag push and every deploy outside a release. When it denies, relay its
reason and stop. Never approve a pull request or a deployment. Never work around a denial: no
`--admin`, no auto-merge, no direct push, no tag on another commit, no deploy command by hand.
The approval is a person's decision. This skill prepares it and carries it out.

The gate is a hook in `hooks/`, not part of this skill, on purpose: it has to hold in every
session, also when someone asks Claude to merge or tag without running `/release`.

**Talking to GitHub.** `gh` when it is signed in, the GitHub MCP server, or Claude in Chrome: use
whichever is there to open pull requests and read their state. None of them is required. Without
`gh`, the gate cannot read approvals, so it denies the merge and tag steps; give the dev the
exact action to take on GitHub instead (`references/merge-tag-rollback.md` → Without gh).

Never open `.env` files. Staging and production values live in the GitHub environments; check
their names only.

## Phase 0: Where the release stands

```bash
node "<skill-dir>/scripts/release-status.mjs" <project-dir>
```

JSON: `setup` (config, workflow, what is missing), `gh`, `git` (heads and `package.json` versions
of dev, stag and prod, the last `v*` tag), `changes` (commits on dev not on stag, on stag not on
prod, with ticket ids), `prs` (open pull requests into stag and prod, who approved their head,
and what the gate says about merging each), `staging.runs` and `next`.

| `next` | Go to |
|---|---|
| `setup` (exit 3) | Stop: run `/deploy-setup` first |
| `stage` | Phase 1 |
| `await-stage-approval` | Say who still has to approve the stage PR (or which change request is open) and stop |
| `merge-stage` | Phase 5 |
| `check-staging-then-open-release` | Phase 6, then Phase 7 |
| `await-release-approval` | Say who still has to approve the release PR and stop |
| `ship` | Phase 8 |
| `tag` | Phase 9 |
| `back-merge` | Phase 9, step 2 |
| `nothing-to-release` | Say so and stop |

A hotfix request starts at Phase 1 from `prod` (`references/merge-tag-rollback.md` → Hotfix).

## Phase 1: What is in this release

From `changes.toStaging`, list what users will notice, grouped as Added, Changed and Fixed, with
ticket ids. Read `references/changelog.md`, draft the `CHANGELOG.md` section and show it. The dev owns
the wording: change what they ask, then go on.

## Phase 2: Version

One `AskUserQuestion`: propose a version from the changes and `git.versions` of prod. A new
feature is minor (`1.4.0`), fixes only are a patch (`1.3.3`), and a breaking change for users or
the API is major. Offer *&lt;proposal&gt; (Recommended)* and the other two.

## Phase 3: Checklist on dev

On the head of `origin/dev`, before anything is pushed, run the seven gates as `/verify` does
(`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm build`,
`pnpm test:stories`, `pnpm test:pages`). Then check:

- **Environment variables**: every name in `.env.example` is set in the GitHub `staging` and
  `production` environments (names only: `gh variable list --env <env>`, `gh secret list --env <env>`,
  or the dev reads them from the repository settings).
- **What is not verified**: the "Not verified" lines of the merged pull requests, and this
  release's own gaps.

A red gate stops the release. Fix it on dev through its own pull request, then start again. If
the dev insists on going on, the stage PR shows the failure in its first line for the approver
to decide.

## Phase 4: The stage pull request (dev → stag)

Read `references/pull-requests.md`. Then:

1. Create `release/<version>` from `origin/dev`.
2. Change only `package.json` → `version` and `CHANGELOG.md`.
3. Commit in the project's format (`chore(release): <version>`).
4. Show the dev the branch, the commit and the PR body.
5. On their yes, push it and open the pull request into `stag` titled `Stage <version>`.
6. Request review from `setup.approvers`, when there are any.

Then **stop** and tell the dev that a release manager reviews and approves it on GitHub. They
come back (or run `/release` again) once it is approved.

**Changes after review**: code goes to dev through its own pull request, then cut
`release/<version>` again from dev. Notes or version go on `release/<version>` itself. Either
way the approval must be given again: the gate only accepts an approval on the head commit.

## Phase 5: Merge into stag

Run Phase 0 again. When `gate.decision` for the stage PR is `allow`, merge it with a merge commit
(`gh pr merge <n> --merge`, or the MCP server). On `deny`, relay the reason and stop. GitHub
Actions then deploys staging; follow the run until it finishes (`gh run watch`, or read
`staging.runs`). A failed deploy: read the log, fix it on dev, and start again from Phase 4.

## Phase 6: Check staging

Follow `references/staging-checks.md`:

1. Check the headers, `robots.txt`, the 404 page and the changed pages on the staging URL.
2. Walk through the smoke flow for the release's changes, with Claude in Chrome when it is there.
3. Ask the dev or QA to confirm what only a person can judge.

A failure is fixed on dev, then the release goes through Phase 4 again.

## Phase 7: The release pull request (stag → prod)

Open it only once staging has deployed the head of `stag` and Phase 6 has passed. Open a pull
request from `stag` into `prod` titled `Release <version>`. Write its body from
`references/pull-requests.md`, with the staging results. Request review and **stop**: a release
manager approves it on GitHub.

## Phase 8: Ship

Run Phase 0 again. When the release PR's gate says `allow`, merge it with a merge commit. GitHub
Actions deploys production. If the `production` environment has required reviewers, the run waits
for a person to approve the deployment on GitHub. Say so, and never approve it yourself. Follow
the run to the end (`references/merge-tag-rollback.md`). A failed deploy: production still runs the last good
release. Read the log and fix it on dev; the fix is a new version.

## Phase 9: Lock and hand off

1. **Tag** the merge commit on `prod` and push the tag: `git tag -a v<version> <sha> -m "Release <version>"`,
   then `git push origin v<version>`. The gate checks that the tag matches the approved release.
2. **Back-merge**: open a pull request from `prod` into `dev` titled `Back-merge <version>`, so
   that dev gets the version and the CHANGELOG. A person merges it.
3. **Hand off**, briefly:
   - what shipped (version, commit, links to the run and the deployment);
   - what is left to people (the back-merge, watching production);
   - how to roll back (`references/merge-tag-rollback.md` → Rolling back);
   - what was not verified, listed and not hidden.

## Principles

- **A person approves; the gate enforces; the skill prepares and carries out.** It never approves
  and never works around the gate.
- **One step at a time.** stag only after its approval, prod only after staging passed and a
  second approval.
- **Exactly the approved commit ships.** Anything added after an approval needs a new one.
- **One version, one commit.** The tag locks it; a fix is a new version.
- **Say what is left to people** and what was not checked.

## References

| File | Use |
|------|-----|
| `references/changelog.md` | Where the changes come from; the CHANGELOG section |
| `references/pull-requests.md` | Bodies of the stage, release and back-merge pull requests |
| `references/staging-checks.md` | Checks against staging, and what a person confirms |
| `references/merge-tag-rollback.md` | Merging, following the deploy, tagging, without gh, hotfix, rolling back |

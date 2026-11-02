# Settings on GitHub

The release gate stops mistakes in a Claude session. These settings stop everyone, so the flow
holds even without the gate. A repository admin turns them on in *Settings*. For each one, here
is what to set, why, and how to read it back.

## 1. Branch rulesets: `dev`, `stag`, `prod`

*Settings → Rules → Rulesets → New branch ruleset*, one ruleset per branch or one covering all
three. Set *Enforcement status* to Active.

| Rule | dev | stag | prod | Why |
|---|---|---|---|---|
| Restrict deletions | ✓ | ✓ | ✓ | The environment branch stays |
| Block force pushes | ✓ | ✓ | ✓ | What was approved stays in history |
| Require a pull request before merging | ✓ | ✓ | ✓ | No direct push, from people or Claude |
| Required approvals | 1 | 1 | 1 | |
| Dismiss stale pull request approvals when new commits are pushed | ✓ | ✓ | ✓ | An approval covers one commit |
| Require approval of the most recent reviewable push | ✓ | ✓ | ✓ | The person who pushed last cannot be the approver |
| Require review from Code Owners | | ✓ | ✓ | Release managers approve stag and prod (CODEOWNERS below) |
| Allowed merge methods | squash, merge | merge | merge | Merge commits keep dev, stag and prod comparable |
| Require status checks to pass | ✓ | ✓ | ✓ | The `gates` job of the deploy workflow on the pull request |

For the code-owner rule, add `.github/CODEOWNERS` on `stag` and `prod` that names the release
managers (`* @ni-ngo`). Leave *Bypass list* empty, or limit it to admins for emergencies.

Read back:

```bash
gh api repos/{owner}/{repo}/rulesets --jq '.[] | {id, name, target, enforcement}'
gh api repos/{owner}/{repo}/rulesets/<id> --jq '{conditions, rules: [.rules[].type]}'
```

## 2. Tag ruleset: `v*`

*New tag ruleset*, target `v*`, with *Restrict creations*, *Restrict updates* and *Restrict
deletions*. Put the release managers (or a team) on the *Bypass list*, so they are the only ones
who can create the tag.

The gate allows Claude to push `v<version>` only on the merge commit of an approved release. If
the dev who runs `/release` is not on the bypass list, GitHub refuses the push, and a release
manager creates the tag instead (`../release/references/merge-tag-rollback.md` → Without gh).

## 3. Environments

*Settings → Environments*: `development`, `staging`, `production`.

| Setting | development | staging | production |
|---|---|---|---|
| Deployment branches and tags | `dev` | `stag` | `prod` and tags `v*` |
| Required reviewers | none | none | the release managers, if chosen in Phase 1 |
| Prevent self-review | | | ✓ |
| Variables | `SITE_URL` and the public names from `.env.example` | same | same |
| Secrets | the secret names from `.env.example`, deploy keys | same | same |

A person enters the values: in the page, or `gh secret set <NAME> --env production` in their own
terminal, which prompts for the value. Claude never sees or types them.

Read back (names only):

```bash
gh api repos/{owner}/{repo}/environments --jq '.environments[] | {name, rules: [.protection_rules[].type]}'
gh variable list --env production
gh secret list --env production
```

Compare the names with `.env.example`, and list any that are missing per environment.

## 4. Repository

- *General → Pull Requests*: allow merge commits, which `stag` and `prod` need.
- *Actions → General → Workflow permissions*: read repository contents. The workflow asks for more
  itself when it needs it (`packages: write` for a registry).

## What the gate and GitHub each stop

| Risk | Release gate (Claude session) | GitHub (everyone) |
|---|---|---|
| Approving one's own release | always denies approving | author and last pusher cannot approve; code owners |
| Merging before approval, or after a new commit | denies | required approval, stale approvals dismissed |
| prod before staging | denies a PR into prod not from stag, or before staging deployed | `prod` accepts pull requests only; reviewers check the staging line |
| A tag on the wrong commit | denies | tag ruleset |
| Deploying production by hand | denies the listed commands; asks before a dispatch | environment branch rules and reviewers |
| A push straight to dev, stag or prod | the guard rules' `deny` in `.claude/settings.json` | branch rulesets |
| Clicking Approve in a browser | cannot see it | all of the above |

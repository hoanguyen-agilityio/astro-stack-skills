# Merging, deploying, tagging, rolling back

Every merge into `stag` or `prod`, every `v*` tag and every deploy outside a release passes
through the release gate. When it denies, relay its reason and stop. Never retry another way
(`--admin`, auto-merge, a direct push, another tag, a deploy command).

## Merging

```bash
gh pr merge <number> --merge
```

Use a merge commit, not a squash or a rebase, so that dev, stag and prod keep the same commits
and `git log origin/prod..origin/stag` stays meaningful. With the MCP server, use
`merge_pull_request` with `merge_method: merge`.

## Following the deploy

```bash
gh run list --workflow deploy.yml --branch <stag|prod> --limit 3
gh run watch <run id> --exit-status
```

- When the run waits on the `production` environment ("Waiting for review"), a person approves it
  on GitHub. Tell the dev who can, and never approve it yourself.
- A failed run: read why (`gh run view <id> --log-failed`) and report it. The environment still
  runs its previous deploy. Fix it on dev; a fix to production is a new version.

## Lock the version

Right after production deployed, on the merge commit of the release pull request:

```bash
git fetch origin
git tag -a v<version> <merge sha> -m "Release <version>"
git push origin v<version>
```

The gate allows the tag only when it is that merge commit, the pull request's title has the
same version, it was approved on its head, and `package.json` there says that version. Push the
tag by name, never `--tags`.

## Without gh

The gate cannot read approvals, so it denies the merges and the tag push. The dev, or the release
manager, does those steps on GitHub, and you give them exactly what to do:

- **Merge**: open `<pull request url>`, check that the approval is on the latest commit, and
  choose *Create a merge commit*.
- **Tag**: open the repository's *Releases* page, click *Draft a new release*, create the tag
  `v<version>` on target `prod`, use the CHANGELOG section as the notes, and publish it.

Then run `/release` again to carry on.

## Hotfix

An urgent fix for production follows the same steps, from `prod` instead of dev:

1. Create `hotfix/<version>` from `origin/prod`, where the version is a patch.
2. Put the fix in it, plus the version and the CHANGELOG change. Run the gates.
3. Open a pull request into `stag` titled `Stage <version>`, and merge it after approval.
4. Check staging.
5. Open `Release <version>` from `stag` into `prod`, and merge it after approval.
6. Tag the release.
7. Back-merge `prod` into dev.

If `stag` already holds a release under test, the dev decides with the release manager. Either
the hotfix waits, or that release is finished first. Do not mix them.

## Rolling back

State these in the hand-off. Run them only when the dev asks; the gate asks the person each time.

- **Redeploy the previous release**: `gh workflow run deploy.yml --ref v<previous> -f environment=production`.
  This puts back the code of the last good tag. It goes through the `production` environment's
  reviewers.
- **Revert**: a pull request into dev that reverts the change, then a new patch release through
  this skill. Use it when the problem must stay fixed.

A database migration or a change to an external API may not roll back by redeploying. Say so
when the release has one.

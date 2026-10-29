---
name: release-setup
description: Sets up a project once for releases from dev to stag to prod on GitHub. It creates the environment branches and a GitHub Actions workflow that runs the gates and deploys each branch to its environment, with production waiting for approval. It writes the .claude/release.json the release gate reads and a CHANGELOG, plus docs/release-plan.md and a checklist of the GitHub rulesets and environments a person turns on. Use it when someone wants to set up releases, staging, deploys, environments, GitHub Actions for deploy, or the release gate, or before the first /release.
argument-hint: "[where it deploys, URLs, release managers]"
disable-model-invocation: true
---

# Release setup: dev → stag → prod on GitHub

Goal: when it is done, a push to `dev`, `stag` or `prod` deploys that branch to its environment
through GitHub Actions. Only pull requests change those branches, and approvals guard `stag` and
`prod`. The release gate knows the branches and the release managers. `docs/release-plan.md`
says what is set up, what a person still has to turn on, and how to release (`/release`).

Talk to the dev in their language. The text after `/release-setup` is their request: use what it
gives (host, URLs, names) and ask only for what it leaves out.

**Secrets never pass through the conversation.** Never open `.env`. Staging and production
values go into the GitHub environments, where the dev or an admin enters them (`gh secret set
<NAME> --env <env>` prompts for the value in their own terminal). Here you handle names only.

**Settings on GitHub are a person's.** Rulesets, environments, reviewers and secrets belong to
the repository's admins. Give them the checklist (`references/github-setup.md`), and read back
what you can to confirm it. Change a setting only when the dev asks you to and `gh` is signed in
as an admin, and show each command before you run it.

## Phase 0: Inventory

```bash
node "<skill-dir>/../release/scripts/release-status.mjs" <project-dir>
```

Read `setup`: the branches on origin, the deploy workflow, `.claude/release.json`, `CHANGELOG.md`,
`docs/release-plan.md`, whether the release gate is registered, and `gh`. Then read
`package.json` (the Astro adapter, the `build` and any `deploy` scripts), `astro.config.*` and
any existing `.github/workflows/`.

- **`docs/release-plan.md` exists**: this is a follow-up run, such as a new host, a new approver
  or a new environment. Read the plan, confirm what changed, and do only that part.
- **A deploy workflow already exists**: adapt it to the three branches. Never replace it without
  the dev's yes, and keep its deploy steps.
- **Not on GitHub** (`git remote get-url origin` is not github.com): stop and say so. The gate
  and this flow read GitHub pull requests.

## Phase 1: Questions

One `AskUserQuestion` round, at most four questions:

- **Where it deploys**: the host and how to deploy (a VPS over SSH, Docker to a registry, a
  platform CLI). Offer what `package.json` and the adapter suggest (`@astrojs/node` standalone →
  *Docker image (Recommended)* / *Node on a server over SSH*), or *Not decided yet: leave a
  placeholder step*.
- **URLs** for staging and production, or *later*.
- **Release managers**: the GitHub usernames who approve the pull requests into `stag` and
  `prod`. The same people approve both. Offer *Anyone but the author (Recommended to start)* or
  *These people: …*.
- **Deployment approval**: should the `production` environment also wait for a reviewer before
  each deploy? Offer *Yes, the same release managers (Recommended)* or *No, the pull request
  approval is enough*.

## Phase 2: Plan, then the dev's approval

Write `docs/release-plan.md` from `references/plan-template.md`. It covers:

- branches and environments, with the URLs;
- the workflow and its deploy step;
- the variables per environment (names from `.env.example`);
- the release managers;
- the GitHub checklist with each item's status;
- what is left to a person.

Ask: "Set up releases from this plan?" Offer *Yes (Recommended)* or *Change something*. Nothing
changes before a yes.

## Phase 3: Files in the repository

1. **`.github/workflows/deploy.yml`** from `references/workflow.md`, with the deploy step for the
   host chosen in Phase 1. Leave it as a failing placeholder when the host is not decided.
2. **`.claude/release.json`**:

   ```json
   {
     "branches": { "development": "dev", "staging": "stag", "production": "prod" },
     "urls": { "staging": "https://stag.example.com", "production": "https://example.com" },
     "releaseBranchPrefix": "release/",
     "hotfixBranchPrefix": "hotfix/",
     "workflow": "deploy.yml",
     "deployCommands": {},
     "approvers": []
   }
   ```

   `deployCommands` lists any script that deploys by hand (`{ "production": ["pnpm deploy:prod"] }`).
   The gate denies the production ones and asks before the staging ones.
3. **`CHANGELOG.md`** if it is missing: `# Changelog`, then `All notable changes to this app.`
4. **The release gate**: when `setup.gateRegistered` is false, the project was installed before
   the gate existed. Run the installer's `update` (`npx git+ssh://…/astro-stack-skills.git update`),
   which copies `hooks/release-gate.mjs` and registers it.
5. **Branches**: for each of `dev`, `stag` and `prod` missing on origin, ask before creating it.
   Create it from the default branch (`main`) on GitHub, with the dev's yes:
   `gh api repos/{owner}/{repo}/git/refs -f ref=refs/heads/<branch> -f sha=<sha of main>`.
   `protect-branches` blocks `git push` to them, and that is intended.

Run the seven gates the project has (`/verify`), since the workflow runs the same ones.

## Phase 4: Settings on GitHub

Read `references/github-setup.md` and go through it with the dev:

- branch rulesets on `dev`, `stag` and `prod`;
- the tag ruleset on `v*`;
- the environments `development`, `staging` and `production`, with their variables, secrets and
  reviewers.

For each item, read back what you can (`gh api repos/{owner}/{repo}/rulesets`,
`gh api repos/{owner}/{repo}/environments`) and mark it in the plan as done, for the dev, or for
an admin.

## Phase 5: Check and hand off

1. **Prove the workflow**: offer *Open a small pull request into dev and watch it deploy
   development (Recommended)* or *Leave it for the first release*. A workflow that never ran is
   reported as "set up, not proven by a run".
2. Update `docs/release-plan.md`, and tell the dev briefly:
   - what is set up;
   - what is left on GitHub, and who does it;
   - that releases go through `/release`, whose gate requires these settings.
3. Offer to commit on a branch (`chore(release): set up dev, stag and prod releases`) and to open
   a pull request into dev. Never commit without a yes.

## Principles

- **The pipeline deploys; people approve; Claude prepares.** No deploy from a laptop and no
  approval from this session.
- **Settings and secrets belong to people.** Checklists and read-back, never values in the chat.
- **Present is not proven.** Offer a real run, and say plainly when there was none.

## References

| File | Use |
|------|-----|
| `references/plan-template.md` | `docs/release-plan.md` |
| `references/workflow.md` | `.github/workflows/deploy.yml` and the deploy steps per host |
| `references/github-setup.md` | Rulesets, environments, reviewers: what to turn on and how to read it back |

# The deploy workflow

`.github/workflows/deploy.yml`: a pull request into `dev`, `stag` or `prod` runs the seven gates
(the required status check). A push to one of them, which only a merged pull request can make,
runs the gates again on the merge commit, builds and deploys to the matching environment. Pushes come only from merged pull requests (the
rulesets block the rest). `workflow_dispatch` re-deploys a ref to an environment: a re-run or a
rollback, which the release gate asks about.

```yaml
name: deploy

on:
  pull_request:
    branches: [dev, stag, prod]
  push:
    branches: [dev, stag, prod]
  workflow_dispatch:
    inputs:
      environment:
        description: Where to deploy the chosen ref
        type: choice
        options: [development, staging, production]
        required: true

concurrency:
  group: deploy-${{ inputs.environment || github.ref_name }}
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test:coverage
      - run: pnpm build
      - run: pnpm test:stories
      - run: pnpm test:pages

  deploy:
    needs: gates
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    environment:
      name: >-
        ${{ inputs.environment
          || (github.ref_name == 'prod' && 'production')
          || (github.ref_name == 'stag' && 'staging')
          || 'development' }}
      url: ${{ vars.SITE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Build with this environment's variables
        run: pnpm build
        env:
          PUBLIC_API_URL: ${{ vars.PUBLIC_API_URL }}
          # One line per name in .env.example: vars.<NAME> for public values,
          # secrets.<NAME> for secret ones.
      - name: Deploy
        run: |
          echo "No deploy step yet: release-setup Phase 1 picks the host." >&2
          exit 1
```

- The release gate reads the `push` runs of this workflow on `stag` to know that staging deployed a
  commit, so keep the deploy in this workflow and its name in `.claude/release.json` → `workflow`.
- The branch names come from `.claude/release.json`. When they differ, change `on.push.branches`
  and the `environment.name` expression together.
- The `production` environment allows only `prod` and `v*` tags (`references/github-setup.md`),
  so a dispatch of another ref to production fails on GitHub, not just in the gate.
- `pnpm/action-setup` reads the pnpm version from `packageManager` in `package.json`.
- `test:stories` and `test:pages` need Chromium; the install step provides it.
- Keep the gates job even though pull requests run the same gates: the commit that deploys is
  the merge commit, which no pull request run has tested.

## Deploy steps per host

Replace the placeholder `Deploy` step with the one for the host. Values in `${{ secrets.* }}`
are set on the environment by a person.

**Docker image to a registry, pulled by the server** (`@astrojs/node` standalone):

```yaml
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
      - name: Roll out
        run: ssh -o StrictHostKeyChecking=accept-new "${{ vars.DEPLOY_HOST }}" "deploy ${{ github.sha }}"
```

This job also needs `permissions: packages: write`, and an SSH key loaded into an agent first
(for example `webfactory/ssh-agent` with `secrets.DEPLOY_SSH_KEY`). The `deploy` command on the
server is the team's own script.

**Node on a server over SSH** (`dist/` copied, then restarted):

```yaml
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.DEPLOY_SSH_KEY }}
      - run: rsync -az --delete dist/ package.json pnpm-lock.yaml "${{ vars.DEPLOY_HOST }}:${{ vars.DEPLOY_PATH }}/"
      - run: ssh "${{ vars.DEPLOY_HOST }}" "cd ${{ vars.DEPLOY_PATH }} && pnpm install --prod --frozen-lockfile && sudo systemctl restart ${{ vars.SERVICE_NAME }}"
```

**A platform CLI** (Vercel, Netlify, Fly, Render…): use the platform's documented GitHub Action
or CLI command with its token in `secrets`, one project or app per environment. Check the current
docs for the exact action and version; do not guess.

Ask before adding a third-party action that the project does not use yet, as with any dependency.

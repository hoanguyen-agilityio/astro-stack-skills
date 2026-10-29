#!/usr/bin/env node
// Where the release stands, dev → stag → prod. Read-only (it fetches origin unless --no-fetch).
// Prints JSON.
//
// Usage: node release-status.mjs [project-dir] [--no-fetch]
//
// Reports:
//   setup     .claude/release.json (or the defaults), the deploy workflow, CHANGELOG.md,
//             docs/deploy-plan.md, whether the release gate is registered, and what is missing
//   gh        whether the GitHub CLI is installed and signed in (optional: without it the gate
//             denies the steps that need an approval, and a person does them on GitHub)
//   git       current branch, clean or not, the head of origin/<branch> for each environment, the
//             last v* tag, and package.json's version on each branch
//   changes   commits on dev not yet on stag, and on stag not yet on prod (subject, ticket ids)
//   prs       open pull requests into stag and prod, who approved them on their head commit,
//             and the release pull requests merged into prod (with gh)
//   staging   the last deploy runs on stag (with gh)
//   gate      what the release gate says right now about merging each open pull request
//   next      the step /release takes next
// Never opens .env files.
//
// Exit codes: 0 done · 1 error · 3 not set up (no environment branches or no deploy workflow:
// run /deploy-setup first)

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const dir = resolve(args.find((arg) => !arg.startsWith('-')) ?? '.');
const fetch = !args.includes('--no-fetch');
const GATE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'hooks',
  'release-gate.mjs',
);

const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};
const run = (command, commandArgs, timeout = 20000) => {
  try {
    return execFileSync(command, commandArgs, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout,
    }).trim();
  } catch {
    return null;
  }
};
const lines = (text) => (text ?? '').split('\n').filter(Boolean);

if (!existsSync(join(dir, 'package.json'))) {
  console.log(JSON.stringify({ error: `no package.json in ${dir}` }));
  process.exit(1);
}

// ---------------------------------------------------------------- setup

const configPath = join(dir, '.claude', 'release.json');
const fileConfig = existsSync(configPath) ? readJson(readFileSync(configPath, 'utf8'), null) : {};
const config = {
  branches: { development: 'dev', staging: 'stag', production: 'prod' },
  releaseBranchPrefix: 'release/',
  hotfixBranchPrefix: 'hotfix/',
  workflow: 'deploy.yml',
  approvers: [],
  ...fileConfig,
};
config.branches = {
  development: 'dev',
  staging: 'stag',
  production: 'prod',
  ...fileConfig?.branches,
};
const { development: DEV, staging: STAG, production: PROD } = config.branches;

const settings = ['settings.json', 'settings.local.json']
  .map((file) => join(dir, '.claude', file))
  .filter(existsSync)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

if (fetch) run('git', ['fetch', '--quiet', '--tags', 'origin'], 60000);

const head = (branch) => run('git', ['rev-parse', '-q', '--verify', `origin/${branch}`]);
const heads = { [DEV]: head(DEV), [STAG]: head(STAG), [PROD]: head(PROD) };

const setup = {
  config: existsSync(configPath) ? (fileConfig ? 'ok' : 'invalid JSON') : 'missing (defaults used)',
  branches: config.branches,
  workflow: existsSync(join(dir, '.github', 'workflows', config.workflow))
    ? `.github/workflows/${config.workflow}`
    : null,
  changelog: existsSync(join(dir, 'CHANGELOG.md')),
  plan: existsSync(join(dir, 'docs', 'deploy-plan.md')),
  gateRegistered: /release-gate\.mjs|web-dev-stack@/.test(settings),
  approvers: config.approvers,
  urls: config.urls ?? {},
};
setup.missing = [
  ...Object.entries(heads)
    .filter(([, sha]) => !sha)
    .map(([branch]) => `branch ${branch} on origin`),
  ...(setup.workflow ? [] : [`.github/workflows/${config.workflow}`]),
  ...(existsSync(configPath) ? [] : ['.claude/release.json']),
  ...(setup.gateRegistered ? [] : ['release-gate hook in .claude/settings.json']),
];

// ---------------------------------------------------------------- git

const versionOn = (ref) =>
  readJson(run('git', ['show', `${ref}:package.json`]) ?? '{}', {}).version ?? null;
const lastTag = run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*', `origin/${PROD}`]);
const git = {
  branch: run('git', ['branch', '--show-current']),
  clean: run('git', ['status', '--porcelain', '--untracked-files=no']) === '',
  heads: Object.fromEntries(Object.entries(heads).map(([b, sha]) => [b, sha?.slice(0, 7) ?? null])),
  versions: Object.fromEntries(
    Object.keys(heads).map((branch) => [
      branch,
      heads[branch] ? versionOn(`origin/${branch}`) : null,
    ]),
  ),
  lastTag: lastTag
    ? { name: lastTag, date: run('git', ['log', '-1', '--format=%cs', lastTag]) }
    : null,
};

const TICKET = /\b[A-Z][A-Z0-9]+-\d+\b|#\d+/g;
const commitsBetween = (from, to) =>
  heads[from] && heads[to]
    ? lines(
        run('git', [
          'log',
          '--no-merges',
          '--format=%h%x09%s%x09%an',
          `origin/${from}..origin/${to}`,
        ]),
      ).map((line) => {
        const [sha, subject, author] = line.split('\t');
        return { sha, subject, author, tickets: [...new Set(subject.match(TICKET) ?? [])] };
      })
    : [];
const changes = { toStaging: commitsBetween(STAG, DEV), toProduction: commitsBetween(PROD, STAG) };

// ---------------------------------------------------------------- GitHub

const ghInstalled = run('gh', ['--version']) !== null;
const gh = {
  installed: ghInstalled,
  signedIn:
    ghInstalled && spawnSync('gh', ['auth', 'status'], { cwd: dir, stdio: 'ignore' }).status === 0,
};
const ghJson = (ghArgs) => (gh.signedIn ? readJson(run('gh', ghArgs) ?? 'null', null) : null);

const PR_FIELDS = 'number,url,title,baseRefName,headRefName,headRefOid,author,reviews';
const isBot = (login = '') => /\[bot\]$|^app\/|copilot/i.test(login);
const approvedBy = (pr) => {
  const latest = new Map();
  for (const review of pr.reviews ?? []) {
    const login = review.author?.login;
    if (!login || isBot(login) || login === pr.author?.login) continue;
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state))
      latest.set(login, review);
  }
  const reviews = [...latest.values()];
  return {
    approvedBy: reviews
      .filter((r) => r.state === 'APPROVED' && r.commit?.oid === pr.headRefOid)
      .map((r) => r.author.login),
    changesRequestedBy: reviews
      .filter((r) => r.state === 'CHANGES_REQUESTED')
      .map((r) => r.author.login),
  };
};

// What the release gate would say about merging this pull request now.
const gateSays = (number) => {
  if (!existsSync(GATE)) return null;
  const result = spawnSync(process.execPath, [GATE], {
    cwd: dir,
    input: JSON.stringify({
      tool_name: 'Bash',
      cwd: dir,
      tool_input: { command: `gh pr merge ${number} --merge` },
    }),
    encoding: 'utf8',
  });
  if (result.stdout.trim() === '') return { decision: 'allow' };
  const out = readJson(result.stdout, {}).hookSpecificOutput ?? {};
  return { decision: out.permissionDecision, reason: out.permissionDecisionReason };
};

const openPrs = [STAG, PROD].flatMap((base) =>
  (ghJson(['pr', 'list', '--state', 'open', '--base', base, '--json', PR_FIELDS]) ?? []).map(
    (pr) => ({
      number: pr.number,
      url: pr.url,
      title: pr.title,
      base: pr.baseRefName,
      head: pr.headRefName,
      headSha: pr.headRefOid.slice(0, 7),
      ...approvedBy(pr),
      gate: gateSays(pr.number),
    }),
  ),
);
const mergedReleases = (
  ghJson([
    'pr',
    'list',
    '--state',
    'merged',
    '--base',
    PROD,
    '--limit',
    '10',
    '--json',
    'number,url,title,mergeCommit,mergedAt',
  ]) ?? []
).map((pr) => ({
  number: pr.number,
  url: pr.url,
  title: pr.title,
  mergeCommit: pr.mergeCommit?.oid?.slice(0, 7) ?? null,
  mergedAt: pr.mergedAt,
}));
const stagingRuns = (
  ghJson([
    'run',
    'list',
    '--workflow',
    config.workflow,
    '--branch',
    STAG,
    '--event',
    'push',
    '--limit',
    '5',
    '--json',
    'headSha,status,conclusion,url,createdAt',
  ]) ?? []
).map((r) => ({ ...r, headSha: r.headSha.slice(0, 7) }));

// ---------------------------------------------------------------- next step

const stagePr = openPrs.find((pr) => pr.base === STAG);
const releasePr = openPrs.find((pr) => pr.base === PROD);
const latestRelease = mergedReleases[0];
const releasedVersion = /^Release (\S+)$/.exec(latestRelease?.title ?? '')?.[1];
const next = (() => {
  if (setup.missing.some((item) => item.startsWith('branch') || item.startsWith('.github')))
    return 'setup';
  if (releasedVersion && !lines(run('git', ['tag', '--list', `v${releasedVersion}`])).length) {
    return 'tag'; // a release reached prod but its version is not locked yet
  }
  if (releasePr) return releasePr.gate?.decision === 'allow' ? 'ship' : 'await-release-approval';
  if (stagePr) return stagePr.gate?.decision === 'allow' ? 'merge-stage' : 'await-stage-approval';
  if (changes.toProduction.length > 0) return 'check-staging-then-open-release';
  if (changes.toStaging.length > 0) return 'stage';
  if (git.versions[DEV] !== git.versions[PROD]) return 'back-merge';
  return 'nothing-to-release';
})();

console.log(
  JSON.stringify(
    {
      setup,
      gh,
      git,
      changes,
      prs: { open: openPrs, mergedReleases },
      staging: { runs: stagingRuns },
      next,
    },
    null,
    2,
  ),
);
process.exit(next === 'setup' ? 3 : 0);

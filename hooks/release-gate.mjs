#!/usr/bin/env node
// PreToolUse hook: the release gate for code that moves dev → stag → prod.
//
// Each branch deploys to its own environment (dev → development, stag → staging, prod →
// production), and code moves up only through a pull request a release manager approved:
//
//   merge into dev                                  allow (normal code review)
//   merge into stag                                 deny unless the release/<version> (or
//                                                   hotfix/<version>) PR is approved on its head
//   merge into prod                                 deny unless the "Release <version>" PR from
//                                                   stag is approved on its head, staging deployed
//                                                   that commit, and v<version> is not taken
//   push a v* tag, gh release create                deny unless it marks the merge commit of an
//                                                   approved release PR with the same version
//   deleting a v* tag, pushing every tag            deny
//   a PR into prod from anything but stag           deny
//   approving a PR or a deployment                  always deny: that is a person's decision
//   re-running or dispatching a deploy              ask the person running the session
//   auto-merge or --admin into stag or prod         deny: it merges after, or around, the gate
//
// It reads Bash commands (git, gh, the deploy commands in .claude/release.json) and the GitHub
// MCP tools. Approvals come from GitHub through `gh`; when `gh` is missing or signed out, a step
// that needs one is denied and a person does it on GitHub instead. An approval counts when it is
// on the PR's head commit, from someone other than its author (and in `approvers`, when set),
// with no change request left. Like the other hooks, it stops mistakes in this session; the real
// protection is the rulesets and environments on GitHub (`release-setup` lists them).
// The answer is printed as JSON (`permissionDecision`), so it can ask as well as deny.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const DEFAULTS = {
  branches: { development: 'dev', staging: 'stag', production: 'prod' },
  releaseBranchPrefix: 'release/',
  hotfixBranchPrefix: 'hotfix/',
  workflow: 'deploy.yml',
  deployCommands: {},
  approvers: [],
};
const RELEASE_TITLE = /^Release (\d+\.\d+\.\d+)$/;
const PR_FIELDS = 'number,url,state,title,baseRefName,headRefName,headRefOid,author,reviews';

const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

// ---------------------------------------------------------------- verdict

const RANK = { allow: 0, ask: 1, deny: 2 };
let verdict = { decision: 'allow', reason: '' };
const decide = (decision, reason) => {
  if (RANK[decision] > RANK[verdict.decision]) verdict = { decision, reason };
};

// ---------------------------------------------------------------- context

const input = readJson(readFileSync(0, 'utf8'), {});
const root = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const fileConfig = readJson(
  existsSync(join(root, '.claude', 'release.json'))
    ? readFileSync(join(root, '.claude', 'release.json'), 'utf8')
    : '{}',
  {},
);
const config = {
  ...DEFAULTS,
  ...fileConfig,
  branches: { ...DEFAULTS.branches, ...fileConfig.branches },
};
const { development: DEV, staging: STAG, production: PROD } = config.branches;
const ENVIRONMENT_OF = { [DEV]: 'development', [STAG]: 'staging', [PROD]: 'production' };

const run = (command, args, timeout = 15000) => {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout,
    }).trim();
  } catch {
    return null;
  }
};
const ghJson = (args) => {
  const out = run('gh', args, 20000);
  return out === null ? null : readJson(out, null);
};

const approversText = () =>
  config.approvers.length > 0 ? config.approvers.join(', ') : 'a release manager';
const ROUTE =
  'Run /release: it opens the pull request and stops. Once ' +
  `${approversText()} approves it on GitHub, run the step again. Never approve it from this session.`;
const NO_GH =
  "Can't check the approval: the GitHub CLI is not installed or not signed in (`gh auth status`). " +
  'A person does this step on GitHub, or signs in with `gh auth login` themselves and runs it again.';

// ---------------------------------------------------------------- approvals

const isBot = (login = '') => /\[bot\]$|^app\/|copilot/i.test(login);

// Logins whose approval on the PR's head commit counts; empty when a change request is left.
const approvedBy = (pr) => {
  const latest = new Map();
  for (const review of pr.reviews ?? []) {
    const login = review.author?.login;
    if (!login || isBot(login) || login === pr.author?.login) continue;
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    latest.set(login, review);
  }
  const reviews = [...latest.values()];
  if (reviews.some((review) => review.state === 'CHANGES_REQUESTED')) return [];
  return reviews
    .filter(
      (review) =>
        review.state === 'APPROVED' &&
        review.commit?.oid === pr.headRefOid &&
        (config.approvers.length === 0 || config.approvers.includes(review.author.login)),
    )
    .map((review) => review.author.login);
};

const notApproved = (pr) =>
  `${pr.url} has no approval on its head commit ${pr.headRefOid.slice(0, 7)} from ` +
  `${config.approvers.length > 0 ? config.approvers.join(', ') : 'someone other than its author'}` +
  ' (a commit pushed after an approval needs a new one, and a change request blocks it). ' +
  ROUTE;

// The commit a tag points at, here or on origin; null when the tag does not exist.
const tagCommit = (tag) =>
  run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`]) ||
  (
    run(
      'git',
      ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
      10000,
    ) ?? ''
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .pop() ||
  null;

const versionAt = (sha) =>
  readJson(run('git', ['show', `${sha}:package.json`]) ?? '{}', {}).version ?? null;

// Did the deploy workflow finish green on staging for this commit? null when it cannot tell.
const stagingDeployed = (sha) => {
  const runs = ghJson([
    'run',
    'list',
    '--workflow',
    config.workflow,
    '--branch',
    STAG,
    '--event',
    'push',
    '--limit',
    '30',
    '--json',
    'headSha,status,conclusion,url',
  ]);
  if (!Array.isArray(runs)) return null;
  return runs.some((r) => r.headSha === sha && r.conclusion === 'success');
};

// ---------------------------------------------------------------- the rules

const checkMerge = (pr, { auto = false, admin = false } = {}) => {
  if (!pr) {
    decide('deny', `Can't read the pull request to merge. ${NO_GH}`);
    return;
  }
  const base = pr.baseRefName;
  if (base !== STAG && base !== PROD) return; // dev and feature branches: normal code review
  if (auto || admin) {
    decide(
      'deny',
      `${auto ? 'Auto-merge merges later, after this check has run' : '--admin skips the branch rules'}; ` +
        `a merge into ${base} goes through the release gate now. Merge it without that flag once it is approved.`,
    );
    return;
  }
  if (approvedBy(pr).length === 0) {
    decide('deny', `Merging into ${base} deploys to ${ENVIRONMENT_OF[base]}. ${notApproved(pr)}`);
    return;
  }
  if (base === STAG) {
    const prefixes = [config.releaseBranchPrefix, config.hotfixBranchPrefix];
    if (!prefixes.some((prefix) => pr.headRefName.startsWith(prefix))) {
      decide(
        'deny',
        `${STAG} takes ${config.releaseBranchPrefix}<version> or ${config.hotfixBranchPrefix}<version> ` +
          `branches only, not ${pr.headRefName}. ${ROUTE}`,
      );
    }
    return;
  }
  // base === PROD
  const version = RELEASE_TITLE.exec(pr.title ?? '')?.[1];
  if (pr.headRefName !== STAG || !version) {
    decide(
      'deny',
      `A merge into ${PROD} must be the "Release <version>" pull request from ${STAG}; ` +
        `${pr.url} is "${pr.title}" from ${pr.headRefName}. ${ROUTE}`,
    );
    return;
  }
  const tagged = tagCommit(`v${version}`);
  if (tagged) {
    decide(
      'deny',
      `v${version} was already released (${tagged.slice(0, 7)}). A new release needs a new version.`,
    );
    return;
  }
  const deployed = stagingDeployed(pr.headRefOid);
  if (deployed === false) {
    decide(
      'deny',
      `Staging has not deployed ${pr.headRefOid.slice(0, 7)} successfully (workflow ${config.workflow} ` +
        `on ${STAG}). Wait for the deploy, check staging, then merge.`,
    );
  } else if (deployed === null) {
    decide(
      'ask',
      `Can't read the ${config.workflow} runs on ${STAG}. Merge into ${PROD} only if staging deployed ` +
        `${pr.headRefOid.slice(0, 7)} and was checked.`,
    );
  }
  verdict.reason ||= `${pr.url} approved by ${approvedBy(pr).join(', ')}`;
};

const checkReleasePullRequest = (base, head) => {
  if (base !== PROD) return;
  if (head !== STAG) {
    decide(
      'deny',
      `Code reaches ${PROD} only from ${STAG}, after staging, so a pull request into ${PROD} comes ` +
        `from ${STAG}, not ${head}. A hotfix goes into ${STAG} first.`,
    );
    return;
  }
  const sha = run('git', ['rev-parse', '-q', '--verify', `origin/${STAG}`]);
  const deployed = sha ? stagingDeployed(sha) : null;
  if (deployed === false) {
    decide(
      'deny',
      `Staging has not deployed ${STAG} (${sha.slice(0, 7)}) yet. Wait for the deploy and check it first.`,
    );
  }
};

const checkTag = (name) => {
  const version = name.slice(1);
  const sha = tagCommit(name);
  if (!sha) return; // nothing to push
  const prs = ghJson([
    'pr',
    'list',
    '--state',
    'merged',
    '--base',
    PROD,
    '--limit',
    '50',
    '--json',
    `${PR_FIELDS},mergeCommit`,
  ]);
  if (!Array.isArray(prs)) {
    decide('deny', `${name} marks a production release. ${NO_GH}`);
    return;
  }
  const pr = prs.find((p) => p.mergeCommit?.oid === sha);
  if (!pr) {
    decide(
      'deny',
      `${name} points at ${sha.slice(0, 7)}, which is not the merge commit of a release pull request ` +
        `into ${PROD}. Tag the merge commit of the approved "Release ${version}" pull request.`,
    );
    return;
  }
  if (RELEASE_TITLE.exec(pr.title ?? '')?.[1] !== version) {
    decide(
      'deny',
      `${name} does not match ${pr.url} ("${pr.title}"). Tag it with that release's version.`,
    );
    return;
  }
  if (approvedBy(pr).length === 0) {
    decide('deny', `${name}: ${notApproved(pr)}`);
    return;
  }
  const packageVersion = versionAt(sha);
  if (packageVersion !== version) {
    decide('deny', `package.json at ${sha.slice(0, 7)} says ${packageVersion}, not ${version}.`);
  }
};

const APPROVE_REASON =
  "Approving is a person's decision: this session never approves a pull request or a deployment. " +
  `Ask ${approversText()} to do it on GitHub.`;

// ---------------------------------------------------------------- Bash

// The words of each simple command, split on ; & | ( ) and newlines, with quotes honoured.
const commandsOf = (line) => {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (';&|()\n'.includes(char)) {
      endCommand();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  return commands;
};

// Drops `VAR=value` and `env` before the command.
const withoutEnv = (words) => {
  let i = 0;
  while (words[i] === 'env' || /^\w+=/.test(words[i] ?? '')) i += 1;
  return words.slice(i);
};

const valueOf = (args, ...names) => {
  for (let i = 0; i < args.length; i += 1) {
    for (const name of names) {
      if (args[i] === name) return args[i + 1];
      if (args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
    }
  }
  return undefined;
};
const has = (args, ...names) => args.some((arg) => names.includes(arg));

const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const PUSH_OPTIONS_WITH_VALUE = new Set([
  '--repo',
  '--receive-pack',
  '--exec',
  '-o',
  '--push-option',
]);

const checkGitPush = (args) => {
  if (has(args, '--tags', '--follow-tags', '--mirror')) {
    if ((run('git', ['tag', '--list', 'v*']) ?? '') !== '') {
      decide(
        'deny',
        'Pushing every tag could publish a release tag that was never approved. Push the release tag ' +
          'by name (`git push origin v<version>`), as /release does.',
      );
    }
    return;
  }
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (PUSH_OPTIONS_WITH_VALUE.has(args[i])) i += 1;
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const deleting = has(args, '-d', '--delete');
  for (const ref of positional.slice(1)) {
    const name = ref
      .replace(/^\+/, '')
      .split(':')
      .pop()
      .replace(/^refs\/tags\//, '');
    if (!/^v\d/.test(name)) continue;
    if (deleting || ref.startsWith(':')) {
      decide(
        'deny',
        `Deleting ${name} would let that version ship again from another commit. A person decides that on GitHub.`,
      );
    } else if (ref.includes('refs/tags/') || tagCommit(name)) {
      checkTag(name);
    }
  }
};

const GH_PR_OPTIONS_WITH_VALUE = new Set([
  '-R',
  '--repo',
  '-t',
  '--subject',
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-A',
  '--author-email',
  '--match-head-commit',
]);

const checkGh = (args) => {
  const [group, action] = args;
  const rest = args.slice(2);
  const repo = valueOf(args, '-R', '--repo');
  const repoArgs = repo ? ['-R', repo] : [];

  if (group === 'pr' && action === 'review' && has(rest, '--approve', '-a'))
    decide('deny', APPROVE_REASON);
  if (group === 'api') {
    if (args.some((arg) => /\/reviews\b/.test(arg)) && args.some((arg) => /APPROVE/.test(arg))) {
      decide('deny', APPROVE_REASON);
    }
    if (args.some((arg) => /pending_deployments/.test(arg))) decide('deny', APPROVE_REASON);
  }

  if (group === 'pr' && action === 'merge') {
    const positional = [];
    for (let i = 0; i < rest.length; i += 1) {
      if (GH_PR_OPTIONS_WITH_VALUE.has(rest[i])) i += 1;
      else if (!rest[i].startsWith('-')) positional.push(rest[i]);
    }
    const pr = ghJson(['pr', 'view', ...positional.slice(0, 1), ...repoArgs, '--json', PR_FIELDS]);
    checkMerge(pr, { auto: has(rest, '--auto'), admin: has(rest, '--admin') });
  }

  if (group === 'pr' && action === 'create') {
    const base = valueOf(rest, '-B', '--base');
    const head = valueOf(rest, '-H', '--head') ?? run('git', ['branch', '--show-current']);
    if (base) checkReleasePullRequest(base, head);
  }

  if (group === 'release' && action === 'create') {
    const tag = rest.find((arg) => !arg.startsWith('-'));
    if (tag && /^v\d/.test(tag)) {
      if (tagCommit(tag)) checkTag(tag);
      else
        decide(
          'deny',
          `gh release create would create ${tag} on GitHub. Push the approved tag first (/release does).`,
        );
    }
  }

  if (group === 'workflow' && action === 'run') {
    const target = valueOf(rest, '-r', '--ref') ?? '';
    const fields = rest.filter((arg) => /=/.test(arg)).join(' ');
    const environment =
      /production/.test(fields) || target === PROD || /^v\d/.test(target)
        ? 'production'
        : /staging/.test(fields) || target === STAG
          ? 'staging'
          : null;
    if (environment) {
      decide(
        'ask',
        `This deploys ${target || 'a commit'} to ${environment} outside a release (a re-run or a ` +
          'rollback). Allow it only if you own this release.',
      );
    }
  }
  if (group === 'run' && action === 'rerun') {
    decide(
      'ask',
      'Re-running a deploy sends that commit to its environment again. Allow it only if you own this release.',
    );
  }
};

const checkDeployCommand = (words) => {
  const line = words.join(' ');
  for (const [environment, commands] of Object.entries(config.deployCommands ?? {})) {
    if (!(commands ?? []).some((command) => line === command || line.startsWith(`${command} `)))
      continue;
    if (environment === 'production') {
      decide(
        'deny',
        `\`${line}\` deploys to production by hand. Production deploys only from ${PROD}, through ` +
          'GitHub Actions, after an approved release. Run /release.',
      );
    } else if (environment === 'staging') {
      decide(
        'ask',
        `\`${line}\` deploys to staging by hand. Allow it only if it is the build you mean to send.`,
      );
    }
  }
};

const checkBash = (command) => {
  for (const all of commandsOf(command)) {
    const words = withoutEnv(all);
    checkDeployCommand(words);
    if (words[0] === 'gh') {
      checkGh(words.slice(1));
      continue;
    }
    if (words[0] !== 'git' && !words[0]?.endsWith('/git')) continue;
    let i = 1;
    while (i < words.length && words[i].startsWith('-')) {
      if (GIT_OPTIONS_WITH_VALUE.has(words[i])) i += 1;
      i += 1;
    }
    if (words[i] === 'push') checkGitPush(words.slice(i + 1));
  }
};

// ---------------------------------------------------------------- GitHub MCP

const REVIEW_TOOLS = /pull_request_review|submit_pending|create_and_submit/;

const checkMcp = (tool, args) => {
  if (REVIEW_TOOLS.test(tool) && String(args.event ?? '').toUpperCase() === 'APPROVE') {
    decide('deny', APPROVE_REASON);
  }
  if (tool === 'merge_pull_request') {
    const number = args.pullNumber ?? args.pull_number ?? args.number;
    const repo = args.owner && args.repo ? ['-R', `${args.owner}/${args.repo}`] : [];
    const pr = number ? ghJson(['pr', 'view', String(number), ...repo, '--json', PR_FIELDS]) : null;
    checkMerge(pr, { auto: Boolean(args.auto) });
  }
  if (tool === 'create_pull_request' && args.base) checkReleasePullRequest(args.base, args.head);
  if (
    ['create_or_update_file', 'push_files', 'delete_file'].includes(tool) &&
    [DEV, STAG, PROD, 'main'].includes(args.branch)
  ) {
    decide(
      'deny',
      `${args.branch} changes only through a pull request. Commit to a feature branch instead.`,
    );
  }
};

// ---------------------------------------------------------------- main

const main = () => {
  const tool = String(input.tool_name ?? '');
  const toolInput = input.tool_input ?? {};
  if (tool === 'Bash') {
    if (typeof toolInput.command === 'string') checkBash(toolInput.command);
  } else {
    const match = /^mcp__.*github.*?__(\w+)$/i.exec(tool);
    if (match) checkMcp(match[1], toolInput);
  }
  if (verdict.decision === 'allow') return;
  try {
    if (existsSync(join(root, '.claude'))) {
      appendFileSync(
        join(root, '.claude', 'release-gate.log'),
        `${new Date().toISOString()} ${verdict.decision} ${tool} ${JSON.stringify(toolInput.command ?? toolInput)} ${verdict.reason}\n`,
      );
    }
  } catch {
    // The log is a convenience.
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: verdict.decision,
        permissionDecisionReason: `Release gate: ${verdict.reason}`,
      },
    }),
  );
};

try {
  main();
} catch (error) {
  // A broken guard must never break the session.
  process.stderr.write(`release-gate: ${error.message}\n`);
}

// Runs the release gate on Bash commands and GitHub MCP calls in a scratch git repository, with a
// fake `gh` on PATH that answers from a JSON file, and checks what it allows, asks and denies.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'release-gate.mjs');

// Answers `gh <group> <action> …` with the JSON stored under "<group> <action>", or fails.
const FAKE_GH = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
let answers = {};
try { answers = JSON.parse(readFileSync(process.env.FAKE_GH_ANSWERS, 'utf8')); } catch {}
const key = process.argv.slice(2, 4).join(' ');
if (!(key in answers)) process.exit(1);
process.stdout.write(JSON.stringify(answers[key]));
`;

let dir;
let bin;

const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout.trim();

const commit = (version) => {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'shop', version }));
  git('add', 'package.json');
  git('commit', '-q', '-m', `chore(release): ${version}`);
  return git('rev-parse', 'HEAD');
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'release-gate-'));
  bin = join(dir, '.bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  git('init', '-q', '-b', 'feat/orders');
  git('config', 'user.email', 'dev@example.com');
  git('config', 'user.name', 'Dev');
  writeFileSync(join(dir, '.gitignore'), '.bin\n');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const answer = (answers) => writeFileSync(join(dir, 'gh.json'), JSON.stringify(answers));

const run = (tool, toolInput) => {
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: tool, cwd: dir, tool_input: toolInput }),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      FAKE_GH_ANSWERS: join(dir, 'gh.json'),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout === ''
    ? { decision: 'allow' }
    : JSON.parse(result.stdout).hookSpecificOutput;
};
const bash = (command) => run('Bash', { command });

const expect = (result, decision, pattern) => {
  assert.equal(result.decision ?? result.permissionDecision, decision, JSON.stringify(result));
  if (pattern) assert.match(result.permissionDecisionReason, pattern);
};

const review = (login, state, oid) => ({ author: { login }, state, commit: { oid } });
const pr = (fields) => ({
  number: 7,
  url: 'https://github.com/acme/shop/pull/7',
  state: 'OPEN',
  title: 'Stage 1.4.0',
  baseRefName: 'stag',
  headRefName: 'release/1.4.0',
  headRefOid: 'aaa1111',
  author: { login: 'dev' },
  reviews: [],
  ...fields,
});

test('never approves a pull request or a deployment', () => {
  expect(bash('gh pr review 7 --approve'), 'deny', /person's decision/);
  expect(bash('gh pr review --approve -b ok'), 'deny');
  expect(bash('gh api repos/acme/shop/pulls/7/reviews -f event=APPROVE'), 'deny');
  expect(bash('gh api -X POST repos/acme/shop/actions/runs/9/pending_deployments'), 'deny');
  expect(
    run('mcp__github__pull_request_review_write', { method: 'create', event: 'APPROVE' }),
    'deny',
  );
  expect(
    run('mcp__github__pull_request_review_write', { method: 'create', event: 'COMMENT' }),
    'allow',
  );
  expect(bash('gh pr review 7 --comment -b "looks good"'), 'allow');
});

test('lets pull requests into dev through, and ordinary commands', () => {
  answer({ 'pr view': pr({ baseRefName: 'dev', headRefName: 'feat/orders' }) });
  expect(bash('gh pr merge 7 --squash'), 'allow');
  expect(bash('git push -u origin feat/orders && pnpm build'), 'allow');
  expect(bash('git status'), 'allow');
  expect(run('Read', { file_path: 'package.json' }), 'allow');
});

test('merges into stag only with an approval on the head commit', () => {
  answer({ 'pr view': pr() });
  expect(bash('gh pr merge 7 --merge'), 'deny', /no approval on its head commit aaa1111/);

  answer({ 'pr view': pr({ reviews: [review('lead', 'APPROVED', 'aaa1111')] }) });
  expect(bash('gh pr merge 7 --merge'), 'allow');
  expect(bash('gh pr merge 7 --merge --auto'), 'deny', /Auto-merge/);
  expect(bash('gh pr merge 7 --merge --admin'), 'deny', /--admin/);

  // An approval on an older commit, the author's own, or with a change request left: not enough.
  answer({ 'pr view': pr({ reviews: [review('lead', 'APPROVED', 'old2222')] }) });
  expect(bash('gh pr merge 7'), 'deny');
  answer({ 'pr view': pr({ reviews: [review('dev', 'APPROVED', 'aaa1111')] }) });
  expect(bash('gh pr merge 7'), 'deny');
  answer({
    'pr view': pr({
      reviews: [
        review('lead', 'APPROVED', 'aaa1111'),
        review('qa', 'CHANGES_REQUESTED', 'aaa1111'),
      ],
    }),
  });
  expect(bash('gh pr merge 7'), 'deny');
});

test('takes only release and hotfix branches into stag, and honours approvers', () => {
  answer({
    'pr view': pr({ headRefName: 'feat/orders', reviews: [review('lead', 'APPROVED', 'aaa1111')] }),
  });
  expect(bash('gh pr merge 7'), 'deny', /release\/<version> or hotfix\/<version>/);

  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude', 'release.json'), JSON.stringify({ approvers: ['ni'] }));
  answer({ 'pr view': pr({ reviews: [review('lead', 'APPROVED', 'aaa1111')] }) });
  expect(bash('gh pr merge 7'), 'deny', /from ni/);
  answer({ 'pr view': pr({ reviews: [review('ni', 'APPROVED', 'aaa1111')] }) });
  expect(bash('gh pr merge 7'), 'allow');
});

test('merges into prod only the approved release from stag, after staging deployed it', () => {
  const release = pr({
    title: 'Release 1.4.0',
    baseRefName: 'prod',
    headRefName: 'stag',
    reviews: [review('lead', 'APPROVED', 'aaa1111')],
  });
  const deployed = [{ headSha: 'aaa1111', status: 'completed', conclusion: 'success' }];
  answer({ 'pr view': release, 'run list': deployed });
  expect(bash('gh pr merge 7 --merge'), 'allow');
  expect(
    run('mcp__github__merge_pull_request', { owner: 'acme', repo: 'shop', pullNumber: 7 }),
    'allow',
  );

  answer({ 'pr view': release, 'run list': [{ ...deployed[0], conclusion: 'failure' }] });
  expect(bash('gh pr merge 7 --merge'), 'deny', /Staging has not deployed aaa1111/);

  answer({ 'pr view': release });
  expect(bash('gh pr merge 7 --merge'), 'ask', /Can't read/);

  answer({ 'pr view': { ...release, title: 'Ship it' }, 'run list': deployed });
  expect(bash('gh pr merge 7'), 'deny', /"Release <version>" pull request from stag/);
  answer({ 'pr view': { ...release, headRefName: 'hotfix/1.4.1' }, 'run list': deployed });
  expect(bash('gh pr merge 7'), 'deny');

  commit('1.4.0');
  git('tag', 'v1.4.0');
  answer({ 'pr view': release, 'run list': deployed });
  expect(bash('gh pr merge 7'), 'deny', /already released/);
});

test('denies a merge it cannot check', () => {
  answer({});
  expect(bash('gh pr merge 7'), 'deny', /gh auth/);
  expect(
    run('mcp__github__merge_pull_request', { owner: 'acme', repo: 'shop', pullNumber: 7 }),
    'deny',
  );
});

test('opens a pull request into prod only from stag, once staging deployed it', () => {
  const sha = commit('1.4.0');
  git('update-ref', 'refs/remotes/origin/stag', sha);
  expect(bash('gh pr create --base prod --head feat/orders'), 'deny', /only from stag/);
  expect(run('mcp__github__create_pull_request', { base: 'prod', head: 'hotfix/1.4.1' }), 'deny');

  answer({ 'run list': [{ headSha: sha, conclusion: 'success' }] });
  expect(bash('gh pr create --base prod --head stag --title "Release 1.4.0"'), 'allow');
  answer({ 'run list': [] });
  expect(bash('gh pr create --base prod --head stag'), 'deny', /has not deployed stag/);
  expect(bash('gh pr create --base stag --head release/1.4.0'), 'allow');
});

test('pushes a v* tag only on the merge commit of an approved release', () => {
  const sha = commit('1.4.0');
  git('tag', '-a', 'v1.4.0', '-m', 'Release 1.4.0');
  const merged = pr({
    state: 'MERGED',
    title: 'Release 1.4.0',
    baseRefName: 'prod',
    headRefName: 'stag',
    reviews: [review('lead', 'APPROVED', 'aaa1111')],
    mergeCommit: { oid: sha },
  });
  answer({ 'pr list': [merged] });
  expect(bash('git push origin v1.4.0'), 'allow');
  expect(bash('git push origin refs/tags/v1.4.0'), 'allow');

  answer({ 'pr list': [{ ...merged, mergeCommit: { oid: 'bbb3333' } }] });
  expect(bash('git push origin v1.4.0'), 'deny', /not the merge commit/);
  answer({ 'pr list': [{ ...merged, title: 'Release 1.5.0' }] });
  expect(bash('git push origin v1.4.0'), 'deny', /does not match/);
  answer({ 'pr list': [{ ...merged, reviews: [] }] });
  expect(bash('git push origin v1.4.0'), 'deny', /no approval/);
  answer({});
  expect(bash('git push origin v1.4.0'), 'deny', /gh auth/);

  git('tag', 'v1.5.0');
  answer({ 'pr list': [{ ...merged, title: 'Release 1.5.0' }] });
  expect(bash('git push origin v1.5.0'), 'deny', /package\.json .* says 1\.4\.0/);
});

test('denies pushing every tag and deleting a release tag', () => {
  commit('1.4.0');
  git('tag', 'v1.4.0');
  expect(bash('git push --tags'), 'deny', /every tag/);
  expect(bash('git push --follow-tags origin feat/orders'), 'deny');
  expect(bash('git push origin :v1.3.0'), 'deny', /Deleting v1\.3\.0/);
  expect(bash('git push --delete origin v1.3.0'), 'deny');
  expect(bash('git push origin feat/orders'), 'allow');
  expect(bash('gh release create v2.0.0 --generate-notes'), 'deny', /would create v2\.0\.0/);
});

test('asks before a deploy outside a release, and denies production by hand', () => {
  expect(
    bash('gh workflow run deploy.yml --ref v1.3.0 -f environment=production'),
    'ask',
    /production/,
  );
  expect(bash('gh workflow run deploy.yml --ref stag'), 'ask', /staging/);
  expect(bash('gh workflow run deploy.yml --ref dev'), 'allow');
  expect(bash('gh run rerun 123'), 'ask');

  mkdirSync(join(dir, '.claude'));
  writeFileSync(
    join(dir, '.claude', 'release.json'),
    JSON.stringify({
      deployCommands: { production: ['pnpm deploy:prod'], staging: ['pnpm deploy:stag'] },
    }),
  );
  expect(bash('pnpm build && pnpm deploy:prod'), 'deny', /by hand/);
  expect(bash('pnpm deploy:stag'), 'ask');
  expect(bash('pnpm deploy:dev'), 'allow');
});

test('keeps Claude from committing to shared branches through the MCP server', () => {
  expect(run('mcp__github__create_or_update_file', { branch: 'prod', path: 'a.txt' }), 'deny');
  expect(run('mcp__github__push_files', { branch: 'feat/orders' }), 'allow');
});

test('ignores input it cannot read', () => {
  const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

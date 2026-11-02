import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { guardRules, mergeRules } from '../guard-rules.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'guard-rules.mjs');

// The harness's matching: the whole command against the rule, * as any run of characters.
const matches = (rule, command) => {
  const pattern = /^Bash\((.*)\)$/.exec(rule)?.[1];
  if (pattern === undefined) return false;
  const re = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  return new RegExp(`^${re}$`).test(command);
};
const denied = (command, rules = guardRules()) => rules.deny.some((r) => matches(r, command));
const asked = (command, rules = guardRules()) => rules.ask.some((r) => matches(r, command));

test('pushes to a protected branch are denied, in every spelling', () => {
  for (const command of [
    'git push origin main',
    'git push -u origin dev',
    'git push origin HEAD:stag',
    'git push origin feat/x:prod --tags',
    'git -C ../app push origin main',
    'git push origin refs/heads/main',
  ])
    assert.ok(denied(command), command);
});

test('a push that names no branch, a force push and skipped hooks are denied', () => {
  for (const command of [
    'git push',
    'git push origin',
    'git push -u origin',
    'git push --force origin feat/x',
    'git push origin +feat/x',
    'git push origin feat/x --no-verify',
    'git commit -m "x" --no-verify',
    'git commit -nm "x"',
  ])
    assert.ok(denied(command), command);
});

test('pushes the skills make stay allowed', () => {
  for (const command of [
    'git push -u origin docs/ticket-412',
    'git push -u origin docs/incident-7',
    'git push origin v1.2.0',
    'git push -u origin feat/main-menu',
  ])
    assert.ok(!denied(command), command);
});

test('a branch family with * covers its members only', () => {
  const rules = guardRules(['prod-*']);
  assert.ok(denied('git push origin prod-eu', rules));
  assert.ok(!denied('git push origin feat/prod-x', rules));
});

test('secret files are denied to Read and Edit, generated files to Edit, templates stay open', () => {
  const { deny } = guardRules();
  for (const rule of [
    'Read(**/.env)',
    'Edit(**/.env)',
    'Read(**/*.pem)',
    'Edit(**/pnpm-lock.yaml)',
  ])
    assert.ok(deny.includes(rule), rule);
  assert.ok(!deny.some((rule) => rule.includes('.env.example')));
  assert.ok(!deny.includes('Read(**/pnpm-lock.yaml)'), 'generated files can still be read');
});

test('a shell command that names a secret file is asked about', () => {
  assert.ok(asked('cat .env'));
  assert.ok(asked('cp .env.example .env'));
  assert.ok(asked('openssl rsa -in server.pem'));
  assert.ok(!asked('pnpm test'));
});

test("mergeRules keeps the project's rules and drops only the ones it wrote before", () => {
  const settings = { permissions: { allow: ['Bash(pnpm *)'], deny: ['Bash(rm *)', 'Bash(old)'] } };
  const merged = mergeRules(settings, { deny: ['Bash(new)'], ask: [] }, { deny: ['Bash(old)'] });
  assert.deepEqual(merged.permissions, {
    allow: ['Bash(pnpm *)'],
    deny: ['Bash(rm *)', 'Bash(new)'],
    ask: [],
  });
});

test('--write merges into .claude/settings.json and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'guard-rules-'));
  try {
    mkdirSync(join(dir, '.claude'));
    writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ model: 'x' }));
    for (let i = 0; i < 2; i += 1)
      assert.equal(spawnSync('node', [SCRIPT, '--write', dir]).status, 0);
    const settings = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
    assert.equal(settings.model, 'x');
    assert.deepEqual(settings.permissions.deny, guardRules().deny);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI refuses a branch name with shell characters', () => {
  assert.equal(spawnSync('node', [SCRIPT, 'main;rm']).status, 1);
});

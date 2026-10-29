// Runs the release skill's status script on a scratch repository with dev, stag and prod on a
// local origin, with no GitHub CLI, and checks what it reports and which step comes next.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'skills',
  'release',
  'scripts',
  'release-status.mjs',
);

let root;
let dir;
let bin;

const git = (...args) => {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

const commit = (message, version = '1.0.0') => {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'shop', version }));
  writeFileSync(join(dir, 'notes.txt'), message);
  git('add', '.');
  git('commit', '-q', '-m', message);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'release-status-'));
  dir = join(root, 'app');
  bin = join(root, 'bin');
  mkdirSync(bin);
  // No GitHub CLI: every gh call fails, as on a machine where it is not installed.
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(bin, 'gh'), 0o755);
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', join(root, 'origin.git')]);
  mkdirSync(dir);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'dev@example.com');
  git('config', 'user.name', 'Dev');
  git('remote', 'add', 'origin', join(root, 'origin.git'));
  commit('chore: start');
  git('push', '-q', 'origin', 'main:dev', 'main:stag', 'main:prod');
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'deploy.yml'), 'name: deploy\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const status = () => {
  const result = spawnSync(process.execPath, [SCRIPT, dir], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
  });
  return { code: result.status, json: JSON.parse(result.stdout) };
};

test('asks for release-setup when the environment branches or the workflow are missing', () => {
  rmSync(join(dir, '.github'), { recursive: true });
  const { code, json } = status();
  assert.equal(code, 3);
  assert.equal(json.next, 'setup');
  assert.ok(json.setup.missing.includes('.github/workflows/deploy.yml'));
  assert.equal(json.gh.signedIn, false);
});

test('lists what dev has for staging, with ticket ids, and says to stage it', () => {
  commit('feat(orders): filter by status SHOP-15');
  commit('fix: cart badge count (#31)');
  git('push', '-q', 'origin', 'HEAD:dev');
  const { code, json } = status();
  assert.equal(code, 0);
  assert.equal(json.next, 'stage');
  assert.deepEqual(
    json.changes.toStaging.map((change) => change.tickets),
    [['#31'], ['SHOP-15']],
  );
  assert.deepEqual(json.changes.toProduction, []);
  assert.equal(json.git.versions.prod, '1.0.0');
});

test('says to check staging and open the release once stag is ahead of prod', () => {
  commit('chore(release): 1.1.0', '1.1.0');
  git('push', '-q', 'origin', 'HEAD:dev', 'HEAD:stag');
  const { json } = status();
  assert.equal(json.next, 'check-staging-then-open-release');
  assert.equal(json.git.versions.stag, '1.1.0');
});

test('says to back-merge when prod has a version dev does not', () => {
  commit('chore(release): 1.1.0', '1.1.0');
  git('push', '-q', 'origin', 'HEAD:stag', 'HEAD:prod');
  const { json } = status();
  assert.equal(json.next, 'back-merge');
});

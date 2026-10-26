// Runs the PreToolUse hook on Bash commands in a scratch git repository and checks which
// pushes it blocks.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'protect-branches.mjs');

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'protect-branches-'));
  spawnSync('git', ['init', '-q', '-b', 'feat/orders'], { cwd: dir });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const checkout = (branch, cwd = dir) => spawnSync('git', ['checkout', '-q', '-b', branch], { cwd });

const run = (command, input = {}) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', cwd: dir, tool_input: { command }, ...input }),
    encoding: 'utf8',
  });

const assertBlocked = (command, branch) => {
  const result = run(command);
  assert.equal(result.status, 2, `${command} should be blocked`);
  assert.match(result.stderr, new RegExp(`\`${branch}\``));
};

const assertAllowed = (command) => {
  const result = run(command);
  assert.equal(result.status, 0, `${command} should pass: ${result.stderr}`);
  assert.equal(result.stderr, '');
};

test('blocks a push that names a protected branch', () => {
  assertBlocked('git push origin dev', 'dev');
  assertBlocked('git push -u origin stag', 'stag');
  assertBlocked('git push --force origin prod', 'prod');
  assertBlocked('git push --no-verify origin dev', 'dev');
  assertBlocked('git push origin +prod', 'prod');
  assertBlocked('git push origin refs/heads/stag', 'stag');
});

test('blocks a refspec whose destination is protected', () => {
  assertBlocked('git push origin HEAD:dev', 'dev');
  assertBlocked('git push origin feat/orders:refs/heads/prod', 'prod');
  assertBlocked('git push origin feat/orders:stag', 'stag');
});

test('blocks deleting a protected branch', () => {
  assertBlocked('git push origin :dev', 'dev');
  assertBlocked('git push origin --delete prod', 'prod');
  assertBlocked('git push -d origin stag', 'stag');
});

test('blocks a bare push from a protected branch', () => {
  checkout('dev');
  assertBlocked('git push', 'dev');
  assertBlocked('git push origin', 'dev');
  assertBlocked('git push origin HEAD', 'dev');
});

test('blocks pushing every branch at once', () => {
  assertBlocked('git push --all origin', 'dev');
  assertBlocked('git push --mirror origin', 'prod');
});

test('finds the push inside a longer command line', () => {
  assertBlocked('pnpm lint && git push origin dev', 'dev');
  assertBlocked('git add -A; git commit -m "wip"; git push origin stag', 'stag');
  assertBlocked('GIT_TRACE=1 git -c core.askPass=x push origin prod', 'prod');
  assertBlocked('git push origin "dev"', 'dev');
});

test('reads the current branch of the repository named by -C', () => {
  const other = join(dir, 'other');
  mkdirSync(other);
  spawnSync('git', ['init', '-q', '-b', 'prod'], { cwd: other });
  assertBlocked('git -C other push', 'prod');
  assertAllowed('git push');
});

test('allows pushes to other branches', () => {
  assertAllowed('git push');
  assertAllowed('git push -u origin feat/orders');
  assertAllowed('git push origin HEAD');
  assertAllowed('git push origin develop production staging');
  assertAllowed('git push origin feat/dev-tools');
  assertAllowed('git push origin dev:feat/orders');
  assertAllowed('git push --tags origin');
  assertAllowed('git push origin v1.0.0');
});

test('ignores commands that are not a git push', () => {
  assertAllowed('git log origin/dev..HEAD');
  assertAllowed('git checkout dev');
  assertAllowed('echo "git push origin dev"');
  assertAllowed('git stash push -m dev');
  assertAllowed('pnpm push dev');
});

test('ignores input without a command', () => {
  assert.equal(run('', { tool_input: {} }).status, 0);
  const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
});

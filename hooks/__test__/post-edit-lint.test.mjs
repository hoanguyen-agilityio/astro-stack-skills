// Runs the PostToolUse lint hook on a scratch project whose node_modules/.bin holds fake
// linters, and checks what it sends back to Claude.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'post-edit-lint.mjs');

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'post-edit-lint-'));
  writeFileSync(join(dir, 'package.json'), '{}');
  mkdirSync(join(dir, 'src'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// A fake linter: prints `output` and exits with `code`.
const fakeBin = (name, code, output = '') => {
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  const path = join(dir, 'node_modules', '.bin', name);
  writeFileSync(path, `#!/bin/sh\necho '${output}'\nexit ${code}\n`);
  chmodSync(path, 0o755);
};

const run = (file, content) => {
  const path = join(dir, file);
  writeFileSync(path, content);
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd: dir, tool_input: { file_path: path } }),
    encoding: 'utf8',
  });
};

test('a clean file passes', { skip: process.platform === 'win32' }, () => {
  fakeBin('eslint', 0);
  fakeBin('oxlint', 0);
  const result = run('src/a.ts', 'export const a = 1;\n');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('an anti-slop finding goes back to Claude', { skip: process.platform === 'win32' }, () => {
  fakeBin('eslint', 0);
  fakeBin('oxlint', 1, 'src/a.ts:1:1: error anti-slop(no-unknown-returns)');
  const result = run('src/a.ts', 'export const a = (): unknown => 1;\n');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Oxlint \(anti-slop\):/);
  assert.match(result.stderr, /no-unknown-returns/);
});

test('without oxlint installed, only ESLint runs', { skip: process.platform === 'win32' }, () => {
  fakeBin('eslint', 1, 'src/a.ts: error no-explicit-any');
  const result = run('src/a.ts', 'export const a: any = 1;\n');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ESLint:/);
  assert.doesNotMatch(result.stderr, /Oxlint/);
});

test('a missing final newline is reported', () => {
  const result = run('src/a.ts', 'export const a = 1;');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Missing final newline/);
});

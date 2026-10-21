#!/usr/bin/env node
// PostToolUse hook: lint the file Claude just edited or wrote, and send problems back to Claude.
//
// Checks, on that one file only: a final newline, then the project's own ESLint and Prettier
// (from its node_modules/.bin, skipped when not installed). Problems go to stderr with exit
// code 2, which Claude Code feeds back to Claude so it fixes them right away. Typecheck and tests
// are too slow per edit; they stay with the Stop checklist and the pre-push hook.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative } from 'node:path';
import process from 'node:process';

const ESLINT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.astro']);

const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

// The nearest folder with a package.json, from the file up to the session's cwd.
const projectRoot = (file, cwd) => {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    if (dir === cwd || dir === dirname(dir)) return null;
  }
};

const bin = (root, name) => {
  const path = join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  return existsSync(path) ? path : null;
};

const runBin = (path, args, cwd) => {
  const result = spawnSync(path, args, {
    cwd,
    encoding: 'utf8',
    timeout: 50_000,
    shell: process.platform === 'win32',
  });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() };
};

const main = () => {
  const input = readJson(readFileSync(0, 'utf8'), {});
  const cwd = input.cwd ?? process.cwd();
  const file = input.tool_input?.file_path;
  if (!file || !existsSync(file)) return;
  const shown = relative(cwd, file);
  if (shown.startsWith('..') || isAbsolute(shown)) return;

  const content = readFileSync(file);
  if (content.includes(0)) return; // binary
  const problems = [];

  if (content.length > 0 && content.at(-1) !== 0x0a) {
    problems.push('Missing final newline: end the file with a single newline.');
  }

  const root = projectRoot(file, cwd);
  if (root) {
    const target = relative(root, file);
    const eslint = bin(root, 'eslint');
    if (eslint && ESLINT_EXTENSIONS.has(extname(file))) {
      const result = runBin(eslint, ['--no-warn-ignored', target], root);
      if (!result.ok) problems.push(`ESLint:\n${result.output}`);
    }
    const prettier = bin(root, 'prettier');
    if (prettier) {
      const result = runBin(prettier, ['--check', '--ignore-unknown', target], root);
      if (!result.ok) {
        problems.push(`Prettier: not formatted. Run \`pnpm exec prettier --write ${target}\`.`);
      }
    }
  }

  if (problems.length === 0) return;
  process.stderr.write(`${shown} has problems to fix now:\n\n${problems.join('\n\n')}\n`);
  process.exit(2);
};

try {
  main();
} catch (error) {
  // A broken lint hook must never break the session.
  process.stderr.write(`post-edit-lint: ${error.message}\n`);
}

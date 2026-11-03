// Working-tree snapshots shared by the turn-snapshot and checklist-on-stop hooks.
//
// A snapshot maps every file git sees as changed (modified, added, deleted, untracked) to a hash
// of its content. Comparing the snapshot taken when the user sends a prompt with the one taken
// when Claude stops gives the files the turn changed, whatever tool changed them: Edit, Write,
// or a Bash command such as `printf > file`, codegen or `pnpm add`.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_FILES = 2000;
const DIR = join(tmpdir(), 'claude-task-checklist');

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 });

const hashFile = (path) => {
  if (!existsSync(path)) return 'deleted';
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex');
  } catch {
    return 'unreadable';
  }
};

// `{ "<absolute path>": "<hash>" }`, or null outside a git repository.
export const snapshot = (cwd) => {
  const root = git(['rev-parse', '--show-toplevel'], cwd);
  if (root.status !== 0) return null;
  const top = root.stdout.trim();
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], top);
  if (status.status !== 0) return null;
  const entries = status.stdout.split('\0').filter(Boolean);
  const files = {};
  for (let i = 0; i < entries.length && Object.keys(files).length < MAX_FILES; i += 1) {
    const code = entries[i].slice(0, 2);
    const path = join(top, entries[i].slice(3));
    files[path] = hashFile(path);
    if (code.includes('R') || code.includes('C')) i += 1; // the next entry is the old name
  }
  return files;
};

// Files whose state differs between two snapshots: changed, created, deleted or reverted.
export const changedBetween = (before, after) => {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter((path) => before[path] !== after[path]);
};

const fileFor = (sessionId) => join(DIR, `${String(sessionId).replace(/[^\w.-]/g, '_')}.json`);

export const saveSnapshot = (sessionId, files) => {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(fileFor(sessionId), JSON.stringify(files));
};

export const loadSnapshot = (sessionId) => {
  try {
    return JSON.parse(readFileSync(fileFor(sessionId), 'utf8'));
  } catch {
    return null;
  }
};

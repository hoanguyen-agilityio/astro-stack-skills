// Runs the SessionStart (compact) hook on ticket folders in a scratch git repository, and checks
// which ticket it points Claude back at.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { activeTicket, message } from '../ticket-resume.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ticket-resume.mjs');
const HOUR = 60 * 60 * 1000;
const NOW = Date.now();

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ticket-resume-'));
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// A ticket folder whose plan.md was last changed `hoursAgo` hours before NOW.
const ticket = (id, { hoursAgo = 1, ready = true } = {}) => {
  const folder = join(dir, 'docs', 'tickets', id);
  mkdirSync(folder, { recursive: true });
  const body = `# ${id} — Plan\n\n## Build order\n\n1. Step\n`;
  const plan = join(folder, 'plan.md');
  writeFileSync(plan, ready ? `${body}\nReady: AC1 · Blocked: — · Next: develop-feature\n` : body);
  const time = new Date(NOW - hoursAgo * HOUR);
  utimesSync(plan, time, time);
};

const run = (env = {}) =>
  spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify({ cwd: dir, session_id: 's', source: 'compact' }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', ...env },
  });

test('the ticket named in the branch wins over a more recent one', () => {
  ticket('412', { hoursAgo: 30 });
  ticket('500', { hoursAgo: 1 });
  assert.equal(activeTicket(dir, 'docs/ticket-412', NOW)?.id, '412');
  assert.equal(activeTicket(dir, 'feat/412-login', NOW)?.id, '412');
});

test('an id only matches whole between separators', () => {
  ticket('41', { hoursAgo: 30 });
  assert.equal(activeTicket(dir, 'feat/412-login', NOW), null);
});

test('no branch match: the plan changed most recently within 12 hours', () => {
  ticket('412', { hoursAgo: 5 });
  ticket('500', { hoursAgo: 2 });
  assert.equal(activeTicket(dir, 'main', NOW)?.id, '500');
});

test('no branch match and nothing recent: no ticket', () => {
  ticket('412', { hoursAgo: 13 });
  assert.equal(activeTicket(dir, 'main', NOW), null);
});

test('a ticket folder without plan.md is skipped', () => {
  mkdirSync(join(dir, 'docs', 'tickets', '412'), { recursive: true });
  assert.equal(activeTicket(dir, 'docs/ticket-412', NOW), null);
});

test('the message quotes the Ready line when the plan has one', () => {
  ticket('412');
  const text = message(activeTicket(dir, 'docs/ticket-412', NOW));
  assert.match(text, /read docs\/tickets\/412\/plan\.md/);
  assert.match(text, /Its plan ends with: Ready: AC1 · Blocked: — · Next: develop-feature/);
  assert.match(text, /keep waiting/);
});

test('the message leaves the Ready line out when the plan has none', () => {
  ticket('412', { ready: false });
  assert.doesNotMatch(message(activeTicket(dir, 'docs/ticket-412', NOW)), /Its plan ends with/);
});

test('the script prints SessionStart context for the active ticket', () => {
  ticket('412');
  const out = run();
  assert.equal(out.status, 0);
  const { hookSpecificOutput } = JSON.parse(out.stdout);
  assert.equal(hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(hookSpecificOutput.additionalContext, /ticket 412/);
});

test('the script prints nothing without docs/tickets', () => {
  const out = run();
  assert.equal(out.status, 0);
  assert.equal(out.stdout, '');
});

test('CLAUDE_PROJECT_DIR is the project when set', () => {
  ticket('412');
  const other = mkdtempSync(join(tmpdir(), 'ticket-resume-other-'));
  try {
    assert.equal(run({ CLAUDE_PROJECT_DIR: other }).stdout, '');
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
});

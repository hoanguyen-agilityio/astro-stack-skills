#!/usr/bin/env node
// SessionStart hook (matcher `compact`): after the context is compacted, point Claude back at the
// ticket it was working on.
//
// A compacted summary can drop where the work stood: which ticket, which step, or that Claude had
// stopped to wait for the developer. The ticket is the `docs/tickets/<id>/` folder whose id appears
// in the current branch name (`docs/ticket-412`, `feat/412-login`), else the one whose `plan.md`
// changed in the last 12 hours. The hook saves nothing: `plan.md` already holds the plan and its
// Ready line. No ticket: it prints nothing. Its own errors never stop the session.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const RECENT_MS = 12 * 60 * 60 * 1000;
const READY_LINE = /^Ready:.*$/m;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const currentBranch = (dir) => {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 5000,
  });
  return result.status === 0 ? result.stdout.trim() : '';
};

// Every ticket folder with a plan.md: `{ id, plan, mtime }`.
const tickets = (dir) => {
  const folder = join(dir, 'docs', 'tickets');
  let ids;
  try {
    ids = readdirSync(folder);
  } catch {
    return [];
  }
  return ids.flatMap((id) => {
    const plan = join(folder, id, 'plan.md');
    try {
      return [{ id, plan, mtime: statSync(plan).mtimeMs }];
    } catch {
      return [];
    }
  });
};

// The ticket to resume, or null.
export const activeTicket = (dir, branch = currentBranch(dir), now = Date.now()) => {
  const all = tickets(dir);
  const onBranch = all.find((ticket) =>
    new RegExp(`(^|[/_-])${escapeRegExp(ticket.id)}([/_-]|$)`).test(branch),
  );
  if (onBranch) return onBranch;
  const recent = all
    .filter((ticket) => now - ticket.mtime < RECENT_MS)
    .sort((a, b) => b.mtime - a.mtime);
  return recent[0] ?? null;
};

export const message = (ticket) => {
  const folder = `docs/tickets/${ticket.id}`;
  let ready = null;
  try {
    ready = readFileSync(ticket.plan, 'utf8').match(READY_LINE)?.[0] ?? null;
  } catch {
    // An unreadable plan still gets the pointer.
  }
  return [
    `The context was just compacted while ticket ${ticket.id} was in progress. Before anything else, read ${folder}/plan.md and ${folder}/spec.md, and find the step the work stopped at.`,
    ready ? `Its plan ends with: ${ready}` : null,
    'If you had stopped to ask the developer something or to wait for their approval, keep waiting: the compacted summary is not their answer.',
  ]
    .filter(Boolean)
    .join('\n');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const ticket = activeTicket(dir);
    if (ticket) {
      const hookSpecificOutput = {
        hookEventName: 'SessionStart',
        additionalContext: message(ticket),
      };
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput })}\n`);
    }
  } catch (error) {
    process.stderr.write(`ticket-resume: ${error.message}\n`);
  }
}

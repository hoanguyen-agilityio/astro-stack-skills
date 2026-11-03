#!/usr/bin/env node
// UserPromptSubmit hook: record the working tree when a turn starts.
//
// The Stop hook (checklist-on-stop.mjs) compares it with the tree at the end of the turn, so files
// changed by Bash commands are listed too. Prints nothing: stdout from this event would be
// added to Claude's context.

import { readFileSync } from 'node:fs';
import process from 'node:process';

import { saveSnapshot, snapshot } from './worktree.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const files = snapshot(input.cwd ?? process.cwd());
  if (files && input.session_id) saveSnapshot(input.session_id, files);
} catch (error) {
  // A failed snapshot only means the checklist falls back to Edit/Write calls.
  process.stderr.write(`turn-snapshot: ${error.message}\n`);
}

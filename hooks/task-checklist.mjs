#!/usr/bin/env node
// Stop hook: after a turn that changed files, show what changed and which gates passed.
//
// Reads the hook input (JSON on stdin), walks the transcript back to the user's last prompt,
// and prints `{ "systemMessage": … }` so Claude Code shows the checklist in the terminal. A
// desktop notification carries the one-line verdict. It never blocks: exit code is always 0.
// A turn with no file edits (questions, reviews) prints nothing.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import process from 'node:process';

const GATES = ['lint', 'format:check', 'typecheck', 'test', 'build'];
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const run = (command, args, cwd) =>
  spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 5000 });

// A user prompt starts a turn; tool results and injected skill text do not.
const isPrompt = (entry) => {
  if (entry.type !== 'user' || entry.isMeta || entry.isSidechain) return false;
  const content = entry.message?.content;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && !content.some((block) => block.type === 'tool_result');
};

const turnEntries = (transcriptPath) => {
  const entries = readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => readJson(line, {}))
    .filter((entry) => (entry.type === 'user' || entry.type === 'assistant') && !entry.isSidechain);
  let start = 0;
  entries.forEach((entry, index) => {
    if (isPrompt(entry)) start = index;
  });
  return entries.slice(start);
};

const blocksOf = (entries, type) =>
  entries.flatMap((entry) =>
    Array.isArray(entry.message?.content)
      ? entry.message.content.filter((block) => block.type === type)
      : [],
  );

// `pnpm lint`, `pnpm run lint`, `pnpm -s test` … each gate named in a Bash command.
const gatesIn = (command) =>
  GATES.filter((gate) =>
    new RegExp(`\\bpnpm\\s+(?:-\\S+\\s+)*(?:run\\s+)?${gate.replace(':', '\\:')}(?![\\w:-])`).test(
      command,
    ),
  );

const collect = (entries) => {
  const failed = new Set(
    blocksOf(entries, 'tool_result')
      .filter((block) => block.is_error)
      .map((block) => block.tool_use_id),
  );
  const edited = new Set();
  const gates = {};
  for (const block of blocksOf(entries, 'tool_use')) {
    const input = block.input ?? {};
    if (EDIT_TOOLS.has(block.name)) {
      const path = input.file_path ?? input.notebook_path;
      if (path) edited.add(path);
      for (const gate of Object.keys(gates)) gates[gate].stale = true;
    }
    if (block.name === 'Bash' && typeof input.command === 'string') {
      for (const gate of gatesIn(input.command)) {
        gates[gate] = { ok: !failed.has(block.id), stale: false };
      }
    }
  }
  return { edited, gates };
};

const diffStat = (cwd, files) => {
  const stats = new Map();
  const result = run('git', ['diff', '--numstat', 'HEAD', '--', ...files], cwd);
  if (result.status !== 0) return stats;
  for (const line of result.stdout.split('\n').filter(Boolean)) {
    const [added, removed, file] = line.split('\t');
    stats.set(file, `+${added} −${removed}`);
  }
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard', '--', ...files], cwd);
  for (const file of untracked.stdout.split('\n').filter(Boolean)) stats.set(file, 'new');
  return stats;
};

const projectGates = (cwd) => {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return [];
  const scripts = readJson(readFileSync(pkgPath, 'utf8'), {}).scripts ?? {};
  return GATES.filter((gate) => gate in scripts);
};

const mark = (gate) => {
  if (!gate) return '[ ]';
  if (!gate.ok) return '[✗]';
  return gate.stale ? '[~]' : '[x]';
};

const notifyDesktop = (title, body) => {
  if (process.platform === 'linux') run('notify-send', ['--app-name=Claude Code', title, body]);
  else if (process.platform === 'darwin') {
    const quote = (text) => JSON.stringify(text);
    run('osascript', ['-e', `display notification ${quote(body)} with title ${quote(title)}`]);
  }
};

const main = () => {
  const input = readJson(readFileSync(0, 'utf8'), {});
  const cwd = input.cwd ?? process.cwd();
  if (!input.transcript_path || !existsSync(input.transcript_path)) return;

  const { edited, gates } = collect(turnEntries(input.transcript_path));
  // Only the project's files count; scratch files outside it are not a code change.
  const files = [...edited]
    .map((path) => relative(cwd, path))
    .filter((path) => path && !path.startsWith('..') && !isAbsolute(path));
  if (files.length === 0) return;

  const stats = diffStat(cwd, files);
  const required = projectGates(cwd);
  const missing = required.filter((gate) => !gates[gate] || gates[gate].stale);
  const failing = required.filter((gate) => gates[gate] && !gates[gate].ok);

  let verdict = '✅ Task done: all gates passed';
  if (required.length === 0) verdict = '✅ Task done (no gate scripts in package.json)';
  else if (failing.length) verdict = `⚠️ Task done, gates failing: ${failing.join(', ')}`;
  else if (missing.length) verdict = `⚠️ Task done, gates not run after the last edit: ${missing.join(', ')}`;

  const lines = [
    verdict,
    `Changed (${files.length}):`,
    ...files.map((file) => `  • ${file}${stats.has(file) ? ` (${stats.get(file)})` : ''}`),
  ];
  if (required.length) {
    lines.push(`Gates: ${required.map((gate) => `${mark(gates[gate])} ${gate}`).join('  ')}`);
    lines.push('[x] passed  [✗] failed  [~] passed before a later edit  [ ] not run');
  }

  process.stdout.write(JSON.stringify({ systemMessage: lines.join('\n') }));
  notifyDesktop('Claude Code', `${verdict} · ${files.length} file(s) changed`);
};

try {
  main();
} catch (error) {
  // A broken checklist must never break the session.
  process.stderr.write(`task-checklist: ${error.message}\n`);
}

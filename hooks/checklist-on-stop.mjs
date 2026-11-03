#!/usr/bin/env node
// Stop hook: after a turn that changed files, show what changed and which gates passed.
//
// Reads the hook input (JSON on stdin), walks the transcript back to the user's last prompt,
// and prints `{ "systemMessage": … }` so Claude Code shows the checklist in the terminal. A
// desktop notification carries the one-line verdict. It never blocks: exit code is always 0.
// A turn with no file changes (questions, reviews) prints nothing.
//
// Changed files come from Edit/Write calls plus the working-tree snapshot turn-snapshot.mjs
// took when the prompt was sent, so files written by Bash count too. A gate's result comes
// from pnpm's own output, not only from the tool's error flag: `pnpm typecheck; echo $?`
// exits 0 even when typecheck fails.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import process from 'node:process';

import { changedBetween, loadSnapshot, snapshot } from './worktree.mjs';

const GATES = ['lint', 'format:check', 'typecheck', 'test', 'build', 'test:stories', 'test:pages'];
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
// `test:coverage` runs the same tests, so it counts as `test`.
const runsScript = (command, script) =>
  new RegExp(`\\bpnpm\\s+(?:-\\S+\\s+)*(?:run\\s+)?${script.replace(':', '\\:')}(?![\\w:-])`).test(
    command,
  );

const gatesIn = (command) =>
  GATES.filter(
    (gate) =>
      runsScript(command, gate) || (gate === 'test' && runsScript(command, 'test:coverage')),
  );

const textOf = (result) => {
  const content = result?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('\n');
  return '';
};

// pnpm prints `> <pkg>@<version> <script> <dir>` before each script it runs (not with `-s`),
// and ` ELIFECYCLE …` or `ERR_PNPM_…` when one fails.
const HEADER = /^> \S*@\S* (\S+) /;
const FAILED = /ELIFECYCLE|ERR_PNPM_/;
// `;`, `||`, a pipe, `&` or `$?` can turn a failing gate into a command that exits 0.
const MASKS_EXIT = /;|\|\||(?<![|&])\|(?!\|)|&(?!&)|\$\?/;

const gateOfScript = (script) => (script === 'test:coverage' ? 'test' : script);

// `{ gate: true | false | null }` for one Bash command: passed, failed, or unknown.
// A gate that has no header when others do never ran (an earlier `&&` failed) and is left out.
const gateResults = (command, gates, result) => {
  const text = textOf(result);
  const segments = {};
  let current = null;
  for (const line of text.split('\n')) {
    const header = HEADER.exec(line);
    if (header) {
      current = gateOfScript(header[1]);
      segments[current] = '';
    } else if (current) {
      segments[current] += `${line}\n`;
    }
  }
  const results = {};
  if (Object.keys(segments).length > 0) {
    for (const gate of gates) {
      if (gate in segments) results[gate] = !FAILED.test(segments[gate]);
    }
    return results;
  }
  // No headers: `pnpm -s`, or the output was cut (`| tail`).
  let verdict = null;
  if (FAILED.test(text)) verdict = gates.length === 1 ? false : null;
  else if (result?.is_error) verdict = gates.length === 1 ? false : null;
  else if (!MASKS_EXIT.test(command)) verdict = true;
  for (const gate of gates) results[gate] = verdict;
  return results;
};

const collect = (entries) => {
  const results = new Map(
    blocksOf(entries, 'tool_result').map((block) => [block.tool_use_id, block]),
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
      const result = results.get(block.id);
      // A loop (`for s in lint test; do pnpm $s; done`) names no gate; pnpm's headers do.
      const ran = textOf(result)
        .split('\n')
        .map((line) => HEADER.exec(line)?.[1])
        .filter(Boolean)
        .map(gateOfScript);
      const inCommand = gatesIn(input.command);
      const named = GATES.filter((gate) => inCommand.includes(gate) || ran.includes(gate));
      if (named.length === 0) continue;
      const outcome = gateResults(input.command, named, result);
      for (const [gate, ok] of Object.entries(outcome)) gates[gate] = { ok, stale: false };
    }
  }
  return { edited, gates };
};

// The `## Result` block the workflow asks Claude to end with: "Did" items are done, "Not done"
// items are not. A label counts only as a heading, in bold or with a colon, so a bullet that
// starts with "Next, …" stays a bullet.
const RESULT_HEADING = /^#{1,4}\s*Result\b/im;
const LABEL =
  /^\s*(?:[-*]\s+)?(#{1,4}\s*)?(\*\*)?(did|saw|not done|blocked by|next)\b\s*(:)?\s*(\*\*)?\s*(:)?\s*(.*)$/i;
const BULLET = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/;
const EMPTY = /^(none|nothing|n\/a|—|-)\.?$/i;
const MAX_TASKS = 10;

const tidy = (text) => {
  const plain = text
    .replace(/\*\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 100 ? `${plain.slice(0, 99)}…` : plain;
};

// The final answer may not be in the transcript yet when Stop runs, so `last_assistant_message`
// from the hook input comes first.
const reportTasks = (entries, lastMessage) => {
  const texts = entries
    .filter((entry) => entry.type === 'assistant')
    .flatMap((entry) => blocksOf([entry], 'text').map((block) => block.text ?? ''));
  if (typeof lastMessage === 'string') texts.push(lastMessage);
  const report = texts.reverse().find((text) => RESULT_HEADING.test(text));
  if (!report) return null;
  const sections = {};
  let current = null;
  for (const line of report.slice(report.search(RESULT_HEADING)).split('\n').slice(1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const label = LABEL.exec(line);
    const [, heading, bold, name, colon, boldEnd, colonAfter, rest] = label ?? [];
    if (label && (heading || (bold && boldEnd) || colon || colonAfter)) {
      current = name.toLowerCase();
      sections[current] ??= [];
      if (rest.trim()) sections[current].push(rest);
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet && current) sections[current].push(bullet[1]);
  }
  const clean = (items = []) => items.map(tidy).filter((item) => item && !EMPTY.test(item));
  return { done: clean(sections.did), notDone: clean(sections['not done']) };
};

// Without a report, the turn's own actions: each changed file and the gates that ran.
const actionTasks = (cwd, files, stats, gates) => {
  const ran = GATES.filter((gate) => gates[gate]);
  return [
    ...files.map((file) => {
      if (stats.get(file) === 'new') return `Created ${file}`;
      return `${existsSync(join(cwd, file)) ? 'Edited' : 'Deleted'} ${file}`;
    }),
    ...(ran.length ? [`Ran ${ran.map((gate) => `pnpm ${gate}`).join(', ')}`] : []),
  ];
};

const taskLines = (items, box) => [
  ...items.slice(0, MAX_TASKS).map((item) => `  ${box} ${item}`),
  ...(items.length > MAX_TASKS ? [`  … ${items.length - MAX_TASKS} more`] : []),
];

// Edit/Write paths, plus what changed in the working tree since the prompt was sent.
const changedFiles = (input, edited) => {
  const files = new Set(edited);
  const before = input.session_id ? loadSnapshot(input.session_id) : null;
  const after = before ? snapshot(input.cwd ?? process.cwd()) : null;
  if (before && after) for (const path of changedBetween(before, after)) files.add(path);
  return files;
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
  if (gate.ok === false) return '[✗]';
  if (gate.stale) return '[~]';
  return gate.ok === null ? '[?]' : '[x]';
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

  const entries = turnEntries(input.transcript_path);
  const { edited, gates } = collect(entries);
  // Only the project's files count; scratch files outside it are not a code change.
  const files = [...changedFiles(input, edited)]
    .map((path) => relative(cwd, path))
    .filter((path) => path && !path.startsWith('..') && !isAbsolute(path))
    .sort();
  if (files.length === 0) return;

  const stats = diffStat(cwd, files);
  const required = projectGates(cwd);
  const failing = required.filter((gate) => gates[gate]?.ok === false);
  const missing = required.filter(
    (gate) => !gates[gate] || (gates[gate].stale && gates[gate].ok !== false),
  );
  const unknown = required.filter((gate) => gates[gate]?.ok === null && !gates[gate].stale);

  const report = reportTasks(entries, input.last_assistant_message);
  const tasks = report ?? { done: actionTasks(cwd, files, stats, gates), notDone: [] };
  const total = tasks.done.length + tasks.notDone.length;
  const left = tasks.notDone.length;

  // The icon follows the checked gates only: ✅ all passed, ❌ one failed, ⚠️ one not run or
  // unknown. Tasks left come from Claude's own report, so they are added as a note.
  const toCheck = [
    missing.length && `not run after the last edit: ${missing.join(', ')}`,
    unknown.length && `result hidden, run alone: ${unknown.join(', ')}`,
  ].filter(Boolean);
  let verdict = '✅ Task done: all gates passed';
  if (failing.length) verdict = [`❌ Gates failing: ${failing.join(', ')}`, ...toCheck].join('; ');
  else if (toCheck.length) verdict = `⚠️ Gates to check: ${toCheck.join('; ')}`;
  else if (required.length === 0) verdict = '✅ Task done (no gate scripts in package.json)';
  if (left) verdict += ` · ${left} task${left > 1 ? 's' : ''} not done`;

  const lines = [
    verdict,
    ...(total
      ? [
          `Tasks (${report ? "from Claude's report" : 'from tool calls'}):`,
          ...taskLines(tasks.done, '[x]'),
          ...taskLines(tasks.notDone, '[ ]'),
        ]
      : []),
    `Changed (${files.length}):`,
    ...files.map((file) => `  • ${file}${stats.has(file) ? ` (${stats.get(file)})` : ''}`),
  ];
  if (required.length) {
    lines.push(`Gates: ${required.map((gate) => `${mark(gates[gate])} ${gate}`).join('  ')}`);
    lines.push(
      '[x] passed  [✗] failed  [~] passed before a later edit  [?] result hidden  [ ] not run',
    );
  }

  process.stdout.write(JSON.stringify({ systemMessage: lines.join('\n') }));
  notifyDesktop('Claude Code', `${verdict} · ${files.length} file(s) changed`);
};

try {
  main();
} catch (error) {
  // A broken checklist must never break the session.
  process.stderr.write(`checklist-on-stop: ${error.message}\n`);
}

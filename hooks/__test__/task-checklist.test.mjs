// Runs the Stop hook (and the UserPromptSubmit snapshot) on synthetic transcripts in a scratch
// git repository, and checks the checklist it prints.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATES = ['lint', 'format:check', 'typecheck', 'test', 'build'];

let dir;
let transcriptDir;
let id = 0;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'task-checklist-'));
  // Outside the repository, or the snapshot would count the transcript as a changed file.
  transcriptDir = mkdtempSync(join(tmpdir(), 'task-checklist-transcript-'));
  const scripts = Object.fromEntries(GATES.map((gate) => [gate, 'x']));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts }));
  spawnSync('mkdir', ['src'], { cwd: dir });
  writeFileSync(join(dir, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src/dirty.ts'), 'export const d = 1;\n');
  const setup = [
    'git init -q',
    'git add -A',
    'git -c user.email=t@t -c user.name=t commit -qm init',
    'echo "export const d = 2;" > src/dirty.ts',
  ].join(' && ');
  spawnSync('sh', ['-c', setup], { cwd: dir });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(transcriptDir, { recursive: true, force: true });
});

// Transcript pieces
const header = (script) => `\n> demo@ ${script} /repo\n> node x\n\n`;
const ok = (script) => `${header(script)}${script}: ok\n`;
const fail = (script) =>
  `${header(script)}${script}: error\n ELIFECYCLE  Command failed with exit code 1.\n`;
const allOk = GATES.map(ok).join('');
const allGates = GATES.map((gate) => `pnpm ${gate}`).join(' && ');

const prompt = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const say = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const tool = (name, input, content = '', isError = false) => {
  const toolId = `t${++id}`;
  return [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: toolId, name, input }] } },
    {
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: toolId, is_error: isError, content }],
      },
    },
  ];
};
const edit = () => tool('Edit', { file_path: join(dir, 'src/a.ts') });
const bash = (command, content, isError) => tool('Bash', { command }, content, isError);

// Runs one turn: snapshot at the prompt, the file changes, then the Stop hook.
const checklist = (entries, { bashWrite = false, snapshot = true, lastMessage } = {}) => {
  const session = `s-${++id}`;
  if (snapshot) {
    spawnSync(process.execPath, [join(HOOKS, 'turn-snapshot.mjs')], {
      input: JSON.stringify({ cwd: dir, session_id: session }),
    });
  }
  if (bashWrite) writeFileSync(join(dir, 'src/user.ts'), 'export const u = 1;\n');
  else if (JSON.stringify(entries).includes('"Edit"')) {
    writeFileSync(join(dir, 'src/a.ts'), 'export const a = 2;\n');
  }
  const transcript = join(transcriptDir, 'transcript.jsonl');
  writeFileSync(transcript, entries.map((entry) => JSON.stringify(entry)).join('\n'));
  const input = {
    transcript_path: transcript,
    cwd: dir,
    session_id: snapshot ? session : 'none',
    last_assistant_message: lastMessage,
  };
  const out = spawnSync(process.execPath, [join(HOOKS, 'task-checklist.mjs')], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    // No notify-send or osascript on PATH: tests never pop a desktop notification.
    env: { ...process.env, PATH: dirname(spawnSync('which', ['git']).stdout.toString().trim()) },
  });
  return out.stdout ? JSON.parse(out.stdout).systemMessage : null;
};

const has = (message, ...parts) => {
  assert.ok(message, 'expected a checklist');
  for (const part of parts) assert.ok(message.includes(part), `missing "${part}" in\n${message}`);
};
const lacks = (message, ...parts) => {
  for (const part of parts)
    assert.ok(!message.includes(part), `unexpected "${part}" in\n${message}`);
};

// Basics
test('a turn without file changes prints nothing', () => {
  assert.equal(checklist([prompt('hi'), ...bash('ls', 'src')]), null);
});

test('all gates passed', () => {
  has(
    checklist([prompt('do'), ...edit(), ...bash(allGates, allOk)]),
    '✅',
    '[x] lint',
    '[x] build',
  );
});

test('a gate run before a later edit is [~]', () => {
  const message = checklist([prompt('do'), ...edit(), ...bash('pnpm lint', ok('lint')), ...edit()]);
  has(message, '[~] lint', 'not run after the last edit');
});

test('no gate run: ⚠️ and never "Task done"', () => {
  const message = checklist([prompt('do'), ...edit()]);
  has(message, '⚠️ Gates to check: not run after the last edit: lint, format:check', '[ ] lint');
  lacks(message, 'Task done');
});

test('similar script names are not gates', () => {
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash('pnpm test:e2e && pnpm lint:fix', 'x'),
  ]);
  has(message, '[ ] test', '[ ] lint');
});

test('test:coverage counts as test', () => {
  const output = `${header('test:coverage')}ok\n`;
  has(checklist([prompt('do'), ...edit(), ...bash('pnpm test:coverage', output)]), '[x] test');
});

// Gate results read from pnpm's output
test('`; echo $?` does not hide a failure', () => {
  const command = 'pnpm typecheck; echo "EXIT: $?"';
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash(command, `${fail('typecheck')}EXIT: 1\n`),
  ]);
  has(message, '❌ Gates failing: typecheck', '[✗] typecheck');
});

test('one command, one gate fails', () => {
  const output = `${ok('lint')}${fail('typecheck')}done\n`;
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash('pnpm lint; pnpm typecheck', output),
  ]);
  has(message, '[x] lint', '[✗] typecheck');
});

test('a gate after a failed && never ran', () => {
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash('pnpm lint && pnpm test', fail('lint'), true),
  ]);
  has(message, '[✗] lint', '[ ] test');
});

test('-s with a masked exit is [?]', () => {
  const command = 'pnpm -s typecheck; echo "EXIT $?"';
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash(command, 'typecheck: error\nEXIT 1\n'),
  ]);
  has(message, '[?] typecheck', 'result hidden, run alone: typecheck');
});

test('-s alone uses the exit status', () => {
  has(
    checklist([prompt('do'), ...edit(), ...bash('pnpm -s typecheck', 'err\n', true)]),
    '[✗] typecheck',
  );
  has(checklist([prompt('do'), ...edit(), ...bash('pnpm -s typecheck', '')]), '[x] typecheck');
});

test('a failure piped to tail', () => {
  const output = 'boom\n ELIFECYCLE  Test failed.\n';
  has(
    checklist([prompt('do'), ...edit(), ...bash('pnpm test 2>&1 | tail -3', output)]),
    '[✗] test',
  );
});

test('gates run in a loop are found by their headers', () => {
  const command = 'for s in lint format:check typecheck test build; do pnpm $s; done';
  has(checklist([prompt('do'), ...edit(), ...bash(command, allOk)]), '✅', '[x] lint', '[x] build');
  const failing = `${ok('lint')}${fail('typecheck')}`;
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash('for s in lint typecheck; do pnpm $s; done', failing),
  ]);
  has(message, '[x] lint', '[✗] typecheck');
});

// Changed files
test('a file written by Bash is listed; an untouched dirty file is not', () => {
  const message = checklist([prompt('do'), ...bash('printf x > src/user.ts', '')], {
    bashWrite: true,
  });
  has(message, 'src/user.ts (new)');
  lacks(message, 'dirty.ts');
});

test('without a snapshot only Edit/Write files count', () => {
  const entries = [prompt('do'), ...bash('printf x > src/user.ts', '')];
  assert.equal(checklist(entries, { bashWrite: true, snapshot: false }), null);
});

// Tasks
const boldReport = [
  'Done.',
  '',
  '## Result',
  '',
  '**Did**',
  '- Added `subtract(a, b)` to `src/math.js`',
  '- Added a test for subtract',
  '',
  '**Saw**',
  '- everything green',
  '',
  '**Not done**',
  '- Storybook check skipped: overlay error',
  '',
  '**Next**',
  '- Next, commit it',
  '',
  '| Criterion | Proof |',
].join('\n');

const nestedReport = [
  '## Result',
  '',
  '- **Did:**',
  '  - Added the /resources page',
  '  - Next, the nav link was added too',
  '- **Saw:** gates pass',
  '- **Not done:** Nothing.',
].join('\n');

test('tasks from a bold report: Did, Not done; Saw and Next left out', () => {
  const message = checklist([prompt('do'), ...edit(), ...bash(allGates, allOk), say(boldReport)]);
  has(
    message,
    '✅ Task done: all gates passed · 1 task not done',
    "Tasks (from Claude's report):",
    '[x] Added subtract(a, b) to src/math.js',
    '[ ] Storybook check skipped: overlay error',
  );
  lacks(message, 'commit it', 'everything green', 'Criterion');
});

test('tasks from a nested report; "Nothing." is not a task', () => {
  const message = checklist([prompt('do'), ...edit(), ...bash(allGates, allOk), say(nestedReport)]);
  has(message, '✅ Task done: all gates passed', '[x] Next, the nav link was added too');
  lacks(message, 'not done', 'Nothing');
});

test('the final answer is read from last_assistant_message', () => {
  const message = checklist([prompt('do'), ...edit(), ...bash(allGates, allOk)], {
    lastMessage: boldReport,
  });
  has(message, "Tasks (from Claude's report):", '[x] Added a test for subtract');
});

test('without a report, tasks come from tool calls', () => {
  const message = checklist([
    prompt('do'),
    ...edit(),
    ...bash('pnpm lint', ok('lint')),
    say('Added it.'),
  ]);
  has(message, 'Tasks (from tool calls):', '[x] Edited src/a.ts', '[x] Ran pnpm lint');
});

test('a report from an earlier turn is not reused', () => {
  const message = checklist([prompt('a'), say(boldReport), prompt('b'), ...edit()]);
  has(message, 'Tasks (from tool calls):', '[x] Edited src/a.ts');
  lacks(message, 'subtract');
});

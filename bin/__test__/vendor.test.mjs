// Runs `init` and `update` from bin/cli.mjs against a scratch skills repo and a scratch project,
// and checks what lands in the project's .claude/.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { guardRules } from '../guard-rules.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs');
const HOOKS_JSON = {
  hooks: {
    Stop: [
      {
        hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/check.mjs"' }],
      },
    ],
  },
};
const OUR_STOP = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/check.mjs"';

let upstream;
let project;

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const read = (path) => readFileSync(join(project, '.claude', path), 'utf8');
const has = (path) => existsSync(join(project, '.claude', path));
const commit = (message) =>
  spawnSync(
    'sh',
    ['-c', `git add -A && git -c user.email=t@t -c user.name=t commit -qm "${message}"`],
    { cwd: upstream },
  );
const cli = (...args) => {
  const result = spawnSync(process.execPath, [CLI, ...args, '--source', upstream], {
    cwd: project,
    encoding: 'utf8',
  });
  return { ...result, output: result.stdout + result.stderr };
};

beforeEach(() => {
  upstream = mkdtempSync(join(tmpdir(), 'vendor-upstream-'));
  project = mkdtempSync(join(tmpdir(), 'vendor-project-'));
  spawnSync('git', ['init', '-q'], { cwd: upstream });
  write(upstream, 'skills/one/SKILL.md', 'line 1\nline 2\nline 3\nline 4\nline 5\n');
  write(upstream, 'skills/one/references/a.md', 'reference a\n');
  write(upstream, 'hooks/check.mjs', 'console.log("check");\n');
  write(upstream, 'hooks/hooks.json', JSON.stringify(HOOKS_JSON));
  write(upstream, 'hooks/__test__/check.test.mjs', 'test\n');
  write(upstream, 'README.md', 'not vendored\n');
  commit('v1');
});

afterEach(() => {
  rmSync(upstream, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

test('init copies the vendored folders and registers the hooks', () => {
  const result = cli('init');
  assert.equal(result.status, 0, result.output);
  assert.equal(read('skills/one/SKILL.md'), 'line 1\nline 2\nline 3\nline 4\nline 5\n');
  assert.equal(read('skills/one/references/a.md'), 'reference a\n');
  assert.equal(read('hooks/check.mjs'), 'console.log("check");\n');
  assert.ok(!has('hooks/hooks.json'), 'the hook manifest becomes settings, not a file');
  assert.ok(!has('hooks/__test__/check.test.mjs'), 'repo tests stay in the repo');
  assert.ok(!has('README.md'));
  const settings = JSON.parse(read('settings.json'));
  assert.equal(settings.hooks.Stop[0].hooks[0].command, OUR_STOP);
  const lock = JSON.parse(read('astro-stack.lock.json'));
  assert.equal(Object.keys(lock.files).length, 3);
});

test('init keeps existing settings and hooks', () => {
  write(
    project,
    '.claude/settings.json',
    JSON.stringify({
      permissions: { allow: ['Bash(pnpm test)'] },
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] },
    }),
  );
  assert.equal(cli('init').status, 0);
  const settings = JSON.parse(read('settings.json'));
  assert.deepEqual(settings.permissions.allow, ['Bash(pnpm test)']);
  const commands = settings.hooks.Stop.flatMap((group) => group.hooks.map((h) => h.command));
  assert.deepEqual(commands, ['echo mine', OUR_STOP]);
});

test("init writes the guard rules next to the project's own", () => {
  write(
    project,
    '.claude/settings.json',
    JSON.stringify({ permissions: { deny: ['Bash(rm -rf *)'] } }),
  );
  assert.equal(cli('init').status, 0);
  const { permissions } = JSON.parse(read('settings.json'));
  const rules = guardRules();
  assert.deepEqual(permissions.deny, ['Bash(rm -rf *)', ...rules.deny]);
  assert.deepEqual(permissions.ask, rules.ask);
  assert.ok(permissions.deny.includes('Bash(git push * main)'));
  assert.ok(permissions.deny.includes('Read(**/.env)'));
});

test("update replaces the guard rules it wrote and keeps the project's", () => {
  cli('init');
  const settings = JSON.parse(read('settings.json'));
  settings.permissions.deny.push('Bash(rm -rf *)');
  // An older install wrote a rule this version no longer has.
  settings.permissions.deny.push('Bash(git push * old)');
  write(project, '.claude/settings.json', JSON.stringify(settings));
  const lock = JSON.parse(read('astro-stack.lock.json'));
  lock.permissionRules.deny.push('Bash(git push * old)');
  write(project, '.claude/astro-stack.lock.json', JSON.stringify(lock));
  assert.equal(cli('update').status, 0);
  const { deny } = JSON.parse(read('settings.json')).permissions;
  assert.ok(deny.includes('Bash(rm -rf *)'));
  assert.ok(!deny.includes('Bash(git push * old)'));
  assert.equal(deny.filter((rule) => rule === 'Bash(git push * main)').length, 1);
});

test('update brings in new, changed and deleted files', () => {
  cli('init');
  write(upstream, 'skills/two/SKILL.md', 'brand new skill\n');
  write(upstream, 'skills/one/references/a.md', 'reference a, v2\n');
  write(upstream, 'agents/reviewer.md', 'a new folder\n');
  write(upstream, 'rules/testing.md', 'a new rule\n');
  rmSync(join(upstream, 'hooks/check.mjs'));
  write(upstream, 'hooks/hooks.json', JSON.stringify({ hooks: {} }));
  commit('v2');

  const result = cli('update');
  assert.equal(result.status, 0, result.output);
  assert.equal(read('skills/two/SKILL.md'), 'brand new skill\n');
  assert.equal(read('skills/one/references/a.md'), 'reference a, v2\n');
  assert.equal(read('agents/reviewer.md'), 'a new folder\n');
  assert.equal(read('rules/testing.md'), 'a new rule\n');
  assert.ok(!has('hooks/check.mjs'));
  assert.ok(!has('hooks'), 'an emptied folder is removed');
  assert.equal(JSON.parse(read('settings.json')).hooks, undefined);
});

test('update keeps a local edit when the repo did not touch the file', () => {
  cli('init');
  write(project, '.claude/skills/one/SKILL.md', 'my own version\n');
  write(upstream, 'skills/one/references/a.md', 'reference a, v2\n');
  commit('v2');

  assert.equal(cli('update').status, 0);
  assert.equal(read('skills/one/SKILL.md'), 'my own version\n');
  assert.equal(read('skills/one/references/a.md'), 'reference a, v2\n');
});

test('update merges edits to different lines of the same file', () => {
  cli('init');
  write(project, '.claude/skills/one/SKILL.md', 'line 1 (mine)\nline 2\nline 3\nline 4\nline 5\n');
  write(upstream, 'skills/one/SKILL.md', 'line 1\nline 2\nline 3\nline 4\nline 5 (repo)\n');
  commit('v2');

  const result = cli('update');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /merged with your changes/);
  assert.equal(
    read('skills/one/SKILL.md'),
    'line 1 (mine)\nline 2\nline 3\nline 4\nline 5 (repo)\n',
  );

  // The merged file is the new baseline: the next update without repo changes leaves it alone.
  assert.equal(cli('update').status, 0);
  assert.equal(
    read('skills/one/SKILL.md'),
    'line 1 (mine)\nline 2\nline 3\nline 4\nline 5 (repo)\n',
  );
});

test('update marks conflicts when both sides change the same line', () => {
  cli('init');
  write(project, '.claude/skills/one/SKILL.md', 'line 1\nline 2\nline 3 (mine)\nline 4\nline 5\n');
  write(upstream, 'skills/one/SKILL.md', 'line 1\nline 2\nline 3 (repo)\nline 4\nline 5\n');
  commit('v2');

  const result = cli('update');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /CONFLICT/);
  const merged = read('skills/one/SKILL.md');
  assert.match(
    merged,
    /<<<<<<< yours\nline 3 \(mine\)\n=======\nline 3 \(repo\)\n>>>>>>> new version/,
  );
});

test('update does not restore a file the project deleted, and says so when the repo changed it', () => {
  cli('init');
  rmSync(join(project, '.claude/skills/one/references/a.md'));
  rmSync(join(project, '.claude/hooks/check.mjs'));
  write(upstream, 'skills/one/references/a.md', 'reference a, v2\n');
  commit('v2');

  const result = cli('update');
  assert.equal(result.status, 0, result.output);
  assert.ok(!has('skills/one/references/a.md'));
  assert.ok(!has('hooks/check.mjs'));
  assert.match(result.output, /not restored\) {2}\.claude\/skills\/one\/references\/a\.md/);
  assert.doesNotMatch(result.output, /check\.mjs/);
});

test('update keeps a file the repo deleted if the project changed it', () => {
  cli('init');
  write(project, '.claude/skills/one/references/a.md', 'my notes\n');
  rmSync(join(upstream, 'skills/one/references/a.md'));
  commit('v2');

  const result = cli('update');
  assert.match(result.output, /kept because you changed it/);
  assert.equal(read('skills/one/references/a.md'), 'my notes\n');
});

test('init over an older copy keeps differing files and saves the repo version beside them', () => {
  write(project, '.claude/skills/one/SKILL.md', 'copied long ago\n');
  const result = cli('init');
  assert.equal(result.status, 0, result.output);
  assert.equal(read('skills/one/SKILL.md'), 'copied long ago\n');
  assert.equal(read('skills/one/SKILL.md.upstream'), 'line 1\nline 2\nline 3\nline 4\nline 5\n');
});

test('a hook the project removed from settings is not added back', () => {
  cli('init');
  write(project, '.claude/settings.json', JSON.stringify({}));
  write(upstream, 'skills/one/references/a.md', 'v2\n');
  commit('v2');

  assert.equal(cli('update').status, 0);
  assert.equal(JSON.parse(read('settings.json')).hooks, undefined);
});

test('dry run writes nothing', () => {
  const result = cli('init', '--dry-run');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /dry run/);
  assert.ok(!has('skills'));
});

test('update without init points to init', () => {
  const result = cli('update');
  assert.equal(result.status, 1);
  assert.match(result.output, /init` first/);
});

// Runs the PreToolUse hook on tool calls in a scratch folder and checks which secret and
// generated files it keeps Claude away from.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'protect-files.mjs');

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'protect-files-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const run = (tool, toolInput) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: tool, cwd: dir, tool_input: toolInput }),
    encoding: 'utf8',
  });

const assertBlocked = (tool, toolInput, pattern) => {
  const result = run(tool, toolInput);
  assert.equal(result.status, 2, `${tool} ${JSON.stringify(toolInput)} should be blocked`);
  assert.match(result.stderr, pattern);
};

const assertAllowed = (tool, toolInput) => {
  const result = run(tool, toolInput);
  assert.equal(
    result.status,
    0,
    `${tool} ${JSON.stringify(toolInput)} should pass: ${result.stderr}`,
  );
  assert.equal(result.stderr, '');
};

test('blocks reading, searching and editing secret files', () => {
  assertBlocked('Read', { file_path: join(dir, '.env') }, /`\.env` may hold secrets/);
  assertBlocked('Read', { file_path: '.env.local' }, /`\.env\.local`/);
  assertBlocked('Read', { file_path: '.env.production' }, /secrets/);
  assertBlocked('Edit', { file_path: '.env', old_string: 'a', new_string: 'b' }, /secrets/);
  assertBlocked('Write', { file_path: '.env', content: 'PUBLIC_API_URL=x' }, /secrets/);
  assertBlocked('Grep', { pattern: 'TOKEN', path: '.env' }, /secrets/);
  assertBlocked('Read', { file_path: 'certs/server.pem' }, /server\.pem/);
  assertBlocked('Read', { file_path: 'AuthKey_ABC.p8' }, /secrets/);
  assertBlocked('Read', { file_path: '/home/me/.ssh/id_ed25519' }, /secrets/);
});

test('blocks shell commands that touch a secret file', () => {
  assertBlocked('Bash', { command: 'cat .env' }, /`\.env`/);
  assertBlocked('Bash', { command: 'source .env.local && pnpm dev' }, /`\.env\.local`/);
  assertBlocked('Bash', { command: 'grep TOKEN .env' }, /secrets/);
  assertBlocked('Bash', { command: 'echo PUBLIC_API_URL=x >> .env' }, /secrets/);
  assertBlocked('Bash', { command: 'node --env-file=.env server.js' }, /secrets/);
  assertBlocked('Bash', { command: 'sed -i \'s/a/b/\' ".env"' }, /secrets/);
});

test('lets code-skeleton create .env from the template once', () => {
  assertAllowed('Bash', { command: 'cp .env.example .env' });
  writeFileSync(join(dir, '.env'), 'PUBLIC_API_URL=http://localhost:8787\n');
  assertBlocked('Bash', { command: 'cp .env.example .env' }, /secrets/);
  assertBlocked('Bash', { command: 'cp .env backup.txt' }, /secrets/);
});

test('leaves templates and ordinary files open', () => {
  assertAllowed('Read', { file_path: '.env.example' });
  assertAllowed('Edit', { file_path: '.env.example', old_string: 'a', new_string: 'b' });
  assertAllowed('Read', { file_path: 'src/env.d.ts' });
  assertAllowed('Read', { file_path: 'src/libs/orpcClient.ts' });
  assertAllowed('Bash', { command: 'git add .env.example && git commit -m "env template"' });
  assertAllowed('Bash', { command: 'grep -rn import.meta.env src' });
  assertAllowed('Bash', { command: 'pnpm build' });
});

test('blocks hand edits to generated files but lets Claude read them', () => {
  assertBlocked('Edit', { file_path: join(dir, '.astro/types.d.ts') }, /generated/);
  assertBlocked('Write', { file_path: 'dist/index.html', content: '' }, /generated/);
  assertBlocked('Edit', { file_path: 'pnpm-lock.yaml' }, /generated/);
  assertBlocked('Write', { file_path: 'src/routes.gen.ts', content: '' }, /generated/);
  assertBlocked('Edit', { file_path: 'node_modules/astro/index.js' }, /generated/);
  assertAllowed('Read', { file_path: '.astro/types.d.ts' });
  assertAllowed('Read', { file_path: 'pnpm-lock.yaml' });
  assertAllowed('Edit', { file_path: 'src/components/ui/button.tsx' });
  assertAllowed('Write', { file_path: 'src/pages/distance.astro', content: '' });
});

test('ignores input it cannot read', () => {
  assertAllowed('Read', {});
  assertAllowed('Bash', {});
  const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
});

// Validates every skill and command the repo ships, with the rules Claude Code and the
// skill-creator validator apply: frontmatter, name, description, size, and that each
// `references/<file>` a SKILL.md points to exists.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');
const COMMANDS = join(ROOT, 'commands');

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
// Keep SKILL.md under 200 lines (as the backend-dev plugin does) and move detail into references/.
const MAX_SKILL_LINES = 200;

const skills = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const commands = existsSync(COMMANDS)
  ? readdirSync(COMMANDS).filter((file) => file.endsWith('.md'))
  : [];

// `key: value` lines of the YAML frontmatter; quotes around a value are dropped.
const frontmatter = (text, file) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(match, `${file}: no YAML frontmatter at the top`);
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => /^([a-z-]+):\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.trim().replace(/^(["'])(.*)\1$/, '$2')]),
  );
};

const checkDescription = (description, file) => {
  assert.ok(description, `${file}: missing description`);
  assert.ok(
    description.length <= MAX_DESCRIPTION,
    `${file}: description is ${description.length} characters (max ${MAX_DESCRIPTION})`,
  );
  assert.ok(!/[<>]/.test(description), `${file}: description contains < or >`);
};

test('there are skills to check', () => {
  assert.ok(skills.length > 0);
});

for (const skill of skills) {
  const file = `skills/${skill}/SKILL.md`;
  const path = join(SKILLS, skill, 'SKILL.md');

  test(`${file}: frontmatter, name and description`, () => {
    assert.ok(existsSync(path), `${file} is missing`);
    const meta = frontmatter(readFileSync(path, 'utf8'), file);
    assert.equal(meta.name, skill, `${file}: name must match the folder name`);
    assert.match(skill, NAME, `${file}: name must be lowercase words joined by single hyphens`);
    assert.ok(skill.length <= MAX_NAME, `${file}: name is longer than ${MAX_NAME} characters`);
    checkDescription(meta.description, file);
  });

  test(`${file}: under ${MAX_SKILL_LINES} lines`, () => {
    const lines = readFileSync(path, 'utf8').split('\n').length;
    assert.ok(lines <= MAX_SKILL_LINES, `${file}: ${lines} lines`);
  });

  test(`${file}: every referenced file exists`, () => {
    const text = readFileSync(path, 'utf8');
    const referenced = new Set([...text.matchAll(/references\/[\w.-]+\.md/g)].map(([ref]) => ref));
    for (const ref of referenced) {
      // "the skeleton's references/project-files.md" points into another skill.
      const found = skills.some((owner) => existsSync(join(SKILLS, owner, ref)));
      assert.ok(found, `${file}: ${ref} does not exist in any skill`);
    }
  });
}

for (const command of commands) {
  const file = `commands/${command}`;
  test(`${file}: frontmatter and description`, () => {
    const meta = frontmatter(readFileSync(join(COMMANDS, command), 'utf8'), file);
    checkDescription(meta.description, file);
  });
}

#!/usr/bin/env node
// The permission rules that keep Claude off the shared branches, out of secret files and off generated
// ones. Claude Code enforces them itself, before a tool runs, so there is no hook script to break or to
// get around. A plugin cannot ship permissions, so they are written into the project's
// .claude/settings.json: by the installer (bin/vendor.mjs) and, for a plugin install, by code-skeleton.
//
//   deny: pushes to a protected branch; a push that names no branch (its target comes from git config,
//         which no rule can see, so on a protected branch or one tracking it the push would reach it);
//         skipping the Git hooks; force pushes; Read on secret files (.env, keys, keystores); Edit on
//         secret files and on generated ones (.astro/, dist/, pnpm-lock.yaml, *.gen.ts).
//   ask:  any Bash command that names a secret file. The Read deny already covers the Read, Grep and Glob
//         tools; a shell command (`cat .env`, `cp .env.example .env`) is only text to the harness, so a
//         person approves it. Templates (.env.example) are asked about too, since the rule cannot tell.
//
// The harness matches a Bash rule against the whole command with * as a wildcard, hence one rule per
// spelling. A branch may end in * to cover a family: `prod-*` blocks prod-eu, while a feature branch that
// only contains the name (`feat/prod-x`) still pushes.
//
// Usage: node bin/guard-rules.mjs [--write <project dir>] [branch | prefix-*]...
//   default branches: main dev stag prod. Without --write, prints {"deny": [...], "ask": [...]}.
//   With --write, merges the rules into <project dir>/.claude/settings.json, keeping every other rule.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BRANCHES = ['main', 'dev', 'stag', 'prod'];

const PER_BRANCH = [
  'git push * {b}',
  'git push * {b} *',
  'git push *:{b}',
  'git push *:{b} *',
  'git -C * push * {b}',
  'git -C * push * {b} *',
  'git -C * push *:{b}',
  'git -C * push *:{b} *',
  'git push *refs/heads/{b}*',
];
// No space before --force/-f: "git push * --force" would miss "git push --force origin x".
const ONCE = [
  'git commit *--no-verify*',
  'git commit -n*',
  'git commit * -n*',
  'git push *--no-verify*',
  'git push *--force',
  'git push *--force *',
  'git push *-f',
  'git push *-f *',
  'git push * +*',
  'git push *--all*',
  'git push *--mirror*',
  // A push with no branch: exact commands, so `git push -u origin feat/x` stays allowed.
  'git push',
  'git push origin',
  'git push -u',
  'git push -u origin',
  'git push origin -u',
  'git push --set-upstream',
  'git push --set-upstream origin',
  'git push --force-with-lease',
  'git push origin --force-with-lease',
  'git -C * push',
  'git -C * push origin',
  'git -C * push -u origin',
];
// Real files only: a template (.env.example) stays readable, so the skills can copy its keys.
const SECRET_FILES = [
  '.env',
  '.env.local',
  '.env.*.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '*.pem',
  '*.key',
  '*.p8',
  '*.p12',
  '*.pfx',
  '*.jks',
  '*.keystore',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
];
const GENERATED = [
  '.astro/**',
  'dist/**',
  'coverage/**',
  'storybook-static/**',
  'node_modules/**',
  'pnpm-lock.yaml',
  '*.gen.ts',
];
// Broad on purpose: the name can sit inside quotes or code.
const SECRET_WORDS = [
  '.env',
  '.pem',
  '.p8',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
  'id_rsa',
  'id_ed',
];

export function guardRules(branches = DEFAULT_BRANCHES) {
  return {
    deny: [
      ...branches.flatMap((b) => PER_BRANCH.map((p) => `Bash(${p.replaceAll('{b}', b)})`)),
      ...ONCE.map((p) => `Bash(${p})`),
      ...SECRET_FILES.flatMap((f) => [`Read(**/${f})`, `Edit(**/${f})`]),
      ...GENERATED.map((f) => `Edit(**/${f})`),
    ],
    ask: SECRET_WORDS.map((w) => `Bash(*${w}*)`),
  };
}

/**
 * Puts the rules into settings.permissions. Rules added before (`previous`) are replaced, so a rule the
 * repo drops is dropped here too; every rule the project wrote itself is kept.
 */
export function mergeRules(settings, rules, previous = { deny: [], ask: [] }) {
  const permissions = { ...settings.permissions };
  for (const kind of ['deny', 'ask']) {
    const ours = new Set(previous[kind] ?? []);
    const kept = (permissions[kind] ?? []).filter((rule) => !ours.has(rule));
    permissions[kind] = [...new Set([...kept, ...rules[kind]])];
  }
  return { ...settings, permissions };
}

function writeRules(projectDir, branches) {
  const path = join(projectDir, '.claude', 'settings.json');
  const settings = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(mergeRules(settings, guardRules(branches)), null, 2)}\n`);
  return path;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--write');
  const projectDir = at === -1 ? undefined : args.splice(at, 2)[1];
  const named = args.filter((b) => /^[\w./-]+\*?$/.test(b));
  if (named.length !== args.length || (at !== -1 && !projectDir)) {
    console.error('usage: guard-rules.mjs [--write <project dir>] [branch | prefix-*]...');
    process.exit(1);
  }
  const branches = named.length > 0 ? named : DEFAULT_BRANCHES;
  if (projectDir) console.log(`Wrote the guard rules to ${writeRules(projectDir, branches)}`);
  else console.log(JSON.stringify(guardRules(branches), null, 2));
}

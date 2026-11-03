#!/usr/bin/env node
// Lints this plugin beyond what `claude plugin validate` and the skill tests check: manifests agree with each
// other and with package.json, every skill and command takes an argument-hint and a model-invoked skill says
// when to use it, every path a skill points to exists (${CLAUDE_PLUGIN_ROOT}/…, <skill-dir>/…,
// references/…, relative Markdown links), skills hold Markdown only (code lives in scripts/), every hook script
// exists and is tested, and the tech stack versions in AGENTS.md match README.md.
// Usage: node scripts/check-plugin.mjs   (exit 1 on any problem)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const err = (file, msg) => problems.push(`${relative(ROOT, file)}: ${msg}`);
const read = (f) => readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(join(ROOT, f)));
const walk = (p) =>
  statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p];

function frontmatter(file) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(read(file));
  if (!m) {
    err(file, 'missing YAML frontmatter');
    return {};
  }
  const fields = m[1]
    .split('\n')
    .map((l) => /^([a-z_-]+):\s*(.*)$/.exec(l))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim()]);
  // YAML reads an unquoted ": " as a second key, so the whole frontmatter fails to parse
  // ("mapping values are not allowed"); quote the value.
  for (const [k, v] of fields)
    if (!/^["'[{]/.test(v) && /:(\s|$)/.test(v))
      err(file, `${k}: quote the value, it contains ": "`);
  return Object.fromEntries(fields.map(([k, v]) => [k, v.replace(/^(["'])(.*)\1$/, '$2')]));
}

// manifests: plugin.json, the marketplace entry and package.json describe the same plugin
const PLUGIN_JSON = join(ROOT, '.claude-plugin/plugin.json');
const MARKET_JSON = join(ROOT, '.claude-plugin/marketplace.json');
const manifest = json('.claude-plugin/plugin.json');
for (const k of ['name', 'version', 'description', 'author'])
  if (!manifest[k]) err(PLUGIN_JSON, `missing ${k}`);
const entry = json('.claude-plugin/marketplace.json').plugins.find((p) => p.name === manifest.name);
if (!entry) err(MARKET_JSON, `no entry for ${manifest.name}`);
else {
  if (entry.source !== './')
    err(MARKET_JSON, `source "${entry.source}" != "./" (the plugin is this repo)`);
  if (entry.version && entry.version !== manifest.version)
    err(MARKET_JSON, `version ${entry.version} != plugin.json ${manifest.version}`);
}
const pkg = json('package.json');
if (pkg.version !== manifest.version)
  err(join(ROOT, 'package.json'), `version ${pkg.version} != plugin.json ${manifest.version}`);

// skills and commands
const SKILLS = join(ROOT, 'skills');
const skills = readdirSync(SKILLS).filter((d) => statSync(join(SKILLS, d)).isDirectory());
// A skill holds instructions only: SKILL.md and references/*.md, plus assets/ that it copies into a
// project as they are. Code the skills run lives in scripts/ (called as <skill-dir>/../../scripts/…),
// where it is linted, tested and shared, and the installer copies it to .claude/scripts/.
for (const file of walk(SKILLS)) {
  const rel = relative(SKILLS, file);
  if (rel.split('/')[1] === 'assets') continue;
  if (!file.endsWith('.md'))
    err(
      file,
      'only Markdown belongs in a skill; move code to scripts/ (or into assets/ if copied)',
    );
}
for (const name of skills) {
  const file = join(SKILLS, name, 'SKILL.md');
  if (!existsSync(file)) {
    err(file, 'missing');
    continue;
  }
  const fm = frontmatter(file);
  if (!fm['argument-hint'])
    err(file, 'missing argument-hint (what to pass when typing /' + name + ')');
  // typed by people only (/<name>): the description is the menu text, so it need not say when to trigger
  if (fm['disable-model-invocation'] === 'true') continue;
  if (!/\bUse when\b/.test(fm.description ?? '') && !fm.when_to_use)
    err(
      file,
      'Claude picks this skill on its own: say when, with "Use when …" in the description or when_to_use',
    );
}
for (const f of readdirSync(join(ROOT, 'commands')).filter((f) => f.endsWith('.md'))) {
  const file = join(ROOT, 'commands', f);
  if (!frontmatter(file)['argument-hint']) err(file, 'missing argument-hint');
}

// every path a skill, command or hook points to exists
const sources = ['skills', 'commands', 'hooks']
  .flatMap((d) => walk(join(ROOT, d)))
  .filter(
    (f) => /\.(md|json|mjs)$/.test(f) && !f.includes('/assets/') && !f.includes('/__test__/'),
  );
for (const file of sources) {
  const text = read(file);
  for (const [, p] of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]*\w)/g))
    if (!existsSync(join(ROOT, p))) err(file, `broken reference \${CLAUDE_PLUGIN_ROOT}/${p}`);
  const skillDir = /^skills\/[^/]+/.exec(relative(ROOT, file))?.[0];
  for (const [, p] of text.matchAll(/<skill-dir>\/([\w./-]*\w)/g))
    if (!skillDir || !existsSync(join(ROOT, skillDir, p)))
      err(file, `broken reference <skill-dir>/${p}`);
  // "the skeleton's references/project-files.md" may point into another skill
  for (const [ref] of text.matchAll(/references\/[\w.-]+\.md/g))
    if (!skills.some((s) => existsSync(join(SKILLS, s, ref))))
      err(file, `${ref} exists in no skill`);
  // A fence closes only on a bare fence at least as long as its opener, so a template that holds a
  // ```astro block must open with ````; otherwise the inner ``` closes it and the rest reads as code.
  if (file.endsWith('.md')) {
    let open = null;
    text.split('\n').forEach((line, i) => {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!m) return;
      if (!open) open = { fence: m[1], line: i + 1 };
      else if (m[1][0] === open.fence[0] && m[1].length >= open.fence.length && !m[2].trim())
        open = null;
    });
    if (open) err(file, `code fence opened at line ${open.line} is never closed`);
  }
  // links inside code blocks are templates for files the skill writes, not files of this repo
  if (file.endsWith('.md'))
    for (const [, link] of text
      .replace(/^```[\s\S]*?^```/gm, '')
      .matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g))
      if (!/^[a-z]+:/.test(link) && !existsSync(join(dirname(file), link)))
        err(file, `broken link ${link}`);
}

// hooks: each command runs an existing script, no script is orphaned, and each hook is tested
const HOOKS_JSON = join(ROOT, 'hooks/hooks.json');
const wired = new Set();
for (const entries of Object.values(json('hooks/hooks.json').hooks ?? {}))
  for (const e of entries)
    for (const h of e.hooks ?? []) {
      const script = /\$\{CLAUDE_PLUGIN_ROOT\}\/(hooks\/[\w.-]+)/.exec(h.command)?.[1];
      if (!script) err(HOOKS_JSON, `hook does not run a script in hooks/: ${h.command}`);
      else if (!existsSync(join(ROOT, script))) err(HOOKS_JSON, `hook script missing: ${script}`);
      else wired.add(basename(script));
    }
const hookFiles = readdirSync(join(ROOT, 'hooks')).filter((f) => f.endsWith('.mjs'));
const hookCode = hookFiles.map((f) => read(join(ROOT, 'hooks', f))).join('\n');
const testDir = join(ROOT, 'hooks/__test__');
const tests = readdirSync(testDir)
  .map((f) => read(join(testDir, f)))
  .join('\n');
for (const f of hookFiles) {
  if (!wired.has(f) && !hookCode.includes(`./${f}`))
    err(join(ROOT, 'hooks', f), 'neither in hooks.json nor imported by a hook');
  if (wired.has(f) && !tests.includes(f.replace(/\.mjs$/, '')))
    err(join(ROOT, 'hooks', f), 'no test in hooks/__test__/ names it');
}

// tech stack: every package in AGENTS.md's tables has the same version in README.md's
function versions(file, heading) {
  const found = new Map();
  const section =
    read(file)
      .split(/^## /m)
      .find((s) => s.startsWith(heading)) ?? '';
  if (!section) err(file, `no "## ${heading}" section`);
  for (const row of section.split('\n').filter((l) => l.startsWith('|') && l.includes('`'))) {
    const cells = row
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    const pkgCell = cells.find((c) => c.includes('`'));
    const verCell = cells[cells.indexOf(pkgCell) + 1] ?? '';
    const groups = pkgCell.split(/ · | \/ /);
    const vers = verCell.split(/ · | \/ /);
    groups.forEach((g, i) => {
      // the names before any "(note)": `effect` (with `Schema`) is one package
      for (const [, name] of g.split('(')[0].matchAll(/`([@\w/.-]+)`/g))
        found.set(name, (vers.length === groups.length ? vers[i] : verCell).trim());
    });
  }
  return found;
}
const contract = versions(join(ROOT, 'AGENTS.md'), 'Tech stack versions');
const readme = versions(join(ROOT, 'README.md'), 'Tech stack');
for (const [name, v] of contract)
  if (readme.has(name) && readme.get(name) !== v)
    err(join(ROOT, 'README.md'), `${name} is ${readme.get(name)}, AGENTS.md says ${v}`);
  else if (!readme.has(name))
    err(join(ROOT, 'README.md'), `${name} (AGENTS.md: ${v}) is not in the tech stack table`);

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `✔ ${manifest.name} ${manifest.version}: ${skills.length} skills, ${wired.size} hooks, references and versions in sync`,
);

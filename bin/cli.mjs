#!/usr/bin/env node
// Installs the web-dev-stack skills into the current project.
//
//   npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git init
//
// Default: a project-scope Claude Code plugin install (two `claude plugin` commands, recorded in
// .claude/settings.json). `--copy` copies the skills into .claude/skills/ instead.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_URL = 'git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git';
const MARKETPLACE = 'astro-stack';
const PLUGIN = 'web-dev-stack';
const SCOPES = ['project', 'user', 'local'];

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `Usage: astro-stack-skills init [options]

Installs the ${PLUGIN} skills into the current directory's project.

Options:
  --scope <scope>   project (default, shared through .claude/settings.json), user or local
  --source <src>    marketplace source (default: ${REPO_URL});
                    a local path tries unpushed changes
  --copy            copy the skills into .claude/skills/ instead of installing the plugin
  --force           with --copy, overwrite skills that are already there
  -h, --help        show this help
`;

const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const options = {
    command: undefined,
    scope: 'project',
    source: REPO_URL,
    copy: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') options.command = 'help';
    else if (arg === '--copy') options.copy = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--scope' || arg === '--source') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) fail(`${arg} needs a value.`);
      options[arg.slice(2)] = value;
      i += 1;
    } else if (!arg.startsWith('-') && options.command === undefined) options.command = arg;
    else fail(`Unknown option: ${arg}\n\n${HELP}`);
  }
  if (!SCOPES.includes(options.scope)) fail(`--scope must be one of: ${SCOPES.join(', ')}.`);
  return options;
};

// On Windows `claude` is either claude.exe (native installer) or claude.cmd (npm), and a .cmd
// shim only runs through a shell, so probe both.
const quote = (arg) => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

const findClaude = () => {
  const modes = process.platform === 'win32' ? [false, true] : [false];
  return modes.find(
    (shell) => spawnSync('claude', ['--version'], { stdio: 'ignore', shell }).status === 0,
  );
};

const runClaude = (shell, args) => {
  console.log(`\n> claude ${args.join(' ')}`);
  const result = spawnSync('claude', shell ? args.map(quote) : args, { stdio: 'inherit', shell });
  if (result.status !== 0)
    fail(`\`claude ${args.slice(0, 3).join(' ')}\` failed (exit ${result.status}).`);
};

const installPlugin = ({ scope, source }) => {
  const shell = findClaude();
  if (shell === undefined) {
    fail(`The Claude Code CLI (\`claude\`) is not on PATH in this terminal.
  Install it (https://code.claude.com/docs/en/setup), or run these inside a Claude Code session:
    /plugin marketplace add ${source}
    /plugin install ${PLUGIN}@${MARKETPLACE}
  Or copy the skills instead: add --copy to this command.`);
  }
  const runClaudeHere = (args) => runClaude(shell, args);

  runClaudeHere(['plugin', 'marketplace', 'add', source, '--scope', scope]);
  runClaudeHere(['plugin', 'install', `${PLUGIN}@${MARKETPLACE}`, '--scope', scope]);

  const where = {
    project: '.claude/settings.json (commit it, so the team gets the same skills)',
    user: 'your user settings (every project on this machine; teammates do not get it)',
    local: '.claude/settings.local.json (this machine only, not committed)',
  }[scope];
  console.log(`\n✔ ${PLUGIN} installed. Recorded in ${where}.`);
  console.log(`\nNext: start \`claude\` here and run /${PLUGIN}:code-skeleton`);
};

const copySkills = ({ force }) => {
  const from = join(packageRoot, 'skills');
  const to = join(process.cwd(), '.claude', 'skills');
  const names = readdirSync(from, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const existing = names.filter((name) => existsSync(join(to, name)));
  if (existing.length > 0 && !force) {
    fail(
      `.claude/skills/ already has: ${existing.join(', ')}. Run again with --force to overwrite.`,
    );
  }

  for (const name of names) {
    cpSync(join(from, name), join(to, name), { recursive: true, force: true });
    console.log(`  copied .claude/skills/${name}`);
  }
  console.log(
    `\n✔ ${names.length} skills copied. They do not update; run this again with --force to refresh.`,
  );
  console.log('\nNext: start `claude` here and run /code-skeleton');
};

const options = parseArgs(process.argv.slice(2));

if (options.command === undefined || options.command === 'help') {
  console.log(HELP);
} else if (options.command === 'init') {
  console.log(`Installing ${PLUGIN} into ${process.cwd()}`);
  if (options.copy) copySkills(options);
  else installPlugin(options);
} else {
  fail(`Unknown command: ${options.command}\n\n${HELP}`);
}

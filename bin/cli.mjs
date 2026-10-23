#!/usr/bin/env node
// Installs the web-dev-stack skills into the current project, and updates them.
//
//   npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git init
//   npx git+ssh://git@gitlab.asoft-python.com/hoa.nguyen/astro-stack-skills.git update
//
// Default: the skills, hooks and the rest of the repo's Claude Code folders are copied into the
// project's .claude/, where the team can read and change them (bin/vendor.mjs). `update` brings
// in the repo's latest commit and keeps the project's own edits. `--plugin` installs the
// project-scope Claude Code plugin instead (two `claude plugin` commands).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { describe, LOCK_FILE, syncProject } from './vendor.mjs';

const REPO_URL = 'git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git';
const NPX = `npx git+ssh://${REPO_URL.replace(':', '/')}`;
const MARKETPLACE = 'astro-stack';
const PLUGIN = 'web-dev-stack';
const SCOPES = ['project', 'user', 'local'];

const HELP = `Usage: astro-stack-skills <init|update> [options]

Commands:
  init              copy the skills, hooks and other Claude Code folders into ./.claude/
  update            bring ./.claude/ up to the repo's latest commit; your own edits are kept
                    (merged when the repo changed the same file)

Options:
  --source <src>    git URL or local path of the skills repo (default: ${REPO_URL});
                    a local path tries changes you have committed but not pushed
  --dry-run         show what init or update would change, without writing
  --plugin          init only: install the Claude Code plugin instead of copying
  --scope <scope>   with --plugin: project (default), user or local
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
    plugin: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') options.command = 'help';
    else if (arg === '--plugin') options.plugin = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--copy' || arg === '--force')
      fail(
        `${arg} is gone: copying into .claude/ is now the default, and \`update\` refreshes it.`,
      );
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
  Or drop --plugin to copy the skills into .claude/ instead.`);
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

const ORDER = [
  'conflict',
  'side-by-side',
  'kept-deleted',
  'kept-removed-upstream',
  'merged',
  'added',
  'updated',
  'removed',
  'kept-local',
];

const report = (result, { dryRun, command }) => {
  const { actions, commit, previousCommit, settingsChanged, pluginEnabled } = result;
  const sorted = [...actions].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  for (const action of sorted) console.log(`  ${describe(action)}`);
  if (settingsChanged) console.log('  hooks registered in .claude/settings.json');

  const short = (sha) => sha?.slice(0, 7);
  const changed = actions.some((action) => action.type !== 'kept-local') || settingsChanged;
  const verb = dryRun ? 'Would update' : 'Updated';
  if (!changed)
    console.log(`\n✔ .claude/ is already at ${short(commit)}. Your own edits are untouched.`);
  else if (previousCommit && previousCommit !== commit)
    console.log(`\n✔ ${verb} .claude/ from ${short(previousCommit)} to ${short(commit)}.`);
  else
    console.log(
      `\n✔ ${dryRun ? 'Would copy' : 'Copied'} the skills into .claude/ at ${short(commit)}.`,
    );

  const conflicts = actions.filter((action) => action.type === 'conflict');
  const sideBySide = actions.filter((action) => action.type === 'side-by-side');
  if (conflicts.length > 0)
    console.log(
      `\n! ${conflicts.length} file(s) have conflict markers. Pick the lines to keep, delete the markers, then commit.`,
    );
  if (sideBySide.length > 0)
    console.log(
      `\n! ${sideBySide.length} file(s) were already here and differ from the repo. Compare each with its .upstream copy, keep what you want, delete the .upstream file.`,
    );
  if (pluginEnabled)
    console.log(`\n! The ${PLUGIN} plugin is also enabled here, so every skill and hook would run twice. Remove it:
    claude plugin uninstall ${PLUGIN}@${MARKETPLACE} --scope project`);
  if (dryRun) console.log('\n(dry run: nothing was written)');
  else if (changed) {
    console.log(
      `\nCommit .claude/ (including ${LOCK_FILE}), then restart Claude Code or type /reload-plugins.`,
    );
    if (command === 'init') console.log(`To update later: ${NPX} update`);
  }
};

const vendor = (options) => {
  const projectDir = process.cwd();
  const hasLock = existsSync(join(projectDir, '.claude', LOCK_FILE));
  if (options.command === 'update' && !hasLock)
    fail(`No .claude/${LOCK_FILE} here. Run \`${NPX} init\` first, from the project's root.`);
  console.log(
    `${options.command === 'init' && !hasLock ? 'Copying' : 'Updating'} ${PLUGIN} in ${projectDir}/.claude`,
  );
  try {
    report(syncProject({ projectDir, source: options.source, dryRun: options.dryRun }), options);
  } catch (error) {
    fail(error.message);
  }
};

const options = parseArgs(process.argv.slice(2));

if (options.command === undefined || options.command === 'help') {
  console.log(HELP);
} else if (options.command === 'init' && options.plugin) {
  console.log(`Installing ${PLUGIN} into ${process.cwd()}`);
  installPlugin(options);
} else if (options.command === 'init' || options.command === 'update') {
  if (options.plugin)
    fail('--plugin works with init only; update a plugin with `claude plugin update`.');
  vendor(options);
} else {
  fail(`Unknown command: ${options.command}\n\n${HELP}`);
}

#!/usr/bin/env node
// PreToolUse hook: stop Claude from pushing to the shared environment branches.
//
// dev, stag and prod deploy to real environments, so changes reach them through a merge
// request, never a push from a Claude session. The hook reads the Bash command, finds every
// `git push` in it and works out which branches each one would update or delete: the refspecs
// given, or the current branch when there are none. A push that touches a protected branch
// exits 2 with the reason on stderr, which blocks the call and tells Claude why. `--no-verify`
// does not get around it: this runs before the command, not inside git.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const PROTECTED = ['dev', 'stag', 'prod'];

// `git push` options whose value is the next word when not written as `--opt=value`.
const PUSH_OPTIONS_WITH_VALUE = new Set([
  '--repo',
  '--receive-pack',
  '--exec',
  '-o',
  '--push-option',
]);
// `git` options before the subcommand whose value is the next word.
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

// The words of each simple command, split on ; & | ( ) and newlines. Quotes and backslashes
// are honoured; expansions are not, which is enough to read a `git push` line.
const commandsOf = (line) => {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && i + 1 < line.length) word += line[++i];
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (char === '\\' && i + 1 < line.length) {
      i += 1;
      if (line[i] !== '\n') {
        word += line[i];
        inWord = true;
      }
    } else if (';&|()\n'.includes(char)) {
      endCommand();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  return commands;
};

// `{ cwd, args }` for a `git … push …` command, or null for any other command.
const pushOf = (words, cwd) => {
  let i = 0;
  while (/^\w+=/.test(words[i] ?? '')) i += 1; // FOO=bar git push
  if (words[i] !== 'git' && !words[i]?.endsWith('/git')) return null;
  let dir = cwd;
  for (i += 1; i < words.length && words[i].startsWith('-'); i += 1) {
    if (words[i] === '-C') dir = resolve(dir, words[i + 1] ?? '');
    if (GIT_OPTIONS_WITH_VALUE.has(words[i])) i += 1;
  }
  return words[i] === 'push' ? { cwd: dir, args: words.slice(i + 1) } : null;
};

const currentBranch = (cwd) => {
  const result = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
};

const branchName = (ref, cwd) => {
  const name = ref.replace(/^refs\/heads\//, '');
  return name === 'HEAD' ? currentBranch(cwd) : name;
};

// Branches one push would update or delete.
const targetsOf = ({ cwd, args }) => {
  const positional = [];
  let all = false;
  let tagsOnly = false;
  let deleting = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (arg === '--all' || arg === '--branches' || arg === '--mirror') all = true;
    else if (arg === '--tags') tagsOnly = true;
    else if (arg === '-d' || arg === '--delete') deleting = true;
    else if (PUSH_OPTIONS_WITH_VALUE.has(arg)) i += 1;
    else if (!arg.startsWith('-')) positional.push(arg);
  }
  if (all) return PROTECTED;
  const refspecs = positional.slice(1); // the first is the remote
  if (refspecs.length === 0) return tagsOnly ? [] : [currentBranch(cwd)];
  return refspecs.map((refspec) => {
    const spec = refspec.replace(/^\+/, '');
    if (deleting || !spec.includes(':')) return branchName(spec, cwd);
    const [source, destination] = spec.split(':');
    return branchName(destination || source, cwd); // `:dst` deletes dst, `src:` pushes src
  });
};

const main = () => {
  const input = readJson(readFileSync(0, 'utf8'), {});
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !/\bpush\b/.test(command)) return;
  const cwd = input.cwd ?? process.cwd();
  const blocked = new Set(
    commandsOf(command)
      .map((words) => pushOf(words, cwd))
      .filter(Boolean)
      .flatMap(targetsOf)
      .filter((branch) => PROTECTED.includes(branch)),
  );
  if (blocked.size === 0) return;
  const names = [...blocked].map((branch) => `\`${branch}\``).join(', ');
  process.stderr.write(
    `Blocked: this push would update ${names}. ${PROTECTED.join(', ')} are protected ` +
      'environment branches and only change through a merge request.\n' +
      'Push a feature branch instead (`git push -u origin <feature-branch>`) and tell the user ' +
      'which branch to open the merge request from. Do not retry the push another way.\n',
  );
  process.exit(2);
};

try {
  main();
} catch (error) {
  // A broken guard must never break the session.
  process.stderr.write(`protect-branches: ${error.message}\n`);
}

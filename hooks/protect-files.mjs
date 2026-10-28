#!/usr/bin/env node
// PreToolUse hook: keep Claude out of secret files and off generated ones.
//
// Secrets (`.env`, `.env.local`, private keys, keystores) hold values that must never reach the
// transcript, so Claude may not read, search, edit or `cat` them; it asks the user for a value
// instead. The one exception is creating `.env` the first time from a template
// (`cp .env.example .env`), which code-skeleton does and which copies no secret. Templates such
// as `.env.example` stay open.
//
// Generated files (`.astro/`, `dist/`, `coverage/`, `storybook-static/`, `node_modules/`,
// `pnpm-lock.yaml`, `*.gen.ts`) are rewritten by their tools, so a hand edit is lost or breaks
// the next build: Claude may read them but not edit them with Edit or Write.
//
// A blocked call exits 2 with the reason on stderr, which stops it and tells Claude why. Like
// protect-branches, this is a guard against mistakes, not against someone determined to get
// around it.

import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

const TEMPLATE_SUFFIXES = ['.example', '.sample', '.template', '.dist'];
const KEY_EXTENSIONS = ['.pem', '.key', '.p8', '.p12', '.pfx', '.jks', '.keystore'];
const KEY_NAMES = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
const GENERATED_DIRS = ['.astro', 'dist', 'coverage', 'storybook-static', 'node_modules'];
const GENERATED_FILES = ['pnpm-lock.yaml'];
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const isTemplate = (name) => TEMPLATE_SUFFIXES.some((suffix) => name.endsWith(suffix));

const isSecret = (path) => {
  const name = basename(path);
  if (isTemplate(name)) return false;
  if (name === '.env' || name.startsWith('.env.')) return true;
  if (KEY_NAMES.includes(name)) return true;
  return KEY_EXTENSIONS.some((extension) => name.endsWith(extension));
};

const isGenerated = (path, cwd) => {
  const rel = isAbsolute(path) ? relative(cwd, path) : path;
  const parts = rel.split(/[\\/]/);
  if (parts.some((part) => GENERATED_DIRS.includes(part))) return true;
  const name = parts.at(-1) ?? '';
  return GENERATED_FILES.includes(name) || name.endsWith('.gen.ts');
};

// The words of each simple command, split on ; & | ( ) and newlines, with quotes honoured.
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
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (';&|()\n'.includes(char)) {
      endCommand();
    } else if (/\s/.test(char) || char === '<' || char === '>') {
      endWord();
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  return commands;
};

// `cp <template> <secret>` that creates the secret file: copies no secret, so it may run.
const createsFromTemplate = (words, cwd) => {
  const args = words.slice(1).filter((word) => !word.startsWith('-'));
  if (words[0] !== 'cp' || args.length !== 2) return false;
  const [source, target] = args;
  return isTemplate(basename(source)) && isSecret(target) && !existsSync(resolve(cwd, target));
};

const secretsInCommand = (command, cwd) =>
  commandsOf(command)
    .filter((words) => !createsFromTemplate(words, cwd))
    .flatMap((words) => words.map((word) => word.replace(/^[\w-]*=/, '')))
    .filter((word) => isSecret(word));

const block = (reason) => {
  process.stderr.write(`Blocked: ${reason}\n`);
  process.exit(2);
};

const main = () => {
  const input = readJson(readFileSync(0, 'utf8'), {});
  const tool = input.tool_name;
  const toolInput = input.tool_input ?? {};
  const cwd = input.cwd ?? process.cwd();

  if (tool === 'Bash') {
    if (typeof toolInput.command !== 'string') return;
    const found = [...new Set(secretsInCommand(toolInput.command, cwd))];
    if (found.length === 0) return;
    block(
      `this command touches ${found.map((path) => `\`${path}\``).join(', ')}, which may hold ` +
        'secrets. Do not read, print, copy or edit secret files. Ask the user for the value you ' +
        'need, or for them to change the file themselves. Do not retry another way.',
    );
  }

  const path = toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path;
  if (typeof path !== 'string' || path === '') return;

  if (isSecret(path)) {
    block(
      `\`${basename(path)}\` may hold secrets, so Claude does not read, search or edit it. ` +
        'Ask the user for the value you need, or for them to change the file. Edit the ' +
        'template (`.env.example`) for new variables, with placeholders only.',
    );
  }

  if (EDIT_TOOLS.has(tool) && isGenerated(path, cwd)) {
    block(
      `\`${relative(cwd, resolve(cwd, path))}\` is generated; a hand edit is lost the next time ` +
        'its tool runs. Change the source it comes from, or run the tool (`pnpm install`, ' +
        '`astro sync`, `pnpm build`) instead.',
    );
  }
};

try {
  main();
} catch (error) {
  // A broken guard must never break the session.
  process.stderr.write(`protect-files: ${error.message}\n`);
}

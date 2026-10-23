// Copies the skills repo into a project's .claude/ folder and keeps it up to date.
//
// Every folder in VENDORED_DIRS is copied file by file into .claude/<same path>, so people can
// read and edit what they run. .claude/astro-stack.lock.json records the source commit and a hash
// of each file as it was written. On update, that hash tells a file the project changed from one
// it left alone:
//
//   untouched here           → replaced by the new version (or deleted, if the repo deleted it)
//   changed here only        → kept
//   changed here and there   → three-way merge (`git merge-file`); overlaps get conflict markers
//   new in the repo          → added
//
// The hooks in hooks/hooks.json are registered in .claude/settings.json with paths into
// .claude/hooks/, next to whatever hooks the project already has.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

// Repo folders that land in .claude/ under the same name. Claude Code reads skills, rules, agents,
// commands and output styles from these folders; hooks are scripts the settings point at.
// A folder that does not exist in the repo is skipped, so adding one later needs only this list.
export const VENDORED_DIRS = ['skills', 'hooks', 'rules', 'agents', 'commands', 'output-styles'];
// Repo-only files: tests of the repo itself, and the plugin hook manifest (it becomes settings).
const SKIPPED = ['hooks/__test__', 'hooks/hooks.json'];

export const LOCK_FILE = 'astro-stack.lock.json';
const PLUGIN_ROOT = '${CLAUDE_PLUGIN_ROOT}';
const PROJECT_ROOT = '$CLAUDE_PROJECT_DIR/.claude';

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const toPosix = (path) => path.split(sep).join('/');

const git = (args, options = {}) =>
  spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });

const readJson = (path, fallback) => {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${path} is not valid JSON. Fix it, then run this again.`);
  }
};

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

/** Clones the source into a temporary folder and returns where, plus the commit it is at. */
export const fetchSource = (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'astro-stack-skills-'));
  const clone = git(['clone', '--quiet', source, dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (clone.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`git clone ${source} failed:\n${clone.stderr.trim()}`);
  }
  const commit = git(['rev-parse', 'HEAD'], { cwd: dir }).stdout.trim();
  return { dir, commit };
};

/** Every vendored file in a checkout, as POSIX paths relative to its root. */
export const listUpstreamFiles = (root) => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const rel = toPosix(relative(root, path));
      if (SKIPPED.some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(rel);
    }
  };
  for (const name of VENDORED_DIRS) if (existsSync(join(root, name))) walk(join(root, name));
  return files.sort();
};

const baseContent = (checkout, commit, path) => {
  if (!commit) return undefined;
  const shown = git(['show', `${commit}:${path}`], { cwd: checkout, encoding: 'buffer' });
  return shown.status === 0 ? shown.stdout : undefined;
};

const mergeThreeWay = (ours, base, theirs) => {
  const dir = mkdtempSync(join(tmpdir(), 'astro-stack-merge-'));
  try {
    const [o, b, t] = ['ours', 'base', 'theirs'].map((name) => join(dir, name));
    writeFileSync(o, ours);
    writeFileSync(b, base);
    writeFileSync(t, theirs);
    const labels = ['-L', 'yours', '-L', 'previous version', '-L', 'new version'];
    const result = git(['merge-file', '-p', ...labels, o, b, t], { encoding: 'buffer' });
    if (result.status < 0 || result.status === null || result.status > 127)
      throw new Error(`git merge-file failed: ${result.stderr}`);
    return { content: result.stdout, conflicts: result.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * Works out what an update does to each file, without writing anything.
 * Returns the actions and the file hashes the lock should hold afterwards.
 */
export const planSync = ({ claudeDir, checkout, commit, lock }) => {
  const upstream = listUpstreamFiles(checkout);
  const upstreamSet = new Set(upstream);
  const previous = lock?.files ?? {};
  const paths = [...new Set([...upstream, ...Object.keys(previous)])].sort();
  const actions = [];
  const files = {};

  for (const path of paths) {
    const target = join(claudeDir, path);
    const local = existsSync(target) ? readFileSync(target) : undefined;
    const localHash = local && hash(local);
    const baseHash = previous[path];
    const next = upstreamSet.has(path) ? readFileSync(join(checkout, path)) : undefined;
    const nextHash = next && hash(next);

    if (next === undefined) {
      // Deleted in the repo.
      if (local === undefined) continue;
      if (localHash === baseHash) actions.push({ type: 'removed', path });
      else actions.push({ type: 'kept-removed-upstream', path });
      continue;
    }
    if (local === undefined) {
      if (baseHash === undefined) {
        actions.push({ type: 'added', path, content: next });
        files[path] = nextHash;
      } else if (nextHash === baseHash) {
        // Deleted here on purpose and unchanged in the repo: stay deleted.
        files[path] = baseHash;
      } else {
        actions.push({ type: 'kept-deleted', path });
        files[path] = nextHash;
      }
      continue;
    }
    if (localHash === nextHash) {
      files[path] = nextHash;
      continue;
    }
    if (baseHash !== undefined && localHash === baseHash) {
      actions.push({ type: 'updated', path, content: next });
      files[path] = nextHash;
      continue;
    }
    if (baseHash !== undefined && nextHash === baseHash) {
      actions.push({ type: 'kept-local', path });
      files[path] = baseHash;
      continue;
    }
    const base = baseHash === undefined ? undefined : baseContent(checkout, lock?.commit, path);
    if (base === undefined || hash(base) !== baseHash) {
      // No common ancestor (a file that was here before the first install, or a lost commit):
      // keep the project's file and put the repo's next to it.
      actions.push({ type: 'side-by-side', path, content: next });
    } else {
      const merged = mergeThreeWay(local, base, next);
      actions.push({
        type: merged.conflicts > 0 ? 'conflict' : 'merged',
        path,
        content: merged.content,
        conflicts: merged.conflicts,
      });
    }
    files[path] = nextHash;
  }
  return { actions, files, commit };
};

const removeEmptyParents = (dir, stopAt) => {
  let current = dir;
  while (current.startsWith(stopAt) && current !== stopAt) {
    if (!existsSync(current) || readdirSync(current).length > 0) return;
    rmdirSync(current);
    current = dirname(current);
  }
};

const applyActions = (claudeDir, actions) => {
  for (const action of actions) {
    const target = join(claudeDir, action.path);
    if (['added', 'updated', 'merged', 'conflict'].includes(action.type)) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, action.content);
    } else if (action.type === 'side-by-side') {
      writeFileSync(`${target}.upstream`, action.content);
    } else if (action.type === 'removed') {
      rmSync(target);
      removeEmptyParents(dirname(target), claudeDir);
    }
  }
};

/** Hook groups from the repo's hooks/hooks.json, pointed at .claude/hooks/. */
export const readUpstreamHooks = (checkout) => {
  const manifest = readJson(join(checkout, 'hooks', 'hooks.json'), { hooks: {} });
  const text = JSON.stringify(manifest.hooks ?? {})
    .split(PLUGIN_ROOT)
    .join(PROJECT_ROOT);
  return JSON.parse(text);
};

const commandsOf = (hooksByEvent) =>
  Object.values(hooksByEvent)
    .flat()
    .flatMap((group) => (group.hooks ?? []).map((hook) => hook.command))
    .filter(Boolean);

/**
 * Puts the repo's hooks into settings.hooks. Hooks this tool added before are replaced; a hook
 * the project deleted stays deleted; every other hook in the file is left as it is.
 */
export const mergeHooks = (settings, upstreamHooks, previousCommands = []) => {
  const current = settings.hooks ?? {};
  const present = new Set(commandsOf(current));
  const ours = new Set(previousCommands);
  const deletedHere = new Set(previousCommands.filter((command) => !present.has(command)));

  const result = {};
  for (const [event, groups] of Object.entries(current)) {
    const kept = groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook) => !ours.has(hook.command)),
      }))
      .filter((group) => group.hooks.length > 0);
    if (kept.length > 0) result[event] = kept;
  }
  for (const [event, groups] of Object.entries(upstreamHooks)) {
    for (const group of groups) {
      const hooks = (group.hooks ?? []).filter((hook) => !deletedHere.has(hook.command));
      if (hooks.length > 0) (result[event] ??= []).push({ ...group, hooks });
    }
  }
  const added = commandsOf(upstreamHooks).filter((command) => !deletedHere.has(command));
  const next = { ...settings };
  if (Object.keys(result).length > 0) next.hooks = result;
  else delete next.hooks;
  return { settings: next, commands: added };
};

const LABELS = {
  added: 'added',
  updated: 'updated',
  merged: 'merged with your changes',
  conflict: 'CONFLICT, fix the <<<<<<< markers',
  'side-by-side': 'kept yours; new version saved as .upstream',
  'kept-local': 'kept your changes',
  'kept-deleted': 'you deleted it; the repo changed it (not restored)',
  'kept-removed-upstream': 'removed from the repo; kept because you changed it',
  removed: 'removed (deleted from the repo)',
};

/** Installs or updates .claude/ from the source. Returns the actions for the caller to report. */
export const syncProject = ({ projectDir, source, dryRun = false }) => {
  const claudeDir = join(projectDir, '.claude');
  const lockPath = join(claudeDir, LOCK_FILE);
  const settingsPath = join(claudeDir, 'settings.json');
  const lock = readJson(lockPath, undefined);
  const { dir: checkout, commit } = fetchSource(source);
  try {
    const plan = planSync({ claudeDir, checkout, commit, lock });
    const settings = readJson(settingsPath, {});
    const hooks = mergeHooks(settings, readUpstreamHooks(checkout), lock?.hookCommands);
    const settingsChanged = JSON.stringify(hooks.settings) !== JSON.stringify(settings);

    if (!dryRun) {
      applyActions(claudeDir, plan.actions);
      if (settingsChanged) writeJson(settingsPath, hooks.settings);
      writeJson(lockPath, {
        source,
        commit,
        hookCommands: hooks.commands,
        files: plan.files,
      });
    }
    return {
      actions: plan.actions,
      commit,
      previousCommit: lock?.commit,
      settingsChanged,
      pluginEnabled: Object.keys(settings.enabledPlugins ?? {}).some(
        (id) => id.startsWith('web-dev-stack@') && settings.enabledPlugins[id],
      ),
    };
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
};

export const describe = (action) => `${LABELS[action.type]}  .claude/${action.path}`;

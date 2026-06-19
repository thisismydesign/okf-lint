import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, basename, dirname, resolve } from 'node:path';
import type { Bundle, OkfFile } from './types.js';

const RESERVED_INDEX = 'index.md';
const RESERVED_LOG = 'log.md';
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

/**
 * Discover an OKF bundle rooted at `target`.
 *
 * If `target` is a file, its containing directory is treated as the bundle root
 * (the whole bundle is still read so that bundle-level rules have full context).
 */
export function loadBundle(target: string): Bundle {
  const absTarget = resolve(target);
  const stats = statSync(absTarget);
  const root = stats.isDirectory() ? absTarget : dirname(absTarget);

  const files: OkfFile[] = [];
  for (const absPath of walk(root)) {
    if (!absPath.toLowerCase().endsWith('.md')) continue;
    const relPath = relative(root, absPath).split(sep).join('/');
    const name = basename(absPath).toLowerCase();
    const reservedKind = name === RESERVED_INDEX ? 'index' : name === RESERVED_LOG ? 'log' : null;
    files.push({
      absPath,
      relPath,
      content: readFileSync(absPath, 'utf8'),
      reserved: reservedKind !== null,
      reservedKind,
      isBundleRootIndex: relPath === RESERVED_INDEX,
    });
  }

  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { root, files };
}

function* walk(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      yield join(dir, entry.name);
    }
  }
}

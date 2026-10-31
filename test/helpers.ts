import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import type { Diagnostic } from '../src/index.js';

/** Absolute path to a bundle under `examples/`, e.g. `example('v0.2/valid')`. */
export const example = (name: string): string =>
  fileURLToPath(new URL(`../examples/${name}`, import.meta.url));

/** The distinct rule ids present in a list of diagnostics. */
export function ruleIds(diagnostics: { ruleId: string }[]): Set<string> {
  return new Set(diagnostics.map((d) => d.ruleId));
}

/** Diagnostics produced by a single rule. */
export function byRule(diagnostics: Diagnostic[], ruleId: string): Diagnostic[] {
  return diagnostics.filter((d) => d.ruleId === ruleId);
}

const tempDirs: string[] = [];

/** Write `files` (relative path → content) into a fresh temp directory and return its path. */
export function makeBundle(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'okf-lint-'));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

/** Build a concept document from a frontmatter YAML string and an optional body. */
export function concept(frontmatter: string, body = ''): string {
  return `---\n${frontmatter.trim()}\n---\n\n${body}`;
}

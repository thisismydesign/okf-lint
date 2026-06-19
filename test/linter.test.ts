import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lint } from '../src/index.js';

const example = (name: string): string =>
  fileURLToPath(new URL(`../examples/${name}`, import.meta.url));

function ruleIds(diagnostics: { ruleId: string }[]): Set<string> {
  return new Set(diagnostics.map((d) => d.ruleId));
}

const tempDirs: string[] = [];
function makeBundle(files: Record<string, string>): string {
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

describe('valid example bundle', () => {
  it('produces no diagnostics', () => {
    const result = lint(example('valid'));
    expect(result.diagnostics).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.version).toMatchObject({ resolved: '0.1', supported: true, declared: true });
  });

  it('resolves cross-links correctly for a relative bundle path', () => {
    // Regression: a relative root must still resolve internal links cleanly.
    const result = lint('examples/valid');
    expect(result.diagnostics).toEqual([]);
  });
});

describe('invalid example bundle', () => {
  it('reports the expected errors and warnings', () => {
    const result = lint(example('invalid'));
    expect(result.errorCount).toBe(4);
    expect(result.warningCount).toBe(6);

    const ids = ruleIds(result.diagnostics);
    expect(ids).toContain('frontmatter-present');
    expect(ids).toContain('type-required');
    expect(ids).toContain('index-version-key');
    expect(ids).toContain('log-date-format');
    expect(ids).toContain('tags-type');
    expect(ids).toContain('timestamp-format');
    expect(ids).toContain('valid-links');
    expect(ids).toContain('prefer-absolute-links');
    expect(ids).toContain('recommended-description');

    // resource and tags are situational, so they are not recommended.
    expect(ids).not.toContain('recommended-resource');
    expect(ids).not.toContain('recommended-tags');
  });
});

describe('version resolution', () => {
  it('warns and falls back to latest when no version is declared', () => {
    const dir = makeBundle({
      'concepts/a.md':
        '---\ntype: Table\ntitle: A\ndescription: d\nresource: r\ntags: [t]\ntimestamp: 2026-01-01\n---\n',
    });
    const result = lint(dir);
    expect(result.version).toMatchObject({ declared: false, resolved: '0.1' });
    expect(ruleIds(result.diagnostics)).toContain('okf-version-declared');
  });

  it('warns and falls back when the declared version is unsupported', () => {
    const dir = makeBundle({
      'index.md': '---\nokf_version: "0.2"\n---\n\n# Items\n',
    });
    const result = lint(dir);
    expect(result.version).toMatchObject({
      declared: true,
      supported: false,
      requested: '0.2',
      resolved: '0.1',
    });
    expect(ruleIds(result.diagnostics)).toContain('okf-version-supported');
  });

  it('flags an unquoted (numeric) okf_version', () => {
    const dir = makeBundle({ 'index.md': '---\nokf_version: 0.1\n---\n\n# Items\n' });
    const result = lint(dir);
    expect(result.version).toMatchObject({ supported: true, resolved: '0.1' });
    expect(ruleIds(result.diagnostics)).toContain('okf-version-format');
  });
});

describe('configuration', () => {
  it('disables a rule via config', () => {
    const withWarning = lint(example('invalid'));
    expect(ruleIds(withWarning.diagnostics)).toContain('recommended-description');

    const disabled = lint(example('invalid'), {
      config: { rules: { 'recommended-description': 'off' } },
    });
    expect(ruleIds(disabled.diagnostics)).not.toContain('recommended-description');
    expect(disabled.warningCount).toBe(withWarning.warningCount - 1);
  });

  it('escalates a warning to an error via config', () => {
    const result = lint(example('invalid'), {
      config: { rules: { 'tags-type': 'error' } },
    });
    const tagsDiag = result.diagnostics.find((d) => d.ruleId === 'tags-type');
    expect(tagsDiag?.severity).toBe('error');
  });
});

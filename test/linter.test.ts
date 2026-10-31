import { describe, it, expect } from 'vitest';
import { lint, SUPPORTED_VERSIONS, LATEST_VERSION, getRuleSet } from '../src/index.js';
import { example, ruleIds, makeBundle } from './helpers.js';

describe('supported versions', () => {
  it('supports 0.1 and 0.2, with 0.2 as latest', () => {
    expect(SUPPORTED_VERSIONS).toEqual(['0.1', '0.2']);
    expect(LATEST_VERSION).toBe('0.2');
  });

  it('has unique rule ids within every rule set', () => {
    for (const version of SUPPORTED_VERSIONS) {
      const ids = getRuleSet(version).map((r) => r.meta.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('v0.1 example bundles', () => {
  it('valid bundle produces no diagnostics', () => {
    const result = lint(example('v0.1/valid'));
    expect(result.diagnostics).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.version).toMatchObject({ resolved: '0.1', supported: true, declared: true });
  });

  it('resolves cross-links correctly for a relative bundle path', () => {
    // Regression: a relative root must still resolve internal links cleanly.
    const result = lint('examples/v0.1/valid');
    expect(result.diagnostics).toEqual([]);
  });

  it('invalid bundle reports the expected errors and warnings', () => {
    const result = lint(example('v0.1/invalid'));
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

  it('does not apply v0.2 rules to a v0.1 bundle', () => {
    const dir = makeBundle({
      'index.md': '---\nokf_version: "0.1"\n---\n',
      'log.md': '# Log\n',
      'a.md':
        '---\ntype: Metric\ntitle: A\ndescription: d\ntimestamp: 2026-01-01T00:00:00Z\nstatus: bogus\n---\n\n# Citations\n\n- x\n',
    });
    const result = lint(dir);
    expect(result.version.resolved).toBe('0.1');
    expect(result.diagnostics).toEqual([]);
  });
});

describe('v0.2 example bundles', () => {
  it('valid bundle produces no diagnostics', () => {
    const result = lint(example('v0.2/valid'));
    expect(result.diagnostics).toEqual([]);
    expect(result.version).toMatchObject({ resolved: '0.2', supported: true, declared: true });
  });

  it('invalid bundle reports a representative spread of 0.2 problems', () => {
    const result = lint(example('v0.2/invalid'));
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(26);

    const ids = ruleIds(result.diagnostics);
    expect(ids).toContain('type-required');
    // provenance
    expect(ids).toContain('sources-resource');
    expect(ids).toContain('sources-id-unique');
    expect(ids).toContain('sources-signals');
    expect(ids).toContain('usage-window-shape');
    expect(ids).toContain('usage-count-window');
    expect(ids).toContain('footnote-source-id');
    // trust
    expect(ids).toContain('recommended-generated');
    expect(ids).toContain('verified-shape');
    expect(ids).toContain('actor-format');
    // lifecycle
    expect(ids).toContain('status-value');
    expect(ids).toContain('stale-after-format');
    expect(ids).toContain('stale-after-passed');
    // computation
    expect(ids).toContain('computation-runtime');
    expect(ids).toContain('computation-parameters');
    expect(ids).toContain('computation-body');
    expect(ids).toContain('computation-executor');
    expect(ids).toContain('computation-attester');
    expect(ids).toContain('computation-paths');
    // migration
    expect(ids).toContain('legacy-timestamp');
    expect(ids).toContain('legacy-citations');
    // superseded in 0.2
    expect(ids).not.toContain('recommended-timestamp');
  });
});

describe('version resolution', () => {
  it('warns and falls back to latest (0.2) when no version is declared', () => {
    const dir = makeBundle({
      'concepts/a.md':
        '---\ntype: Table\ntitle: A\ndescription: d\nresource: r\ntags: [t]\ngenerated: { by: human:x, at: 2026-01-01T00:00:00Z }\n---\n',
    });
    const result = lint(dir);
    expect(result.version).toMatchObject({ declared: false, resolved: '0.2' });
    expect(ruleIds(result.diagnostics)).toContain('okf-version-declared');
  });

  it('validates against 0.1 when "0.1" is declared', () => {
    const dir = makeBundle({ 'index.md': '---\nokf_version: "0.1"\n---\n\n# Items\n' });
    const result = lint(dir);
    expect(result.version).toMatchObject({ declared: true, supported: true, resolved: '0.1' });
  });

  it('validates against 0.2 when "0.2" is declared', () => {
    const dir = makeBundle({ 'index.md': '---\nokf_version: "0.2"\n---\n\n# Items\n' });
    const result = lint(dir);
    expect(result.version).toMatchObject({ declared: true, supported: true, resolved: '0.2' });
    expect(ruleIds(result.diagnostics)).not.toContain('okf-version-supported');
  });

  it('warns and falls back when the declared version is unsupported', () => {
    const dir = makeBundle({
      'index.md': '---\nokf_version: "0.3"\n---\n\n# Items\n',
    });
    const result = lint(dir);
    expect(result.version).toMatchObject({
      declared: true,
      supported: false,
      requested: '0.3',
      resolved: '0.2',
    });
    expect(ruleIds(result.diagnostics)).toContain('okf-version-supported');
  });

  it('flags an unquoted (numeric) okf_version', () => {
    const dir = makeBundle({ 'index.md': '---\nokf_version: 0.2\n---\n\n# Items\n' });
    const result = lint(dir);
    expect(result.version).toMatchObject({ supported: true, resolved: '0.2' });
    expect(ruleIds(result.diagnostics)).toContain('okf-version-format');
  });
});

describe('configuration', () => {
  it('disables a rule via config', () => {
    const withWarning = lint(example('v0.1/invalid'));
    expect(ruleIds(withWarning.diagnostics)).toContain('recommended-description');

    const disabled = lint(example('v0.1/invalid'), {
      config: { rules: { 'recommended-description': 'off' } },
    });
    expect(ruleIds(disabled.diagnostics)).not.toContain('recommended-description');
    expect(disabled.warningCount).toBe(withWarning.warningCount - 1);
  });

  it('escalates a warning to an error via config', () => {
    const result = lint(example('v0.1/invalid'), {
      config: { rules: { 'tags-type': 'error' } },
    });
    const tagsDiag = result.diagnostics.find((d) => d.ruleId === 'tags-type');
    expect(tagsDiag?.severity).toBe('error');
  });

  it('escalates a 0.2 rule to an error via config', () => {
    const result = lint(example('v0.2/invalid'), {
      config: { rules: { 'computation-runtime': 'error' } },
    });
    expect(result.diagnostics.find((d) => d.ruleId === 'computation-runtime')?.severity).toBe(
      'error',
    );
    expect(result.errorCount).toBe(2);
  });
});

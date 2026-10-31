/**
 * Specs for the OKF v0.2 rule set, one `describe` per spec family.
 *
 * Each test builds a minimal bundle that declares `okf_version: "0.2"` and
 * asserts on the diagnostics of a single rule, so unrelated warnings (missing
 * `log.md`, etc.) do not affect the outcome.
 */
import { describe, it, expect } from 'vitest';
import { lint, type Diagnostic, type LintOptions } from '../src/index.js';
import { byRule, concept, makeBundle } from './helpers.js';

const INDEX = '---\nokf_version: "0.2"\n---\n\n# Items\n';

/** A fully-recommended 0.2 concept frontmatter to build variations on. */
const GOOD = `
type: Metric
title: Revenue
description: Recognized revenue for a fiscal year.
generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-20T22:53:05Z }
`;

/** Lint a 0.2 bundle made of `files` and return all diagnostics. */
function lint02(files: Record<string, string>, options: LintOptions = {}): Diagnostic[] {
  const dir = makeBundle({ 'index.md': INDEX, ...files });
  return lint(dir, options).diagnostics;
}

/** Lint a single concept (`a.md`) and return the diagnostics of one rule. */
function ruleOn(
  ruleId: string,
  frontmatter: string,
  body = '',
  extra: Record<string, string> = {},
) {
  return byRule(lint02({ 'a.md': concept(frontmatter, body), ...extra }), ruleId);
}

// ---------------------------------------------------------------------------
// §5.1 Provenance
// ---------------------------------------------------------------------------

describe('provenance (§5.1)', () => {
  describe('sources-type', () => {
    it('accepts a list of mappings', () => {
      const fm = `${GOOD}\nsources:\n  - { id: a, resource: https://x, title: A }`;
      expect(ruleOn('sources-type', fm)).toEqual([]);
    });

    it('rejects a non-list', () => {
      const d = ruleOn('sources-type', `${GOOD}\nsources: https://x`);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toMatch(/YAML list/);
    });

    it('rejects non-mapping entries and non-string id/title', () => {
      const d = ruleOn(
        'sources-type',
        `${GOOD}\nsources:\n  - https://x\n  - { resource: r, id: 3, title: [t] }`,
      );
      expect(d.map((x) => x.message)).toEqual([
        expect.stringContaining('`sources[0]` should be a mapping'),
        expect.stringContaining('`sources[1].id` should be a string'),
        expect.stringContaining('`sources[1].title` should be a string'),
      ]);
    });
  });

  describe('sources-resource', () => {
    it('flags entries without a resource', () => {
      const d = ruleOn(
        'sources-resource',
        `${GOOD}\nsources:\n  - { id: a }\n  - { id: b, resource: '' }\n  - { id: c, resource: all queries in project X }`,
      );
      expect(d.map((x) => x.message)).toEqual([
        expect.stringContaining('`sources[0]` is missing `resource`'),
        expect.stringContaining('`sources[1]` is missing `resource`'),
      ]);
    });
  });

  describe('sources-id-unique', () => {
    it('flags duplicate ids', () => {
      const d = ruleOn(
        'sources-id-unique',
        `${GOOD}\nsources:\n  - { id: a, resource: r1 }\n  - { id: b, resource: r2 }\n  - { id: a, resource: r3 }`,
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`sources[2].id` `a` is a duplicate');
    });

    it('ignores entries without ids', () => {
      expect(
        ruleOn(
          'sources-id-unique',
          `${GOOD}\nsources:\n  - { resource: r1 }\n  - { resource: r2 }`,
        ),
      ).toEqual([]);
    });
  });

  describe('sources-signals', () => {
    it('accepts well-typed credibility signals', () => {
      const fm = `${GOOD}\nsources:\n  - { resource: r, author: team:ga4-docs, usage_count: 5000, last_modified: 2026-05-30T00:00:00Z }\nusage_window: { from: 2026-06-01T00:00:00Z, to: 2026-06-30T00:00:00Z }`;
      expect(ruleOn('sources-signals', fm)).toEqual([]);
    });

    it('flags malformed signals', () => {
      const fm = `${GOOD}\nsources:\n  - { resource: r, author: 7, usage_count: -1, last_modified: 2026-05-30 }\n  - { resource: r, usage_count: 1.5 }\nusage_window: { from: 2026-06-01T00:00:00Z, to: 2026-06-30T00:00:00Z }`;
      expect(ruleOn('sources-signals', fm).map((x) => x.message)).toEqual([
        expect.stringContaining('`sources[0].author` should be a non-empty string'),
        expect.stringContaining('`sources[0].usage_count` should be a non-negative integer'),
        expect.stringContaining('`sources[0].last_modified` should be an ISO 8601 datetime'),
        expect.stringContaining('`sources[1].usage_count` should be a non-negative integer'),
      ]);
    });
  });

  describe('usage-window-shape', () => {
    it('validates the shared window', () => {
      expect(ruleOn('usage-window-shape', `${GOOD}\nusage_window: 2026-06`)[0]!.message).toContain(
        '`usage_window` should be a `{ from, to }` mapping',
      );
      const d = ruleOn('usage-window-shape', `${GOOD}\nusage_window: { from: 2026-06-01, to: x }`);
      expect(d.map((x) => x.message)).toEqual([
        expect.stringContaining('`usage_window`.from should be'),
        expect.stringContaining('`usage_window`.to should be'),
      ]);
    });

    it('flags an inverted window', () => {
      const d = ruleOn(
        'usage-window-shape',
        `${GOOD}\nusage_window: { from: 2026-07-01T00:00:00Z, to: 2026-06-01T00:00:00Z }`,
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`from` later than `to`');
    });

    it('validates per-entry overrides', () => {
      const d = ruleOn(
        'usage-window-shape',
        `${GOOD}\nsources:\n  - { resource: r, usage_count: 1, usage_window: { from: 2026-06-01T00:00:00Z } }`,
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`sources[0].usage_window`.to should be');
    });
  });

  describe('usage-count-window', () => {
    it('requires a window for usage_count', () => {
      const d = ruleOn(
        'usage-count-window',
        `${GOOD}\nsources:\n  - { resource: r, usage_count: 10 }`,
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`sources[0].usage_count` has no `usage_window`');
    });

    it('is satisfied by a shared or a per-entry window', () => {
      const shared = `${GOOD}\nsources:\n  - { resource: r, usage_count: 10 }\nusage_window: { from: 2026-06-01T00:00:00Z, to: 2026-06-30T00:00:00Z }`;
      const own = `${GOOD}\nsources:\n  - { resource: r, usage_count: 10, usage_window: { from: 2026-06-01T00:00:00Z, to: 2026-06-30T00:00:00Z } }`;
      expect(ruleOn('usage-count-window', shared)).toEqual([]);
      expect(ruleOn('usage-count-window', own)).toEqual([]);
    });
  });

  describe('footnote-source-id', () => {
    it('accepts footnotes keyed to a source id', () => {
      const fm = `${GOOD}\nsources:\n  - { id: ga4-schema, resource: https://x }`;
      const body = 'Sharded daily.[^ga4-schema]\n\n[^ga4-schema]: GA4 schema\n';
      expect(ruleOn('footnote-source-id', fm, body)).toEqual([]);
    });

    it('flags each unknown label once, at its first occurrence', () => {
      const fm = `${GOOD}\nsources:\n  - { id: known, resource: https://x }`;
      const body =
        'A claim.[^missing] Another.[^known] Again.[^missing]\n\n[^missing]: Not in sources\n';
      const d = ruleOn('footnote-source-id', fm, body);
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ line: 11, column: 9 });
      expect(d[0]!.message).toContain('`[^missing]` does not match any `sources[].id`');
    });

    it('flags footnotes when no sources are declared at all', () => {
      expect(ruleOn('footnote-source-id', GOOD, 'Claim.[^x]\n')).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// §5.2 Trust and §7 actor convention
// ---------------------------------------------------------------------------

describe('trust (§5.2, §7)', () => {
  describe('recommended-generated', () => {
    it('warns when generated is absent', () => {
      const d = ruleOn('recommended-generated', 'type: Metric\ntitle: T\ndescription: D');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('Missing recommended `generated` field');
    });

    it('defers to legacy-timestamp when a legacy timestamp is present', () => {
      const fm = 'type: Metric\ntitle: T\ndescription: D\ntimestamp: 2026-01-01T00:00:00Z';
      expect(ruleOn('recommended-generated', fm)).toEqual([]);
      expect(ruleOn('legacy-timestamp', fm)).toHaveLength(1);
    });

    it('warns when generated has no at', () => {
      const d = ruleOn(
        'recommended-generated',
        'type: Metric\ntitle: T\ndescription: D\ngenerated: { by: human:x }',
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`generated` has no `at`');
    });

    it('is satisfied by a full generated block', () => {
      expect(ruleOn('recommended-generated', GOOD)).toEqual([]);
    });
  });

  describe('generated-shape', () => {
    it('rejects a scalar', () => {
      expect(
        ruleOn('generated-shape', `type: Metric\ngenerated: 2026-01-01T00:00:00Z`)[0]!.message,
      ).toContain('`generated` should be a mapping');
    });

    it('requires by and validates at', () => {
      const d = ruleOn('generated-shape', 'type: Metric\ngenerated: { at: 2026-01-01 }');
      expect(d.map((x) => x.message)).toEqual([
        expect.stringContaining('`generated.by` is required'),
        expect.stringContaining(
          '`generated.at` should be an ISO 8601 datetime with an explicit UTC offset',
        ),
      ]);
    });

    it('accepts offsets other than Z', () => {
      expect(
        ruleOn(
          'generated-shape',
          'type: Metric\ngenerated: { by: human:x, at: "2026-01-01T10:00:00+02:00" }',
        ),
      ).toEqual([]);
    });
  });

  describe('verified-shape', () => {
    it('accepts a bare mapping as a one-element list', () => {
      expect(
        ruleOn(
          'verified-shape',
          `${GOOD}\nverified: { by: human:ahormati, at: 2026-06-25T09:00:00Z }`,
        ),
      ).toEqual([]);
    });

    it('accepts a list of entries', () => {
      const fm = `${GOOD}\nverified:\n  - { by: human:ahormati, at: 2026-06-25T09:00:00Z }\n  - { by: process:finance-nightly, at: 2026-06-26T02:00:00Z }`;
      expect(ruleOn('verified-shape', fm)).toEqual([]);
    });

    it('flags malformed entries', () => {
      const fm = `${GOOD}\nverified:\n  - human:x\n  - { at: 2026-06-25T09:00:00Z }\n  - { by: human:y, at: last week }`;
      expect(ruleOn('verified-shape', fm).map((x) => x.message)).toEqual([
        expect.stringContaining('`verified[0]` should be a mapping'),
        expect.stringContaining('`verified[1]` is missing `by`'),
        expect.stringContaining('`verified[2]` should have an `at`'),
      ]);
    });

    it('names a bare mapping without an index', () => {
      expect(ruleOn('verified-shape', `${GOOD}\nverified: { by: human:x }`)[0]!.message).toContain(
        '`verified` should have an `at`',
      );
    });
  });

  describe('actor-format', () => {
    it.each([
      'reference_agent/gemini-2.5-pro',
      'human:ahormati',
      'human:jsmith@acme',
      'process:finance-nightly',
      'my-tool/1.2.3',
    ])('accepts %s', (actor) => {
      expect(
        ruleOn(
          'actor-format',
          `type: Metric\ngenerated: { by: ${actor}, at: 2026-01-01T00:00:00Z }`,
        ),
      ).toEqual([]);
    });

    it.each(['jane', 'team:data', 'human:', 'tool/', 'a b/c'])('rejects %s', (actor) => {
      const d = ruleOn(
        'actor-format',
        `type: Metric\ngenerated: { by: "${actor}", at: 2026-01-01T00:00:00Z }`,
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`generated.by`');
    });

    it('checks every verified entry', () => {
      const fm = `${GOOD}\nverified:\n  - { by: human:ok, at: 2026-01-01T00:00:00Z }\n  - { by: nope, at: 2026-01-01T00:00:00Z }`;
      const d = ruleOn('actor-format', fm);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`verified[1].by` value `nope`');
    });

    it('does not police sources[].author (spec examples use team:)', () => {
      expect(
        ruleOn('actor-format', `${GOOD}\nsources:\n  - { resource: r, author: team:ga4-docs }`),
      ).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// §5.4 / §5.5 Lifecycle
// ---------------------------------------------------------------------------

describe('lifecycle (§5.4, §5.5)', () => {
  describe('status-value', () => {
    it.each(['draft', 'stable', 'deprecated'])('accepts %s', (status) => {
      expect(ruleOn('status-value', `${GOOD}\nstatus: ${status}`)).toEqual([]);
    });

    it('rejects other values', () => {
      const d = ruleOn('status-value', `${GOOD}\nstatus: archived`);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('found `archived`');
      expect(ruleOn('status-value', `${GOOD}\nstatus: [stable]`)).toHaveLength(1);
    });
  });

  describe('stale-after-format', () => {
    it('requires a datetime with an explicit offset', () => {
      expect(ruleOn('stale-after-format', `${GOOD}\nstale_after: 2099-09-23T00:00:00Z`)).toEqual(
        [],
      );
      expect(ruleOn('stale-after-format', `${GOOD}\nstale_after: 2099-09-23`)).toHaveLength(1);
      expect(
        ruleOn('stale-after-format', `${GOOD}\nstale_after: 2099-09-23T00:00:00`),
      ).toHaveLength(1);
      expect(ruleOn('stale-after-format', `${GOOD}\nstale_after: 90d`)).toHaveLength(1);
    });
  });

  describe('stale-after-passed', () => {
    const now = new Date('2026-10-01T00:00:00Z');

    it('flags a stale_after in the past', () => {
      const d = byRule(
        lint02({ 'a.md': concept(`${GOOD}\nstale_after: 2026-09-23T00:00:00Z`) }, { now }),
        'stale-after-passed',
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`2026-09-23T00:00:00Z`');
    });

    it('treats now >= stale_after as stale (inclusive)', () => {
      const d = byRule(
        lint02({ 'a.md': concept(`${GOOD}\nstale_after: 2026-10-01T00:00:00Z`) }, { now }),
        'stale-after-passed',
      );
      expect(d).toHaveLength(1);
    });

    it('is quiet for a future stale_after or a deprecated concept', () => {
      expect(
        byRule(
          lint02({ 'a.md': concept(`${GOOD}\nstale_after: 2026-10-02T00:00:00Z`) }, { now }),
          'stale-after-passed',
        ),
      ).toEqual([]);
      expect(
        byRule(
          lint02(
            { 'a.md': concept(`${GOOD}\nstatus: deprecated\nstale_after: 2020-01-01T00:00:00Z`) },
            { now },
          ),
          'stale-after-passed',
        ),
      ).toEqual([]);
    });

    it('ignores malformed values (left to stale-after-format)', () => {
      expect(
        byRule(
          lint02({ 'a.md': concept(`${GOOD}\nstale_after: 2020-01-01`) }, { now }),
          'stale-after-passed',
        ),
      ).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// §10 Attested computations
// ---------------------------------------------------------------------------

describe('attested computations (§10)', () => {
  const AC = `
type: Attested Computation
title: Revenue for fiscal year
description: Recognized revenue for a fiscal year.
generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-20T22:53:05Z }
`;
  const INLINE = '# Computation\n\n```sql\nSELECT 1\n```\n';

  describe('computation-runtime', () => {
    it('requires runtime for Attested Computation', () => {
      const d = ruleOn('computation-runtime', AC, INLINE);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('`runtime` is required');
    });

    it('matches the type case-insensitively', () => {
      expect(
        ruleOn(
          'computation-runtime',
          AC.replace('Attested Computation', 'attested computation'),
          INLINE,
        ),
      ).toHaveLength(1);
    });

    it('does not apply to other types', () => {
      expect(ruleOn('computation-runtime', GOOD)).toEqual([]);
    });

    it('is satisfied by a runtime', () => {
      expect(ruleOn('computation-runtime', `${AC}\nruntime: bigquery`, INLINE)).toEqual([]);
    });
  });

  describe('computation-parameters', () => {
    it('accepts well-formed entries', () => {
      const fm = `${AC}\nruntime: bigquery\nparameters:\n  - { name: year, type: integer, required: true }\n  - { name: segment, type: string, required: false }`;
      expect(ruleOn('computation-parameters', fm, INLINE)).toEqual([]);
    });

    it('rejects a non-list', () => {
      expect(
        ruleOn('computation-parameters', `${AC}\nruntime: bigquery\nparameters: year`, INLINE)[0]!
          .message,
      ).toContain('`parameters` should be a YAML list');
    });

    it('flags missing or mistyped fields and duplicate names', () => {
      const fm = `${AC}\nruntime: bigquery\nparameters:\n  - year\n  - { name: year, type: integer, required: true }\n  - { name: year, required: yes }\n  - { type: string, required: false }`;
      expect(ruleOn('computation-parameters', fm, INLINE).map((x) => x.message)).toEqual([
        expect.stringContaining('`parameters[0]` should be a `{ name, type, required }` mapping'),
        expect.stringContaining('`parameters[2].name` `year` is a duplicate'),
        expect.stringContaining('`parameters[2].type` is required'),
        expect.stringContaining('`parameters[2].required` should be `true` or `false`'),
        expect.stringContaining('`parameters[3].name` is required'),
      ]);
    });
  });

  describe('computation-body', () => {
    it('accepts an inline fenced code block under # Computation', () => {
      expect(ruleOn('computation-body', `${AC}\nruntime: bigquery`, INLINE)).toEqual([]);
    });

    it('accepts an indented code block (as in the spec examples)', () => {
      const body =
        '# Computation\n\n    SELECT SUM(amount) AS revenue\n    FROM finance.recognized_revenue\n';
      expect(ruleOn('computation-body', `${AC}\nruntime: bigquery`, body)).toEqual([]);
    });

    it('accepts a computation file instead of an inline block', () => {
      const fm = `${AC}\nruntime: dbt\ncomputation: /references/computations/profit.sql`;
      const extra = { 'references/computations/profit.sql': 'SELECT 1\n' };
      expect(ruleOn('computation-body', fm, '# Definition\n\nProse only.\n', extra)).toEqual([]);
    });

    it('flags both a file and an inline block', () => {
      const fm = `${AC}\nruntime: dbt\ncomputation: /references/computations/profit.sql`;
      const d = ruleOn('computation-body', fm, INLINE, {
        'references/computations/profit.sql': 'SELECT 1\n',
      });
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('Both a `computation` path and an inline');
    });

    it('flags a # Computation section without a code block', () => {
      const d = ruleOn(
        'computation-body',
        `${AC}\nruntime: bigquery`,
        '# Computation\n\nJust prose.\n',
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('has no code block');
    });

    it('flags a missing computation entirely', () => {
      const d = ruleOn('computation-body', `${AC}\nruntime: bigquery`, '# Definition\n\nProse.\n');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('has no computation');
    });

    it('does not apply to other types', () => {
      expect(ruleOn('computation-body', GOOD)).toEqual([]);
    });
  });

  describe('computation-executor', () => {
    it('accepts resource plus receipt list', () => {
      const fm = `${AC}\nruntime: bigquery\nexecutor: { resource: https://example.com/run, receipt: [job_id, executed_sql, result] }`;
      expect(ruleOn('computation-executor', fm, INLINE)).toEqual([]);
    });

    it('flags a scalar, a missing resource, and a non-list receipt', () => {
      expect(
        ruleOn('computation-executor', `${AC}\nexecutor: run.md`, INLINE)[0]!.message,
      ).toContain('`executor` should be a mapping');
      const d = ruleOn('computation-executor', `${AC}\nexecutor: { receipt: job_id }`, INLINE);
      expect(d.map((x) => x.message)).toEqual([
        expect.stringContaining('`executor.resource` should name'),
        expect.stringContaining('`executor.receipt` should be a list'),
      ]);
      expect(
        ruleOn(
          'computation-executor',
          `${AC}\nexecutor: { resource: https://x, receipt: [job_id, 3] }`,
          INLINE,
        ),
      ).toHaveLength(1);
    });
  });

  describe('computation-attester', () => {
    it('accepts a mapping with a resource', () => {
      expect(
        ruleOn(
          'computation-attester',
          `${AC}\nattester: { resource: https://example.com/check.py }`,
          INLINE,
        ),
      ).toEqual([]);
    });

    it('flags a scalar and a missing resource', () => {
      expect(
        ruleOn('computation-attester', `${AC}\nattester: check.py`, INLINE)[0]!.message,
      ).toContain('`attester` should be a mapping');
      expect(
        ruleOn('computation-attester', `${AC}\nattester: { verdict: ok }`, INLINE)[0]!.message,
      ).toContain('`attester.resource` should name');
    });
  });

  describe('computation-paths', () => {
    const extra = {
      'references/skills/run-on-bq.md': concept(
        'type: Skill\ntitle: Run\ndescription: d\ngenerated: { by: human:x, at: 2026-01-01T00:00:00Z }',
      ),
      'references/attesters/check.py': 'print(1)\n',
      'computations/lib/revenue.sql': 'SELECT 1\n',
    };
    const fmFor = (fields: string) => `${AC}\nruntime: bigquery\n${fields}`;
    const run = (fields: string, file = 'computations/a.md') =>
      byRule(lint02({ [file]: concept(fmFor(fields), INLINE), ...extra }), 'computation-paths');

    it('resolves bundle-absolute paths', () => {
      expect(
        run(
          'executor: { resource: /references/skills/run-on-bq.md }\nattester: { resource: /references/attesters/check.py }',
        ),
      ).toEqual([]);
    });

    it('resolves paths relative to the document', () => {
      expect(
        run(
          'computation: lib/revenue.sql\nattester: { resource: ../references/attesters/check.py }',
        ),
      ).toEqual([]);
    });

    it('resolves root-relative paths without a leading slash (as upstream bundles do)', () => {
      expect(
        run(
          'executor: { resource: references/skills/run-on-bq.md }\nattester: { resource: references/attesters/check.py }',
        ),
      ).toEqual([]);
    });

    it('ignores URLs', () => {
      expect(
        run(
          'computation: https://example.com/revenue.sql\nexecutor: { resource: gs://bucket/run.md }',
        ),
      ).toEqual([]);
    });

    it('flags paths that resolve nowhere, naming the field', () => {
      const d = run(
        'computation: /references/computations/missing.sql\nexecutor: { resource: skills/nope.md }\nattester: { resource: /references/attesters/check.py }',
      );
      expect(d.map((x) => x.message)).toEqual([
        expect.stringContaining(
          '`computation` path `/references/computations/missing.sql` does not resolve',
        ),
        expect.stringContaining('`executor.resource` path `skills/nope.md` does not resolve'),
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// §13.1 Migration from v0.1
// ---------------------------------------------------------------------------

describe('migration (§13.1)', () => {
  describe('legacy-timestamp', () => {
    it('asks to move a lone timestamp into generated', () => {
      const d = ruleOn(
        'legacy-timestamp',
        'type: Metric\ntitle: T\ndescription: D\ntimestamp: 2026-01-01T00:00:00Z',
      );
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('move it to `generated: { by: <actor>, at: <datetime> }`');
      expect(d[0]!.line).toBe(5);
    });

    it('asks to remove a timestamp that is redundant beside generated', () => {
      const d = ruleOn('legacy-timestamp', `${GOOD}\ntimestamp: 2026-01-01T00:00:00Z`);
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain('redundant alongside `generated`; remove it');
    });

    it('still format-checks a legacy timestamp', () => {
      expect(ruleOn('timestamp-format', `${GOOD}\ntimestamp: last Tuesday`)).toHaveLength(1);
    });

    it('does not recommend the superseded timestamp field', () => {
      expect(ruleOn('recommended-timestamp', 'type: Metric')).toEqual([]);
    });
  });

  describe('legacy-citations', () => {
    it('flags a # Citations heading at any level', () => {
      const d = ruleOn(
        'legacy-citations',
        GOOD,
        '# Definition\n\nText.\n\n## Citations\n\n- https://x\n',
      );
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ line: 12 });
      expect(d[0]!.message).toContain('superseded by `sources` frontmatter');
    });

    it('ignores headings inside fenced code', () => {
      expect(ruleOn('legacy-citations', GOOD, '```\n# Citations\n```\n')).toEqual([]);
    });
  });
});

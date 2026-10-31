/**
 * OKF 0.2 §5.1: provenance (`sources`, credibility signals, `usage_window`)
 * and per-claim attribution via `[^id]` footnotes.
 */
import type { ReportInput, Rule, RuleContext } from '../../rule.js';
import {
  bodyOf,
  conceptFrontmatters,
  isEmptyValue,
  isMapping,
  nonEmptyString,
} from '../../rule.js';
import { frontmatterKeyLine } from '../../frontmatter.js';
import { extractFootnotes, isOkfDateTime, toEpochMs } from '../../text-utils.js';

const DATETIME_HINT =
  'an ISO 8601 datetime with an explicit UTC offset, e.g. `2026-06-30T00:00:00Z`';

/** Normalize `sources` into its list entries, or `null` when absent or not a list. */
function sourceEntries(value: unknown): unknown[] | null {
  if (value === undefined || value === null) return null;
  return Array.isArray(value) ? value : null;
}

/** Collect the `id`s declared by well-formed `sources` entries. */
export function sourceIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  for (const entry of sourceEntries(value) ?? []) {
    if (isMapping(entry)) {
      const id = nonEmptyString(entry['id']);
      if (id) ids.add(id.trim());
    }
  }
  return ids;
}

export const sourcesType: Rule = {
  meta: {
    id: 'sources-type',
    severity: 'warning',
    category: 'provenance',
    description:
      'When present, `sources` should be a list of mappings (with string `id`/`title` when given).',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const sources = data['sources'];
      if (sources === undefined || sources === null) continue;
      const line = frontmatterKeyLine(fm, 'sources');
      const entries = sourceEntries(sources);
      if (!entries) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message:
            '`sources` should be a YAML list of mappings, e.g. `sources: [{ id: ga4-schema, resource: https://... }]`.',
        });
        continue;
      }
      entries.forEach((entry, index) => {
        if (!isMapping(entry)) {
          ctx.report({
            filePath: file.absPath,
            line,
            column: 1,
            message: `\`sources[${index}]\` should be a mapping with at least a \`resource\`.`,
          });
          return;
        }
        for (const key of ['id', 'title'] as const) {
          const value = entry[key];
          if (value !== undefined && value !== null && typeof value !== 'string') {
            ctx.report({
              filePath: file.absPath,
              line,
              column: 1,
              message: `\`sources[${index}].${key}\` should be a string.`,
            });
          }
        }
      });
    }
  },
};

export const sourcesResource: Rule = {
  meta: {
    id: 'sources-resource',
    severity: 'warning',
    category: 'provenance',
    description: 'Every `sources` entry should have a non-empty `resource`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const entries = sourceEntries(data['sources']);
      if (!entries) continue;
      entries.forEach((entry, index) => {
        if (!isMapping(entry)) return;
        if (nonEmptyString(entry['resource'])) return;
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, 'sources'),
          column: 1,
          message: `\`sources[${index}]\` is missing \`resource\` (a URL, a bundle path, or a scope descriptor such as \`all queries in BigQuery project X\`).`,
        });
      });
    }
  },
};

export const sourcesIdUnique: Rule = {
  meta: {
    id: 'sources-id-unique',
    severity: 'warning',
    category: 'provenance',
    description:
      '`sources[].id` values should be unique within a document, since footnotes join on them.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const entries = sourceEntries(data['sources']);
      if (!entries) continue;
      const seen = new Set<string>();
      entries.forEach((entry, index) => {
        if (!isMapping(entry)) return;
        const id = nonEmptyString(entry['id'])?.trim();
        if (!id) return;
        if (seen.has(id)) {
          ctx.report({
            filePath: file.absPath,
            line: frontmatterKeyLine(fm, 'sources'),
            column: 1,
            message: `\`sources[${index}].id\` \`${id}\` is a duplicate; ids must be unique so \`[^${id}]\` footnotes attribute unambiguously.`,
          });
        }
        seen.add(id);
      });
    }
  },
};

/** Validate a `{ from, to }` usage window, reporting problems under `label`. */
function checkUsageWindow(value: unknown, label: string, report: (message: string) => void): void {
  if (!isMapping(value)) {
    report(`${label} should be a \`{ from, to }\` mapping of datetimes.`);
    return;
  }
  let valid = true;
  for (const key of ['from', 'to'] as const) {
    if (!isOkfDateTime(value[key])) {
      report(`${label}.${key} should be ${DATETIME_HINT}.`);
      valid = false;
    }
  }
  if (valid) {
    const from = toEpochMs(value['from'])!;
    const to = toEpochMs(value['to'])!;
    if (from > to) report(`${label} has \`from\` later than \`to\`.`);
  }
}

export const usageWindowShape: Rule = {
  meta: {
    id: 'usage-window-shape',
    severity: 'warning',
    category: 'provenance',
    description:
      'When present, `usage_window` should be `{ from, to }` with `from` not later than `to`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const report = (key: string) => (message: string) =>
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, key),
          column: 1,
          message,
        });

      const shared = data['usage_window'];
      if (shared !== undefined && shared !== null) {
        checkUsageWindow(shared, '`usage_window`', report('usage_window'));
      }
      (sourceEntries(data['sources']) ?? []).forEach((entry, index) => {
        if (!isMapping(entry)) return;
        const own = entry['usage_window'];
        if (own === undefined || own === null) return;
        checkUsageWindow(own, `\`sources[${index}].usage_window\``, report('sources'));
      });
    }
  },
};

export const sourcesSignals: Rule = {
  meta: {
    id: 'sources-signals',
    severity: 'warning',
    category: 'provenance',
    description:
      'Credibility signals should be well-typed: `author` a string, `usage_count` a non-negative integer, `last_modified` an ISO 8601 datetime.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const entries = sourceEntries(data['sources']);
      if (!entries) continue;
      const line = frontmatterKeyLine(fm, 'sources');
      const report = (message: string) =>
        ctx.report({ filePath: file.absPath, line, column: 1, message });

      entries.forEach((entry, index) => {
        if (!isMapping(entry)) return;
        const where = `\`sources[${index}]`;
        const author = entry['author'];
        if (author !== undefined && author !== null && !nonEmptyString(author)) {
          report(
            `${where}.author\` should be a non-empty string naming who or what produced the source.`,
          );
        }
        const usageCount = entry['usage_count'];
        if (
          usageCount !== undefined &&
          usageCount !== null &&
          !(typeof usageCount === 'number' && Number.isInteger(usageCount) && usageCount >= 0)
        ) {
          report(`${where}.usage_count\` should be a non-negative integer.`);
        }
        const lastModified = entry['last_modified'];
        if (!isEmptyValue(lastModified) && !isOkfDateTime(lastModified)) {
          report(`${where}.last_modified\` should be ${DATETIME_HINT}.`);
        }
      });
    }
  },
};

export const usageCountWindow: Rule = {
  meta: {
    id: 'usage-count-window',
    severity: 'warning',
    category: 'provenance',
    description: 'A `usage_count` should be framed by a `usage_window` (shared or per-entry).',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const entries = sourceEntries(data['sources']);
      if (!entries) continue;
      const hasShared = isMapping(data['usage_window']);
      entries.forEach((entry, index) => {
        if (!isMapping(entry)) return;
        if (entry['usage_count'] === undefined || entry['usage_count'] === null) return;
        if (hasShared || isMapping(entry['usage_window'])) return;
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, 'sources'),
          column: 1,
          message: `\`sources[${index}].usage_count\` has no \`usage_window\`; add a \`usage_window: { from, to }\` beside \`sources\` (or on the entry) so the count is interpretable.`,
        });
      });
    }
  },
};

export const footnoteSourceId: Rule = {
  meta: {
    id: 'footnote-source-id',
    severity: 'warning',
    category: 'provenance',
    description:
      'Footnote labels (`[^id]`) should match a `sources[].id` so claims attribute to a source.',
  },
  run(ctx: RuleContext) {
    for (const { file, data } of conceptFrontmatters(ctx)) {
      const body = bodyOf(ctx, file);
      const footnotes = extractFootnotes(body.text, body.startLine);
      if (footnotes.length === 0) continue;
      const ids = sourceIds(data['sources']);
      const reported = new Set<string>();
      for (const footnote of footnotes) {
        if (ids.has(footnote.label) || reported.has(footnote.label)) continue;
        reported.add(footnote.label);
        const input: ReportInput = {
          filePath: file.absPath,
          line: footnote.line,
          column: footnote.column,
          message: `Footnote \`[^${footnote.label}]\` does not match any \`sources[].id\`; add a \`sources\` entry with \`id: ${footnote.label}\` so the claim attributes to a source.`,
        };
        ctx.report(input);
      }
    }
  },
};

/** Provenance rules, in reporting order. */
export const provenanceRules: Rule[] = [
  sourcesType,
  sourcesResource,
  sourcesIdUnique,
  sourcesSignals,
  usageWindowShape,
  usageCountWindow,
  footnoteSourceId,
];

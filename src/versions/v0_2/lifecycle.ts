/**
 * OKF 0.2 §5.4 (`status`) and §5.5 (`stale_after`).
 */
import type { Rule, RuleContext } from '../../rule.js';
import { conceptFrontmatters, isEmptyValue } from '../../rule.js';
import { frontmatterKeyLine } from '../../frontmatter.js';
import { isOkfDateTime, toEpochMs } from '../../text-utils.js';

/** The lifecycle states defined by §5.4. Absent means `stable`. */
export const STATUS_VALUES = ['draft', 'stable', 'deprecated'] as const;

export const statusValue: Rule = {
  meta: {
    id: 'status-value',
    severity: 'warning',
    category: 'lifecycle',
    description: 'When present, `status` should be one of `draft`, `stable`, or `deprecated`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const status = data['status'];
      if (status === undefined || status === null) continue;
      if (typeof status === 'string' && (STATUS_VALUES as readonly string[]).includes(status)) {
        continue;
      }
      ctx.report({
        filePath: file.absPath,
        line: frontmatterKeyLine(fm, 'status'),
        column: 1,
        message: `\`status\` should be one of ${STATUS_VALUES.map((s) => `\`${s}\``).join(', ')}; found \`${String(status)}\`.`,
      });
    }
  },
};

export const staleAfterFormat: Rule = {
  meta: {
    id: 'stale-after-format',
    severity: 'warning',
    category: 'lifecycle',
    description:
      'When present, `stale_after` should be an ISO 8601 datetime with an explicit UTC offset.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const value = data['stale_after'];
      if (isEmptyValue(value) || isOkfDateTime(value)) continue;
      ctx.report({
        filePath: file.absPath,
        line: frontmatterKeyLine(fm, 'stale_after'),
        column: 1,
        message:
          '`stale_after` should be an absolute ISO 8601 datetime with an explicit UTC offset, e.g. `2026-09-23T00:00:00Z`.',
      });
    }
  },
};

export const staleAfterPassed: Rule = {
  meta: {
    id: 'stale-after-passed',
    severity: 'warning',
    category: 'lifecycle',
    description:
      'A concept whose `stale_after` instant has passed is stale and should be refreshed.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      if (data['status'] === 'deprecated') continue;
      const value = data['stale_after'];
      const staleAt = toEpochMs(value);
      if (staleAt === null || ctx.now.getTime() < staleAt) continue;
      ctx.report({
        filePath: file.absPath,
        line: frontmatterKeyLine(fm, 'stale_after'),
        column: 1,
        message: `Concept is stale: \`stale_after\` (\`${String(value instanceof Date ? value.toISOString() : value)}\`) has passed. Re-verify the content and move \`stale_after\` forward, or set \`status: deprecated\`.`,
      });
    }
  },
};

/** Lifecycle rules, in reporting order. */
export const lifecycleRules: Rule[] = [statusValue, staleAfterFormat, staleAfterPassed];

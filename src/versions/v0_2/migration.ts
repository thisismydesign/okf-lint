/**
 * OKF 0.2 §13.1: the two breaking changes from 0.1, surfaced as migration hints.
 *
 * - `timestamp` is superseded by `generated.at`.
 * - The body `# Citations` list is superseded by `sources`.
 */
import type { Rule, RuleContext } from '../../rule.js';
import { bodyOf, conceptFrontmatters, isEmptyValue } from '../../rule.js';
import { frontmatterKeyLine } from '../../frontmatter.js';
import { extractHeadings } from '../../text-utils.js';

export const legacyTimestamp: Rule = {
  meta: {
    id: 'legacy-timestamp',
    severity: 'warning',
    category: 'migration',
    description: '`timestamp` is superseded by `generated.at` in OKF 0.2.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      if (isEmptyValue(data['timestamp'])) continue;
      const hasGenerated = !isEmptyValue(data['generated']);
      ctx.report({
        filePath: file.absPath,
        line: frontmatterKeyLine(fm, 'timestamp'),
        column: 1,
        message: hasGenerated
          ? '`timestamp` is superseded by `generated.at` in OKF 0.2 and is redundant alongside `generated`; remove it.'
          : '`timestamp` is superseded by `generated.at` in OKF 0.2; move it to `generated: { by: <actor>, at: <datetime> }`.',
      });
    }
  },
};

export const legacyCitations: Rule = {
  meta: {
    id: 'legacy-citations',
    severity: 'warning',
    category: 'migration',
    description:
      'A body `# Citations` list is superseded by the `sources` frontmatter field in OKF 0.2.',
  },
  run(ctx: RuleContext) {
    for (const file of ctx.conceptFiles) {
      const body = bodyOf(ctx, file);
      for (const heading of extractHeadings(body.text, body.startLine)) {
        if (heading.text.toLowerCase() !== 'citations') continue;
        ctx.report({
          filePath: file.absPath,
          line: heading.line,
          column: 1,
          message:
            'A `# Citations` body list is superseded by `sources` frontmatter in OKF 0.2; move each citation to a `sources` entry (with an `id`) and attribute claims with `[^id]` footnotes.',
        });
      }
    }
  },
};

/** Migration rules, in reporting order. */
export const migrationRules: Rule[] = [legacyTimestamp, legacyCitations];

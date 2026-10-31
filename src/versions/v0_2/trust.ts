/**
 * OKF 0.2 §5.2 (trust: `generated`, `verified`) and §7 (actor convention).
 */
import type { Rule, RuleContext } from '../../rule.js';
import { conceptFrontmatters, isEmptyValue, isMapping, nonEmptyString } from '../../rule.js';
import { frontmatterKeyLine } from '../../frontmatter.js';
import { isOkfDateTime } from '../../text-utils.js';

const DATETIME_HINT =
  'an ISO 8601 datetime with an explicit UTC offset, e.g. `2026-06-30T14:00:00Z`';

/**
 * §7: `<producer>/<version>` for agents and tools, `human:<id>` for people,
 * `process:<id>` for automated processes.
 */
const ACTOR_RE = /^(?:(?:human|process):\S+|[^\s/:]+\/\S+)$/;

/** True when `value` follows the OKF 0.2 actor convention (§7). */
export function isActor(value: unknown): boolean {
  return typeof value === 'string' && ACTOR_RE.test(value.trim());
}

/** Normalize `verified` (bare mapping or list) into a list of entries (§5.2). */
export function verifiedEntries(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export const recommendedGenerated: Rule = {
  meta: {
    id: 'recommended-generated',
    severity: 'warning',
    category: 'trust',
    description: 'Concept documents should record `generated: { by, at }`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const generated = data['generated'];
      if (isEmptyValue(generated)) {
        // A legacy `timestamp` is handled by `legacy-timestamp`, which already asks for `generated`.
        if (!isEmptyValue(data['timestamp'])) continue;
        ctx.report({
          filePath: file.absPath,
          line: fm.startLine || 1,
          column: 1,
          message:
            'Missing recommended `generated` field (`{ by: <actor>, at: <datetime> }` recording how and when the content was produced).',
        });
      } else if (isMapping(generated) && isEmptyValue(generated['at'])) {
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, 'generated'),
          column: 1,
          message:
            '`generated` has no `at`; add the datetime of the last meaningful content change so consumers can judge freshness.',
        });
      }
    }
  },
};

export const generatedShape: Rule = {
  meta: {
    id: 'generated-shape',
    severity: 'warning',
    category: 'trust',
    description:
      'When present, `generated` should be a mapping with a `by` actor and an ISO 8601 `at`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const generated = data['generated'];
      if (generated === undefined || generated === null) continue;
      const line = frontmatterKeyLine(fm, 'generated');
      if (!isMapping(generated)) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message:
            '`generated` should be a mapping, e.g. `generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-20T22:53:05Z }`.',
        });
        continue;
      }
      if (!nonEmptyString(generated['by'])) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message:
            '`generated.by` is required within `generated` and should be a non-empty actor string.',
        });
      }
      const at = generated['at'];
      if (!isEmptyValue(at) && !isOkfDateTime(at)) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message: `\`generated.at\` should be ${DATETIME_HINT}.`,
        });
      }
    }
  },
};

export const verifiedShape: Rule = {
  meta: {
    id: 'verified-shape',
    severity: 'warning',
    category: 'trust',
    description:
      'When present, `verified` should be a `{ by, at }` mapping or a list of them, each with an actor and an ISO 8601 datetime.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const verified = data['verified'];
      if (verified === undefined || verified === null) continue;
      const line = frontmatterKeyLine(fm, 'verified');
      const entries = verifiedEntries(verified);
      entries.forEach((entry, index) => {
        const where = Array.isArray(verified) ? `\`verified[${index}]\`` : '`verified`';
        if (!isMapping(entry)) {
          ctx.report({
            filePath: file.absPath,
            line,
            column: 1,
            message: `${where} should be a mapping, e.g. \`{ by: human:ahormati, at: 2026-06-25T09:00:00Z }\`.`,
          });
          return;
        }
        if (!nonEmptyString(entry['by'])) {
          ctx.report({
            filePath: file.absPath,
            line,
            column: 1,
            message: `${where} is missing \`by\` (the actor that confirmed the content).`,
          });
        }
        if (!isOkfDateTime(entry['at'])) {
          ctx.report({
            filePath: file.absPath,
            line,
            column: 1,
            message: `${where} should have an \`at\` that is ${DATETIME_HINT}.`,
          });
        }
      });
    }
  },
};

export const actorFormat: Rule = {
  meta: {
    id: 'actor-format',
    severity: 'warning',
    category: 'trust',
    description:
      '`generated.by` and `verified[].by` should follow the actor convention: `<producer>/<version>`, `human:<id>`, or `process:<id>`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const candidates: { field: string; key: string; value: unknown }[] = [];
      const generated = data['generated'];
      if (isMapping(generated) && nonEmptyString(generated['by'])) {
        candidates.push({ field: '`generated.by`', key: 'generated', value: generated['by'] });
      }
      const verified = data['verified'];
      verifiedEntries(verified).forEach((entry, index) => {
        if (!isMapping(entry) || !nonEmptyString(entry['by'])) return;
        const field = Array.isArray(verified) ? `\`verified[${index}].by\`` : '`verified.by`';
        candidates.push({ field, key: 'verified', value: entry['by'] });
      });
      for (const { field, key, value } of candidates) {
        if (isActor(value)) continue;
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, key),
          column: 1,
          message: `${field} value \`${String(value)}\` does not follow the actor convention: use \`<producer>/<version>\` for agents, \`human:<id>\` for people, or \`process:<id>\` for processes.`,
        });
      }
    }
  },
};

/** Trust rules, in reporting order. */
export const trustRules: Rule[] = [
  recommendedGenerated,
  generatedShape,
  verifiedShape,
  actorFormat,
];

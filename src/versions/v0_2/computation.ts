/**
 * OKF 0.2 §10: the `Attested Computation` concept type and its contract fields
 * (`runtime`, `parameters`, `computation`, `executor`, `attester`), plus §6.2
 * path resolution for the path-valued fields among them.
 */
import { dirname, resolve } from 'node:path';
import type { OkfFile } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';
import {
  bodyOf,
  conceptFrontmatters,
  isEmptyValue,
  isMapping,
  nonEmptyString,
} from '../../rule.js';
import { frontmatterKeyLine } from '../../frontmatter.js';
import {
  containsCodeBlock,
  findSection,
  isInternalLink,
  stripLinkSuffix,
} from '../../text-utils.js';

/** The concept type that carries a sanctioned computation (§10.1). */
export const ATTESTED_COMPUTATION_TYPE = 'Attested Computation';

/** True when the frontmatter declares an Attested Computation (case-insensitive). */
export function isAttestedComputation(data: Record<string, unknown>): boolean {
  const type = data['type'];
  return (
    typeof type === 'string' &&
    type.trim().toLowerCase() === ATTESTED_COMPUTATION_TYPE.toLowerCase()
  );
}

export const computationRuntime: Rule = {
  meta: {
    id: 'computation-runtime',
    severity: 'warning',
    category: 'computation',
    description: 'An `Attested Computation` concept must declare a non-empty `runtime`.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      if (!isAttestedComputation(data)) continue;
      if (nonEmptyString(data['runtime'])) continue;
      ctx.report({
        filePath: file.absPath,
        line:
          'runtime' in data ? frontmatterKeyLine(fm, 'runtime') : frontmatterKeyLine(fm, 'type'),
        column: 1,
        message:
          '`runtime` is required for `type: Attested Computation`; it defines how the computation runs and what `parameters` mean (e.g. `bigquery`, `dbt`, `python`).',
      });
    }
  },
};

export const computationParameters: Rule = {
  meta: {
    id: 'computation-parameters',
    severity: 'warning',
    category: 'computation',
    description:
      'When present, `parameters` should be a list of `{ name, type, required }` entries with unique names.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const parameters = data['parameters'];
      if (parameters === undefined || parameters === null) continue;
      const line = frontmatterKeyLine(fm, 'parameters');
      const report = (message: string) =>
        ctx.report({ filePath: file.absPath, line, column: 1, message });

      if (!Array.isArray(parameters)) {
        report(
          '`parameters` should be a YAML list, e.g. `parameters: [{ name: year, type: integer, required: true }]`.',
        );
        continue;
      }
      const names = new Set<string>();
      parameters.forEach((entry, index) => {
        const where = `\`parameters[${index}]`;
        if (!isMapping(entry)) {
          report(`${where}\` should be a \`{ name, type, required }\` mapping.`);
          return;
        }
        const name = nonEmptyString(entry['name']);
        if (!name) {
          report(`${where}.name\` is required and should be a non-empty string.`);
        } else if (names.has(name)) {
          report(`${where}.name\` \`${name}\` is a duplicate; parameter names must be unique.`);
        } else {
          names.add(name);
        }
        if (!nonEmptyString(entry['type'])) {
          report(
            `${where}.type\` is required and should be a non-empty string (e.g. \`integer\`, \`string\`).`,
          );
        }
        if (typeof entry['required'] !== 'boolean') {
          report(`${where}.required\` should be \`true\` or \`false\`.`);
        }
      });
    }
  },
};

export const computationBody: Rule = {
  meta: {
    id: 'computation-body',
    severity: 'warning',
    category: 'computation',
    description:
      'An `Attested Computation` should provide its computation exactly once: a code block under `# Computation`, or a `computation` path.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      if (!isAttestedComputation(data)) continue;
      const hasPath = !isEmptyValue(data['computation']);
      const body = bodyOf(ctx, file);
      const section = findSection(body.text, 'Computation', body.startLine);
      const hasInline = section !== null && containsCodeBlock(section.lines);

      if (hasPath && hasInline) {
        ctx.report({
          filePath: file.absPath,
          line: section.line,
          column: 1,
          message:
            'Both a `computation` path and an inline `# Computation` code block are present; the file is used instead of the inline fence, so omit the body code block.',
        });
      } else if (!hasPath && section && !hasInline) {
        ctx.report({
          filePath: file.absPath,
          line: section.line,
          column: 1,
          message:
            'The `# Computation` section has no code block; put the computation in a fenced code block.',
        });
      } else if (!hasPath && !section) {
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, 'type'),
          column: 1,
          message:
            'Attested Computation has no computation: add a `# Computation` section with a code block, or set `computation` to a path.',
        });
      }
    }
  },
};

export const computationExecutor: Rule = {
  meta: {
    id: 'computation-executor',
    severity: 'warning',
    category: 'computation',
    description:
      'When present, `executor` should be a mapping with a `resource` and, optionally, a `receipt` list of field names.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const executor = data['executor'];
      if (executor === undefined || executor === null) continue;
      const line = frontmatterKeyLine(fm, 'executor');
      const report = (message: string) =>
        ctx.report({ filePath: file.absPath, line, column: 1, message });

      if (!isMapping(executor)) {
        report(
          '`executor` should be a mapping, e.g. `executor: { resource: references/skills/run-on-bq.md, receipt: [job_id, executed_sql, result] }`.',
        );
        continue;
      }
      if (!nonEmptyString(executor['resource'])) {
        report('`executor.resource` should name the run instructions or code (a path or URL).');
      }
      const receipt = executor['receipt'];
      if (receipt !== undefined && receipt !== null) {
        if (!Array.isArray(receipt) || !receipt.every((r) => nonEmptyString(r))) {
          report(
            '`executor.receipt` should be a list of field names a run must return, e.g. `[job_id, executed_sql, result]`.',
          );
        }
      }
    }
  },
};

export const computationAttester: Rule = {
  meta: {
    id: 'computation-attester',
    severity: 'warning',
    category: 'computation',
    description:
      'When present, `attester` should be a mapping with a `resource` naming deterministic check code.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const attester = data['attester'];
      if (attester === undefined || attester === null) continue;
      const line = frontmatterKeyLine(fm, 'attester');
      if (!isMapping(attester)) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message:
            '`attester` should be a mapping, e.g. `attester: { resource: references/attesters/revenue.py }`.',
        });
        continue;
      }
      if (!nonEmptyString(attester['resource'])) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message:
            '`attester.resource` should name the deterministic (no-LLM) code that checks a receipt.',
        });
      }
    }
  },
};

/**
 * Resolve a §6.2 path-valued field. Bundle-absolute paths (`/x`) resolve from
 * the bundle root. Other paths are tried relative to the document first and
 * then relative to the bundle root, since the spec's own examples use
 * root-relative `references/...` paths without a leading slash.
 */
export function resolvePathField(ctx: RuleContext, file: OkfFile, value: string): string | null {
  const stripped = stripLinkSuffix(value.trim());
  if (!stripped) return null;
  const candidates = stripped.startsWith('/')
    ? [resolve(ctx.bundle.root, stripped.slice(1))]
    : [resolve(dirname(file.absPath), stripped), resolve(ctx.bundle.root, stripped)];
  return candidates.find((c) => ctx.pathSet.has(c)) ?? null;
}

export const computationPaths: Rule = {
  meta: {
    id: 'computation-paths',
    severity: 'warning',
    category: 'computation',
    description:
      'Bundle paths in `computation`, `executor.resource`, and `attester.resource` should resolve to a file in the bundle.',
  },
  run(ctx: RuleContext) {
    for (const { file, fm, data } of conceptFrontmatters(ctx)) {
      const fields: { label: string; key: string; value: unknown }[] = [
        { label: '`computation`', key: 'computation', value: data['computation'] },
      ];
      for (const key of ['executor', 'attester'] as const) {
        const mapping = data[key];
        if (isMapping(mapping)) {
          fields.push({ label: `\`${key}.resource\``, key, value: mapping['resource'] });
        }
      }
      for (const { label, key, value } of fields) {
        if (typeof value !== 'string' || value.trim() === '') continue;
        if (!isInternalLink(value)) continue; // absolute URL (https:, gs:, ...)
        if (resolvePathField(ctx, file, value) !== null) continue;
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, key),
          column: 1,
          message: `${label} path \`${value}\` does not resolve to a file in the bundle (tried relative to the document and to the bundle root).`,
        });
      }
    }
  },
};

/** Computation rules, in reporting order. */
export const computationRules: Rule[] = [
  computationRuntime,
  computationParameters,
  computationBody,
  computationExecutor,
  computationAttester,
  computationPaths,
];

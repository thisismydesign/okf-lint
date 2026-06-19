import { resolve, dirname, join } from 'node:path';
import type { Rule, RuleContext } from '../../rule.js';
import { nonEmptyString } from '../../rule.js';
import { frontmatterKeyLine } from '../../frontmatter.js';
import {
  extractLinks,
  isInternalLink,
  stripLinkSuffix,
  isIso8601DateTime,
  isIsoDate,
} from '../../text-utils.js';

const RECOMMENDED_FIELDS = ['title', 'description', 'timestamp'] as const;

/** True for values that count as "missing" for a recommended field. */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// ---------------------------------------------------------------------------
// Frontmatter rules (mandatory)
// ---------------------------------------------------------------------------

const frontmatterPresent: Rule = {
  meta: {
    id: 'frontmatter-present',
    severity: 'error',
    category: 'frontmatter',
    description: 'Every non-reserved `.md` file must begin with a YAML frontmatter block.',
  },
  run(ctx) {
    for (const file of ctx.conceptFiles) {
      const fm = ctx.parsed.get(file.absPath)!;
      if (!fm.present) {
        ctx.report({
          filePath: file.absPath,
          line: 1,
          column: 1,
          message:
            'Concept document has no YAML frontmatter block. Every non-reserved `.md` file must start with `---`.',
        });
      }
    }
  },
};

const frontmatterParseable: Rule = {
  meta: {
    id: 'frontmatter-parseable',
    severity: 'error',
    category: 'frontmatter',
    description: 'Frontmatter must be a parseable YAML mapping.',
  },
  run(ctx) {
    for (const file of ctx.conceptFiles) {
      const fm = ctx.parsed.get(file.absPath)!;
      if (fm.present && fm.parseError) {
        ctx.report({
          filePath: file.absPath,
          line: fm.startLine || 1,
          column: 1,
          message: `Frontmatter could not be parsed as YAML: ${fm.parseError}`,
        });
      }
    }
  },
};

const typeRequired: Rule = {
  meta: {
    id: 'type-required',
    severity: 'error',
    category: 'frontmatter',
    description: 'Frontmatter must contain a non-empty `type` field.',
  },
  run(ctx) {
    for (const file of ctx.conceptFiles) {
      const fm = ctx.parsed.get(file.absPath)!;
      if (!fm.present || !fm.data) continue;
      if (!nonEmptyString(fm.data['type'])) {
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, 'type'),
          column: 1,
          message:
            'type' in fm.data
              ? 'Frontmatter `type` field must be a non-empty string.'
              : 'Frontmatter is missing the required `type` field.',
        });
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Frontmatter rules (recommended — opinionated warnings)
// ---------------------------------------------------------------------------

const RECOMMENDED_LABELS: Record<(typeof RECOMMENDED_FIELDS)[number], string> = {
  title: 'a human-readable display name',
  description: 'a one-line summary',
  timestamp: 'an ISO 8601 last-modified time',
};

const recommendedFieldRules: Rule[] = RECOMMENDED_FIELDS.map((field) => ({
  meta: {
    id: `recommended-${field}`,
    severity: 'warning' as const,
    category: 'frontmatter' as const,
    description: `Concept documents should include a \`${field}\` field.`,
  },
  run(ctx: RuleContext) {
    for (const file of ctx.conceptFiles) {
      const fm = ctx.parsed.get(file.absPath)!;
      if (!fm.present || !fm.data) continue;
      if (isEmptyValue(fm.data[field])) {
        ctx.report({
          filePath: file.absPath,
          line: fm.startLine || 1,
          column: 1,
          message: `Missing recommended \`${field}\` field (${RECOMMENDED_LABELS[field]}).`,
        });
      }
    }
  },
}));

const tagsType: Rule = {
  meta: {
    id: 'tags-type',
    severity: 'warning',
    category: 'frontmatter',
    description: 'When present, `tags` should be a list of strings.',
  },
  run(ctx) {
    for (const file of ctx.conceptFiles) {
      const fm = ctx.parsed.get(file.absPath)!;
      if (!fm.present || !fm.data) continue;
      const tags = fm.data['tags'];
      if (tags === undefined || tags === null) continue;
      const line = frontmatterKeyLine(fm, 'tags');
      if (!Array.isArray(tags)) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message: '`tags` should be a YAML list, e.g. `tags: [analytics, customer]`.',
        });
      } else if (!tags.every((t) => typeof t === 'string')) {
        ctx.report({
          filePath: file.absPath,
          line,
          column: 1,
          message: '`tags` should contain only strings.',
        });
      }
    }
  },
};

const timestampFormat: Rule = {
  meta: {
    id: 'timestamp-format',
    severity: 'warning',
    category: 'frontmatter',
    description: 'When present, `timestamp` should be an ISO 8601 datetime.',
  },
  run(ctx) {
    for (const file of ctx.conceptFiles) {
      const fm = ctx.parsed.get(file.absPath)!;
      if (!fm.present || !fm.data) continue;
      const ts = fm.data['timestamp'];
      if (isEmptyValue(ts)) continue;
      const ok = ts instanceof Date || (typeof ts === 'string' && isIso8601DateTime(ts));
      if (!ok) {
        ctx.report({
          filePath: file.absPath,
          line: frontmatterKeyLine(fm, 'timestamp'),
          column: 1,
          message: '`timestamp` should be an ISO 8601 datetime, e.g. `2026-05-22T10:00:00Z`.',
        });
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Structure rules
// ---------------------------------------------------------------------------

const indexFrontmatter: Rule = {
  meta: {
    id: 'index-frontmatter',
    severity: 'error',
    category: 'structure',
    description: 'Only the bundle-root `index.md` may contain frontmatter.',
  },
  run(ctx) {
    for (const file of ctx.indexFiles) {
      if (file.isBundleRootIndex) continue;
      const fm = ctx.parsed.get(file.absPath)!;
      if (fm.present) {
        ctx.report({
          filePath: file.absPath,
          line: fm.startLine || 1,
          column: 1,
          message:
            'Reserved `index.md` files must not contain frontmatter (only the bundle-root index may, to declare `okf_version`).',
        });
      }
    }
  },
};

const indexVersionKey: Rule = {
  meta: {
    id: 'index-version-key',
    severity: 'error',
    category: 'structure',
    description: 'Bundle-root `index.md` frontmatter may only contain `okf_version`.',
  },
  run(ctx) {
    const root = ctx.rootIndex;
    if (!root) return;
    const fm = ctx.parsed.get(root.absPath)!;
    if (!fm.present || !fm.data) return;
    for (const key of Object.keys(fm.data)) {
      if (key !== 'okf_version') {
        ctx.report({
          filePath: root.absPath,
          line: frontmatterKeyLine(fm, key),
          column: 1,
          message: `Bundle-root \`index.md\` frontmatter may only contain \`okf_version\`; found unexpected key \`${key}\`.`,
        });
      }
    }
  },
};

const recommendedIndex: Rule = {
  meta: {
    id: 'recommended-index',
    severity: 'warning',
    category: 'structure',
    description: 'A bundle should include a root `index.md` for progressive disclosure.',
  },
  run(ctx) {
    if (!ctx.rootIndex) {
      ctx.report({
        filePath: join(ctx.bundle.root, 'index.md'),
        line: 1,
        column: 1,
        message:
          'Bundle has no root `index.md`. Adding one provides a navigable, grouped listing of concepts.',
      });
    }
  },
};

const recommendedLog: Rule = {
  meta: {
    id: 'recommended-log',
    severity: 'warning',
    category: 'structure',
    description: 'A bundle should include a `log.md` recording its update history.',
  },
  run(ctx) {
    if (!ctx.logFile) {
      ctx.report({
        filePath: join(ctx.bundle.root, 'log.md'),
        line: 1,
        column: 1,
        message:
          'Bundle has no `log.md`. Adding one records the update history and aids consumers tracking changes.',
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Log rules
// ---------------------------------------------------------------------------

interface LogHeading {
  text: string;
  line: number;
}

function collectLogHeadings(content: string): LogHeading[] {
  const headings: LogHeading[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /^##\s+(.+?)\s*$/.exec(lines[i]!);
    if (match) headings.push({ text: match[1]!, line: i + 1 });
  }
  return headings;
}

const logDateFormat: Rule = {
  meta: {
    id: 'log-date-format',
    severity: 'error',
    category: 'log',
    description: 'Log entry headings must use ISO 8601 `YYYY-MM-DD` dates.',
  },
  run(ctx) {
    if (!ctx.logFile) return;
    for (const heading of collectLogHeadings(ctx.logFile.content)) {
      if (!isIsoDate(heading.text)) {
        ctx.report({
          filePath: ctx.logFile.absPath,
          line: heading.line,
          column: 1,
          message: `Log entry headings must use ISO 8601 \`YYYY-MM-DD\` form; found \`${heading.text}\`.`,
        });
      }
    }
  },
};

const logDateOrder: Rule = {
  meta: {
    id: 'log-date-order',
    severity: 'warning',
    category: 'log',
    description: 'Log entries should be ordered newest-first.',
  },
  run(ctx) {
    if (!ctx.logFile) return;
    const dated = collectLogHeadings(ctx.logFile.content).filter((h) => isIsoDate(h.text));
    for (let i = 1; i < dated.length; i++) {
      const prev = Date.parse(dated[i - 1]!.text);
      const curr = Date.parse(dated[i]!.text);
      if (curr > prev) {
        ctx.report({
          filePath: ctx.logFile.absPath,
          line: dated[i]!.line,
          column: 1,
          message: `Log entries should be newest-first; \`${dated[i]!.text}\` is newer than the preceding \`${dated[i - 1]!.text}\`.`,
        });
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Link rules
// ---------------------------------------------------------------------------

const validLinks: Rule = {
  meta: {
    id: 'valid-links',
    severity: 'warning',
    category: 'links',
    description: 'Internal `.md` cross-links should resolve to a file in the bundle.',
  },
  run(ctx) {
    for (const file of ctx.bundle.files) {
      const fm = ctx.parsed.get(file.absPath)!;
      const lines = file.content.split(/\r?\n/);
      const body = lines.slice(fm.bodyStartLine - 1).join('\n');
      for (const link of extractLinks(body, fm.bodyStartLine)) {
        if (!isInternalLink(link.target)) continue;
        const stripped = stripLinkSuffix(link.target);
        if (!stripped || !stripped.toLowerCase().endsWith('.md')) continue;
        const candidate = stripped.startsWith('/')
          ? resolve(ctx.bundle.root, stripped.slice(1))
          : resolve(dirname(file.absPath), stripped);
        if (!ctx.fileSet.has(candidate)) {
          ctx.report({
            filePath: file.absPath,
            line: link.line,
            column: link.column,
            message: `Cross-link \`${link.target}\` does not resolve to a file in the bundle.`,
          });
        }
      }
    }
  },
};

const preferAbsoluteLinks: Rule = {
  meta: {
    id: 'prefer-absolute-links',
    severity: 'warning',
    category: 'links',
    description:
      'Internal cross-links should use bundle-absolute paths (`/...`), not relative paths.',
  },
  run(ctx) {
    for (const file of ctx.bundle.files) {
      const fm = ctx.parsed.get(file.absPath)!;
      const lines = file.content.split(/\r?\n/);
      const body = lines.slice(fm.bodyStartLine - 1).join('\n');
      for (const link of extractLinks(body, fm.bodyStartLine)) {
        if (!isInternalLink(link.target)) continue;
        if (link.target.startsWith('/')) continue;
        ctx.report({
          filePath: file.absPath,
          line: link.line,
          column: link.column,
          message: `Prefer a bundle-absolute link (e.g. \`/path/to/doc.md\`) over the relative link \`${link.target}\`.`,
        });
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Version rules
// ---------------------------------------------------------------------------

const okfVersionDeclared: Rule = {
  meta: {
    id: 'okf-version-declared',
    severity: 'warning',
    category: 'version',
    description: 'Bundles should declare the OKF version they target.',
  },
  run(ctx) {
    if (ctx.version.declared) return;
    ctx.report({
      filePath: ctx.rootIndex?.absPath ?? join(ctx.bundle.root, 'index.md'),
      line: 1,
      column: 1,
      message: `Bundle does not declare an OKF version. Add \`okf_version: "${ctx.version.resolved}"\` to the bundle-root \`index.md\`; validating against the latest supported version (${ctx.version.resolved}).`,
    });
  },
};

const okfVersionSupported: Rule = {
  meta: {
    id: 'okf-version-supported',
    severity: 'warning',
    category: 'version',
    description: 'The declared OKF version should be supported by the linter.',
  },
  run(ctx) {
    if (!ctx.version.declared || ctx.version.supported) return;
    const fm = ctx.rootIndex ? ctx.parsed.get(ctx.rootIndex.absPath) : undefined;
    ctx.report({
      filePath: ctx.rootIndex?.absPath ?? join(ctx.bundle.root, 'index.md'),
      line: fm ? frontmatterKeyLine(fm, 'okf_version') : 1,
      column: 1,
      message: `Declared OKF version \`${ctx.version.requested}\` is not supported; validating against the latest supported version (${ctx.version.resolved}).`,
    });
  },
};

const okfVersionFormat: Rule = {
  meta: {
    id: 'okf-version-format',
    severity: 'warning',
    category: 'version',
    description: '`okf_version` should be a quoted string to avoid numeric coercion.',
  },
  run(ctx) {
    const root = ctx.rootIndex;
    if (!root) return;
    const fm = ctx.parsed.get(root.absPath)!;
    if (!fm.present || !fm.data) return;
    const value = fm.data['okf_version'];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') {
      ctx.report({
        filePath: root.absPath,
        line: frontmatterKeyLine(fm, 'okf_version'),
        column: 1,
        message: `\`okf_version\` should be a quoted string (e.g. "${ctx.version.resolved}") so versions like "0.10" are not parsed as numbers.`,
      });
    }
  },
};

/** The complete, ordered rule set for OKF v0.1. */
export const rules: Rule[] = [
  frontmatterPresent,
  frontmatterParseable,
  typeRequired,
  ...recommendedFieldRules,
  tagsType,
  timestampFormat,
  indexFrontmatter,
  indexVersionKey,
  recommendedIndex,
  recommendedLog,
  logDateFormat,
  logDateOrder,
  validLinks,
  preferAbsoluteLinks,
  okfVersionDeclared,
  okfVersionSupported,
  okfVersionFormat,
];

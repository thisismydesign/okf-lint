import type { Bundle, Diagnostic, LintResult, OkfLintConfig } from './types.js';
import type { ParsedFrontmatter } from './frontmatter.js';
import type { RuleContext } from './rule.js';
import { parseFrontmatter } from './frontmatter.js';
import { loadBundle } from './bundle.js';
import { loadConfig, applyConfig } from './config.js';
import { getRuleSet, resolveVersion } from './versions/index.js';

/** Options accepted by {@link lint} and {@link lintBundle}. */
export interface LintOptions {
  /** Inline configuration. When provided, file-based config discovery is skipped. */
  config?: OkfLintConfig;
  /** Working directory used to discover `.okflintrc.json`. Defaults to `process.cwd()`. */
  cwd?: string;
}

/** Lint the OKF bundle at `target` (a bundle directory, or a file within one). */
export function lint(target: string, options: LintOptions = {}): LintResult {
  const bundle = loadBundle(target);
  return lintBundle(bundle, options);
}

/** Lint an already-loaded {@link Bundle}. */
export function lintBundle(bundle: Bundle, options: LintOptions = {}): LintResult {
  const parsed = new Map<string, ParsedFrontmatter>();
  for (const file of bundle.files) {
    parsed.set(file.absPath, parseFrontmatter(file.content));
  }

  const version = resolveVersion(bundle, parsed);
  const config = options.config ?? loadConfig(bundle.root, options.cwd);

  const fileSet = new Set(bundle.files.map((f) => f.absPath));
  const conceptFiles = bundle.files.filter((f) => !f.reserved);
  const indexFiles = bundle.files.filter((f) => f.reservedKind === 'index');
  const rootIndex = bundle.files.find((f) => f.isBundleRootIndex);
  const logFile = bundle.files.find((f) => f.reservedKind === 'log' && f.relPath === 'log.md');

  const baseContext: Omit<RuleContext, 'report'> = {
    bundle,
    parsed,
    fileSet,
    version,
    conceptFiles,
    rootIndex,
    logFile,
    indexFiles,
  };

  const diagnostics: Diagnostic[] = [];
  for (const rule of getRuleSet(version.resolved)) {
    const context: RuleContext = {
      ...baseContext,
      report(input) {
        diagnostics.push({
          ruleId: rule.meta.id,
          severity: rule.meta.severity,
          message: input.message,
          filePath: input.filePath,
          line: input.line,
          column: input.column,
        });
      },
    };
    rule.run(context);
  }

  const filtered = sortDiagnostics(applyConfig(diagnostics, config));
  const errorCount = filtered.filter((d) => d.severity === 'error').length;
  const warningCount = filtered.length - errorCount;

  return { diagnostics: filtered, errorCount, warningCount, version };
}

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      a.filePath.localeCompare(b.filePath) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      (a.column ?? 0) - (b.column ?? 0) ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

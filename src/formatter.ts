import { relative } from 'node:path';
import type { Diagnostic, LintResult } from './types.js';

const useColor = process.env['NO_COLOR'] === undefined && process.stdout.isTTY === true;

const color = {
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  underline: (s: string) => (useColor ? `\x1b[4m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
};

/** ESLint-style ("stylish") human-readable output. */
export function formatStylish(result: LintResult, cwd: string = process.cwd()): string {
  const byFile = new Map<string, Diagnostic[]>();
  for (const d of result.diagnostics) {
    const list = byFile.get(d.filePath) ?? [];
    list.push(d);
    byFile.set(d.filePath, list);
  }

  const out: string[] = [];
  for (const [filePath, diagnostics] of byFile) {
    out.push(color.underline(relative(cwd, filePath) || filePath));
    for (const d of diagnostics) {
      const pos = `${d.line ?? 0}:${d.column ?? 0}`.padEnd(7);
      const severity = d.severity === 'error' ? color.red('error  ') : color.yellow('warning');
      out.push(`  ${color.dim(pos)}  ${severity}  ${d.message}  ${color.dim(d.ruleId)}`);
    }
    out.push('');
  }

  out.push(summary(result));
  return out.join('\n');
}

function summary(result: LintResult): string {
  const { errorCount, warningCount } = result;
  const total = errorCount + warningCount;
  if (total === 0) {
    return color.bold('✓ No problems found.');
  }
  const parts = `${total} problem${total === 1 ? '' : 's'} (${errorCount} error${
    errorCount === 1 ? '' : 's'
  }, ${warningCount} warning${warningCount === 1 ? '' : 's'})`;
  const line = `✖ ${parts}`;
  return color.bold(errorCount > 0 ? color.red(line) : color.yellow(line));
}

/** Machine-readable JSON output. */
export function formatJson(result: LintResult): string {
  return JSON.stringify(
    {
      version: result.version,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      diagnostics: result.diagnostics,
    },
    null,
    2,
  );
}

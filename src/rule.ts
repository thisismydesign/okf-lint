import type { Bundle, OkfFile, ResolvedVersion, Severity } from './types.js';
import type { ParsedFrontmatter } from './frontmatter.js';

/** A diagnostic as reported by a rule (rule id and severity are attached by the engine). */
export interface ReportInput {
  message: string;
  filePath: string;
  line?: number;
  column?: number;
}

/** Everything a rule needs to inspect a bundle and report problems. */
export interface RuleContext {
  bundle: Bundle;
  /** Parsed frontmatter for every file, keyed by absolute path. */
  parsed: Map<string, ParsedFrontmatter>;
  /** Set of absolute paths of every file in the bundle (for link resolution). */
  fileSet: Set<string>;
  /** The resolved OKF version being validated against. */
  version: ResolvedVersion;
  /** Non-reserved concept documents. */
  conceptFiles: OkfFile[];
  /** The bundle-root `index.md`, if present. */
  rootIndex: OkfFile | undefined;
  /** The bundle-root `log.md`, if present. */
  logFile: OkfFile | undefined;
  /** All `index.md` files in the bundle. */
  indexFiles: OkfFile[];
  /** Report a problem. The rule's id and severity are filled in automatically. */
  report(input: ReportInput): void;
}

/** Metadata describing a single lint rule. */
export interface RuleMeta {
  /** Stable identifier, e.g. `type-required`. */
  id: string;
  /** Default severity. May be overridden by user configuration. */
  severity: Severity;
  /** Grouping used in documentation and `--list-rules` output. */
  category: 'frontmatter' | 'structure' | 'links' | 'log' | 'version';
  /** One-line human-readable description. */
  description: string;
}

/** A lint rule: metadata plus a function that inspects a bundle. */
export interface Rule {
  meta: RuleMeta;
  run(context: RuleContext): void;
}

/** Get a frontmatter field value if it is a non-empty string, else `null`. */
export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

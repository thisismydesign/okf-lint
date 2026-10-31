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
  /** Set of absolute paths of every markdown file in the bundle (for link resolution). */
  fileSet: Set<string>;
  /** Set of absolute paths of every file in the bundle tree, markdown or not. */
  pathSet: Set<string>;
  /** The instant to treat as "now" for time-sensitive rules (e.g. `stale_after`). */
  now: Date;
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
  category:
    | 'frontmatter'
    | 'structure'
    | 'links'
    | 'log'
    | 'version'
    | 'provenance'
    | 'trust'
    | 'lifecycle'
    | 'computation'
    | 'migration';
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

/** True for plain YAML mappings (not lists, dates, or scalars). */
export function isMapping(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

/** True for values that count as "missing": `undefined`, `null`, blank strings, empty lists. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** A concept document together with its successfully parsed frontmatter. */
export interface ConceptFrontmatter {
  file: OkfFile;
  fm: ParsedFrontmatter;
  data: Record<string, unknown>;
}

/** Iterate concept documents whose frontmatter parsed to a mapping. */
export function* conceptFrontmatters(ctx: RuleContext): Generator<ConceptFrontmatter> {
  for (const file of ctx.conceptFiles) {
    const fm = ctx.parsed.get(file.absPath)!;
    if (!fm.present || !fm.data) continue;
    yield { file, fm, data: fm.data };
  }
}

/** The markdown body of a file (everything after the frontmatter block). */
export function bodyOf(ctx: RuleContext, file: OkfFile): { text: string; startLine: number } {
  const fm = ctx.parsed.get(file.absPath)!;
  const lines = file.content.split(/\r?\n/);
  return { text: lines.slice(fm.bodyStartLine - 1).join('\n'), startLine: fm.bodyStartLine };
}

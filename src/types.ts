/**
 * Severity of a diagnostic produced by a rule.
 *
 * - `error`   — a mandatory OKF conformance requirement is violated.
 * - `warning` — an optional-but-useful (opinionated) convention is not followed.
 */
export type Severity = 'error' | 'warning';

/** Severity as expressed in user configuration, where rules can also be disabled. */
export type ConfigSeverity = Severity | 'off';

/** A single problem found in a bundle. */
export interface Diagnostic {
  /** Identifier of the rule that produced this diagnostic, e.g. `type-required`. */
  ruleId: string;
  /** Effective severity after applying configuration. */
  severity: Severity;
  /** Human-readable description of the problem. */
  message: string;
  /** Absolute path to the file the diagnostic refers to. */
  filePath: string;
  /** 1-based line number, when known. */
  line?: number;
  /** 1-based column number, when known. */
  column?: number;
}

/** A single markdown file discovered inside a bundle. */
export interface OkfFile {
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to the bundle root, using POSIX separators. */
  relPath: string;
  /** Raw file contents. */
  content: string;
  /** True for reserved files (`index.md`, `log.md`). */
  reserved: boolean;
  /** The kind of reserved file, if any. */
  reservedKind: 'index' | 'log' | null;
  /** True when this is the bundle-root `index.md`. */
  isBundleRootIndex: boolean;
}

/** A discovered OKF bundle. */
export interface Bundle {
  /** Absolute path to the bundle root directory. */
  root: string;
  /** All markdown files in the bundle. */
  files: OkfFile[];
}

/** Result of resolving which OKF version to validate against. */
export interface ResolvedVersion {
  /** Version declared by the bundle (`okf_version`), or `null` if none. */
  requested: string | null;
  /** Whether the bundle declared a version at all. */
  declared: boolean;
  /** Whether the declared version is supported by this linter. */
  supported: boolean;
  /** The version whose rule set is actually used for validation. */
  resolved: string;
}

/** Configuration, typically loaded from `.okflintrc.json`. */
export interface OkfLintConfig {
  /** Per-rule severity overrides. */
  rules?: Record<string, ConfigSeverity>;
}

/** Aggregated outcome of a lint run. */
export interface LintResult {
  /** All diagnostics, sorted by file then position. */
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  /** The version resolution that was applied. */
  version: ResolvedVersion;
}

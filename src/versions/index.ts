import type { Bundle, ResolvedVersion } from '../types.js';
import type { Rule } from '../rule.js';
import type { ParsedFrontmatter } from '../frontmatter.js';
import { rules as v0_1Rules } from './v0_1/rules.js';

/** The most recent OKF version this linter implements. */
export const LATEST_VERSION = '0.1';

/** Registry of supported OKF versions and their rule sets. */
const RULE_SETS: Record<string, Rule[]> = {
  '0.1': v0_1Rules,
};

/** List of OKF versions this linter supports, ascending. */
export const SUPPORTED_VERSIONS: string[] = Object.keys(RULE_SETS).sort();

/** Whether a given version string has a rule set. */
export function isSupported(version: string): boolean {
  return Object.prototype.hasOwnProperty.call(RULE_SETS, version);
}

/** Get the rule set for a (supported) version, falling back to the latest. */
export function getRuleSet(version: string): Rule[] {
  return RULE_SETS[version] ?? RULE_SETS[LATEST_VERSION]!;
}

/**
 * Determine which OKF version to validate against.
 *
 * Reads `okf_version` from the bundle-root `index.md` frontmatter. If absent or
 * unsupported, falls back to {@link LATEST_VERSION} (the caller surfaces the
 * corresponding warning via the `okf-version-*` rules).
 */
export function resolveVersion(
  bundle: Bundle,
  parsed: Map<string, ParsedFrontmatter>,
): ResolvedVersion {
  const rootIndex = bundle.files.find((f) => f.isBundleRootIndex);
  let requested: string | null = null;

  if (rootIndex) {
    const fm = parsed.get(rootIndex.absPath);
    const value = fm?.present && fm.data ? fm.data['okf_version'] : undefined;
    if (value !== undefined && value !== null && value !== '') {
      requested = typeof value === 'string' ? value.trim() : String(value);
    }
  }

  const declared = requested !== null && requested !== '';
  const supported = declared && isSupported(requested!);
  const resolved = supported ? requested! : LATEST_VERSION;

  return { requested: declared ? requested : null, declared, supported, resolved };
}

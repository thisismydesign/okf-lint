/**
 * OKF v0.2 rule set.
 *
 * v0.2 is a minor bump over v0.1 (§13): bundle structure, reserved files, the
 * required `type`, cross-linking, and conformance are carried forward
 * unchanged, so those rules are reused from v0.1 as-is. On top of them v0.2
 * adds the provenance, trust, lifecycle, and computation families (§5, §10)
 * and two migration hints for the fields it supersedes (§13.1).
 */
import type { Rule } from '../../rule.js';
import {
  frontmatterPresent,
  frontmatterParseable,
  typeRequired,
  recommendedTitle,
  recommendedDescription,
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
} from '../v0_1/rules.js';
import { provenanceRules } from './provenance.js';
import { trustRules } from './trust.js';
import { lifecycleRules } from './lifecycle.js';
import { computationRules } from './computation.js';
import { migrationRules } from './migration.js';

export * from './provenance.js';
export * from './trust.js';
export * from './lifecycle.js';
export * from './computation.js';
export * from './migration.js';

/** The complete, ordered rule set for OKF v0.2. */
export const rules: Rule[] = [
  // Carried forward from v0.1 (§13.2: "everything else ... unchanged").
  frontmatterPresent,
  frontmatterParseable,
  typeRequired,
  recommendedTitle,
  recommendedDescription,
  // `recommended-timestamp` is intentionally absent: `timestamp` is superseded by
  // `generated.at` (§13.1) and `recommended-generated` takes its place. The legacy
  // field is still format-checked when present.
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
  // New in v0.2.
  ...provenanceRules,
  ...trustRules,
  ...lifecycleRules,
  ...computationRules,
  ...migrationRules,
];

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigSeverity, Diagnostic, OkfLintConfig } from './types.js';

const CONFIG_FILENAME = '.okflintrc.json';
const VALID_SEVERITIES: ConfigSeverity[] = ['off', 'warning', 'error'];

/**
 * Load configuration, searching `bundleRoot` first and then `cwd` for
 * `.okflintrc.json`. Returns an empty config when none is found.
 */
export function loadConfig(bundleRoot: string, cwd: string = process.cwd()): OkfLintConfig {
  for (const dir of [bundleRoot, cwd]) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return parseConfig(readFileSync(candidate, 'utf8'), candidate);
    }
  }
  return {};
}

/** Parse and validate config JSON. Throws on malformed content. */
export function parseConfig(raw: string, source = '<config>'): OkfLintConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse ${source}: ${(error as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid config in ${source}: expected an object.`);
  }

  const config: OkfLintConfig = {};
  const rules = (parsed as Record<string, unknown>)['rules'];
  if (rules !== undefined) {
    if (typeof rules !== 'object' || rules === null) {
      throw new Error(`Invalid config in ${source}: "rules" must be an object.`);
    }
    config.rules = {};
    for (const [id, severity] of Object.entries(rules as Record<string, unknown>)) {
      if (!VALID_SEVERITIES.includes(severity as ConfigSeverity)) {
        throw new Error(
          `Invalid config in ${source}: rule "${id}" must be one of ${VALID_SEVERITIES.map((s) => `"${s}"`).join(', ')}.`,
        );
      }
      config.rules[id] = severity as ConfigSeverity;
    }
  }
  return config;
}

/**
 * Apply per-rule severity overrides from config: drop disabled rules and
 * re-map the severity of the rest.
 */
export function applyConfig(diagnostics: Diagnostic[], config: OkfLintConfig): Diagnostic[] {
  const overrides = config.rules;
  if (!overrides) return diagnostics;

  const result: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const override = overrides[diagnostic.ruleId];
    if (override === undefined) {
      result.push(diagnostic);
    } else if (override === 'off') {
      continue;
    } else {
      result.push({ ...diagnostic, severity: override });
    }
  }
  return result;
}

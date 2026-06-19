#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lint } from './linter.js';
import { formatStylish, formatJson } from './formatter.js';
import { getRuleSet, LATEST_VERSION, SUPPORTED_VERSIONS } from './versions/index.js';

interface CliOptions {
  path: string;
  format: 'stylish' | 'json';
  quiet: boolean;
  maxWarnings: number;
}

function readVersion(): string {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), 'utf8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const HELP = `okf-lint — an opinionated linter for OKF knowledge catalogs

Usage:
  okf-lint [path] [options]

Arguments:
  path                 Path to the OKF bundle directory (default: ".")

Options:
  -f, --format <fmt>   Output format: "stylish" (default) or "json"
  -q, --quiet          Report errors only (suppress warnings)
  --max-warnings <n>   Exit with a non-zero code if warnings exceed <n>
  --list-rules         Print all rules for the latest version and exit
  -v, --version        Print the okf-lint version and exit
  -h, --help           Show this help and exit

Exit codes:
  0  no errors (and warnings within --max-warnings, if set)
  1  errors found, or warnings exceeded --max-warnings
  2  usage or runtime error

Supported OKF versions: ${SUPPORTED_VERSIONS.join(', ')} (latest: ${LATEST_VERSION})`;

function parseArgs(argv: string[]): CliOptions | { exit: number; message?: string } {
  const options: CliOptions = {
    path: '.',
    format: 'stylish',
    quiet: false,
    maxWarnings: Number.POSITIVE_INFINITY,
  };
  let pathSet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP + '\n');
        return { exit: 0 };
      case '-v':
      case '--version':
        process.stdout.write(readVersion() + '\n');
        return { exit: 0 };
      case '--list-rules':
        printRules();
        return { exit: 0 };
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '-f':
      case '--format': {
        const value = argv[++i];
        if (value !== 'stylish' && value !== 'json') {
          return { exit: 2, message: `Invalid format: ${value ?? '(missing)'}` };
        }
        options.format = value;
        break;
      }
      case '--max-warnings': {
        const value = Number(argv[++i]);
        if (!Number.isInteger(value) || value < 0) {
          return { exit: 2, message: '--max-warnings requires a non-negative integer.' };
        }
        options.maxWarnings = value;
        break;
      }
      default:
        if (arg.startsWith('-')) {
          return { exit: 2, message: `Unknown option: ${arg}` };
        }
        options.path = arg;
        pathSet = true;
        break;
    }
  }

  void pathSet;
  return options;
}

function printRules(): void {
  const rules = getRuleSet(LATEST_VERSION);
  process.stdout.write(`Rules for OKF v${LATEST_VERSION}:\n\n`);
  for (const rule of rules) {
    const sev = rule.meta.severity === 'error' ? 'error  ' : 'warning';
    process.stdout.write(`  ${sev}  ${rule.meta.id.padEnd(24)} ${rule.meta.description}\n`);
  }
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ('exit' in parsed) {
    if (parsed.message) process.stderr.write(parsed.message + '\n');
    return parsed.exit;
  }

  let result;
  try {
    result = lint(parsed.path);
  } catch (error) {
    process.stderr.write(`okf-lint: ${(error as Error).message}\n`);
    return 2;
  }

  if (parsed.quiet) {
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    result = { ...result, diagnostics: errors, warningCount: 0 };
  }

  if (parsed.format === 'json') {
    process.stdout.write(formatJson(result) + '\n');
  } else {
    process.stdout.write(formatStylish(result) + '\n');
  }

  if (result.errorCount > 0) return 1;
  if (result.warningCount > parsed.maxWarnings) return 1;
  return 0;
}

process.exit(main());

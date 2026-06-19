import { parse as parseYaml } from 'yaml';

/** Result of attempting to parse a YAML frontmatter block from a markdown file. */
export interface ParsedFrontmatter {
  /** True when an opening `---` fence was found at the start of the file. */
  present: boolean;
  /** Parsed mapping, or `null` when absent or unparseable. */
  data: Record<string, unknown> | null;
  /** Raw YAML text between the fences, or `null` when absent. */
  raw: string | null;
  /** 1-based line of the opening `---` (0 when absent). */
  startLine: number;
  /** 1-based line of the closing `---` (0 when unterminated/absent). */
  endLine: number;
  /** 1-based line where the markdown body begins. */
  bodyStartLine: number;
  /** Parse error message, or `null` when parsing succeeded. */
  parseError: string | null;
}

/**
 * Parse the leading YAML frontmatter block of a markdown document.
 *
 * A frontmatter block must start on the very first line with a `---` fence and
 * be terminated by a matching `---` fence on its own line.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const normalized = content.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);

  if (lines[0] !== '---') {
    return {
      present: false,
      data: null,
      raw: null,
      startLine: 0,
      endLine: 0,
      bodyStartLine: 1,
      parseError: null,
    };
  }

  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      closing = i;
      break;
    }
  }

  if (closing === -1) {
    return {
      present: true,
      data: null,
      raw: null,
      startLine: 1,
      endLine: 0,
      bodyStartLine: lines.length + 1,
      parseError: 'Unterminated frontmatter block (missing closing `---`).',
    };
  }

  const raw = lines.slice(1, closing).join('\n');
  let data: Record<string, unknown> | null = null;
  let parseError: string | null = null;

  try {
    const parsed = parseYaml(raw) as unknown;
    if (parsed === null || parsed === undefined) {
      data = {};
    } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    } else {
      parseError = 'Frontmatter must be a YAML mapping.';
    }
  } catch (error) {
    parseError = (error as Error).message;
  }

  return {
    present: true,
    data,
    raw,
    startLine: 1,
    endLine: closing + 1,
    bodyStartLine: closing + 2,
    parseError,
  };
}

/**
 * Find the 1-based line number of a top-level frontmatter key, for diagnostics.
 * Returns the opening-fence line when the key cannot be located.
 */
export function frontmatterKeyLine(fm: ParsedFrontmatter, key: string): number {
  if (!fm.raw) return fm.startLine || 1;
  const rawLines = fm.raw.split('\n');
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`);
  for (let i = 0; i < rawLines.length; i++) {
    if (pattern.test(rawLines[i]!)) {
      // +1 to move past the opening fence, +1 to convert to 1-based.
      return fm.startLine + 1 + i;
    }
  }
  return fm.startLine || 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

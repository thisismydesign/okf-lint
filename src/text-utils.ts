/** A markdown link found in a document body. */
export interface FoundLink {
  /** The raw target inside the parentheses, e.g. `/tables/x.md#schema`. */
  target: string;
  /** 1-based line number where the link occurs. */
  line: number;
  /** 1-based column of the link. */
  column: number;
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Extract markdown links from `content`, starting line numbering at `startLine`
 * (1-based) so callers can pass body text that begins after frontmatter.
 */
export function extractLinks(content: string, startLine = 1): FoundLink[] {
  const links: FoundLink[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!;
    let match: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(lineText)) !== null) {
      links.push({
        target: match[1]!,
        line: startLine + i,
        column: match.index + 1,
      });
    }
  }
  return links;
}

/** True when `target` points at another document inside the bundle (not external). */
export function isInternalLink(target: string): boolean {
  if (target.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false; // http:, https:, mailto:, bigquery: ...
  return true;
}

/** Strip the `#fragment` and `?query` portions from a link target. */
export function stripLinkSuffix(target: string): string {
  return target.replace(/[#?].*$/, '');
}

/**
 * Validate an ISO 8601 date or date-time string (the form OKF timestamps use).
 * Accepts `YYYY-MM-DD` and `YYYY-MM-DDThh:mm:ss[.sss][Z|±hh:mm]`.
 */
export function isIso8601DateTime(value: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!re.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/** Validate a strict `YYYY-MM-DD` calendar date. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * Validate an ISO 8601 datetime that carries an explicit UTC offset, the form
 * OKF 0.2 requires for every timestamp-valued key (`2026-06-30T14:00:00Z`,
 * `2026-06-30T14:00:00+02:00`). Date-only values are rejected.
 */
export function isIso8601DateTimeWithOffset(value: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
  if (!re.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/** True when `value` is an OKF 0.2 datetime: a YAML-parsed `Date` or an offset-bearing string. */
export function isOkfDateTime(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return typeof value === 'string' && isIso8601DateTimeWithOffset(value);
}

/** Parse an OKF datetime value to epoch milliseconds, or `null` when invalid. */
export function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string' && isIso8601DateTimeWithOffset(value)) return Date.parse(value);
  return null;
}

/** A markdown heading found in a document body. */
export interface FoundHeading {
  /** Heading depth, 1 for `#`, 2 for `##`, ... */
  level: number;
  /** Heading text with surrounding whitespace and trailing `#`s removed. */
  text: string;
  /** 1-based line number of the heading. */
  line: number;
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Extract ATX headings from `content`, ignoring lines inside fenced code blocks
 * (so a `# comment` in a SQL fence is not mistaken for a section).
 */
export function extractHeadings(content: string, startLine = 1): FoundHeading[] {
  const headings: FoundHeading[] = [];
  const lines = content.split(/\r?\n/);
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!;
    const fenceMatch = FENCE_RE.exec(lineText);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const match = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lineText);
    if (match) headings.push({ level: match[1]!.length, text: match[2]!, line: startLine + i });
  }
  return headings;
}

/** A section of a markdown body: a heading plus the lines up to the next heading. */
export interface FoundSection extends FoundHeading {
  /** Lines of the section body (excluding the heading line). */
  lines: string[];
}

/** Find the first section whose heading text equals `title` (case-insensitive). */
export function findSection(content: string, title: string, startLine = 1): FoundSection | null {
  const headings = extractHeadings(content, startLine);
  const index = headings.findIndex((h) => h.text.toLowerCase() === title.toLowerCase());
  if (index === -1) return null;
  const heading = headings[index]!;
  const next = headings[index + 1];
  const lines = content.split(/\r?\n/);
  const from = heading.line - startLine + 1;
  const to = next ? next.line - startLine : lines.length;
  return { ...heading, lines: lines.slice(from, to) };
}

/** True when `lines` contain a fenced (``` or ~~~) or indented (4 spaces / tab) code block. */
export function containsCodeBlock(lines: string[]): boolean {
  return lines.some((l) => FENCE_RE.test(l) || /^(?: {4}|\t)\S/.test(l));
}

/** A markdown footnote reference or definition found in a document body. */
export interface FoundFootnote {
  /** The label between `[^` and `]`. */
  label: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column of the `[`. */
  column: number;
  /** True for a definition line (`[^label]: ...`) rather than an inline reference. */
  definition: boolean;
}

const FOOTNOTE_RE = /\[\^([^\]\s]+)\]/g;

/** Extract footnote references and definitions, starting line numbering at `startLine`. */
export function extractFootnotes(content: string, startLine = 1): FoundFootnote[] {
  const footnotes: FoundFootnote[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!;
    let match: RegExpExecArray | null;
    FOOTNOTE_RE.lastIndex = 0;
    while ((match = FOOTNOTE_RE.exec(lineText)) !== null) {
      footnotes.push({
        label: match[1]!,
        line: startLine + i,
        column: match.index + 1,
        definition: match.index === 0 && lineText.startsWith(`[^${match[1]}]:`),
      });
    }
  }
  return footnotes;
}

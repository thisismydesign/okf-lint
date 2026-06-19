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

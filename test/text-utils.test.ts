import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  isInternalLink,
  stripLinkSuffix,
  isIso8601DateTime,
  isIsoDate,
  isIso8601DateTimeWithOffset,
  isOkfDateTime,
  toEpochMs,
  extractHeadings,
  findSection,
  containsCodeBlock,
  extractFootnotes,
} from '../src/text-utils.js';

describe('extractLinks', () => {
  it('finds links with correct positions', () => {
    const links = extractLinks('See [a](/x.md) and [b](./y.md).', 3);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ target: '/x.md', line: 3 });
    expect(links[1]).toMatchObject({ target: './y.md', line: 3 });
  });
});

describe('isInternalLink', () => {
  it('treats bundle-relative paths as internal', () => {
    expect(isInternalLink('/x.md')).toBe(true);
    expect(isInternalLink('./x.md')).toBe(true);
  });
  it('treats URIs and anchors as external', () => {
    expect(isInternalLink('https://example.com')).toBe(false);
    expect(isInternalLink('bigquery://p.d.t')).toBe(false);
    expect(isInternalLink('#section')).toBe(false);
  });
});

describe('stripLinkSuffix', () => {
  it('removes anchors and queries', () => {
    expect(stripLinkSuffix('/x.md#schema')).toBe('/x.md');
    expect(stripLinkSuffix('/x.md?v=1')).toBe('/x.md');
  });
});

describe('ISO date helpers', () => {
  it('validates datetimes', () => {
    expect(isIso8601DateTime('2026-05-22T10:00:00Z')).toBe(true);
    expect(isIso8601DateTime('2026-05-22')).toBe(true);
    expect(isIso8601DateTime('last Tuesday')).toBe(false);
  });
  it('validates strict calendar dates', () => {
    expect(isIsoDate('2026-05-22')).toBe(true);
    expect(isIsoDate('2026-05-22T10:00:00Z')).toBe(false);
    expect(isIsoDate('May 22, 2026')).toBe(false);
  });
});

describe('isIso8601DateTimeWithOffset', () => {
  it.each([
    '2026-06-30T14:00:00Z',
    '2026-06-30T14:00Z',
    '2026-06-30T14:00:00.123Z',
    '2026-06-30T14:00:00+02:00',
    '2026-06-30T14:00:00-0500',
  ])('accepts %s', (value) => {
    expect(isIso8601DateTimeWithOffset(value)).toBe(true);
  });

  it.each([
    '2026-06-30',
    '2026-06-30T14:00:00',
    '2026-06-30 14:00:00Z',
    '2026-13-01T00:00:00Z',
    'soon',
  ])('rejects %s', (value) => {
    expect(isIso8601DateTimeWithOffset(value)).toBe(false);
  });
});

describe('isOkfDateTime / toEpochMs', () => {
  it('accepts Date objects and offset strings', () => {
    expect(isOkfDateTime(new Date('2026-01-01T00:00:00Z'))).toBe(true);
    expect(isOkfDateTime('2026-01-01T00:00:00Z')).toBe(true);
    expect(isOkfDateTime('2026-01-01')).toBe(false);
    expect(isOkfDateTime(new Date('nope'))).toBe(false);
    expect(isOkfDateTime(42)).toBe(false);
  });

  it('converts to epoch milliseconds', () => {
    expect(toEpochMs('2026-01-01T00:00:00Z')).toBe(Date.UTC(2026, 0, 1));
    expect(toEpochMs(new Date(Date.UTC(2026, 0, 1)))).toBe(Date.UTC(2026, 0, 1));
    expect(toEpochMs('2026-01-01')).toBeNull();
    expect(toEpochMs(null)).toBeNull();
  });
});

describe('extractHeadings / findSection / containsCodeBlock', () => {
  const doc = [
    '# Computation',
    '',
    '```sql',
    '# not a heading',
    'SELECT 1',
    '```',
    '',
    '## Notes ##',
    '',
    '    indented code',
    '',
    '# Citations',
    '- x',
  ].join('\n');

  it('skips headings inside fences and strips closing hashes', () => {
    expect(extractHeadings(doc, 10)).toEqual([
      { level: 1, text: 'Computation', line: 10 },
      { level: 2, text: 'Notes', line: 17 },
      { level: 1, text: 'Citations', line: 21 },
    ]);
  });

  it('returns a section up to the next heading, case-insensitively', () => {
    const section = findSection(doc, 'computation', 10);
    expect(section).toMatchObject({ text: 'Computation', line: 10 });
    expect(section!.lines).toEqual(['', '```sql', '# not a heading', 'SELECT 1', '```', '']);
    expect(findSection(doc, 'Missing')).toBeNull();
    expect(findSection(doc, 'Citations')!.lines).toEqual(['- x']);
  });

  it('detects fenced and indented code blocks', () => {
    expect(containsCodeBlock(findSection(doc, 'Computation')!.lines)).toBe(true);
    expect(containsCodeBlock(findSection(doc, 'Notes')!.lines)).toBe(true);
    expect(containsCodeBlock(findSection(doc, 'Citations')!.lines)).toBe(false);
    expect(containsCodeBlock(['~~~', 'x', '~~~'])).toBe(true);
  });
});

describe('extractFootnotes', () => {
  it('finds references and definitions with positions', () => {
    const body = 'Claim.[^a] Another.[^b-2]\n\n[^a]: Source A\n';
    expect(extractFootnotes(body, 5)).toEqual([
      { label: 'a', line: 5, column: 7, definition: false },
      { label: 'b-2', line: 5, column: 20, definition: false },
      { label: 'a', line: 7, column: 1, definition: true },
    ]);
  });
});

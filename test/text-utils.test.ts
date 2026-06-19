import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  isInternalLink,
  stripLinkSuffix,
  isIso8601DateTime,
  isIsoDate,
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

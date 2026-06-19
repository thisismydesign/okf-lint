import { describe, it, expect } from 'vitest';
import { parseFrontmatter, frontmatterKeyLine } from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses a well-formed frontmatter block', () => {
    const fm = parseFrontmatter('---\ntype: Table\ntitle: X\n---\n\nBody');
    expect(fm.present).toBe(true);
    expect(fm.parseError).toBeNull();
    expect(fm.data).toEqual({ type: 'Table', title: 'X' });
    expect(fm.bodyStartLine).toBe(5);
  });

  it('reports absent frontmatter', () => {
    const fm = parseFrontmatter('# Heading\n\nNo frontmatter.');
    expect(fm.present).toBe(false);
    expect(fm.data).toBeNull();
    expect(fm.bodyStartLine).toBe(1);
  });

  it('reports an unterminated block', () => {
    const fm = parseFrontmatter('---\ntype: Table\n');
    expect(fm.present).toBe(true);
    expect(fm.parseError).toMatch(/Unterminated/);
  });

  it('reports invalid YAML', () => {
    const fm = parseFrontmatter('---\ntype: : :\n  - broken\n---\n');
    expect(fm.present).toBe(true);
    expect(fm.parseError).not.toBeNull();
  });

  it('locates a key line for diagnostics', () => {
    const fm = parseFrontmatter('---\ntype: Table\ntitle: X\n---\n');
    expect(frontmatterKeyLine(fm, 'type')).toBe(2);
    expect(frontmatterKeyLine(fm, 'title')).toBe(3);
  });
});

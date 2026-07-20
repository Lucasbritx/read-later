import { describe, expect, it } from 'vitest';

import { buildArticleDraft, normalizeUrl } from './urlMetadata';

describe('normalizeUrl', () => {
  it('adds https when a URL is missing a protocol', () => {
    expect(normalizeUrl('example.com/article')).toBe('https://example.com/article');
  });

  it('keeps http URLs unchanged', () => {
    expect(normalizeUrl('http://example.com/a')).toBe('http://example.com/a');
  });

  it('throws for invalid URLs', () => {
    expect(() => normalizeUrl('not a url')).toThrow('Enter a valid article URL.');
  });
});

describe('buildArticleDraft', () => {
  it('builds an article draft from a URL', () => {
    expect(buildArticleDraft('example.com/story')).toEqual({
      url: 'https://example.com/story',
      title: 'example.com',
      description: '',
      site_name: 'example.com'
    });
  });
});

import { describe, expect, it } from 'vitest';

import { buildEpub } from './epubBuilder';

function parseStoredZipEntries(bytes: Uint8Array) {
  const entries = new Map<string, string>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset < bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const signature = view.getUint32(0, true);

    if (signature !== 0x04034b50) {
      break;
    }

    const compressedSize = view.getUint32(18, true);
    const filenameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const filenameStart = offset + 30;
    const filenameEnd = filenameStart + filenameLength;
    const contentStart = filenameEnd + extraLength;
    const contentEnd = contentStart + compressedSize;
    const filename = decoder.decode(bytes.slice(filenameStart, filenameEnd));
    const content = decoder.decode(bytes.slice(contentStart, contentEnd));

    entries.set(filename, content);
    offset = contentEnd;
  }

  return entries;
}

describe('buildEpub', () => {
  it('builds a stored EPUB archive with the required files', () => {
    const epub = buildEpub({
      title: 'Readable Article',
      sourceUrl: 'https://example.com/readable',
      siteName: 'Example',
      html: '<p>Clean article content.</p>'
    });
    const entries = parseStoredZipEntries(epub);

    expect(entries.get('mimetype')).toBe('application/epub+zip');
    expect(entries.get('META-INF/container.xml')).toContain('OEBPS/content.opf');
    expect(entries.get('OEBPS/content.opf')).toContain('<dc:title>Readable Article</dc:title>');
    expect(entries.get('OEBPS/nav.xhtml')).toContain('Readable Article');
    expect(entries.get('OEBPS/article.xhtml')).toContain('<p>Clean article content.</p>');
  });

  it('escapes metadata while preserving article markup', () => {
    const epub = buildEpub({
      title: 'A&B <Story>',
      sourceUrl: 'https://example.com/a?x=1&y=2',
      siteName: 'Example <Site>',
      html: '<p>Body & content.</p>'
    });
    const entries = parseStoredZipEntries(epub);

    expect(entries.get('OEBPS/content.opf')).toContain('<dc:title>A&amp;B &lt;Story&gt;</dc:title>');
    expect(entries.get('OEBPS/article.xhtml')).toContain('Example &lt;Site&gt;');
    expect(entries.get('OEBPS/article.xhtml')).toContain('https://example.com/a?x=1&amp;y=2');
    expect(entries.get('OEBPS/article.xhtml')).toContain('<p>Body & content.</p>');
  });
});

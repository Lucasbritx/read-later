import { describe, expect, it } from 'vitest';

import { buildEpub } from './epubBuilder';

function parseStoredZipEntries(bytes: Uint8Array) {
  const entries = new Map<string, { bytes: Uint8Array; text: string }>();
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
    const content = bytes.slice(contentStart, contentEnd);

    entries.set(filename, {
      bytes: content,
      text: decoder.decode(content)
    });
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

    expect(entries.get('mimetype')?.text).toBe('application/epub+zip');
    expect(entries.get('META-INF/container.xml')?.text).toContain('OEBPS/content.opf');
    expect(entries.get('OEBPS/content.opf')?.text).toContain('<dc:title>Readable Article</dc:title>');
    expect(entries.get('OEBPS/nav.xhtml')?.text).toContain('Readable Article');
    expect(entries.get('OEBPS/article.xhtml')?.text).toContain('<p>Clean article content.</p>');
  });

  it('escapes metadata while preserving article markup', () => {
    const epub = buildEpub({
      title: 'A&B <Story>',
      sourceUrl: 'https://example.com/a?x=1&y=2',
      siteName: 'Example <Site>',
      html: '<p>Body & content.</p>'
    });
    const entries = parseStoredZipEntries(epub);

    expect(entries.get('OEBPS/content.opf')?.text).toContain('<dc:title>A&amp;B &lt;Story&gt;</dc:title>');
    expect(entries.get('OEBPS/article.xhtml')?.text).toContain('Example &lt;Site&gt;');
    expect(entries.get('OEBPS/article.xhtml')?.text).toContain('https://example.com/a?x=1&amp;y=2');
    expect(entries.get('OEBPS/article.xhtml')?.text).toContain('<p>Body & content.</p>');
  });

  it('packages image assets and declares them in the manifest', () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]);
    const epub = buildEpub({
      title: 'Illustrated Article',
      sourceUrl: 'https://example.com/readable',
      siteName: 'Example',
      html: '<p><img src="images/image-1.png" alt="Chart"/></p>',
      assets: [
        {
          path: 'images/image-1.png',
          mediaType: 'image/png',
          content: imageBytes
        }
      ]
    });
    const entries = parseStoredZipEntries(epub);

    expect(entries.get('OEBPS/content.opf')?.text).toContain(
      '<item id="image-1" href="images/image-1.png" media-type="image/png"/>'
    );
    expect(entries.get('OEBPS/article.xhtml')?.text).toContain('src="images/image-1.png"');
    expect(entries.get('OEBPS/images/image-1.png')?.bytes).toEqual(imageBytes);
  });
});

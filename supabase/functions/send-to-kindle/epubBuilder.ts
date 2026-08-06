type EpubEntry = {
  path: string;
  content: string | Uint8Array;
};

export type EpubAsset = {
  path: string;
  mediaType: string;
  content: Uint8Array;
};

export type EpubInput = {
  title: string;
  sourceUrl: string;
  siteName: string;
  html: string;
  assets?: EpubAsset[];
};

const encoder = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUInt32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
}

function buildLocalFileHeader(path: string, contentBytes: Uint8Array, checksum: number) {
  const pathBytes = encoder.encode(path);
  const bytes: number[] = [];

  writeUInt32(bytes, 0x04034b50);
  writeUInt16(bytes, 20);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt32(bytes, checksum);
  writeUInt32(bytes, contentBytes.length);
  writeUInt32(bytes, contentBytes.length);
  writeUInt16(bytes, pathBytes.length);
  writeUInt16(bytes, 0);

  return concatBytes([new Uint8Array(bytes), pathBytes, contentBytes]);
}

function buildCentralDirectoryHeader(
  path: string,
  contentBytes: Uint8Array,
  checksum: number,
  localHeaderOffset: number
) {
  const pathBytes = encoder.encode(path);
  const bytes: number[] = [];

  writeUInt32(bytes, 0x02014b50);
  writeUInt16(bytes, 20);
  writeUInt16(bytes, 20);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt32(bytes, checksum);
  writeUInt32(bytes, contentBytes.length);
  writeUInt32(bytes, contentBytes.length);
  writeUInt16(bytes, pathBytes.length);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt32(bytes, 0);
  writeUInt32(bytes, localHeaderOffset);

  return concatBytes([new Uint8Array(bytes), pathBytes]);
}

function buildEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const bytes: number[] = [];

  writeUInt32(bytes, 0x06054b50);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, 0);
  writeUInt16(bytes, entryCount);
  writeUInt16(bytes, entryCount);
  writeUInt32(bytes, centralDirectorySize);
  writeUInt32(bytes, centralDirectoryOffset);
  writeUInt16(bytes, 0);

  return new Uint8Array(bytes);
}

function buildZip(entries: EpubEntry[]) {
  const localFiles: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const contentBytes = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
    const checksum = crc32(contentBytes);
    const localFile = buildLocalFileHeader(entry.path, contentBytes, checksum);

    localFiles.push(localFile);
    centralDirectory.push(buildCentralDirectoryHeader(entry.path, contentBytes, checksum, offset));
    offset += localFile.length;
  });

  const centralDirectoryOffset = offset;
  const centralDirectoryBytes = concatBytes(centralDirectory);
  const end = buildEndOfCentralDirectory(entries.length, centralDirectoryBytes.length, centralDirectoryOffset);

  return concatBytes([...localFiles, centralDirectoryBytes, end]);
}

function buildContainerXml() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '<rootfiles>',
    '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    '</rootfiles>',
    '</container>'
  ].join('');
}

function buildManifestAssetItems(assets: EpubAsset[]) {
  return assets.map((asset, index) => {
    const id = `image-${index + 1}`;
    const href = escapeXml(asset.path);
    const mediaType = escapeXml(asset.mediaType);

    return `<item id="${id}" href="${href}" media-type="${mediaType}"/>`;
  });
}

function buildContentOpf(input: EpubInput) {
  const title = escapeXml(input.title);
  const identifier = escapeXml(input.sourceUrl || `read-later:${input.title}`);
  const assetItems = buildManifestAssetItems(input.assets ?? []);

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="article-id" version="3.0">',
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `<dc:identifier id="article-id">${identifier}</dc:identifier>`,
    `<dc:title>${title}</dc:title>`,
    '<dc:language>en</dc:language>',
    '<meta property="dcterms:modified">2026-07-28T00:00:00Z</meta>',
    '</metadata>',
    '<manifest>',
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="article" href="article.xhtml" media-type="application/xhtml+xml"/>',
    ...assetItems,
    '</manifest>',
    '<spine>',
    '<itemref idref="article"/>',
    '</spine>',
    '</package>'
  ].join('');
}

function buildNavXhtml(title: string) {
  const escapedTitle = escapeXml(title);

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">',
    '<head>',
    `<title>${escapedTitle}</title>`,
    '</head>',
    '<body>',
    '<nav epub:type="toc" id="toc">',
    '<h1>Table of Contents</h1>',
    '<ol>',
    `<li><a href="article.xhtml">${escapedTitle}</a></li>`,
    '</ol>',
    '</nav>',
    '</body>',
    '</html>'
  ].join('');
}

function buildArticleXhtml(input: EpubInput) {
  const title = escapeXml(input.title);
  const sourceUrl = escapeXml(input.sourceUrl);
  const siteName = escapeXml(input.siteName || 'Source');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="en">',
    '<head>',
    `<title>${title}</title>`,
    '<style>',
    'body{font-family:serif;line-height:1.55;margin:0;padding:1.5rem;color:#111;}',
    'main{max-width:42rem;margin:0 auto;}',
    'h1{font-size:1.8rem;line-height:1.2;margin:0 0 .5rem;}',
    '.source{font-size:.9rem;color:#555;margin:0 0 1.5rem;}',
    'img,video,iframe{max-width:100%;height:auto;}',
    'pre{white-space:pre-wrap;}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    `<h1>${title}</h1>`,
    `<p class="source">${siteName}: <a href="${sourceUrl}">${sourceUrl}</a></p>`,
    '<section>',
    input.html,
    '</section>',
    '</main>',
    '</body>',
    '</html>'
  ].join('');
}

export function buildEpub(input: EpubInput) {
  const title = input.title.trim() || 'Article';
  const assets = input.assets ?? [];
  const entries: EpubEntry[] = [
    {
      path: 'mimetype',
      content: 'application/epub+zip'
    },
    {
      path: 'META-INF/container.xml',
      content: buildContainerXml()
    },
    {
      path: 'OEBPS/content.opf',
      content: buildContentOpf({ ...input, title, assets })
    },
    {
      path: 'OEBPS/nav.xhtml',
      content: buildNavXhtml(title)
    },
    {
      path: 'OEBPS/article.xhtml',
      content: buildArticleXhtml({ ...input, title })
    },
    ...assets.map((asset) => ({
      path: `OEBPS/${asset.path}`,
      content: asset.content
    }))
  ];

  return buildZip(entries);
}

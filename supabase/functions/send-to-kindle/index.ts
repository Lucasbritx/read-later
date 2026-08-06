import { createClient } from 'npm:@supabase/supabase-js@2';
import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { parseHTML } from 'npm:linkedom@0.18.13';
import {
  handleSendToKindleRequest,
  type SendToKindleDependencies
} from './sendToKindleCore.ts';
import type { EpubAsset } from './epubBuilder.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const senderEmail = Deno.env.get('KINDLE_SENDER_EMAIL') ?? '';
const articleFetchTimeoutMs = 10_000;
const imageFetchTimeoutMs = 5_000;
const maxArticleImages = 8;
const maxTotalImageBytes = 6 * 1024 * 1024;

type ArticleForExtraction = {
  title: string;
  url: string;
  site_name: string;
};

function createAuthorizedClient(authorizationHeader: string | null) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authorizationHeader ? { Authorization: authorizationHeader } : {}
    }
  });
}

async function fetchArticleHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), articleFetchTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Read Later Kindle Extractor/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Article fetch failed with ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function resolveImageUrl(src: string, baseUrl: string) {
  try {
    const url = new URL(src, baseUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function imageMediaTypeFromUrl(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (pathname.endsWith('.png')) {
    return 'image/png';
  }

  if (pathname.endsWith('.gif')) {
    return 'image/gif';
  }

  if (pathname.endsWith('.webp')) {
    return 'image/webp';
  }

  if (pathname.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  return null;
}

function normalizeImageMediaType(contentType: string | null, url: string) {
  const mediaType = contentType?.split(';')[0]?.trim().toLowerCase() || imageMediaTypeFromUrl(url);

  if (
    mediaType === 'image/jpeg' ||
    mediaType === 'image/png' ||
    mediaType === 'image/gif' ||
    mediaType === 'image/webp' ||
    mediaType === 'image/svg+xml'
  ) {
    return mediaType;
  }

  return null;
}

function imageExtensionForMediaType(mediaType: string) {
  if (mediaType === 'image/jpeg') {
    return 'jpg';
  }

  if (mediaType === 'image/svg+xml') {
    return 'svg';
  }

  return mediaType.replace('image/', '');
}

function removeImageSourceAttributes(image: Element) {
  image.removeAttribute('src');
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
}

async function fetchImageAsset(url: string, index: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), imageFetchTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Read Later Kindle Extractor/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const mediaType = normalizeImageMediaType(response.headers.get('Content-Type'), url);

    if (!mediaType) {
      return null;
    }

    const contentLength = Number(response.headers.get('Content-Length') ?? 0);

    if (contentLength > maxTotalImageBytes) {
      return null;
    }

    const content = new Uint8Array(await response.arrayBuffer());

    return {
      path: `images/image-${index}.${imageExtensionForMediaType(mediaType)}`,
      mediaType,
      content
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareArticleAssets(content: string, baseUrl: string): Promise<{ html: string; assets: EpubAsset[] }> {
  const { document } = parseHTML(`<main>${content}</main>`);
  const container = document.querySelector('main');

  if (!container) {
    return { html: content, assets: [] };
  }

  const assets: EpubAsset[] = [];
  let totalBytes = 0;
  let nextAssetIndex = 1;

  for (const image of Array.from(container.querySelectorAll('img')).slice(0, maxArticleImages)) {
    const src = image.getAttribute('src');
    const resolvedUrl = src ? resolveImageUrl(src, baseUrl) : null;

    if (!resolvedUrl) {
      removeImageSourceAttributes(image);
      continue;
    }

    const asset = await fetchImageAsset(resolvedUrl, nextAssetIndex);

    if (!asset || totalBytes + asset.content.byteLength > maxTotalImageBytes) {
      removeImageSourceAttributes(image);
      continue;
    }

    assets.push(asset);
    totalBytes += asset.content.byteLength;
    nextAssetIndex += 1;
    image.setAttribute('src', asset.path);
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
  }

  return {
    html: container.innerHTML,
    assets
  };
}

async function extractReadableArticle(article: ArticleForExtraction) {
  const html = await fetchArticleHtml(article.url);
  const { document } = parseHTML(html);
  const parsed = new Readability(document).parse();

  if (!parsed?.content?.trim()) {
    return null;
  }

  const title = parsed.title?.trim() || article.title;
  const articleWithAssets = await prepareArticleAssets(parsed.content, article.url);

  return {
    title,
    html: articleWithAssets.html,
    assets: articleWithAssets.assets
  };
}

function createDependencies(request: Request): SendToKindleDependencies {
  const authorizationHeader = request.headers.get('Authorization');

  return {
    senderEmail,
    async getUser(request) {
      const client = createAuthorizedClient(request.headers.get('Authorization'));
      const { data, error } = await client.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email
      };
    },
    async getArticle(userId, articleId) {
      const client = createAuthorizedClient(authorizationHeader);
      const { data, error } = await client
        .from('articles')
        .select('id,user_id,title,url,description,site_name')
        .eq('user_id', userId)
        .eq('id', articleId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    async getKindleSettings(userId) {
      const client = createAuthorizedClient(authorizationHeader);
      const { data, error } = await client
        .from('kindle_settings')
        .select('user_id,kindle_email')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    extractArticle: extractReadableArticle,
    async sendEmail(payload) {
      if (!resendApiKey || !senderEmail) {
        throw new Error('Send to Kindle email is not configured.');
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw await response.text();
      }
    }
  };
}

Deno.serve((request) => {
  const deps = createDependencies(request);

  return handleSendToKindleRequest(request, deps);
});

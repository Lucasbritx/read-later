import { createClient } from 'npm:@supabase/supabase-js@2';
import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { parseHTML } from 'npm:linkedom@0.18.13';
import {
  handleSendToKindleRequest,
  type SendToKindleDependencies
} from './sendToKindleCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const senderEmail = Deno.env.get('KINDLE_SENDER_EMAIL') ?? '';
const articleFetchTimeoutMs = 10_000;

type ArticleForExtraction = {
  title: string;
  url: string;
  site_name: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function buildKindleHtml({
  title,
  url,
  siteName,
  content
}: {
  title: string;
  url: string;
  siteName: string;
  content: string;
}) {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
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
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="source">${escapeHtml(siteName || 'Source')}: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    content,
    '</main>',
    '</body>',
    '</html>'
  ].join('');
}

async function extractReadableArticle(article: ArticleForExtraction) {
  const html = await fetchArticleHtml(article.url);
  const { document } = parseHTML(html);
  const parsed = new Readability(document).parse();

  if (!parsed?.content?.trim()) {
    return null;
  }

  const title = parsed.title?.trim() || article.title;

  return {
    title,
    html: buildKindleHtml({
      title,
      url: article.url,
      siteName: article.site_name,
      content: parsed.content
    })
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

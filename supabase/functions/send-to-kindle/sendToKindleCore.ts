type User = {
  id: string;
  email?: string;
};

type Article = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string;
  site_name: string;
};

type KindleSettings = {
  user_id: string;
  kindle_email: string;
};

type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: {
    filename: string;
    content: string;
  }[];
};

type ExtractedArticle = {
  title: string;
  html: string;
};

export type SendToKindleDependencies = {
  getUser: (request: Request) => Promise<User | null>;
  getArticle: (userId: string, articleId: string) => Promise<Article | null>;
  getKindleSettings: (userId: string) => Promise<KindleSettings | null>;
  sendEmail: (payload: EmailPayload) => Promise<void>;
  extractArticle?: (article: Article) => Promise<ExtractedArticle | null>;
  senderEmail: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function emptyResponse(status = 204) {
  return new Response(null, {
    status,
    headers: corsHeaders
  });
}

async function readArticleId(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { articleId?: unknown };

    if (typeof body.articleId !== 'string') {
      return null;
    }

    const articleId = body.articleId.trim();
    return articleId ? articleId : null;
  } catch {
    return null;
  }
}

function buildEmailText(article: Article) {
  return [
    article.title,
    '',
    article.url,
    '',
    article.description,
    '',
    `Source: ${article.site_name || 'Unknown'}`
  ].join('\n');
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function buildAttachmentFilename(title: string, extension = 'txt') {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return `${slug || 'article'}.${extension}`;
}

function isKindleEmail(value: string) {
  return /^[^\s@]+@(free\.)?kindle\.com$/i.test(value.trim());
}

async function buildKindleAttachment(article: Article, deps: SendToKindleDependencies) {
  try {
    const extracted = await deps.extractArticle?.(article);

    if (extracted?.html.trim()) {
      return {
        title: extracted.title.trim() || article.title,
        filename: buildAttachmentFilename(extracted.title || article.title, 'html'),
        content: encodeBase64(extracted.html)
      };
    }
  } catch {
    // Keep Kindle delivery usable when a page blocks fetches or cannot be parsed.
  }

  return {
    title: article.title,
    filename: buildAttachmentFilename(article.title),
    content: encodeBase64(buildEmailText(article))
  };
}

export async function handleSendToKindleRequest(
  request: Request,
  deps: SendToKindleDependencies
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return emptyResponse();
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const user = await deps.getUser(request);

  if (!user) {
    return jsonResponse({ error: 'Sign in before sending to Kindle.' }, 401);
  }

  const articleId = await readArticleId(request);

  if (!articleId) {
    return jsonResponse({ error: 'Choose an article to send.' }, 400);
  }

  const article = await deps.getArticle(user.id, articleId);

  if (!article) {
    return jsonResponse({ error: 'Article not found.' }, 404);
  }

  const settings = await deps.getKindleSettings(user.id);

  if (!settings) {
    return jsonResponse({ error: 'Save your Kindle email before sending.' }, 400);
  }

  if (!isKindleEmail(settings.kindle_email)) {
    return jsonResponse({ error: 'Save a valid Kindle email before sending.' }, 400);
  }

  try {
    const attachment = await buildKindleAttachment(article, deps);

    await deps.sendEmail({
      from: deps.senderEmail,
      to: settings.kindle_email,
      subject: `Article: ${article.title}`,
      text: `Attached: ${attachment.title}`,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content
        }
      ]
    });
  } catch {
    return jsonResponse({ error: 'Could not send article to Kindle.' }, 502);
  }

  return jsonResponse({ sent: true });
}

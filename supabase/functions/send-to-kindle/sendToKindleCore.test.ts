import { describe, expect, it, vi } from 'vitest';

import { handleSendToKindleRequest } from './sendToKindleCore';

const validArticle = {
  id: 'article-1',
  user_id: 'user-1',
  title: 'Useful Article',
  url: 'https://example.com/useful',
  description: 'A useful read.',
  site_name: 'Example'
};

const validSettings = {
  user_id: 'user-1',
  kindle_email: 'reader@kindle.com'
};

function createDependencies(overrides = {}) {
  return {
    getUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'lucas@example.com' }),
    getArticle: vi.fn().mockResolvedValue(validArticle),
    getKindleSettings: vi.fn().mockResolvedValue(validSettings),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    senderEmail: 'send@example.com',
    ...overrides
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('handleSendToKindleRequest', () => {
  it('allows CORS preflight requests', async () => {
    const deps = createDependencies();

    const response = await handleSendToKindleRequest(new Request('https://fn.test', { method: 'OPTIONS' }), deps);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects non-POST methods', async () => {
    const deps = createDependencies();

    const response = await handleSendToKindleRequest(new Request('https://fn.test', { method: 'GET' }), deps);

    expect(response.status).toBe(405);
    await expect(readJson(response)).resolves.toEqual({ error: 'Method not allowed.' });
  });

  it('rejects unauthenticated requests', async () => {
    const deps = createDependencies({ getUser: vi.fn().mockResolvedValue(null) });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toEqual({ error: 'Sign in before sending to Kindle.' });
  });

  it('rejects missing article ids', async () => {
    const deps = createDependencies();

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({})
      }),
      deps
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({ error: 'Choose an article to send.' });
  });

  it('returns 404 when the article is not owned by the user', async () => {
    const deps = createDependencies({ getArticle: vi.fn().mockResolvedValue(null) });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(404);
    await expect(readJson(response)).resolves.toEqual({ error: 'Article not found.' });
  });

  it('asks for kindle settings before sending', async () => {
    const deps = createDependencies({ getKindleSettings: vi.fn().mockResolvedValue(null) });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({ error: 'Save your Kindle email before sending.' });
  });

  it('rejects non-Kindle delivery addresses before sending email', async () => {
    const deps = createDependencies({
      getKindleSettings: vi.fn().mockResolvedValue({
        user_id: 'user-1',
        kindle_email: 'reader@example.com'
      })
    });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({
      error: 'Save a valid Kindle email before sending.'
    });
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it('sends the expected Resend payload for a valid article', async () => {
    const deps = createDependencies();

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ sent: true });
    expect(deps.sendEmail).toHaveBeenCalledWith({
      from: 'send@example.com',
      to: 'reader@kindle.com',
      subject: 'Article: Useful Article',
      text: 'Attached: Useful Article',
      attachments: [
        {
          filename: 'useful-article.txt',
          content: btoa(
            [
              'Useful Article',
              '',
              'https://example.com/useful',
              '',
              'A useful read.',
              '',
              'Source: Example'
            ].join('\n')
          )
        }
      ]
    });
  });

  it('uses a safe fallback attachment filename', async () => {
    const deps = createDependencies({
      getArticle: vi.fn().mockResolvedValue({
        ...validArticle,
        title: '???'
      })
    });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(200);
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: 'article.txt'
          })
        ]
      })
    );
  });

  it('base64 encodes unicode article text for the Kindle attachment', async () => {
    const deps = createDependencies({
      getArticle: vi.fn().mockResolvedValue({
        ...validArticle,
        title: 'Café Article',
        description: 'São Paulo notes.'
      })
    });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    const payload = deps.sendEmail.mock.calls[0][0];
    const encoded = payload.attachments[0].content;
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
    );

    expect(response.status).toBe(200);
    expect(decoded).toBe(
      [
        'Café Article',
        '',
        'https://example.com/useful',
        '',
        'São Paulo notes.',
        '',
        'Source: Example'
      ].join('\n')
    );
  });

  it('allows free.kindle.com delivery addresses', async () => {
    const deps = createDependencies({
      getKindleSettings: vi.fn().mockResolvedValue({
        user_id: 'user-1',
        kindle_email: 'reader@free.kindle.com'
      })
    });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(200);
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reader@free.kindle.com'
      })
    );
  });

  it('returns a gateway error when email delivery fails', async () => {
    const deps = createDependencies({ sendEmail: vi.fn().mockRejectedValue(new Error('Resend rejected')) });

    const response = await handleSendToKindleRequest(
      new Request('https://fn.test', {
        method: 'POST',
        body: JSON.stringify({ articleId: 'article-1' })
      }),
      deps
    );

    expect(response.status).toBe(502);
    await expect(readJson(response)).resolves.toEqual({ error: 'Could not send article to Kindle.' });
  });
});

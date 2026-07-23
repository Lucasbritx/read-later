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
      text: [
        'Useful Article',
        '',
        'https://example.com/useful',
        '',
        'A useful read.',
        '',
        'Source: Example'
      ].join('\n')
    });
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

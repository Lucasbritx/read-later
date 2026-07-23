import { describe, expect, it, vi } from 'vitest';

import {
  getKindleSettings,
  saveKindleSettings,
  sendArticleToKindle,
  validateKindleEmail
} from './kindleRepository';
import type { KindleSettings } from './kindleTypes';

type MockQueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>;
  functions: {
    invoke: ReturnType<typeof vi.fn>;
  };
  query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
};

const kindleSettings = (overrides: Partial<KindleSettings> = {}): KindleSettings => ({
  user_id: 'user-1',
  kindle_email: 'reader@kindle.com',
  created_at: '2026-07-20T12:00:00.000Z',
  updated_at: '2026-07-20T12:00:00.000Z',
  ...overrides
});

const createMockClient = <T>(
  result: MockQueryResult<T>,
  functionResult: MockQueryResult<unknown> = { data: null, error: null }
): MockSupabaseClient => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn()
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);

  return {
    from: vi.fn(() => query),
    functions: {
      invoke: vi.fn().mockResolvedValue(functionResult)
    },
    query
  };
};

describe('kindleRepository', () => {
  it('getKindleSettings reads settings by user id', async () => {
    const settings = kindleSettings();
    const client = createMockClient({ data: settings, error: null });

    await expect(getKindleSettings(client as never, 'user-1')).resolves.toEqual(settings);

    expect(client.from).toHaveBeenCalledWith('kindle_settings');
    expect(client.query.select).toHaveBeenCalledWith('*');
    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.maybeSingle).toHaveBeenCalledWith();
  });

  it('getKindleSettings returns null when settings do not exist', async () => {
    const client = createMockClient<KindleSettings | null>({ data: null, error: null });

    await expect(getKindleSettings(client as never, 'user-1')).resolves.toBeNull();
  });

  it('saveKindleSettings trims email, upserts, selects, and returns settings', async () => {
    const settings = kindleSettings();
    const client = createMockClient({ data: settings, error: null });

    await expect(
      saveKindleSettings(client as never, {
        userId: 'user-1',
        kindleEmail: '  reader@kindle.com  '
      })
    ).resolves.toEqual(settings);

    expect(client.from).toHaveBeenCalledWith('kindle_settings');
    expect(client.query.upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      kindle_email: 'reader@kindle.com'
    });
    expect(client.query.select).toHaveBeenCalledWith();
    expect(client.query.maybeSingle).toHaveBeenCalledWith();
  });

  it('saveKindleSettings rejects invalid email before saving', async () => {
    const client = createMockClient<KindleSettings | null>({ data: null, error: null });

    await expect(
      saveKindleSettings(client as never, {
        userId: 'user-1',
        kindleEmail: 'bad email'
      })
    ).rejects.toThrow('Enter a valid Kindle email address.');

    expect(client.from).not.toHaveBeenCalled();
  });

  it('sendArticleToKindle invokes the send-to-kindle function', async () => {
    const client = createMockClient(
      { data: null, error: null },
      { data: { sent: true }, error: null }
    );

    await expect(sendArticleToKindle(client as never, 'article-1')).resolves.toEqual({
      sent: true
    });

    expect(client.functions.invoke).toHaveBeenCalledWith('send-to-kindle', {
      body: { articleId: 'article-1' }
    });
  });

  it('validateKindleEmail accepts valid email and rejects invalid email', () => {
    expect(validateKindleEmail('reader@kindle.com')).toBe(true);
    expect(validateKindleEmail('reader@free.kindle.com')).toBe(true);
    expect(validateKindleEmail('reader@example.com')).toBe(false);
    expect(validateKindleEmail('bad email')).toBe(false);
  });
});

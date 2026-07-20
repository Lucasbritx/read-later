import { describe, expect, it, vi } from 'vitest';

import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticleStatus
} from './articleRepository';
import type { Article } from './articleTypes';

type MockQueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>;
  query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
  };
};

const article = (overrides: Partial<Article> = {}): Article => ({
  id: 'article-1',
  user_id: 'user-1',
  url: 'https://example.com/article',
  title: 'Example article',
  description: 'A useful article',
  site_name: 'Example',
  status: 'unread',
  created_at: '2026-07-20T12:00:00.000Z',
  read_at: null,
  ...overrides
});

const createMockClient = <T>(result: MockQueryResult<T>): MockSupabaseClient => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    then: vi.fn()
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.order.mockResolvedValue(result);
  query.then.mockImplementation((resolve, reject) => Promise.resolve(result).then(resolve, reject));

  return {
    from: vi.fn(() => query),
    query
  };
};

describe('articleRepository', () => {
  it('list all articles filters by user and orders newest first', async () => {
    const articles = [
      article({ id: 'newer', created_at: '2026-07-20T12:00:00.000Z' }),
      article({ id: 'older', created_at: '2026-07-19T12:00:00.000Z' })
    ];
    const client = createMockClient({ data: articles, error: null });

    await expect(
      listArticles(client as never, { userId: 'user-1', status: 'all' })
    ).resolves.toEqual(articles);

    expect(client.from).toHaveBeenCalledWith('articles');
    expect(client.query.select).toHaveBeenCalledWith('*');
    expect(client.query.eq).toHaveBeenCalledTimes(1);
    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('list read articles adds eq status read', async () => {
    const client = createMockClient({ data: [article({ status: 'read' })], error: null });

    await listArticles(client as never, { userId: 'user-1', status: 'read' });

    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.eq).toHaveBeenCalledWith('status', 'read');
    expect(client.query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('create inserts unread owned article and returns data', async () => {
    const createdArticle = article();
    const client = createMockClient({ data: createdArticle, error: null });

    await expect(
      createArticle(client as never, {
        userId: 'user-1',
        url: 'https://example.com/article',
        title: 'Example article',
        description: 'A useful article',
        site_name: 'Example'
      })
    ).resolves.toEqual(createdArticle);

    expect(client.from).toHaveBeenCalledWith('articles');
    expect(client.query.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      url: 'https://example.com/article',
      title: 'Example article',
      description: 'A useful article',
      site_name: 'Example',
      status: 'unread'
    });
    expect(client.query.select).toHaveBeenCalledWith();
    expect(client.query.single).toHaveBeenCalledWith();
  });

  it('update read sets read_at string and eq user/id', async () => {
    const client = createMockClient({ data: null, error: null });

    await updateArticleStatus(client as never, {
      userId: 'user-1',
      articleId: 'article-1',
      status: 'read'
    });

    expect(client.query.update).toHaveBeenCalledTimes(1);
    expect(client.query.update).toHaveBeenCalledWith({
      status: 'read',
      read_at: expect.any(String)
    });
    expect(Date.parse(client.query.update.mock.calls[0][0].read_at)).not.toBeNaN();
    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.eq).toHaveBeenCalledWith('id', 'article-1');
  });

  it('update unread clears read_at', async () => {
    const client = createMockClient({ data: null, error: null });

    await updateArticleStatus(client as never, {
      userId: 'user-1',
      articleId: 'article-1',
      status: 'unread'
    });

    expect(client.query.update).toHaveBeenCalledWith({
      status: 'unread',
      read_at: null
    });
    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.eq).toHaveBeenCalledWith('id', 'article-1');
  });

  it('delete deletes by user/id', async () => {
    const client = createMockClient({ data: null, error: null });

    await deleteArticle(client as never, { userId: 'user-1', articleId: 'article-1' });

    expect(client.from).toHaveBeenCalledWith('articles');
    expect(client.query.delete).toHaveBeenCalledWith();
    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.eq).toHaveBeenCalledWith('id', 'article-1');
  });
});

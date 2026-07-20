// @vitest-environment happy-dom

import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import type { Article } from './features/articles/articleTypes';
import { getByText, queryByText, render, waitFor } from './test/render';

const testState = vi.hoisted((): any => {
  const authState = {
    callback: undefined as undefined | ((_event: string, session: unknown) => void)
  };

  return {
    authState,
    createArticle: vi.fn(),
    deleteArticle: vi.fn(),
    getSession: vi.fn(),
    listArticles: vi.fn(),
    onAuthStateChange: vi.fn((callback) => {
      authState.callback = callback;

      return {
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      };
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    updateArticleStatus: vi.fn()
  };
});

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: testState.getSession,
      onAuthStateChange: testState.onAuthStateChange,
      signInWithPassword: testState.signInWithPassword,
      signOut: testState.signOut,
      signUp: testState.signUp
    }
  }
}));

vi.mock('./features/articles/articleRepository', () => ({
  createArticle: testState.createArticle,
  deleteArticle: testState.deleteArticle,
  listArticles: testState.listArticles,
  updateArticleStatus: testState.updateArticleStatus
}));

function createSession(userId: string, email: string) {
  return {
    access_token: `${userId}-token`,
    expires_at: 1_785_000_000,
    expires_in: 3600,
    refresh_token: `${userId}-refresh`,
    token_type: 'bearer',
    user: {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-20T00:00:00.000Z',
      email,
      id: userId,
      user_metadata: {}
    }
  };
}

function createArticle(id: string, userId: string, title: string): Article {
  return {
    id,
    user_id: userId,
    url: `https://example.com/${id}`,
    title,
    description: '',
    site_name: 'Example',
    status: 'unread',
    created_at: '2026-07-20T00:00:00.000Z',
    read_at: null
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.authState.callback = undefined;
    testState.getSession.mockResolvedValue({ data: { session: null }, error: null });
    testState.listArticles.mockResolvedValue([]);
    testState.signInWithPassword.mockResolvedValue({ error: null });
    testState.signOut.mockResolvedValue({ error: null });
    testState.signUp.mockResolvedValue({ error: null });
  });

  it('shows the auth form when signed out', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(getByText(container, 'Welcome back')).toBeTruthy();
    });
  });

  it('ignores stale article loads from a previous session', async () => {
    const firstLoad = createDeferred<Article[]>();
    const secondLoad = createDeferred<Article[]>();
    const userAArticle = createArticle('article-a', 'user-a', 'User A Article');
    const userBArticle = createArticle('article-b', 'user-b', 'User B Article');

    testState.getSession.mockResolvedValue({
      data: { session: createSession('user-a', 'a@example.com') },
      error: null
    });
    testState.listArticles
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);

    const { container } = render(<App />);

    await waitFor(() => {
      expect(testState.listArticles).toHaveBeenCalledWith(expect.anything(), {
        userId: 'user-a',
        status: 'unread'
      });
    });

    await act(async () => {
      testState.authState.callback?.('SIGNED_IN', createSession('user-b', 'b@example.com'));
    });

    await waitFor(() => {
      expect(testState.listArticles).toHaveBeenCalledWith(expect.anything(), {
        userId: 'user-b',
        status: 'unread'
      });
    });

    await act(async () => {
      secondLoad.resolve([userBArticle]);
    });

    await waitFor(() => {
      expect(getByText(container, 'User B Article')).toBeTruthy();
    });

    await act(async () => {
      firstLoad.resolve([userAArticle]);
    });

    expect(queryByText(container, 'User A Article')).toBeUndefined();
    expect(getByText(container, 'User B Article')).toBeTruthy();
  });
});

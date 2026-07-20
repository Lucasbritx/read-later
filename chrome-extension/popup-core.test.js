import { describe, expect, it, vi } from 'vitest';

import {
  buildArticleDraft,
  getConfig,
  normalizeUrl,
  saveArticle,
  signInWithPassword
} from './popup-core.js';

describe('normalizeUrl', () => {
  it('adds https when missing a protocol', () => {
    expect(normalizeUrl('example.com/story')).toBe('https://example.com/story');
  });

  it('rejects invalid urls', () => {
    expect(() => normalizeUrl('bad url')).toThrow('Current tab does not have a valid article URL.');
  });
});

describe('buildArticleDraft', () => {
  it('uses the current tab title and host', () => {
    expect(buildArticleDraft({ title: 'Useful Article', url: 'https://www.example.com/story' })).toEqual({
      url: 'https://www.example.com/story',
      title: 'Useful Article',
      description: '',
      site_name: 'example.com',
      status: 'unread'
    });
  });
});

describe('getConfig', () => {
  it('requires a configured Supabase project', () => {
    expect(() =>
      getConfig({
        SUPABASE_URL: 'https://your-project-ref.supabase.co',
        SUPABASE_ANON_KEY: 'key'
      })
    ).toThrow('Configure chrome-extension/config.js');
  });
});

describe('signInWithPassword', () => {
  it('returns a minimal session from Supabase auth', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          user: { id: 'user-1', email: 'lucas@example.com' }
        })
    });

    await expect(
      signInWithPassword(
        { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon-key' },
        'lucas@example.com',
        'secret123',
        fetcher
      )
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'lucas@example.com' }
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/token?grant_type=password',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('saveArticle', () => {
  it('inserts an unread article for the signed-in user', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await saveArticle(
      { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon-key' },
      { accessToken: 'access-token', user: { id: 'user-1' } },
      {
        url: 'https://example.com/story',
        title: 'Useful Article',
        description: '',
        site_name: 'example.com',
        status: 'unread'
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/articles',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          user_id: 'user-1',
          url: 'https://example.com/story',
          title: 'Useful Article',
          description: '',
          site_name: 'example.com',
          status: 'unread'
        })
      })
    );
  });
});

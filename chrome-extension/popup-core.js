export const STORAGE_SESSION_KEY = 'readLaterSession';

export function normalizeUrl(value) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);

    if (!url.hostname.includes('.')) {
      throw new Error('Invalid host');
    }

    return url.toString();
  } catch {
    throw new Error('Current tab does not have a valid article URL.');
  }
}

export function buildArticleDraft(tab) {
  const url = normalizeUrl(tab.url || '');
  const host = new URL(url).hostname.replace(/^www\./i, '');
  const title = (tab.title || host).trim() || host;

  return {
    url,
    title,
    description: '',
    site_name: host,
    status: 'unread'
  };
}

export function getConfig(configSource = globalThis.window?.READ_LATER_CONFIG) {
  const supabaseUrl = configSource?.SUPABASE_URL?.replace(/\/$/, '');
  const supabaseAnonKey = configSource?.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-ref')) {
    throw new Error('Configure chrome-extension/config.js with your Supabase URL and anon key.');
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function signInWithPassword(config, email, password, fetcher = fetch) {
  const response = await fetcher(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || 'Could not sign in.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: {
      id: payload.user.id,
      email: payload.user.email
    }
  };
}

export async function saveArticle(config, session, draft, fetcher = fetch) {
  const response = await fetcher(`${config.supabaseUrl}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      user_id: session.user.id,
      url: draft.url,
      title: draft.title,
      description: draft.description,
      site_name: draft.site_name,
      status: draft.status
    })
  });

  if (!response.ok) {
    let message = 'Could not save article.';

    try {
      const payload = await response.json();
      message = payload.message || payload.msg || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }
}

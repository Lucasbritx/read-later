# Kindle Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested Send to Kindle MVP that saves a user's Kindle email and sends saved article links through a Supabase Edge Function using Resend.

**Architecture:** Store Kindle settings in Supabase with RLS, keep frontend persistence behind a small repository, and send emails only from a server-side Edge Function. The Edge Function has a pure core module for local Vitest coverage and a thin Deno/Supabase wrapper for deployment.

**Tech Stack:** React 18, Vite, Vitest, Supabase Auth/PostgREST/Functions, Supabase Edge Functions, Resend REST API.

---

## File Structure

- Create `supabase/migrations/20260722000000_create_kindle_settings.sql`: user-scoped Kindle email settings table and RLS policies.
- Create `src/features/kindle/kindleTypes.ts`: shared Kindle settings types.
- Create `src/features/kindle/kindleRepository.ts`: Supabase client helpers for loading/saving settings and invoking Send to Kindle.
- Create `src/features/kindle/kindleRepository.test.ts`: repository tests with existing Vitest mocking style.
- Create `supabase/functions/send-to-kindle/sendToKindleCore.ts`: pure request handler with injectable auth/database/email dependencies.
- Create `supabase/functions/send-to-kindle/sendToKindleCore.test.ts`: local Vitest coverage for auth, validation, lookup, and Resend payload behavior.
- Create `supabase/functions/send-to-kindle/index.ts`: Deno Edge Function wrapper that wires Supabase and Resend.
- Modify `src/App.tsx`: load Kindle settings for signed-in users, save settings, and dispatch sends.
- Modify `src/features/articles/ArticleDashboard.tsx`: render settings form and per-article Send to Kindle action.
- Modify `src/features/articles/ArticleDashboard.test.tsx`: cover saving settings and sending articles.
- Modify `src/styles.css`: compact Kindle settings and article action styling.
- Modify `README.md`: document Supabase migration, Edge Function secrets, Resend sender, Amazon approved sender, and local extension separation.

---

### Task 1: Database Migration For Kindle Settings

**Files:**
- Create: `supabase/migrations/20260722000000_create_kindle_settings.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260722000000_create_kindle_settings.sql`:

```sql
create table if not exists public.kindle_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kindle_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindle_settings_email_trim_check check (length(trim(kindle_email)) > 0),
  constraint kindle_settings_email_shape_check check (
    kindle_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kindle_settings_set_updated_at on public.kindle_settings;

create trigger kindle_settings_set_updated_at
before update on public.kindle_settings
for each row
execute function public.set_updated_at();

alter table public.kindle_settings enable row level security;

drop policy if exists "Users can select their own kindle settings" on public.kindle_settings;

create policy "Users can select their own kindle settings"
  on public.kindle_settings
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own kindle settings" on public.kindle_settings;

create policy "Users can insert their own kindle settings"
  on public.kindle_settings
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own kindle settings" on public.kindle_settings;

create policy "Users can update their own kindle settings"
  on public.kindle_settings
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Inspect migration syntax**

Run:

```bash
sed -n '1,220p' supabase/migrations/20260722000000_create_kindle_settings.sql
```

Expected: the file contains one table, one trigger function, one trigger, RLS enabled, and select/insert/update policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260722000000_create_kindle_settings.sql
git commit -m "feat: add kindle settings migration"
```

---

### Task 2: Kindle Repository

**Files:**
- Create: `src/features/kindle/kindleTypes.ts`
- Create: `src/features/kindle/kindleRepository.ts`
- Create: `src/features/kindle/kindleRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/features/kindle/kindleRepository.test.ts`:

```ts
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
  error: { message: string; code?: string } | null;
};

const createMockClient = <T>(result: MockQueryResult<T>) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn()
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);

  return {
    from: vi.fn(() => query),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { sent: true }, error: null })
    },
    query
  };
};

const settings: KindleSettings = {
  user_id: 'user-1',
  kindle_email: 'reader@kindle.com',
  created_at: '2026-07-22T12:00:00.000Z',
  updated_at: '2026-07-22T12:00:00.000Z'
};

describe('kindleRepository', () => {
  it('loads kindle settings for a user', async () => {
    const client = createMockClient({ data: settings, error: null });

    await expect(getKindleSettings(client as never, 'user-1')).resolves.toEqual(settings);

    expect(client.from).toHaveBeenCalledWith('kindle_settings');
    expect(client.query.select).toHaveBeenCalledWith('*');
    expect(client.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.query.maybeSingle).toHaveBeenCalledWith();
  });

  it('returns null when settings do not exist', async () => {
    const client = createMockClient({ data: null, error: null });

    await expect(getKindleSettings(client as never, 'user-1')).resolves.toBeNull();
  });

  it('upserts a trimmed kindle email for the user', async () => {
    const client = createMockClient({ data: settings, error: null });

    await expect(
      saveKindleSettings(client as never, {
        userId: 'user-1',
        kindleEmail: ' reader@kindle.com '
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

  it('rejects invalid kindle emails before saving', async () => {
    const client = createMockClient({ data: null, error: null });

    await expect(
      saveKindleSettings(client as never, {
        userId: 'user-1',
        kindleEmail: 'not an email'
      })
    ).rejects.toThrow('Enter a valid Kindle email address.');
  });

  it('invokes the send-to-kindle edge function with the article id', async () => {
    const client = createMockClient({ data: null, error: null });

    await expect(sendArticleToKindle(client as never, 'article-1')).resolves.toEqual({ sent: true });

    expect(client.functions.invoke).toHaveBeenCalledWith('send-to-kindle', {
      body: { articleId: 'article-1' }
    });
  });

  it('validates simple email shape', () => {
    expect(validateKindleEmail('reader@kindle.com')).toBe(true);
    expect(validateKindleEmail('bad email')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test src/features/kindle/kindleRepository.test.ts
```

Expected: FAIL because `src/features/kindle/kindleRepository.ts` does not exist.

- [ ] **Step 3: Add types**

Create `src/features/kindle/kindleTypes.ts`:

```ts
export type KindleSettings = {
  user_id: string;
  kindle_email: string;
  created_at: string;
  updated_at: string;
};

export type SaveKindleSettingsInput = {
  userId: string;
  kindleEmail: string;
};

export type SendToKindleResult = {
  sent: true;
};
```

- [ ] **Step 4: Implement repository**

Create `src/features/kindle/kindleRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import type { KindleSettings, SaveKindleSettingsInput, SendToKindleResult } from './kindleTypes';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateKindleEmail(value: string): boolean {
  return emailPattern.test(value.trim());
}

export async function getKindleSettings(
  client: SupabaseClient,
  userId: string
): Promise<KindleSettings | null> {
  const { data, error } = await client
    .from('kindle_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as KindleSettings | null;
}

export async function saveKindleSettings(
  client: SupabaseClient,
  input: SaveKindleSettingsInput
): Promise<KindleSettings> {
  const kindleEmail = input.kindleEmail.trim();

  if (!validateKindleEmail(kindleEmail)) {
    throw new Error('Enter a valid Kindle email address.');
  }

  const { data, error } = await client
    .from('kindle_settings')
    .upsert({
      user_id: input.userId,
      kindle_email: kindleEmail
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Could not save Kindle settings.');
  }

  return data as KindleSettings;
}

export async function sendArticleToKindle(
  client: SupabaseClient,
  articleId: string
): Promise<SendToKindleResult> {
  const { data, error } = await client.functions.invoke('send-to-kindle', {
    body: { articleId }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as SendToKindleResult;
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
npm test src/features/kindle/kindleRepository.test.ts
```

Expected: PASS for `6` tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/kindle/kindleTypes.ts src/features/kindle/kindleRepository.ts src/features/kindle/kindleRepository.test.ts
git commit -m "feat: add kindle settings repository"
```

---

### Task 3: Send To Kindle Function Core

**Files:**
- Create: `supabase/functions/send-to-kindle/sendToKindleCore.ts`
- Create: `supabase/functions/send-to-kindle/sendToKindleCore.test.ts`

- [ ] **Step 1: Write failing function core tests**

Create `supabase/functions/send-to-kindle/sendToKindleCore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test supabase/functions/send-to-kindle/sendToKindleCore.test.ts
```

Expected: FAIL because `sendToKindleCore.ts` does not exist.

- [ ] **Step 3: Implement function core**

Create `supabase/functions/send-to-kindle/sendToKindleCore.ts`:

```ts
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
};

export type SendToKindleDependencies = {
  getUser: (request: Request) => Promise<User | null>;
  getArticle: (userId: string, articleId: string) => Promise<Article | null>;
  getKindleSettings: (userId: string) => Promise<KindleSettings | null>;
  sendEmail: (payload: EmailPayload) => Promise<void>;
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
    return typeof body.articleId === 'string' && body.articleId.trim() ? body.articleId.trim() : null;
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

  try {
    await deps.sendEmail({
      from: deps.senderEmail,
      to: settings.kindle_email,
      subject: `Article: ${article.title}`,
      text: buildEmailText(article)
    });
  } catch {
    return jsonResponse({ error: 'Could not send article to Kindle.' }, 502);
  }

  return jsonResponse({ sent: true });
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test supabase/functions/send-to-kindle/sendToKindleCore.test.ts
```

Expected: PASS for `8` tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-to-kindle/sendToKindleCore.ts supabase/functions/send-to-kindle/sendToKindleCore.test.ts
git commit -m "feat: add send to kindle function core"
```

---

### Task 4: Supabase Edge Function Wrapper

**Files:**
- Create: `supabase/functions/send-to-kindle/index.ts`

- [ ] **Step 1: Create deployment wrapper**

Create `supabase/functions/send-to-kindle/index.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleSendToKindleRequest } from './sendToKindleCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const senderEmail = Deno.env.get('KINDLE_SENDER_EMAIL') ?? '';

Deno.serve((request) =>
  handleSendToKindleRequest(request, {
    senderEmail,
    getUser: async () => {
      const authHeader = request.headers.get('Authorization') ?? '';
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });
      const { data, error } = await client.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email
      };
    },
    getArticle: async (userId, articleId) => {
      const authHeader = request.headers.get('Authorization') ?? '';
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });
      const { data, error } = await client
        .from('articles')
        .select('id,user_id,title,url,description,site_name')
        .eq('user_id', userId)
        .eq('id', articleId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    getKindleSettings: async (userId) => {
      const authHeader = request.headers.get('Authorization') ?? '';
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });
      const { data, error } = await client
        .from('kindle_settings')
        .select('user_id,kindle_email')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    sendEmail: async (payload) => {
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
        throw new Error(await response.text());
      }
    }
  })
);
```

- [ ] **Step 2: Run existing function core tests**

Run:

```bash
npm test supabase/functions/send-to-kindle/sendToKindleCore.test.ts
```

Expected: PASS. The wrapper is not imported by Vitest because it uses Deno-specific globals.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-to-kindle/index.ts
git commit -m "feat: wire send to kindle edge function"
```

---

### Task 5: App State And Dashboard UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/articles/ArticleDashboard.tsx`
- Modify: `src/features/articles/ArticleDashboard.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing dashboard tests**

Update `renderDashboard()` in `src/features/articles/ArticleDashboard.test.tsx` so props include Kindle behavior:

```ts
const props = {
  articles,
  currentFilter: 'all' as const,
  isLoading: false,
  kindleEmail: 'reader@kindle.com',
  sendingArticleIds: [],
  onCreate: vi.fn().mockResolvedValue(undefined),
  onActionError: vi.fn(),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onFilterChange: vi.fn(),
  onSaveKindleEmail: vi.fn().mockResolvedValue(undefined),
  onSendToKindle: vi.fn().mockResolvedValue(undefined),
  onSignOut: vi.fn().mockResolvedValue(undefined),
  onToggleStatus: vi.fn().mockResolvedValue(undefined),
  userEmail: 'lucas@example.com'
};
```

Add these tests:

```ts
it('saves a kindle email from the settings form', async () => {
  const { container, onSaveKindleEmail } = renderDashboard();
  const input = container.querySelector<HTMLInputElement>('#kindle-email');

  if (!input) {
    throw new Error('Kindle email input missing');
  }

  input.value = 'new-reader@kindle.com';
  input.dispatchEvent(new Event('input', { bubbles: true }));

  await click(getButton(container, 'Save Kindle email'));

  expect(onSaveKindleEmail).toHaveBeenCalledWith('new-reader@kindle.com');
});

it('sends an article to kindle', async () => {
  const { container, onSendToKindle } = renderDashboard();

  await click(getButton(container, 'Send First Article to Kindle'));

  expect(onSendToKindle).toHaveBeenCalledWith('article-1');
});

it('shows a sending state for an article', () => {
  const props = renderDashboard();
  const view = render(
    <ArticleDashboard
      articles={articles}
      currentFilter="all"
      isLoading={false}
      kindleEmail="reader@kindle.com"
      sendingArticleIds={['article-1']}
      onCreate={props.onCreate}
      onActionError={props.onActionError}
      onDelete={props.onDelete}
      onFilterChange={props.onFilterChange}
      onSaveKindleEmail={props.onSaveKindleEmail}
      onSendToKindle={props.onSendToKindle}
      onSignOut={props.onSignOut}
      onToggleStatus={props.onToggleStatus}
      userEmail="lucas@example.com"
    />
  );

  expect(getButton(view.container, 'Sending First Article to Kindle')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test src/features/articles/ArticleDashboard.test.tsx
```

Expected: FAIL because `ArticleDashboardProps` does not include Kindle props and the UI is missing.

- [ ] **Step 3: Update dashboard component**

Modify `src/features/articles/ArticleDashboard.tsx`:

```tsx
import Check from 'lucide-react/dist/esm/icons/check.js';
import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Undo2 from 'lucide-react/dist/esm/icons/undo-2.js';
```

Add props:

```ts
  kindleEmail: string;
  sendingArticleIds: string[];
  onSaveKindleEmail: (kindleEmail: string) => Promise<void>;
  onSendToKindle: (articleId: string) => Promise<void>;
```

Inside the component, add state and handler:

```tsx
  const [kindleEmailDraft, setKindleEmailDraft] = useState(kindleEmail);

  useEffect(() => {
    setKindleEmailDraft(kindleEmail);
  }, [kindleEmail]);

  async function handleKindleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runDashboardAction(() => onSaveKindleEmail(kindleEmailDraft));
  }
```

Render the settings block after the save article section:

```tsx
      <section className="dashboard-band kindle-band" aria-labelledby="kindle-settings-heading">
        <div>
          <h2 id="kindle-settings-heading">Kindle delivery</h2>
          <p className="muted">Use your Kindle personal document email.</p>
        </div>

        <form className="kindle-form" onSubmit={(event) => void handleKindleSubmit(event)}>
          <label htmlFor="kindle-email">Kindle email</label>
          <div className="inline-form-row">
            <input
              id="kindle-email"
              type="email"
              value={kindleEmailDraft}
              onChange={(event) => setKindleEmailDraft(event.target.value)}
              placeholder="name@kindle.com"
              required
            />
            <button className="secondary-button" type="submit">
              Save Kindle email
            </button>
          </div>
        </form>
      </section>
```

Render this button in each article action group:

```tsx
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={
                        sendingArticleIds.includes(article.id)
                          ? `Sending ${article.title} to Kindle`
                          : `Send ${article.title} to Kindle`
                      }
                      disabled={sendingArticleIds.includes(article.id)}
                      onClick={() => void runDashboardAction(() => onSendToKindle(article.id))}
                    >
                      <Send aria-hidden="true" size={18} />
                    </button>
```

Also import React types:

```tsx
import { type FormEvent, useEffect, useState } from 'react';
```

- [ ] **Step 4: Update styles**

Add to `src/styles.css`:

```css
.kindle-form {
  display: grid;
  gap: 8px;
}

.inline-form-row {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 1fr) auto;
}

.inline-form-row input {
  min-width: 0;
}

.icon-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 680px) {
  .inline-form-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run dashboard tests to verify GREEN**

Run:

```bash
npm test src/features/articles/ArticleDashboard.test.tsx
```

Expected: PASS for the dashboard tests.

- [ ] **Step 6: Wire `App.tsx`**

Import Kindle helpers:

```ts
import {
  getKindleSettings,
  saveKindleSettings,
  sendArticleToKindle
} from './features/kindle/kindleRepository';
import type { KindleSettings } from './features/kindle/kindleTypes';
```

Add state:

```ts
  const [kindleSettings, setKindleSettings] = useState<KindleSettings | null>(null);
  const [sendingArticleIds, setSendingArticleIds] = useState<string[]>([]);
```

Add loader:

```ts
  const refreshKindleSettings = useCallback(async () => {
    if (!userId) {
      setKindleSettings(null);
      return;
    }

    try {
      setKindleSettings(await getKindleSettings(supabase, userId));
    } catch (error) {
      setNotice(getErrorMessage(error, 'Could not load Kindle settings.'));
    }
  }, [userId]);

  useEffect(() => {
    void refreshKindleSettings();
  }, [refreshKindleSettings]);
```

Add actions:

```ts
  const handleSaveKindleEmail = async (kindleEmail: string) => {
    if (!userId) {
      return;
    }

    setNotice('');
    const nextSettings = await saveKindleSettings(supabase, { userId, kindleEmail });
    setKindleSettings(nextSettings);
    setNotice('Kindle email saved.');
  };

  const handleSendToKindle = async (articleId: string) => {
    if (!userId) {
      return;
    }

    if (!kindleSettings) {
      setNotice('Save your Kindle email before sending.');
      return;
    }

    setNotice('');
    setSendingArticleIds((current) => [...current, articleId]);

    try {
      await sendArticleToKindle(supabase, articleId);
      setNotice('Sent to Kindle.');
    } finally {
      setSendingArticleIds((current) => current.filter((id) => id !== articleId));
    }
  };
```

Pass props to `ArticleDashboard`:

```tsx
        kindleEmail={kindleSettings?.kindle_email ?? ''}
        sendingArticleIds={sendingArticleIds}
        onSaveKindleEmail={handleSaveKindleEmail}
        onSendToKindle={handleSendToKindle}
```

- [ ] **Step 7: Run app and full tests**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/features/articles/ArticleDashboard.tsx src/features/articles/ArticleDashboard.test.tsx src/styles.css
git commit -m "feat: add kindle controls to dashboard"
```

---

### Task 6: Documentation And Setup Notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add this section to `README.md` after Supabase setup:

````md
## Send to Kindle Setup

The Send to Kindle MVP sends the article title, source URL, description, and site name through a Supabase Edge Function using Resend.

1. Run `supabase/migrations/20260722000000_create_kindle_settings.sql` in Supabase.
2. Create a Resend API key.
3. Verify the sender email or domain in Resend.
4. Add that sender email to Amazon's Approved Personal Document E-mail List for your Kindle account.
5. Set Edge Function secrets:

```sh
supabase secrets set SUPABASE_URL="https://your-project-ref.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="your-public-anon-key"
supabase secrets set RESEND_API_KEY="your-resend-api-key"
supabase secrets set KINDLE_SENDER_EMAIL="Read Later <send@example.com>"
```

6. Deploy the function:

```sh
supabase functions deploy send-to-kindle
```

The first version sends a plain text email. The next Kindle phase will generate a Kindle-friendly HTML attachment from extracted article content.
````

- [ ] **Step 2: Run verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add kindle setup instructions"
```

---

### Task 7: Final Verification And Push

**Files:**
- Verify all changed files.

- [ ] **Step 1: Inspect status**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected: clean worktree and recent Kindle commits on the current branch.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 3: Push**

Run:

```bash
git push origin main
```

Expected: `main` is updated on `git@github.com:Lucasbritx/read-later.git`.

---

## Self-Review Notes

- Spec coverage: the plan covers settings storage, dashboard settings, per-article send action, Edge Function auth/article/settings validation, Resend delivery, setup docs, and the incremental future path.
- Scope: this plan intentionally avoids article extraction, HTML attachment generation, EPUB generation, queues, retries, and Chrome extension Kindle actions.
- Type consistency: frontend uses `KindleSettings`, repository returns `{ sent: true }`, function body uses `articleId`, and the table is consistently named `kindle_settings`.

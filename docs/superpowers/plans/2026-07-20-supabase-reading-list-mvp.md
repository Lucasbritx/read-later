# Supabase Reading List MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Supabase-backed web dashboard where users sign up with email/password, save article URLs, list saved articles, mark them read/unread, and delete them.

**Architecture:** Create a React + Vite + TypeScript single-page app that talks directly to Supabase using the public anon key. Supabase Auth owns email/password sessions, and a Postgres `articles` table protected by Row Level Security stores user-owned reading-list items. The MVP keeps article metadata simple and client-entered/inferred, leaving Chrome extension saving and Kindle delivery for later phases.

**Tech Stack:** React, Vite, TypeScript, Supabase JS, Vitest, React Testing Library, Playwright, CSS modules/plain CSS, Supabase SQL migrations.

---

## File Structure

- Create `package.json`: npm scripts and runtime/dev dependencies.
- Create `index.html`: Vite app shell.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: TypeScript and Vite configuration.
- Create `vitest.setup.ts`: React Testing Library setup.
- Create `.gitignore`: ignore dependencies, build output, local env files.
- Create `.env.example`: document required Supabase environment variables.
- Create `supabase/migrations/20260720000000_create_articles.sql`: database schema, indexes, and RLS policies.
- Create `src/main.tsx`: React entrypoint.
- Create `src/App.tsx`: top-level auth/session routing and dashboard composition.
- Create `src/App.test.tsx`: app-level auth state tests.
- Create `src/lib/supabaseClient.ts`: Supabase browser client.
- Create `src/lib/env.ts`: environment variable validation.
- Create `src/lib/urlMetadata.ts`: URL validation and default title/site inference.
- Create `src/lib/urlMetadata.test.ts`: unit tests for URL helpers.
- Create `src/features/auth/AuthForm.tsx`: email/password sign in and sign up form.
- Create `src/features/auth/AuthForm.test.tsx`: auth form interaction tests.
- Create `src/features/articles/articleTypes.ts`: shared article TypeScript types.
- Create `src/features/articles/articleRepository.ts`: Supabase CRUD functions.
- Create `src/features/articles/articleRepository.test.ts`: repository query-shape tests with mocked Supabase client.
- Create `src/features/articles/ArticleForm.tsx`: save-article form.
- Create `src/features/articles/ArticleForm.test.tsx`: save form tests.
- Create `src/features/articles/ArticleDashboard.tsx`: article list, filters, read/unread/delete actions.
- Create `src/features/articles/ArticleDashboard.test.tsx`: dashboard behavior tests.
- Create `src/styles.css`: responsive app styling.

## Out of Scope For This Plan

- Chrome extension save button.
- Kindle email delivery.
- Full article extraction/readability parsing.
- Server-side metadata scraping.
- Multi-user sharing or teams.

## Tasks

### Task 1: Scaffold The React/Vite Project

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/main.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create package metadata and scripts**

Write `package.json`:

```json
{
  "name": "read-on-kindle",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create Vite HTML shell**

Write `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Read Later</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create TypeScript configs**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Write `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create Vite and Vitest config**

Write `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
});
```

Write `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Create repo ignores and environment example**

Write `.gitignore`:

```gitignore
node_modules
dist
.env
.env.local
.DS_Store
coverage
```

Write `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

- [ ] **Step 6: Create app entrypoint and base CSS**

Write `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Write `src/styles.css`:

```css
:root {
  color: #17201b;
  background: #f7f4ee;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 8: Run build to verify scaffold**

Run: `npm run build`

Expected: build fails because `src/App.tsx` does not exist yet.

- [ ] **Step 9: Commit scaffold**

```bash
git add .gitignore .env.example index.html package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.setup.ts src/main.tsx src/styles.css
git commit -m "chore: scaffold reading list app"
```

### Task 2: Add Supabase Schema And RLS Migration

**Files:**
- Create: `supabase/migrations/20260720000000_create_articles.sql`

- [ ] **Step 1: Write schema migration**

Write `supabase/migrations/20260720000000_create_articles.sql`:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  description text not null default '',
  site_name text not null default '',
  status text not null default 'unread',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint articles_status_check check (status in ('unread', 'read')),
  constraint articles_url_not_blank check (length(trim(url)) > 0),
  constraint articles_title_not_blank check (length(trim(title)) > 0)
);

create unique index if not exists articles_user_url_key
  on public.articles (user_id, lower(url));

create index if not exists articles_user_status_created_at_idx
  on public.articles (user_id, status, created_at desc);

create index if not exists articles_user_created_at_idx
  on public.articles (user_id, created_at desc);

alter table public.articles enable row level security;

create policy "Users can read their own articles"
  on public.articles
  for select
  using (auth.uid() = user_id);

create policy "Users can create their own articles"
  on public.articles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own articles"
  on public.articles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own articles"
  on public.articles
  for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Review migration for required security properties**

Run: `rg "enable row level security|auth.uid\\(\\) = user_id|articles_user_url_key" supabase/migrations/20260720000000_create_articles.sql`

Expected output includes:

```text
alter table public.articles enable row level security;
  using (auth.uid() = user_id);
  with check (auth.uid() = user_id);
create unique index if not exists articles_user_url_key
```

- [ ] **Step 3: Commit schema**

```bash
git add supabase/migrations/20260720000000_create_articles.sql
git commit -m "feat: add articles schema"
```

### Task 3: Add Environment And Supabase Client

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/supabaseClient.ts`

- [ ] **Step 1: Write environment validation**

Write `src/lib/env.ts`:

```ts
export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function getAppEnv(): AppEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase config. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}
```

- [ ] **Step 2: Write Supabase client**

Write `src/lib/supabaseClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { getAppEnv } from './env';

const env = getAppEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
```

- [ ] **Step 3: Run TypeScript build**

Run: `npm run build`

Expected: build still fails because `src/App.tsx` does not exist yet, but there are no errors in `src/lib/env.ts` or `src/lib/supabaseClient.ts`.

- [ ] **Step 4: Commit client setup**

```bash
git add src/lib/env.ts src/lib/supabaseClient.ts
git commit -m "feat: configure supabase client"
```

### Task 4: Add URL Metadata Helpers

**Files:**
- Create: `src/lib/urlMetadata.ts`
- Create: `src/lib/urlMetadata.test.ts`

- [ ] **Step 1: Write failing URL helper tests**

Write `src/lib/urlMetadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildArticleDraft, normalizeUrl } from './urlMetadata';

describe('normalizeUrl', () => {
  it('adds https when the user omits a protocol', () => {
    expect(normalizeUrl('example.com/article')).toBe('https://example.com/article');
  });

  it('keeps existing http urls', () => {
    expect(normalizeUrl('http://example.com/a')).toBe('http://example.com/a');
  });

  it('throws for invalid urls', () => {
    expect(() => normalizeUrl('not a url')).toThrow('Enter a valid article URL.');
  });
});

describe('buildArticleDraft', () => {
  it('uses the host as the default title and site name', () => {
    expect(buildArticleDraft('example.com/story')).toEqual({
      url: 'https://example.com/story',
      title: 'example.com',
      description: '',
      site_name: 'example.com',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/urlMetadata.test.ts`

Expected: FAIL with an import error because `src/lib/urlMetadata.ts` does not exist.

- [ ] **Step 3: Implement URL helpers**

Write `src/lib/urlMetadata.ts`:

```ts
export type ArticleDraft = {
  url: string;
  title: string;
  description: string;
  site_name: string;
};

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);

    if (!url.hostname.includes('.')) {
      throw new Error('Invalid host');
    }

    return url.toString();
  } catch {
    throw new Error('Enter a valid article URL.');
  }
}

export function buildArticleDraft(value: string): ArticleDraft {
  const url = normalizeUrl(value);
  const host = new URL(url).hostname.replace(/^www\./i, '');

  return {
    url,
    title: host,
    description: '',
    site_name: host,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/urlMetadata.test.ts`

Expected: PASS, 4 tests pass.

- [ ] **Step 5: Commit URL helpers**

```bash
git add src/lib/urlMetadata.ts src/lib/urlMetadata.test.ts
git commit -m "feat: add article url helpers"
```

### Task 5: Add Article Repository

**Files:**
- Create: `src/features/articles/articleTypes.ts`
- Create: `src/features/articles/articleRepository.ts`
- Create: `src/features/articles/articleRepository.test.ts`

- [ ] **Step 1: Write shared article types**

Write `src/features/articles/articleTypes.ts`:

```ts
export type ArticleStatus = 'unread' | 'read';

export type Article = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  description: string;
  site_name: string;
  status: ArticleStatus;
  created_at: string;
  read_at: string | null;
};

export type CreateArticleInput = {
  userId: string;
  url: string;
  title: string;
  description: string;
  site_name: string;
};
```

- [ ] **Step 2: Write failing repository tests**

Write `src/features/articles/articleRepository.test.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticleStatus,
} from './articleRepository';

function createSupabaseMock() {
  const order = vi.fn(() => Promise.resolve({ data: [], error: null }));
  const eqStatus = vi.fn(() => ({ order }));
  const eqUser = vi.fn(() => ({ eq: eqStatus, order }));
  const select = vi.fn(() => ({ eq: eqUser }));
  const insertSelectSingle = vi.fn(() =>
    Promise.resolve({
      data: {
        id: 'article-1',
        user_id: 'user-1',
        url: 'https://example.com/',
        title: 'example.com',
        description: '',
        site_name: 'example.com',
        status: 'unread',
        created_at: '2026-07-20T00:00:00Z',
        read_at: null,
      },
      error: null,
    }),
  );
  const insertSelect = vi.fn(() => ({ single: insertSelectSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const updateEqId = vi.fn(() => Promise.resolve({ error: null }));
  const updateEqUser = vi.fn(() => ({ eq: updateEqId }));
  const update = vi.fn(() => ({ eq: updateEqUser }));
  const deleteEqId = vi.fn(() => Promise.resolve({ error: null }));
  const deleteEqUser = vi.fn(() => ({ eq: deleteEqId }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqUser }));
  const from = vi.fn(() => ({ select, insert, update, delete: deleteFn }));

  return {
    client: { from } as unknown as SupabaseClient,
    calls: {
      from,
      select,
      eqUser,
      eqStatus,
      order,
      insert,
      update,
      updateEqUser,
      updateEqId,
      deleteFn,
      deleteEqUser,
      deleteEqId,
    },
  };
}

describe('articleRepository', () => {
  it('lists all articles for a user ordered newest first', async () => {
    const { client, calls } = createSupabaseMock();

    await listArticles(client, { userId: 'user-1', status: 'all' });

    expect(calls.from).toHaveBeenCalledWith('articles');
    expect(calls.select).toHaveBeenCalledWith('*');
    expect(calls.eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(calls.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('lists filtered articles for a user', async () => {
    const { client, calls } = createSupabaseMock();

    await listArticles(client, { userId: 'user-1', status: 'read' });

    expect(calls.eqStatus).toHaveBeenCalledWith('status', 'read');
  });

  it('creates an unread article owned by the user', async () => {
    const { client, calls } = createSupabaseMock();

    const article = await createArticle(client, {
      userId: 'user-1',
      url: 'https://example.com/',
      title: 'example.com',
      description: '',
      site_name: 'example.com',
    });

    expect(calls.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      url: 'https://example.com/',
      title: 'example.com',
      description: '',
      site_name: 'example.com',
      status: 'unread',
    });
    expect(article.id).toBe('article-1');
  });

  it('marks an article read with read_at populated', async () => {
    const { client, calls } = createSupabaseMock();

    await updateArticleStatus(client, {
      userId: 'user-1',
      articleId: 'article-1',
      status: 'read',
    });

    expect(calls.update).toHaveBeenCalledWith({
      status: 'read',
      read_at: expect.any(String),
    });
    expect(calls.updateEqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(calls.updateEqId).toHaveBeenCalledWith('id', 'article-1');
  });

  it('marks an article unread with read_at cleared', async () => {
    const { client, calls } = createSupabaseMock();

    await updateArticleStatus(client, {
      userId: 'user-1',
      articleId: 'article-1',
      status: 'unread',
    });

    expect(calls.update).toHaveBeenCalledWith({
      status: 'unread',
      read_at: null,
    });
  });

  it('deletes an article by id and owner', async () => {
    const { client, calls } = createSupabaseMock();

    await deleteArticle(client, { userId: 'user-1', articleId: 'article-1' });

    expect(calls.deleteFn).toHaveBeenCalled();
    expect(calls.deleteEqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(calls.deleteEqId).toHaveBeenCalledWith('id', 'article-1');
  });
});
```

- [ ] **Step 3: Run repository tests to verify they fail**

Run: `npm test -- src/features/articles/articleRepository.test.ts`

Expected: FAIL with an import error because `src/features/articles/articleRepository.ts` does not exist.

- [ ] **Step 4: Implement article repository**

Write `src/features/articles/articleRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Article, ArticleStatus, CreateArticleInput } from './articleTypes';

type ArticleFilter = ArticleStatus | 'all';

type ListArticlesParams = {
  userId: string;
  status: ArticleFilter;
};

type UpdateArticleStatusParams = {
  userId: string;
  articleId: string;
  status: ArticleStatus;
};

type DeleteArticleParams = {
  userId: string;
  articleId: string;
};

export async function listArticles(
  client: SupabaseClient,
  params: ListArticlesParams,
): Promise<Article[]> {
  let query = client
    .from('articles')
    .select('*')
    .eq('user_id', params.userId);

  if (params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Article[];
}

export async function createArticle(
  client: SupabaseClient,
  input: CreateArticleInput,
): Promise<Article> {
  const { data, error } = await client
    .from('articles')
    .insert({
      user_id: input.userId,
      url: input.url,
      title: input.title,
      description: input.description,
      site_name: input.site_name,
      status: 'unread',
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Article;
}

export async function updateArticleStatus(
  client: SupabaseClient,
  params: UpdateArticleStatusParams,
): Promise<void> {
  const readAt = params.status === 'read' ? new Date().toISOString() : null;
  const { error } = await client
    .from('articles')
    .update({ status: params.status, read_at: readAt })
    .eq('user_id', params.userId)
    .eq('id', params.articleId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteArticle(
  client: SupabaseClient,
  params: DeleteArticleParams,
): Promise<void> {
  const { error } = await client
    .from('articles')
    .delete()
    .eq('user_id', params.userId)
    .eq('id', params.articleId);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 5: Run repository tests to verify they pass**

Run: `npm test -- src/features/articles/articleRepository.test.ts`

Expected: PASS, 6 tests pass.

- [ ] **Step 6: Commit repository**

```bash
git add src/features/articles/articleTypes.ts src/features/articles/articleRepository.ts src/features/articles/articleRepository.test.ts
git commit -m "feat: add article repository"
```

### Task 6: Add Email And Password Auth Form

**Files:**
- Create: `src/features/auth/AuthForm.tsx`
- Create: `src/features/auth/AuthForm.test.tsx`

- [ ] **Step 1: Write failing auth form tests**

Write `src/features/auth/AuthForm.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';

describe('AuthForm', () => {
  it('submits sign in with email and password', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const onSignUp = vi.fn().mockResolvedValue(undefined);

    render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

    await user.type(screen.getByLabelText('Email'), 'lucas@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSignIn).toHaveBeenCalledWith('lucas@example.com', 'secret123');
  });

  it('switches to sign up mode', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const onSignUp = vi.fn().mockResolvedValue(undefined);

    render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Email'), 'lucas@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(onSignUp).toHaveBeenCalledWith('lucas@example.com', 'secret123');
  });
});
```

- [ ] **Step 2: Run auth tests to verify they fail**

Run: `npm test -- src/features/auth/AuthForm.test.tsx`

Expected: FAIL with an import error because `src/features/auth/AuthForm.tsx` does not exist.

- [ ] **Step 3: Implement auth form**

Write `src/features/auth/AuthForm.tsx`:

```tsx
import { FormEvent, useState } from 'react';

type AuthFormProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

export default function AuthForm({ onSignIn, onSignUp }: AuthFormProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <p className="eyebrow">Read Later</p>
        <h1 id="auth-heading">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setError('');
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          }}
          type="button"
        >
          {mode === 'sign-in' ? 'Create account' : 'Use existing account'}
        </button>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add auth styles**

Append to `src/styles.css`:

```css
.auth-layout {
  align-items: center;
  display: flex;
  min-height: 100vh;
  justify-content: center;
  padding: 24px;
}

.auth-panel {
  background: #ffffff;
  border: 1px solid #ddd7ca;
  border-radius: 8px;
  box-shadow: 0 18px 50px rgba(62, 54, 39, 0.12);
  max-width: 420px;
  padding: 32px;
  width: 100%;
}

.eyebrow {
  color: #6d7d39;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.auth-panel h1 {
  font-size: 2rem;
  line-height: 1.1;
  margin: 0 0 24px;
}

.stack {
  display: grid;
  gap: 16px;
}

label {
  display: grid;
  font-weight: 700;
  gap: 8px;
}

input {
  border: 1px solid #cfc8b8;
  border-radius: 6px;
  color: #17201b;
  padding: 12px 14px;
  width: 100%;
}

.primary-button,
.text-button,
.icon-button {
  border-radius: 6px;
  min-height: 42px;
}

.primary-button {
  background: #1f4d3a;
  border: 1px solid #1f4d3a;
  color: #ffffff;
  font-weight: 700;
  padding: 0 16px;
}

.text-button {
  background: transparent;
  border: 0;
  color: #1f4d3a;
  font-weight: 700;
  margin-top: 16px;
  padding: 0;
}

.error-message {
  color: #a13022;
  font-weight: 700;
  margin: 0;
}
```

- [ ] **Step 5: Run auth tests to verify they pass**

Run: `npm test -- src/features/auth/AuthForm.test.tsx`

Expected: PASS, 2 tests pass.

- [ ] **Step 6: Commit auth form**

```bash
git add src/features/auth/AuthForm.tsx src/features/auth/AuthForm.test.tsx src/styles.css
git commit -m "feat: add email password auth form"
```

### Task 7: Add Article Save Form

**Files:**
- Create: `src/features/articles/ArticleForm.tsx`
- Create: `src/features/articles/ArticleForm.test.tsx`

- [ ] **Step 1: Write failing article form tests**

Write `src/features/articles/ArticleForm.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ArticleForm from './ArticleForm';

describe('ArticleForm', () => {
  it('submits a normalized article draft', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<ArticleForm onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Article URL'), 'example.com/story');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(onCreate).toHaveBeenCalledWith({
      url: 'https://example.com/story',
      title: 'example.com',
      description: '',
      site_name: 'example.com',
    });
  });

  it('shows validation feedback for invalid urls', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<ArticleForm onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Article URL'), 'bad url');
    await user.click(screen.getByRole('button', { name: 'Save article' }));

    expect(await screen.findByText('Enter a valid article URL.')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/articles/ArticleForm.test.tsx`

Expected: FAIL with an import error because `src/features/articles/ArticleForm.tsx` does not exist.

- [ ] **Step 3: Implement article form**

Write `src/features/articles/ArticleForm.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { ArticleDraft, buildArticleDraft } from '../../lib/urlMetadata';

type ArticleFormProps = {
  onCreate: (draft: ArticleDraft) => Promise<void>;
};

export default function ArticleForm({ onCreate }: ArticleFormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const draft = buildArticleDraft(url);
      await onCreate(draft);
      setUrl('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save article.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="article-form" onSubmit={handleSubmit}>
      <label>
        Article URL
        <input
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/article"
          required
          type="text"
          value={url}
        />
      </label>
      {error ? <p className="error-message">{error}</p> : null}
      <button className="primary-button" disabled={isSubmitting} type="submit">
        Save article
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Add article form styles**

Append to `src/styles.css`:

```css
.article-form {
  align-items: end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.article-form .error-message {
  grid-column: 1 / -1;
}

@media (max-width: 680px) {
  .article-form {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run article form tests to verify they pass**

Run: `npm test -- src/features/articles/ArticleForm.test.tsx`

Expected: PASS, 2 tests pass.

- [ ] **Step 6: Commit article form**

```bash
git add src/features/articles/ArticleForm.tsx src/features/articles/ArticleForm.test.tsx src/styles.css
git commit -m "feat: add article save form"
```

### Task 8: Add Article Dashboard

**Files:**
- Create: `src/features/articles/ArticleDashboard.tsx`
- Create: `src/features/articles/ArticleDashboard.test.tsx`

- [ ] **Step 1: Write failing dashboard tests**

Write `src/features/articles/ArticleDashboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ArticleDashboard from './ArticleDashboard';
import type { Article } from './articleTypes';

const articles: Article[] = [
  {
    id: 'article-1',
    user_id: 'user-1',
    url: 'https://example.com/a',
    title: 'First Article',
    description: '',
    site_name: 'example.com',
    status: 'unread',
    created_at: '2026-07-20T00:00:00Z',
    read_at: null,
  },
  {
    id: 'article-2',
    user_id: 'user-1',
    url: 'https://example.com/b',
    title: 'Second Article',
    description: '',
    site_name: 'example.com',
    status: 'read',
    created_at: '2026-07-19T00:00:00Z',
    read_at: '2026-07-20T00:00:00Z',
  },
];

describe('ArticleDashboard', () => {
  it('renders articles and count summary', () => {
    render(
      <ArticleDashboard
        articles={articles}
        currentFilter="all"
        isLoading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onFilterChange={vi.fn()}
        onSignOut={vi.fn()}
        onToggleStatus={vi.fn()}
        userEmail="lucas@example.com"
      />,
    );

    expect(screen.getByText('First Article')).toBeInTheDocument();
    expect(screen.getByText('Second Article')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });

  it('requests status toggle', async () => {
    const user = userEvent.setup();
    const onToggleStatus = vi.fn().mockResolvedValue(undefined);

    render(
      <ArticleDashboard
        articles={articles}
        currentFilter="all"
        isLoading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onFilterChange={vi.fn()}
        onSignOut={vi.fn()}
        onToggleStatus={onToggleStatus}
        userEmail="lucas@example.com"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Mark First Article read' }));

    expect(onToggleStatus).toHaveBeenCalledWith('article-1', 'read');
  });

  it('requests filter changes', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    render(
      <ArticleDashboard
        articles={articles}
        currentFilter="all"
        isLoading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onFilterChange={onFilterChange}
        onSignOut={vi.fn()}
        onToggleStatus={vi.fn()}
        userEmail="lucas@example.com"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Read' }));

    expect(onFilterChange).toHaveBeenCalledWith('read');
  });
});
```

- [ ] **Step 2: Run dashboard tests to verify they fail**

Run: `npm test -- src/features/articles/ArticleDashboard.test.tsx`

Expected: FAIL with an import error because `src/features/articles/ArticleDashboard.tsx` does not exist.

- [ ] **Step 3: Implement dashboard**

Write `src/features/articles/ArticleDashboard.tsx`:

```tsx
import { Check, LogOut, Trash2, Undo2 } from 'lucide-react';
import type { ArticleDraft } from '../../lib/urlMetadata';
import ArticleForm from './ArticleForm';
import type { Article, ArticleStatus } from './articleTypes';

export type ArticleFilter = ArticleStatus | 'all';

type ArticleDashboardProps = {
  articles: Article[];
  currentFilter: ArticleFilter;
  isLoading: boolean;
  onCreate: (draft: ArticleDraft) => Promise<void>;
  onDelete: (articleId: string) => Promise<void>;
  onFilterChange: (filter: ArticleFilter) => void;
  onSignOut: () => Promise<void>;
  onToggleStatus: (articleId: string, status: ArticleStatus) => Promise<void>;
  userEmail: string;
};

export default function ArticleDashboard({
  articles,
  currentFilter,
  isLoading,
  onCreate,
  onDelete,
  onFilterChange,
  onSignOut,
  onToggleStatus,
  userEmail,
}: ArticleDashboardProps) {
  const unreadCount = articles.filter((article) => article.status === 'unread').length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Read Later</p>
          <h1>Article Library</h1>
          <p className="muted">{userEmail}</p>
        </div>
        <button className="secondary-button" onClick={onSignOut} type="button">
          <LogOut aria-hidden="true" size={18} />
          Sign out
        </button>
      </header>

      <section className="dashboard-band" aria-label="Save article">
        <div>
          <h2>Save an article</h2>
          <p className="muted">{unreadCount} unread</p>
        </div>
        <ArticleForm onCreate={onCreate} />
      </section>

      <section className="library-section" aria-label="Saved articles">
        <div className="filter-row" role="group" aria-label="Article filters">
          {(['unread', 'read', 'all'] as ArticleFilter[]).map((filter) => (
            <button
              className={currentFilter === filter ? 'filter-button active' : 'filter-button'}
              key={filter}
              onClick={() => onFilterChange(filter)}
              type="button"
            >
              {filter === 'all' ? 'All' : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? <p className="muted">Loading articles...</p> : null}

        {!isLoading && articles.length === 0 ? (
          <p className="empty-state">No articles in this view yet.</p>
        ) : null}

        <div className="article-list">
          {articles.map((article) => {
            const nextStatus: ArticleStatus = article.status === 'read' ? 'unread' : 'read';
            const toggleLabel =
              nextStatus === 'read'
                ? `Mark ${article.title} read`
                : `Mark ${article.title} unread`;

            return (
              <article className="article-item" key={article.id}>
                <div className="article-copy">
                  <a href={article.url} rel="noreferrer" target="_blank">
                    {article.title}
                  </a>
                  <p>{article.site_name}</p>
                </div>
                <div className="article-actions">
                  <button
                    aria-label={toggleLabel}
                    className="icon-button"
                    onClick={() => onToggleStatus(article.id, nextStatus)}
                    title={toggleLabel}
                    type="button"
                  >
                    {nextStatus === 'read' ? (
                      <Check aria-hidden="true" size={18} />
                    ) : (
                      <Undo2 aria-hidden="true" size={18} />
                    )}
                  </button>
                  <button
                    aria-label={`Delete ${article.title}`}
                    className="icon-button danger"
                    onClick={() => onDelete(article.id)}
                    title={`Delete ${article.title}`}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add dashboard styles**

Append to `src/styles.css`:

```css
.topbar {
  align-items: center;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  margin: 0 auto 28px;
  max-width: 1060px;
}

.topbar h1,
.dashboard-band h2 {
  margin: 0;
}

.muted {
  color: #697168;
  margin: 6px 0 0;
}

.secondary-button {
  align-items: center;
  background: #ffffff;
  border: 1px solid #cfc8b8;
  border-radius: 6px;
  color: #17201b;
  display: inline-flex;
  font-weight: 700;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
}

.dashboard-band,
.library-section {
  margin: 0 auto;
  max-width: 1060px;
}

.dashboard-band {
  background: #ffffff;
  border: 1px solid #ddd7ca;
  border-radius: 8px;
  display: grid;
  gap: 18px;
  margin-bottom: 24px;
  padding: 24px;
}

.library-section {
  display: grid;
  gap: 16px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-button {
  background: #ffffff;
  border: 1px solid #cfc8b8;
  border-radius: 999px;
  color: #17201b;
  font-weight: 700;
  min-height: 38px;
  padding: 0 14px;
}

.filter-button.active {
  background: #d8e5b1;
  border-color: #879b45;
}

.empty-state {
  background: #ffffff;
  border: 1px dashed #cfc8b8;
  border-radius: 8px;
  color: #697168;
  margin: 0;
  padding: 24px;
}

.article-list {
  display: grid;
  gap: 10px;
}

.article-item {
  align-items: center;
  background: #ffffff;
  border: 1px solid #ddd7ca;
  border-radius: 8px;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 16px;
}

.article-copy {
  min-width: 0;
}

.article-copy a {
  color: #17201b;
  display: inline-block;
  font-weight: 800;
  max-width: 100%;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.article-copy p {
  color: #697168;
  margin: 4px 0 0;
}

.article-actions {
  display: flex;
  gap: 8px;
}

.icon-button {
  align-items: center;
  background: #f7f4ee;
  border: 1px solid #cfc8b8;
  color: #17201b;
  display: inline-flex;
  height: 42px;
  justify-content: center;
  padding: 0;
  width: 42px;
}

.icon-button.danger {
  color: #a13022;
}

@media (max-width: 680px) {
  .app-shell {
    padding: 20px;
  }

  .topbar,
  .article-item {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .topbar {
    display: grid;
  }

  .article-actions {
    justify-content: flex-end;
  }
}
```

- [ ] **Step 5: Run dashboard tests to verify they pass**

Run: `npm test -- src/features/articles/ArticleDashboard.test.tsx`

Expected: PASS, 3 tests pass.

- [ ] **Step 6: Commit dashboard**

```bash
git add src/features/articles/ArticleDashboard.tsx src/features/articles/ArticleDashboard.test.tsx src/styles.css
git commit -m "feat: add article dashboard"
```

### Task 9: Wire Supabase Auth And Articles Into App

**Files:**
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing App tests**

Write `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

describe('App', () => {
  it('renders the auth screen when signed out', async () => {
    render(<App />);

    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run App test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL with an import error because `src/App.tsx` does not exist.

- [ ] **Step 3: Implement top-level App**

Write `src/App.tsx`:

```tsx
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import AuthForm from './features/auth/AuthForm';
import ArticleDashboard, { ArticleFilter } from './features/articles/ArticleDashboard';
import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticleStatus,
} from './features/articles/articleRepository';
import type { Article, ArticleStatus } from './features/articles/articleTypes';
import type { ArticleDraft } from './lib/urlMetadata';
import { supabase } from './lib/supabaseClient';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [filter, setFilter] = useState<ArticleFilter>('unread');
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [notice, setNotice] = useState('');

  const userId = session?.user.id;

  const refreshArticles = useCallback(async () => {
    if (!userId) {
      setArticles([]);
      return;
    }

    setIsLoadingArticles(true);
    setNotice('');

    try {
      const nextArticles = await listArticles(supabase, { userId, status: filter });
      setArticles(nextArticles);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not load articles.');
    } finally {
      setIsLoadingArticles(false);
    }
  }, [filter, userId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsBooting(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void refreshArticles();
  }, [refreshArticles]);

  async function handleSignIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message);
    }
  }

  async function handleSignUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      throw new Error(error.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setArticles([]);
  }

  async function handleCreateArticle(draft: ArticleDraft) {
    if (!userId) {
      return;
    }

    setNotice('');
    await createArticle(supabase, { userId, ...draft });
    await refreshArticles();
  }

  async function handleToggleStatus(articleId: string, status: ArticleStatus) {
    if (!userId) {
      return;
    }

    setNotice('');
    await updateArticleStatus(supabase, { userId, articleId, status });
    await refreshArticles();
  }

  async function handleDeleteArticle(articleId: string) {
    if (!userId) {
      return;
    }

    setNotice('');
    await deleteArticle(supabase, { userId, articleId });
    await refreshArticles();
  }

  if (isBooting) {
    return <main className="app-shell">Loading...</main>;
  }

  if (!session) {
    return <AuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} />;
  }

  return (
    <>
      <ArticleDashboard
        articles={articles}
        currentFilter={filter}
        isLoading={isLoadingArticles}
        onCreate={handleCreateArticle}
        onDelete={handleDeleteArticle}
        onFilterChange={setFilter}
        onSignOut={handleSignOut}
        onToggleStatus={handleToggleStatus}
        userEmail={session.user.email ?? 'Signed in'}
      />
      {notice ? <div className="toast" role="status">{notice}</div> : null}
    </>
  );
}
```

- [ ] **Step 4: Add toast styles**

Append to `src/styles.css`:

```css
.toast {
  background: #17201b;
  border-radius: 6px;
  bottom: 20px;
  color: #ffffff;
  font-weight: 700;
  left: 50%;
  max-width: calc(100vw - 40px);
  padding: 12px 16px;
  position: fixed;
  transform: translateX(-50%);
}
```

- [ ] **Step 5: Run App test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: PASS, 1 test passes.

- [ ] **Step 6: Run full test suite**

Run: `npm test`

Expected: PASS, all tests pass.

- [ ] **Step 7: Commit App integration**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: wire supabase reading list app"
```

### Task 10: Final Build And Manual Setup Notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Write `README.md`:

```md
# Read Later

A Supabase-backed reading-list dashboard for saving article URLs and tracking read/unread status.

## Requirements

- Node.js 20+
- A Supabase project

## Supabase Setup

1. In Supabase, enable Email provider authentication.
2. Run `supabase/migrations/20260720000000_create_articles.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Copy `.env.example` to `.env`.
4. Set `VITE_SUPABASE_URL` to your project URL.
5. Set `VITE_SUPABASE_ANON_KEY` to your public anon key.

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```

## MVP Scope

- Email/password sign up and sign in
- Save article URLs
- List unread, read, and all articles
- Mark articles read/unread
- Delete articles

## Future Phases

- Chrome extension for saving the active tab
- Supabase Edge Function for article extraction
- Send-to-Kindle delivery through Kindle email
```

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: PASS, all tests pass.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS and `dist/` is created.

- [ ] **Step 4: Commit README**

```bash
git add README.md
git commit -m "docs: add setup instructions"
```

### Task 11: Optional Local Smoke Test

**Files:**
- Modify: none

- [ ] **Step 1: Start development server**

Run: `npm run dev`

Expected: Vite prints a local URL, usually `http://localhost:5173/`.

- [ ] **Step 2: Open the app**

Open the local URL in a browser.

Expected: the auth screen renders. If `.env` is missing, the browser console shows the explicit missing Supabase config error from `src/lib/env.ts`.

- [ ] **Step 3: Configure Supabase and retry**

Create `.env`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Restart the dev server.

Expected: auth screen renders without config errors.

- [ ] **Step 4: Verify signed-in flow**

Use a Supabase test account to sign up or sign in.

Expected:
- The article dashboard appears.
- Saving `example.com/story` creates an unread item titled `example.com`.
- Clicking the check icon marks it read.
- Switching to the `Read` filter shows the read item.
- Clicking the delete icon removes it.

## Self-Review

- Spec coverage: The plan covers Supabase email/password login, protected `articles` data, dashboard listing, article creation, read/unread updates, deletion, tests, and setup docs.
- Placeholder scan: The plan contains no unresolved work markers. Future Chrome extension, Kindle delivery, and article extraction are explicitly out of scope.
- Type consistency: Article status is consistently `unread | read`; filter is consistently `unread | read | all`; repository functions use the same `userId`, `articleId`, and `site_name` field names across tests and implementation.

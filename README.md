# Read Later

Supabase-backed reading-list dashboard for saving article URLs and tracking read/unread status.

## Requirements

- Node.js 20+
- Supabase project

## Supabase Setup

1. Enable Email provider authentication in your Supabase project.
2. Run `supabase/migrations/20260720000000_create_articles.sql` in the Supabase SQL editor or with the Supabase CLI.
3. Copy `.env.example` to `.env`.
4. Set `VITE_SUPABASE_URL` to your Supabase project URL.
5. Set `VITE_SUPABASE_ANON_KEY` to your Supabase anon key.

## Local Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm test
npm run build
```

## MVP Scope

- Email/password sign up and sign in
- Save article URLs
- List unread, read, and all articles
- Mark articles read or unread
- Delete articles

## Future Phases

- Chrome extension for active tab
- Supabase Edge Function for article extraction
- Send-to-Kindle through Kindle email

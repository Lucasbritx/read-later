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

## Chrome Extension

The `chrome-extension` folder contains a Manifest V3 extension that signs in with the same Supabase email/password account and saves the active tab as an unread article.

Copy `chrome-extension/config.example.js` to `chrome-extension/config.js`, fill in your Supabase URL and anon key, then load the `chrome-extension` folder from `chrome://extensions`.

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
- Chrome extension for saving the active tab

## Future Phases

- Supabase Edge Function for article extraction
- Send-to-Kindle through Kindle email

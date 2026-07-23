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

## Send to Kindle Setup

The MVP sends a `.txt` attachment containing the article title, source URL, description, and site name through a Supabase Edge Function using Resend.

1. Run `supabase/migrations/20260722000000_create_kindle_settings.sql` in Supabase.
2. Create a Resend API key.
3. Verify the sender email or domain in Resend.
4. Add that sender email to Amazon's Approved Personal Document E-mail List.
5. Set the Edge Function secrets:

```sh
supabase secrets set SUPABASE_URL="https://your-project-ref.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="your-public-anon-key"
supabase secrets set RESEND_API_KEY="your-resend-api-key"
supabase secrets set KINDLE_SENDER_EMAIL="Read Later <send@example.com>"
```

6. Deploy the Edge Function:

```sh
supabase functions deploy send-to-kindle
```

This first version sends a plain text attachment. The next Kindle phase will generate a Kindle-friendly HTML attachment from extracted article content.

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

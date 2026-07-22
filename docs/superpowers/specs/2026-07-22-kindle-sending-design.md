# Kindle Sending Design

## Goal

Add an incremental Send to Kindle workflow to Read Later. The first version proves the delivery pipeline by emailing a saved article's title, URL, and description to the user's Kindle email address. Later versions will replace the simple email content with generated Kindle-friendly HTML and then EPUB output.

## Scope

This phase includes:

- User-level Kindle delivery settings.
- A dashboard control for saving the user's Kindle email address.
- A Send to Kindle action for each saved article.
- A Supabase Edge Function that validates the user, loads the article, and sends email through Resend.
- Setup documentation for Supabase secrets, Resend, and Amazon's approved sender requirement.

This phase does not include:

- Full article extraction.
- HTML attachment generation.
- EPUB generation.
- Background send queues or retry workers.
- Chrome extension Kindle actions.

## Product Behavior

The dashboard will show a compact Kindle settings area where the signed-in user can save their Kindle email address. The app will validate that the value looks like an email address before saving it.

Each article row will include a Send to Kindle action. When clicked, the UI will call the Edge Function with the article id. The button will show a sending state while the request is in progress. On success, the app will show a sent confirmation. On failure, the app will show the function's user-facing error.

If the user has not saved a Kindle email address, the Send to Kindle action will ask them to add one before sending.

## Data Model

Add a `public.kindle_settings` table:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `kindle_email text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Enable row level security. Users can select, insert, and update only their own row. Delete is not required for the MVP; users can overwrite the email if needed.

The existing `articles` table remains the article source of truth. Delivery status will stay client-local for this phase to avoid adding history tables before we need them.

## Backend Architecture

Add `supabase/functions/send-to-kindle/index.ts`.

The Edge Function will:

1. Accept `POST` only.
2. Read the caller's Supabase JWT from the `Authorization` header.
3. Create a Supabase client with the anon key and caller JWT.
4. Call `auth.getUser()` to identify the user.
5. Validate the JSON body contains `articleId`.
6. Load the matching article with `id = articleId` and `user_id = user.id`.
7. Load the user's Kindle settings.
8. Send an email through Resend.

The Resend email will use:

- `from`: `KINDLE_SENDER_EMAIL`
- `to`: the user's saved Kindle email
- `subject`: `Article: <article title>`
- `text`: title, URL, optional description, and source site

Required Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `KINDLE_SENDER_EMAIL`

The sender email or domain must be added to the user's Amazon Approved Personal Document E-mail List. This is an operational setup step and cannot be automated safely from this app.

## Frontend Architecture

Add a small settings repository for Kindle settings:

- `getKindleSettings(client, userId)`
- `saveKindleSettings(client, { userId, kindleEmail })`

Add a Kindle send repository helper:

- `sendArticleToKindle(client, articleId)`

This helper will invoke the Supabase Edge Function using the logged-in user's session.

Update the dashboard props and state so `App.tsx` owns:

- current Kindle settings
- save settings action
- send-to-kindle action
- per-article sending state

Update `ArticleDashboard` to render the settings form and Send to Kindle button.

## Error Handling

Frontend errors:

- Invalid email: show a local validation message.
- Missing settings: show a message asking the user to save a Kindle email.
- Function failure: show the function's error message.

Function errors:

- Missing or invalid JWT: `401`
- Invalid method: `405`
- Missing article id: `400`
- Article not found or inaccessible: `404`
- Missing Kindle settings: `400`
- Resend failure: `502`

All function responses will be JSON.

## Testing

Use TDD for the implementation.

Repository tests:

- Saving Kindle settings upserts the user's row.
- Loading settings returns the user's row or `null`.
- Sending invokes the Edge Function with the article id.

Edge Function unit tests:

- Rejects non-POST methods.
- Rejects unauthenticated requests.
- Rejects missing article ids.
- Sends the expected Resend payload for a valid article/settings pair.
- Returns a useful error when settings are missing.
- Returns a useful error when Resend fails.

Dashboard tests:

- Saves a Kindle email from the settings form.
- Calls Send to Kindle for an article.
- Shows sending and error states.

## Future Path

After the email pipeline works, add article extraction and generate a Kindle-friendly HTML attachment. The Edge Function can then attach `article.html` instead of sending only text. Once HTML output is stable, add EPUB generation as a separate phase.

# Read Later Chrome Extension

Manifest V3 extension for saving the active Chrome tab into the same Supabase `articles` table used by the web dashboard.

## Setup

1. Copy `config.example.js` to `config.js`.
2. Set `SUPABASE_URL` to your Supabase project URL.
3. Set `SUPABASE_ANON_KEY` to your Supabase anon key.
4. Open Chrome and go to `chrome://extensions`.
5. Enable Developer mode.
6. Click Load unpacked.
7. Select this `chrome-extension` folder.

## Usage

1. Click the extension icon.
2. Sign in with the same Supabase email/password account used by the web app.
3. Open an article tab.
4. Click Save current tab.

The extension stores the Supabase access token in `chrome.storage.local` and inserts an unread row into `public.articles`.

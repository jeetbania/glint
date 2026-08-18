# Glint browser extension

Save pages, links, and images straight to your Glint library — no
account, no API keys, just points at your live site.

## What it does

- **Click the toolbar icon** — saves the current tab as a link.
- **Right-click a page → "Save page to Glint"** — same as above.
- **Right-click an image → "Save image to Glint"** — downloads and saves
  the image itself.
- **Right-click a link → "Save link to Glint"** — saves the link's
  target without navigating to it (handy for saving a link straight out
  of a list, e.g. an X bookmark or a search result).

A native Chrome notification confirms each save (or tells you what went
wrong).

This is manual-save only, on purpose — no background scraping or
auto-sync of X/Instagram saves. That would mean scraping those sites'
pages with no official API, which breaks whenever they change their
markup and sits in a gray area against their terms of service. The
one-click/right-click flow covers the same use case reliably instead.

## Install it (unpacked — free, ~30 seconds, no Chrome Web Store needed)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this `browser-extension` folder.

That's it — the Glint icon appears in your toolbar. Pin it (puzzle-piece
icon → pin) for one-click access.

## Notes

- It always saves to `https://glint-jeetbania.vercel.app` — the same
  live site the web and desktop apps use. Change `API_BASE` at the top
  of `background.js` if that URL ever changes.
- Chrome only "remembers" an unpacked extension while its folder stays
  on disk in the same place — don't delete/move this folder after
  loading it.
- Because this loads unpacked instead of through the Web Store, Chrome
  will occasionally show a "disable developer mode extensions" nag on
  browser restart. Click **Cancel** to keep it enabled — it's not
  actually being disabled, just re-prompted.

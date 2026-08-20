# Glint browser extension

Save pages, links, and images straight to your Glint library — no
account, no API keys, no server. Everything you save through this
extension lands only in the local storage of the Glint tab that's open
in this browser (see the main app's README/AGENTS notes on
`lib/local/*` for why) — the same way pasting or dragging something into
the app itself already works.

## What it does

- **Click the toolbar icon** — saves the current tab as a link.
- **Right-click a page → "Save page to Glint"** — same as above.
- **Right-click an image → "Save image to Glint"** — downloads, resizes,
  and saves the image itself, entirely on this machine.
- **Right-click a link → "Save link to Glint"** — saves the link's
  target without navigating to it (handy for saving a link straight out
  of a list, e.g. an X bookmark or a search result).

A native Chrome notification confirms each save (or tells you what went
wrong), and a toast appears in the Glint tab itself once the save lands.

This is manual-save only, on purpose — no background scraping or
auto-sync of X/Instagram saves. That would mean scraping those sites'
pages with no official API, which breaks whenever they change their
markup and sits in a gray area against their terms of service. The
one-click/right-click flow covers the same use case reliably instead.

## How a save actually reaches your library

There's no server in this loop anymore — a save has to make it into an
**open Glint tab in this same browser** to be written to local storage:

- If a Glint tab is already open, the save lands within a second or two
  and that tab shows a toast confirming it.
- If no Glint tab is open, the save is queued (in the extension's own
  storage, not the page's) and delivered automatically the next time you
  open one.
- A save made in this browser stays in this browser — it won't show up
  in Glint on a different computer, a different browser profile, or the
  desktop app on another device. That's the whole point of local
  storage: nothing here ever touches a server other people could see.

## Install it (unpacked — free, ~30 seconds, no Chrome Web Store needed)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this `browser-extension` folder.

That's it — the Glint icon appears in your toolbar. Pin it (puzzle-piece
icon → pin) for one-click access.

## Notes

- It targets `https://glint-jeetbania.vercel.app` — the same live site
  the web and desktop apps use. Change `GLINT_ORIGIN` at the top of
  `background.js` if that URL ever changes.
- `host_permissions` is intentionally broad (`<all_urls>`) — saving an
  image means this extension has to fetch the image bytes itself, from
  whatever site you right-clicked on, since there's no server left to do
  that fetch on its behalf. Some hotlink-protected images may still fail
  to save (a browser `fetch()` can't spoof the page's Referer header the
  way a server-side fetch could) — a known trade-off.
- Chrome only "remembers" an unpacked extension while its folder stays
  on disk in the same place — don't delete/move this folder after
  loading it.
- Because this loads unpacked instead of through the Web Store, Chrome
  will occasionally show a "disable developer mode extensions" nag on
  browser restart. Click **Cancel** to keep it enabled — it's not
  actually being disabled, just re-prompted.

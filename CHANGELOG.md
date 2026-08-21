# Changelog

All notable changes to Glint are logged here, newest first. This mirrors
`src/lib/version.ts`, which is what the in-app "What's new" dialog and
Settings → Changelog actually render — keep both in sync when adding an
entry.

## 0.2.0 — 2026-08-21

- Frame is now a real Figma/FigJam-style container: drag to draw, drop
  things into it, move it and everything inside follows, resize without
  scaling its contents, nest frames inside frames, delete one and its
  contents unwrap onto the canvas instead of vanishing.
- Flip horizontal/vertical is now available from the right-click menu
  for images, links, and every other library item — not just canvas
  objects.
- Fixed right-clicking an item incorrectly opening its detail dialog —
  right-click now only selects and opens the context menu, matching
  left-click's own behavior.
- Fixed the browser extension reporting a save as successful when it
  silently failed to land — a real delivery acknowledgment now confirms
  the save actually happened before saying so, and queued saves are
  only cleared once confirmed instead of upfront.
- The whole app (landing page included) is now behind a single password
  gate; the downloaded desktop app signs itself in automatically.
- Added a Custom provider option to AI settings — point it at any
  OpenAI-compatible endpoint (OpenRouter, NVIDIA NIM, etc.) with your
  own base URL, model name, and API key.
- The app now checks for new versions on GitHub and shows a dismissible
  bottom-right notification when one's available, with a link to
  download it.
- Added this changelog — visible here, and in Settings → Changelog
  going forward.

## 0.1.0 — 2026-08-18

- First local-first release — everything you save (images, links,
  notes, tasks) lives in this browser's own storage, no server
  database.
- Freeform canvas per collection with sticky notes, text, shapes, and
  real Figma/FigJam-style connectors (lines, arrows, elbow connectors).
- Browser extension for saving pages, links, and images straight from
  anywhere.
- Downloadable Mac/Windows desktop app.

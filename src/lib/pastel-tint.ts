const TINTS = ["mint", "lavender", "peach", "sky", "rose", "sage"] as const;

/** Deterministic pastel-glass tint for a card with no image of its own
 * (notes, tasks, link previews that failed to scrape an OG image) — a
 * uniform stack of plain cards reads as monotonous, and unlike an image
 * card there's no photo to supply color, so one of the same 6
 * `.glass-tint-*` hues already used for Collection folders (globals.css)
 * is picked instead. Hashed from the item's own id (not index/position)
 * so a given note/task keeps the same color across reloads and
 * regardless of sort order — the same technique as skeleton-image.tsx's
 * pickVariant, just over 6 buckets instead of 4. */
export function pastelTintClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return `glass-tint-${TINTS[Math.abs(hash) % TINTS.length]}`;
}

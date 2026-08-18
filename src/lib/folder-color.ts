/** Curated pastel hue palette for Collection folders — sampled directly
 * from the user's own reference (a "MacBook Folder Icons" pastel pack:
 * sea green, sky blue, periwinkle, lavender, plum, rose, peach, apricot,
 * mustard), converted to OKLCH and reduced to just the hue angle from
 * each distinct color family. Deliberately a small FIXED set rather
 * than a continuous hue sweep — a random pick from an open 0-360 range
 * risks landing on a muddy in-between hue the reference never actually
 * has, and a fixed set is also what makes the live color-picker (see
 * collections-row.tsx) a simple "pick one of these," not an open-ended
 * color input that could drift the whole app's palette over time.
 *
 * Only the HUE comes from the reference — lightness/chroma still ride
 * on this app's own already-tuned --folder-l/--folder-c glass recipe
 * (globals.css), not the reference's own (much paler, inconsistently so
 * across its 4 saturation tiers) values, which would fight the
 * translucent-glass look rather than just recolor it.
 */
export const FOLDER_HUE_PALETTE = [
  176, // sea green
  195, // teal
  233, // sky blue
  264, // periwinkle
  282, // lavender
  327, // plum
  355, // rose
  43, // peach
  58, // apricot
  90, // mustard
] as const;

export type FolderHue = (typeof FOLDER_HUE_PALETTE)[number];

export function isFolderHue(value: number): value is FolderHue {
  return (FOLDER_HUE_PALETTE as readonly number[]).includes(value);
}

/** Assigned once, at creation time, to a new Collection — see
 * createCollection/setItemCollections in lib/collections.ts. Persisted
 * (collections.color_hue), not recomputed on the fly, both so it stays
 * stable across reloads regardless of the folder's position in the list
 * and so the live color-picker has something durable to overwrite. */
export function randomFolderHue(): FolderHue {
  return FOLDER_HUE_PALETTE[Math.floor(Math.random() * FOLDER_HUE_PALETTE.length)];
}

/** A mid-lightness, moderately saturated swatch for small UI (icons,
 * badges) — distinct from the folder card's own airy/rich gradient
 * lightness (see globals.css's --folder-l1/-l2), since a tiny icon needs
 * more contrast against the page than a big gradient card does. */
export function hueSwatch(hue: number): string {
  return `oklch(62% 0.14 ${hue})`;
}

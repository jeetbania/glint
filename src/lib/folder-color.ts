/** Shared hue-assignment for anything that needs to color-code a
 * Collection consistently with its own folder card (collections-row.tsx)
 * — the Notes sidebar's folder icons, in particular. Hue is assigned by
 * position (golden-angle spacing, ~137.5° apart) rather than hashed from
 * the id, so no two folders can land on the same color regardless of how
 * many exist. */
const GOLDEN_ANGLE = 137.508;

export function hueForIndex(index: number): number {
  return Math.round((index * GOLDEN_ANGLE) % 360);
}

/** A mid-lightness, moderately saturated swatch for small UI (icons,
 * badges) — distinct from the folder card's own airy/rich gradient
 * lightness (see globals.css's --folder-l1/-l2), since a tiny icon needs
 * more contrast against the page than a big gradient card does. */
export function hueSwatch(hue: number): string {
  return `oklch(62% 0.14 ${hue})`;
}

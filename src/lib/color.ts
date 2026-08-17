export const COLOR_FAMILIES = [
  "black",
  "white",
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "brown",
  "pastel",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/**
 * Buckets a color into one of ~13 coarse families for filter UI, from its
 * HSL components (hue/saturation/lightness all normalized 0-1, matching
 * what the `extract-colors` package returns). Order matters: achromatic
 * checks first, then brown/pastel as special cases of the hue wheel,
 * then a plain 30-60° hue-segment split for the rest.
 */
export function bucketColorFamily(
  hue: number,
  saturation: number,
  lightness: number,
): ColorFamily {
  const hueDeg = hue * 360;

  if (lightness < 0.12) return "black";
  if (lightness > 0.92 && saturation < 0.15) return "white";
  if (saturation < 0.12) return "gray";

  if (hueDeg >= 20 && hueDeg < 50 && lightness < 0.45 && saturation > 0.2) {
    return "brown";
  }
  if (lightness > 0.78 && saturation < 0.6) return "pastel";

  if (hueDeg < 15 || hueDeg >= 345) return "red";
  if (hueDeg < 45) return "orange";
  if (hueDeg < 65) return "yellow";
  if (hueDeg < 170) return "green";
  if (hueDeg < 200) return "teal";
  if (hueDeg < 255) return "blue";
  if (hueDeg < 290) return "purple";
  return "pink";
}

/** Representative hex per color-family bucket, for filter swatch dots —
 * not the stored per-image palette itself. */
const SWATCH_HEX: Record<ColorFamily, string> = {
  black: "#111111",
  white: "#f5f5f5",
  gray: "#9ca3af",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  brown: "#92400e",
  pastel: "#fbcfe8",
};

export function swatchHex(family: string): string {
  return SWATCH_HEX[family as ColorFamily] ?? "#9ca3af";
}

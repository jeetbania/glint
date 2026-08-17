"use client";

import { Grid2x2, LayoutGrid } from "lucide-react";

/** Grid density control — fewer columns = bigger cards. Matches the
 * reference app's small-icon / slider / large-icon control. */
export function SizeSlider({
  columns,
  onChange,
  min = 2,
  max = 6,
}: {
  columns: number;
  onChange: (columns: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="glass-pill hidden items-center gap-2 px-3 py-1.5 sm:flex">
      <LayoutGrid className="size-3.5 text-muted-foreground" />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        // Inverted: dragging right = fewer, bigger columns, matching the
        // "small icon -> large icon" reading direction of the control.
        value={max + min - columns}
        onChange={(e) => onChange(max + min - Number(e.target.value))}
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-foreground/15 accent-foreground"
        aria-label="Grid card size"
      />
      <Grid2x2 className="size-3.5 text-muted-foreground" />
    </div>
  );
}

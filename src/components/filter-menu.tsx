"use client";

import useSWR from "swr";
import { SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { swatchHex } from "@/lib/color";
import { cn } from "@/lib/utils";

/** Color + tag filtering, moved out of the always-visible toolbar into a
 * single "Filters" control — matches the reference app's pattern of
 * filters living in a dropdown rather than scattered inline swatches. */
export function FilterMenu({
  color,
  onColorChange,
  tag,
  onTagChange,
}: {
  color: string | null;
  onColorChange: (color: string | null) => void;
  tag: string | null;
  onTagChange: (tag: string | null) => void;
}) {
  const { data: colorsData } = useSWR<{
    colors: { color: string; count: number }[];
  }>("/api/colors");
  const { data: tagsData } = useSWR<{
    tags: { id: string; name: string; slug: string; count: number }[];
  }>("/api/tags");

  const activeCount = (color ? 1 : 0) + (tag ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-72 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Color</p>
            {color && (
              <button
                onClick={() => onColorChange(null)}
                className="text-[11px] text-muted-foreground underline underline-offset-2"
              >
                clear
              </button>
            )}
          </div>
          {colorsData && colorsData.colors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {colorsData.colors.map((c) => (
                <button
                  key={c.color}
                  onClick={() =>
                    onColorChange(color === c.color ? null : c.color)
                  }
                  title={`${c.color} (${c.count})`}
                  className={cn(
                    "size-6 rounded-full border-2 transition-transform",
                    color === c.color
                      ? "scale-110 border-foreground"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: swatchHex(c.color) }}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No colors extracted yet.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Tags</p>
            {tag && (
              <button
                onClick={() => onTagChange(null)}
                className="text-[11px] text-muted-foreground underline underline-offset-2"
              >
                clear
              </button>
            )}
          </div>
          {tagsData && tagsData.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tagsData.tags.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    onTagChange(tag === t.slug ? null : t.slug)
                  }
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs transition-all",
                    tag === t.slug
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-foreground/6 text-muted-foreground hover:bg-foreground/10",
                  )}
                >
                  {t.name} · {t.count}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No tags yet.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

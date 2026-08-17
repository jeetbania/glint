"use client";

import { useMemo, useState } from "react";
import Masonry from "react-masonry-css";
import useSWR, { useSWRConfig } from "swr";
import { Search, Plus, StickyNote, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ItemCard } from "@/components/item-card";
import { ItemDetailDialog } from "@/components/item-detail-dialog";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { swatchHex } from "@/lib/color";
import { cn } from "@/lib/utils";
import type { ApiItem, ItemType } from "@/types/item";

const TYPE_FILTERS: { value: ItemType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "link", label: "Links" },
  { value: "note", label: "Notes" },
  { value: "task", label: "Tasks" },
];

const MASONRY_BREAKPOINTS = { default: 4, 1280: 3, 900: 2, 600: 1 };

export function LibraryView({
  fixedType,
  initialTag = null,
  initialColor = null,
  emptyMessage = "Nothing here yet. Paste an image or link anywhere to save it.",
}: {
  fixedType?: ItemType;
  initialTag?: string | null;
  initialColor?: string | null;
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<ItemType | "all">(fixedType ?? "all");
  const [tag, setTag] = useState<string | null>(initialTag);
  const [color, setColor] = useState<string | null>(initialColor);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { mutate: globalMutate } = useSWRConfig();

  async function createBlank(kind: "note" | "task") {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "note"
          ? { type: "note", title: "Untitled note" }
          : { type: "task", title: "New task" },
      ),
    });
    const { item } = (await res.json()) as { item: ApiItem };
    void globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/items"),
    );
    setSelectedItemId(item.id);
  }

  const debounceSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
  }, 300);

  const effectiveType = fixedType ?? type;
  const queryKey = useMemo(() => {
    const params = new URLSearchParams();
    if (effectiveType !== "all") params.set("type", effectiveType);
    if (tag) params.set("tag", tag);
    if (color) params.set("color", color);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    return `/api/items?${params.toString()}`;
  }, [effectiveType, tag, color, debouncedSearch]);

  const { data, isLoading } = useSWR<{ items: ApiItem[] }>(queryKey);
  const { data: tagsData } = useSWR<{
    tags: { id: string; name: string; slug: string; count: number }[];
  }>("/api/tags");
  const { data: colorsData } = useSWR<{
    colors: { color: string; count: number }[];
  }>("/api/colors");

  const items = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 px-6 pb-4 pt-6">
        <div className="flex items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                debounceSearch(e.target.value);
              }}
              placeholder="Search your library…"
              className="pl-9"
            />
          </div>
          {!fixedType && (
            <div className="flex items-center gap-5">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setType(f.value)}
                  className={cn(
                    "relative pb-1 text-sm font-medium transition-colors",
                    type === f.value
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  {type === f.value && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline" className="ml-auto gap-1.5">
                  <Plus className="size-4" />
                  New
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => createBlank("note")}>
                <StickyNote className="size-4" />
                Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createBlank("task")}>
                <CheckSquare className="size-4" />
                Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {colorsData && colorsData.colors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {colorsData.colors.map((c) => (
              <button
                key={c.color}
                onClick={() =>
                  setColor((current) => (current === c.color ? null : c.color))
                }
                title={`${c.color} (${c.count})`}
                className={cn(
                  "size-5 rounded-full border-2 transition-transform",
                  color === c.color
                    ? "scale-110 border-foreground"
                    : "border-transparent",
                )}
                style={{ backgroundColor: swatchHex(c.color) }}
              />
            ))}
            {color && (
              <button
                onClick={() => setColor(null)}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                clear
              </button>
            )}
          </div>
        )}

        {tagsData && tagsData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tagsData.tags.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setTag((current) => (current === t.slug ? null : t.slug))
                }
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs transition-all",
                  tag === t.slug
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-foreground/6 text-muted-foreground hover:bg-foreground/10",
                )}
              >
                {t.name} · {t.count}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-6">
        {!isLoading && items.length === 0 && (
          <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
        <Masonry
          breakpointCols={MASONRY_BREAKPOINTS}
          className="masonry-grid"
          columnClassName="masonry-grid-column"
        >
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItemId(item.id)}
            />
          ))}
        </Masonry>
      </div>

      <ItemDetailDialog
        itemId={selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </div>
  );
}

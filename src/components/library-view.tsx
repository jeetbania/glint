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
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Tabs } from "@/components/ui/tabs";
import { ItemCard } from "@/components/item-card";
import { ItemDetailDialog } from "@/components/item-detail-dialog";
import { CollectionsRow } from "@/components/collections-row";
import { FilterMenu } from "@/components/filter-menu";
import { SortMenu, type SortValue } from "@/components/sort-menu";
import { SizeSlider } from "@/components/size-slider";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { GhostCard, GhostBar } from "@/components/ui/ghost-card";
import type { ApiItem, ItemType } from "@/types/item";

/** The main Library view is visuals-only by default (images + links) —
 * Notes and Tasks live under their own dedicated tabs instead of
 * cluttering the primary grid. */
const VISUAL_TYPE_FILTERS: { value: string; label: string; types?: ItemType[] }[] = [
  { value: "all", label: "All", types: ["image", "link"] },
  { value: "image", label: "Images", types: ["image"] },
  { value: "link", label: "Links", types: ["link"] },
];

const DEFAULT_COLUMNS = 4;

export function LibraryView({
  fixedType,
  initialTag = null,
  initialColor = null,
  initialItemId = null,
  showCollections = false,
  showTypeFilters = true,
  emptyMessage = "Nothing here yet. Paste an image or link anywhere to save it.",
}: {
  fixedType?: ItemType;
  initialTag?: string | null;
  initialColor?: string | null;
  initialItemId?: string | null;
  showCollections?: boolean;
  showTypeFilters?: boolean;
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tag, setTag] = useState<string | null>(initialTag);
  const [color, setColor] = useState<string | null>(initialColor);
  const [sort, setSort] = useState<SortValue>("recent-desc");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialItemId);
  // The command palette's "Recent" row deep-links here via ?item=<id>.
  // Navigating there while already on /library is a client-side
  // transition that doesn't remount this component, so the useState
  // initializer above only fires the very first time. React's documented
  // "adjusting state when a prop changes" pattern (compare + setState
  // during render, not in an effect) catches the case where
  // initialItemId changes on an already-mounted instance instead —
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitialItemId, setPrevInitialItemId] = useState(initialItemId);
  if (initialItemId !== prevInitialItemId) {
    setPrevInitialItemId(initialItemId);
    if (initialItemId) setSelectedItemId(initialItemId);
  }
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

  const queryKey = useMemo(() => {
    const effectiveTypes = fixedType
      ? [fixedType]
      : VISUAL_TYPE_FILTERS.find((f) => f.value === typeFilter)?.types;
    const params = new URLSearchParams();
    if (effectiveTypes) params.set("type", effectiveTypes.join(","));
    if (tag) params.set("tag", tag);
    if (color) params.set("color", color);
    if (sort !== "recent-desc") params.set("sort", sort);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    return `/api/items?${params.toString()}`;
  }, [fixedType, typeFilter, tag, color, sort, debouncedSearch]);

  // A slow background poll (not focus-revalidation — see swr-provider.tsx
  // for why that's off globally) so items saved from outside the app
  // itself (the browser extension, the desktop clipboard watcher on
  // another device) show up here on their own within half a minute,
  // instead of needing a manual reload to notice them.
  const { data, isLoading } = useSWR<{ items: ApiItem[] }>(queryKey, {
    refreshInterval: 30000,
  });

  const items = data?.items ?? [];
  const breakpoints = {
    default: columns,
    1400: Math.max(columns - 1, 2),
    1000: Math.max(columns - 2, 1),
    640: 1,
  };

  return (
    <div className="flex h-full flex-col">
      {showCollections && <CollectionsRow />}
      <div className="space-y-3 px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
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
          {!fixedType && showTypeFilters && (
            <Tabs
              items={VISUAL_TYPE_FILTERS}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          )}

          <div className="ml-auto flex items-center gap-2">
            <FilterMenu
              color={color}
              onColorChange={setColor}
              tag={tag}
              onTagChange={setTag}
            />
            <SortMenu value={sort} onChange={setSort} />
            <SizeSlider columns={columns} onChange={setColumns} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="size-4" />
                    New
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => createBlank("note")}>
                  <StickyNote className="size-4" />
                  Note
                  <DropdownMenuShortcut>
                    <Kbd>⌘⇧N</Kbd>
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createBlank("task")}>
                  <CheckSquare className="size-4" />
                  Task
                  <DropdownMenuShortcut>
                    <Kbd>⌘⇧T</Kbd>
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        {!isLoading && items.length === 0 && <EmptyLibraryState message={emptyMessage} />}
        {isLoading && items.length === 0 ? (
          <LibrarySkeleton breakpoints={breakpoints} />
        ) : (
          // Keyed by the query + column count so a filter/sort/search/size
          // change fully remounts the grid instead of React quietly
          // reusing the existing cards for anything that persists across
          // it — that's what makes ItemCard's fade-in replay on every
          // filter/resize instead of only on the very first load.
          <Masonry
            key={`${queryKey}-${columns}`}
            breakpointCols={breakpoints}
            className="masonry-grid"
            columnClassName="masonry-grid-column"
          >
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => setSelectedItemId(item.id)}
                onColorClick={setColor}
              />
            ))}
          </Masonry>
        )}
      </div>

      <ItemDetailDialog
        itemId={selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </div>
  );
}

/** A blank pane with just a line of text read as bare/broken for a
 * brand-new library rather than "start here" — a small fanned stack of
 * flat, neutral "ghost cards" (mimicking the item cards that will
 * eventually fill this grid: an image block + a couple of skeleton text
 * lines) gives a first-run visitor something to look at without
 * resorting to a decorative color/gradient illustration, which reads as
 * generic AI-generated chrome rather than something considered. Soft
 * elevation comes from a plain shadow + blur/opacity on the two back
 * cards, not color — same restrained, monochrome language as the
 * reference empty states this was modeled on. No animation: the
 * reference is fully static, and a wall of colorful floating badges was
 * exactly the wrong direction here. */
function EmptyLibraryState({ message }: { message: string }) {
  return (
    <div className="flex h-[28rem] flex-col items-center justify-center gap-6 text-center">
      <div className="relative flex h-28 w-56 items-center justify-center">
        <GhostCard className="h-28 w-40 -translate-x-14 -rotate-6 opacity-50 blur-[1px]">
          <GhostCardBody />
        </GhostCard>
        <GhostCard className="h-28 w-40 translate-x-14 rotate-6 opacity-50 blur-[1px]">
          <GhostCardBody />
        </GhostCard>
        <GhostCard className="relative h-28 w-40 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)]">
          <GhostCardBody />
        </GhostCard>
      </div>
      <div>
        <p className="font-heading text-base font-semibold tracking-heading">
          Your library is empty
        </p>
        <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/** An image block plus two skeleton text bars, echoing an ItemCard's own
 * shape without needing real content — see GhostCard (ui/ghost-card.tsx)
 * for why this is neutral/monochrome rather than colorful. */
function GhostCardBody() {
  return (
    <>
      <div className="h-14 w-full rounded-md bg-foreground/8" />
      <GhostBar className="mt-2.5 w-3/4" />
      <GhostBar className="mt-1.5 w-1/2" />
    </>
  );
}

// Cycled, not random — a fixed pattern avoids a hydration mismatch
// between server and client render and still reads as "masonry" instead
// of a flat grid of identical boxes.
const SKELETON_HEIGHTS = [220, 160, 280, 190, 240, 170, 260, 200];

/** Shown in place of a blank pane while the very first fetch for a view
 * is in flight — the network round trip to this app's DB can take a
 * couple of seconds, and a blank content area during that reads as
 * "broken" far more than a skeleton does, even though the actual wait
 * is identical either way. */
function LibrarySkeleton({
  breakpoints,
}: {
  breakpoints: { default: number; [key: number]: number };
}) {
  const count = breakpoints.default * 3;
  return (
    <Masonry breakpointCols={breakpoints} className="masonry-grid" columnClassName="masonry-grid-column">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl bg-foreground/6"
          style={{ height: SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length] }}
        />
      ))}
    </Masonry>
  );
}

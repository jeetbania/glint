"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { animate } from "motion";
import { toast } from "sonner";
import {
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderOpen,
  Palette,
  Link as LucideLinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollectionActions } from "@/lib/use-collection-actions";
import { FOLDER_HUE_PALETTE, type FolderHue } from "@/lib/folder-color";
import { renderMenuActions, type MenuAction } from "@/components/ui/menu-actions";
import { GhostBar } from "@/components/ui/ghost-card";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { localFetch } from "@/lib/local/api";
import { useResolvedImageSrc } from "@/lib/local/blobs";
import { GLINT_ITEM_DRAG_TYPE } from "@/lib/drag-types";

type CollectionPreview = {
  id: string;
  name: string;
  slug: string;
  count: number;
  colorHue: number;
  previews: string[];
  hasNotesOrTasks: boolean;
  textLink: { url: string; domain: string | null; title: string | null; faviconUrl: string | null } | null;
};

// A folder's fanned preview slots — a real image thumbnail, a flat
// "ghost card" standing in for a note/task (which never has a thumbnail
// of its own), or a mini favicon+domain+title card for a link that has
// no scraped OG image to show as a real thumbnail (the same fallback
// item-card.tsx's LinkCardBody uses, shrunk to fit the fan). Ghost-card
// language matches the Notes/Tasks empty states (ui/ghost-card.tsx).
type PreviewSlot =
  | { kind: "image"; src: string }
  | { kind: "note" }
  | { kind: "link"; url: string; domain: string | null; title: string | null; faviconUrl: string | null };

// Colors: a single pastel hue per folder, rendered as translucent
// frosted glass (blur + partial opacity) rather than an opaque fill.
// Hue is persisted per-collection (collections.color_hue — assigned
// randomly at creation, editable live via the "Change color" menu below)
// rather than derived from list position, so it stays stable regardless
// of sort order and matches what the Notes/Tasks sidebars show for the
// same folder (lib/folder-color.ts).
const CARD_ASPECT = 426 / 362.09;

// The manila-folder-tab silhouette (from the user's own Paper mockup),
// used verbatim — the tab cutout at top-left isn't reproducible with a
// plain rounded rect + overflow-hidden, it needs the actual path. The
// second <path> in the source (a fully-transparent stroke overlay) is
// dropped as a no-op.
const FOLDER_TAB_PATH =
  "M0.000 23.430C-0.000 17.216 2.468 11.256 6.862 6.862C11.256 2.468 17.216 0.000 23.430 0.000C23.430 0.000 165.072 0.000 165.072 0.000C171.286 0.000 177.246 2.468 181.639 6.862C186.033 11.256 188.502 17.216 188.502 23.430C188.502 32.468 192.092 41.136 198.484 47.527C204.875 53.919 213.543 57.509 222.581 57.509C222.581 57.509 398.303 57.509 398.303 57.509C405.647 57.509 412.690 60.426 417.883 65.619C423.076 70.812 425.993 77.855 425.993 85.199C425.993 85.199 425.993 334.404 425.993 334.404C425.993 341.748 423.076 348.791 417.883 353.984C412.690 359.177 405.647 362.094 398.303 362.094C398.303 362.094 27.690 362.094 27.690 362.094C20.346 362.094 13.303 359.177 8.110 353.984C2.917 348.791 0.000 341.748 0.000 334.404C0.000 334.404 0.000 23.430 0.000 23.430Z";

// Fan-out hover animation for the peeking preview images — imperative
// animate() calls on refs (not declarative whileHover props), matching
// jeetcreates.cc's own Folder.tsx, since the declarative path glitches
// on first hover. Unchanged interaction from the previous pass; only
// the resting angles were tuned to echo the reference's ±4°/0° tilt.
const OPEN_SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;
const CLOSE_SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;
const REST = [
  { x: -34, y: 4, rotate: -4 },
  { x: 0, y: -6, rotate: 0 },
  { x: 34, y: 4, rotate: 4 },
];
const OPEN_POS = [
  { x: -46, y: -6, rotate: -10 },
  { x: 0, y: -20, rotate: 0 },
  { x: 46, y: -6, rotate: 10 },
];
const IMAGE_Z = [1, 2, 1]; // center paints on top, matching the reference

// A preview slot's image src is whatever's on the item — for a local
// image that's a `local-blob:` reference, not a renderable URL, so it
// needs resolving to a real object URL first (same as RecentThumb in
// command-palette.tsx). Pulled into its own component so the resolve
// hook runs once per slot rather than conditionally inside the .map().
function PreviewImage({ src }: { src: string }) {
  const resolved = useResolvedImageSrc(src);
  if (!resolved) return null;
  return <Image src={resolved} alt="" fill className="object-cover" unoptimized />;
}

function FolderTile({
  collection,
  active,
}: {
  collection: CollectionPreview;
  active: boolean;
}) {
  const { rename, remove, setColor } = useCollectionActions();
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [draft, setDraft] = useState(collection.name);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Anchors the color-picker Popover to the tile itself. Needed because
  // the picker is positioned with a real Popover (portaled to
  // document.body) rather than a plain absolutely-positioned sibling —
  // CollectionsRow's row wrapper has `overflow-x-auto`, which per the
  // CSS Overflow spec forces its computed overflow-y to non-`visible`
  // too, so anything positioned *inside* the row (like the old inline
  // picker) that pops below a tile's bottom edge gets silently clipped.
  // Portaling out of that row is what actually fixes it.
  const tileRef = useRef<HTMLDivElement | null>(null);

  // Up to 3 fanned slots. A note/task or an image-less link never has a
  // thumbnail, so without a stand-in slot either would be invisible in
  // the tile even though it's really in the collection — each gets one
  // slot (a note ghost-card / a mini link card) that bumps an image slot
  // out rather than the tile showing images-only and pretending there's
  // nothing else there. Placed first (the back-left/back-right fan
  // positions) so a real photo still gets the prominent centered spot
  // whenever one exists.
  const extraSlots: PreviewSlot[] = [];
  if (collection.hasNotesOrTasks) extraSlots.push({ kind: "note" });
  if (collection.textLink) extraSlots.push({ kind: "link", ...collection.textLink });
  const slots: PreviewSlot[] = [
    ...extraSlots,
    ...collection.previews.map((src): PreviewSlot => ({ kind: "image", src })),
  ].slice(0, 3);

  useEffect(() => {
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = REST[i] ?? REST[REST.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, { duration: 0 });
    });
  }, []);

  function open() {
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = OPEN_POS[i] ?? OPEN_POS[OPEN_POS.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, OPEN_SPRING);
    });
  }
  function close() {
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = REST[i] ?? REST[REST.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, CLOSE_SPRING);
    });
  }

  // Drag an item card here (from the Library grid) to file it into this
  // collection, without opening the item and using its tag editor.
  // Additive — reads the item's current collections first and appends
  // this one, rather than overwriting whatever it's already filed into.
  async function handleItemDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDropTarget(false);
    const itemId = e.dataTransfer.getData(GLINT_ITEM_DRAG_TYPE);
    if (!itemId) return;
    try {
      const res = await localFetch(`/api/items/${itemId}`);
      if (!res.ok) throw new Error("Item not found");
      const { item } = (await res.json()) as { item: { collections: { name: string }[] } };
      const existingNames = item.collections.map((c) => c.name);
      if (existingNames.includes(collection.name)) {
        toast(`Already in ${collection.name}`);
        return;
      }
      const patchRes = await localFetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections: [...existingNames, collection.name] }),
      });
      if (!patchRes.ok) throw new Error("Failed to save");
      toast.success(`Added to ${collection.name}`);
      void globalMutate((key) => typeof key === "string" && key.startsWith("/api/items"));
      void globalMutate("/api/collections");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that to the collection");
    }
  }

  async function submitRename() {
    setIsRenaming(false);
    if (draft.trim() === collection.name || !draft.trim()) {
      setDraft(collection.name);
      return;
    }
    const ok = await rename(collection.id, collection.slug, draft);
    if (!ok) setDraft(collection.name);
  }

  const actions: MenuAction[] = [
    {
      label: "Open",
      icon: FolderOpen,
      onClick: () => router.push(`/collections/${collection.slug}`),
    },
    {
      label: "Rename",
      icon: Pencil,
      onClick: () => {
        setDraft(collection.name);
        setIsRenaming(true);
      },
    },
    {
      label: "Change color",
      icon: Palette,
      onClick: () => setIsPickingColor(true),
    },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => remove(collection.slug, collection.name),
    },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {/* The Link is a full-cover sibling underneath everything else,
            not a wrapper — the kebab button below needs its own click
            target, and a <button> nested inside an <a> is invalid HTML
            (and risks the click bubbling into Link's navigation despite
            preventDefault). Every visual layer above the Link is
            pointer-events-none by default so clicks fall through to it,
            except the couple of controls that opt back in explicitly. */}
        <div
          ref={tileRef}
          onPointerEnter={open}
          onPointerLeave={close}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(GLINT_ITEM_DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!isDropTarget) setIsDropTarget(true);
          }}
          onDragLeave={(e) => {
            // dragleave bubbles from every child too (the Link, the SVG,
            // the info panel...), so a naive "leave -> unset" flickers
            // the ring off and on as the pointer crosses those internal
            // boundaries while still hovering the same tile. Only really
            // left once the related target (where the pointer is
            // headed) is outside this tile entirely.
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setIsDropTarget(false);
          }}
          onDrop={(e) => void handleItemDrop(e)}
          style={{ "--folder-hue": collection.colorHue, aspectRatio: CARD_ASPECT } as React.CSSProperties}
          className={cn(
            "group relative w-64 shrink-0 rounded-[18px] shadow-[0_10px_14px_-8px_rgba(0,0,0,0.18),0_3px_5px_-2px_rgba(0,0,0,0.1)] transition-transform duration-150 [perspective:800px] hover:scale-[1.02]",
            active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            isDropTarget && "scale-[1.04] ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}
        >
          {/* Clipped layer — everything that must not bleed past the
              card's rounded silhouette. Deliberately NOT the same node
              as the shadow/hover-scale above: `overflow-hidden` on an
              element clips its own box-shadow too, which was cutting
              the card's drop shadow off at the bottom. Keeping the clip
              on this inner wrapper instead lets the outer box cast its
              shadow freely. */}
          <div className="absolute inset-0 overflow-hidden rounded-[18px]">
            <Link
              href={isRenaming ? "#" : `/collections/${collection.slug}`}
              onClick={(e) => isRenaming && e.preventDefault()}
              aria-label={collection.name}
              className="absolute inset-0 z-0"
            />

            {/* Manila-folder-tab silhouette — the folder itself. */}
            <svg
              aria-hidden
              viewBox="0 0 426 362.09"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            >
              <path
                d={FOLDER_TAB_PATH}
                style={{
                  fill: "color-mix(in oklch, oklch(var(--folder-l) var(--folder-c) var(--folder-hue)) calc(var(--folder-alpha) * 100%), transparent)",
                }}
              />
            </svg>

            {/* Info panel — a genuinely separate frosted-glass layer (not
                just a gradient scrim), overlapping the previews' lower
                edge so they read as tucked behind it. Deliberately kept a
                fixed dark tint (not the reference's near-white one) so
                white text stays legible regardless of the site's own
                light/dark theme — see globals.css. */}
            <div className="folder-card-info pointer-events-none absolute inset-x-0 bottom-0 top-[32%] z-[2] flex flex-col justify-between rounded-[18px] p-4">
              {isRenaming ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") submitRename();
                    if (e.key === "Escape") {
                      setDraft(collection.name);
                      setIsRenaming(false);
                    }
                  }}
                  onBlur={submitRename}
                  className="pointer-events-auto min-w-0 rounded bg-white/15 px-1 -mx-1 font-heading text-xl font-medium tracking-heading text-white outline-none"
                />
              ) : (
                <p className="truncate font-heading text-xl font-medium tracking-heading text-white">
                  {collection.name}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-base tracking-heading text-white/70">
                  {collection.count} {collection.count === 1 ? "save" : "saves"}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`More options for ${collection.name}`}
                        className="glass-pill pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full text-foreground opacity-0 transition-opacity hover:brightness-105 group-hover:opacity-100 data-popup-open:opacity-100"
                      />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {renderMenuActions(actions, DropdownMenuItem, DropdownMenuShortcut)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Fanned previews, peeking out of the tab — a sibling of the
              clipped layer above (not inside it), so they're free to
              rise past the card's own top edge on hover instead of
              getting hard-clipped there. Still anchored to the upper
              ~58% so they tuck behind the info panel below at rest. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-[58%] items-end justify-center pb-2">
            {slots.length > 0 ? (
              slots.map((slot, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    imgRefs.current[i] = el;
                  }}
                  className={cn(
                    "absolute h-28 w-24 rounded-[10px] shadow-[0_3px_5.5px_rgba(0,0,0,0.16),0_1px_2px_rgba(0,0,0,0.1)] will-change-transform",
                    slot.kind === "image"
                      ? "overflow-hidden"
                      // Top-anchored (not centered/bottom), same reason the
                      // image slots' most legible content is naturally at
                      // rest near the top: the card's own bottom third
                      // gets tucked behind the folder's frosted info panel
                      // (see below), so content anchored to the bottom
                      // would render there and effectively disappear.
                      : "flex flex-col gap-1.5 border border-border/60 bg-card p-2",
                  )}
                  style={{
                    zIndex: IMAGE_Z[i] ?? 1,
                    transform: `translate(${REST[i]?.x ?? 0}px, ${REST[i]?.y ?? 0}px) rotate(${REST[i]?.rotate ?? 0}deg)`,
                  }}
                >
                  {slot.kind === "image" ? (
                    <PreviewImage src={slot.src} />
                  ) : slot.kind === "link" ? (
                    <>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {slot.faviconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slot.faviconUrl} alt="" className="size-3 shrink-0 rounded-sm" />
                        ) : (
                          <LucideLinkIcon className="size-3 shrink-0" />
                        )}
                        <span className="truncate">{slot.domain ?? slot.url}</span>
                      </div>
                      <p className="line-clamp-3 text-[11px] font-medium leading-snug">
                        {slot.title ?? slot.url}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-0.5 h-2 w-3/4 rounded-full bg-foreground/20" />
                      <GhostBar className="w-full" />
                      <GhostBar className="w-2/3" />
                    </>
                  )}
                </div>
              ))
            ) : (
              <Folder className="mb-4 size-8 text-white/80" />
            )}
          </div>

        </div>

        {/* Color picker — a real Popover, anchored to the tile via
            `tileRef` rather than wrapping a visible trigger (there isn't
            one; "Change color" lives inside the existing dropdown/context
            menu above instead). Portals to document.body, which is what
            actually keeps it visible — see the tileRef comment above.
            Only ever writes --folder-hue's underlying value via the same
            PATCH -> mutate() path rename already uses — the blur/glass
            CSS itself (backdrop-filter, the translucent color-mix
            recipe) never changes, just which hue custom property feeds
            it, so there's no way this can break the glass effect the way
            a bug that touched the actual glass rules could. */}
        <Popover open={isPickingColor} onOpenChange={setIsPickingColor}>
          <PopoverContent
            anchor={tileRef}
            align="center"
            sideOffset={8}
            className="flex w-44 flex-wrap justify-center gap-2 p-3"
          >
            {FOLDER_HUE_PALETTE.map((paletteHue) => (
              <button
                key={paletteHue}
                type="button"
                aria-label={`Set folder color to hue ${paletteHue}`}
                onClick={async () => {
                  setIsPickingColor(false);
                  await setColor(collection.slug, paletteHue as FolderHue);
                }}
                className={cn(
                  "size-7 shrink-0 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                  collection.colorHue === paletteHue && "ring-2 ring-foreground",
                )}
                style={{
                  background: `oklch(var(--folder-l) var(--folder-c) ${paletteHue})`,
                }}
              />
            ))}
          </PopoverContent>
        </Popover>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** "Folder" tiles for the reference app's Collections concept — a
 * lightweight, user-named grouping shown as a horizontal row above the
 * Library grid. Clicking one opens its dedicated infinite-canvas space
 * (see /collections/[slug]), not an inline filter. */
export function CollectionsRow({ activeSlug }: { activeSlug?: string | null }) {
  const { data, mutate } = useSWR<{ collections: CollectionPreview[] }>(
    "/api/collections",
  );
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const collections = data?.collections ?? [];

  async function submitCreate() {
    const name = draft.trim();
    setCreating(false);
    setDraft("");
    if (!name) return;
    await localFetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    mutate();
  }

  return (
    // `shrink-0` is load-bearing, not decorative: LibraryView's root is a
    // fixed-height column flex container, and `overflow-x-auto` here
    // forces `overflow-y` to also compute as non-`visible` per the CSS
    // Overflow spec — which strips this row's flexbox automatic minimum
    // height, letting the masonry grid below squeeze it down to a
    // near-zero sliver instead of its real tile height.
    <div data-tour="collections" className="flex shrink-0 items-end gap-4 overflow-x-auto px-6 pb-1 pt-8">
      {collections.map((c) => (
        <FolderTile key={c.id} collection={c} active={activeSlug === c.slug} />
      ))}

      {creating ? (
        <div
          style={{ aspectRatio: CARD_ASPECT }}
          className="glass-panel flex w-64 shrink-0 flex-col items-center justify-center gap-2 rounded-[18px] p-3"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setDraft("");
              }
            }}
            onBlur={submitCreate}
            placeholder="Collection name"
            className="w-full rounded-md bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{ aspectRatio: CARD_ASPECT }}
          className="flex w-64 shrink-0 flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-border/60 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}

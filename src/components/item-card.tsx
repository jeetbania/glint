"use client";

import Image from "next/image";
import {
  FileText,
  CheckSquare,
  Link as LinkIcon,
  Maximize2,
  ExternalLink,
  Copy,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useItemActions } from "@/lib/use-item-actions";
import { renderMenuActions, type MenuAction } from "@/components/ui/menu-actions";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ApiItem } from "@/types/item";

export function ItemCard({
  item,
  onClick,
  onColorClick,
}: {
  item: ApiItem;
  onClick: () => void;
  /** Clicking the color dot on an image card filters the Library by
   * that image's dominant color family instead of opening the item. */
  onColorClick?: (colorFamily: string) => void;
}) {
  const hasVisual =
    item.type === "image" || (item.type === "link" && !!item.previewImageUrl);
  const { remove, copyLink, download } = useItemActions();

  const hasDownload = !!(item.blobUrl ?? item.previewImageUrl);
  const actions: MenuAction[] = [
    { label: "Open", icon: Maximize2, onClick },
    ...(item.url
      ? [{ label: "Copy link", icon: Copy, onClick: () => copyLink(item) }]
      : []),
    ...(item.url
      ? [
          {
            label: "Open original",
            icon: ExternalLink,
            onClick: () => window.open(item.url!, "_blank", "noreferrer"),
          },
        ]
      : []),
    ...(hasDownload
      ? [{ label: "Download", icon: Download, onClick: () => download(item) }]
      : []),
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => remove(item),
    },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group relative block w-full overflow-hidden rounded-xl text-left shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_-12px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !hasVisual && "glass-panel",
          )}
        >
          {item.type === "image" && item.blobUrl && (
            <ImageCardBody item={item} onColorClick={onColorClick} />
          )}
          {item.type === "link" && <LinkCardBody item={item} />}
          {item.type === "note" && <NoteCardBody item={item} />}
          {item.type === "task" && <TaskCardBody item={item} />}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions.slice(0, -1), ContextMenuItem, ContextMenuShortcut)}
        <ContextMenuSeparator />
        {renderMenuActions(actions.slice(-1), ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Floating corner controls that appear on card hover, over image/preview
 * content — a selection affordance top-left and an explicit "expand"
 * hint bottom-right, both rendered as neutral glass circles so they read
 * against any image regardless of its own colors. No bottom scrim — the
 * hover state is communicated by lift + shadow only (see ItemCard). */
function HoverControls({ showSelect = true }: { showSelect?: boolean }) {
  return (
    <>
      {showSelect && (
        <span
          aria-hidden
          className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full border border-white/25 bg-black/35 opacity-0 backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100"
        >
          <span className="size-3 rounded-full border-[1.5px] border-white/80" />
        </span>
      )}
      <span
        aria-hidden
        className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full border border-white/25 bg-black/35 opacity-0 backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100"
      >
        <Maximize2 className="size-3.5 text-white" />
      </span>
    </>
  );
}

function TypeIcon({
  icon: Icon,
  gradient,
}: {
  icon: typeof FileText;
  gradient: "gradient-peach" | "gradient-lavender" | "gradient-sage";
}) {
  return (
    <span
      className={cn(
        "flex size-4.5 items-center justify-center rounded-full",
        gradient,
      )}
    >
      <Icon className="size-2.5 text-white" />
    </span>
  );
}

function ImageCardBody({
  item,
  onColorClick,
}: {
  item: ApiItem;
  onColorClick?: (colorFamily: string) => void;
}) {
  const ratio =
    item.width && item.height ? item.width / item.height : 4 / 3;

  return (
    <div className="relative w-full" style={{ aspectRatio: ratio }}>
      <Image
        src={item.blobUrl!}
        alt={item.title ?? "Saved image"}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover"
        unoptimized
      />
      <ColorDot item={item} onColorClick={onColorClick} />
      <HoverControls showSelect={false} />
    </div>
  );
}

/** Shows the image's own extracted dominant color as a small always-on
 * swatch — both a quick visual cue (scanning a grid, colors read at a
 * glance) and a one-click shortcut into the existing color filter
 * (FilterMenu) for that color family, without opening the dropdown.
 * A <span role="button"> rather than a real <button>: this renders
 * inside ItemCard's own outer <button>, and a nested <button> is
 * invalid HTML (see collections-row.tsx for the same footgun). */
function ColorDot({
  item,
  onColorClick,
}: {
  item: ApiItem;
  onColorClick?: (colorFamily: string) => void;
}) {
  const hex = item.dominantColors?.[0]?.hex;
  const family = item.colorFamily?.[0];
  if (!hex || !family || !onColorClick) return null;

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Filter by ${family}`}
      title={`Filter by ${family}`}
      onClick={(e) => {
        e.stopPropagation();
        onColorClick(family);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onColorClick(family);
        }
      }}
      className="absolute left-2 top-2 size-4 cursor-pointer rounded-full border-2 border-white/80 shadow-[0_1px_4px_rgba(0,0,0,0.4)] transition-transform hover:scale-125"
      style={{ backgroundColor: hex }}
    />
  );
}

function LinkCardBody({ item }: { item: ApiItem }) {
  if (item.previewImageUrl) {
    return (
      <div className="relative aspect-video w-full bg-muted">
        <Image
          src={item.previewImageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          unoptimized
        />
        <div className="absolute left-2 top-2 flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 backdrop-blur-sm">
          {item.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.faviconUrl} alt="" className="size-3 shrink-0 rounded-sm" />
          ) : (
            <LinkIcon className="size-3 shrink-0 text-white" />
          )}
          <span className="truncate text-[11px] font-medium text-white">
            {item.domain ?? item.url}
          </span>
        </div>
        <HoverControls showSelect={false} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {item.faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.faviconUrl} alt="" className="size-3.5 rounded-sm" />
        ) : (
          <TypeIcon icon={LinkIcon} gradient="gradient-lavender" />
        )}
        <span className="truncate">{item.domain ?? item.url}</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium">
        {item.title ?? item.url}
      </p>
      <TagRow item={item} />
    </div>
  );
}

function TagRow({ item }: { item: ApiItem }) {
  if (item.tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {item.tags.slice(0, 4).map((tag) => (
        <span
          key={tag.id}
          className="rounded-full bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function NoteCardBody({ item }: { item: ApiItem }) {
  return (
    <div className="space-y-1.5 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TypeIcon icon={FileText} gradient="gradient-peach" />
        Note
      </div>
      {item.title && <p className="text-sm font-medium">{item.title}</p>}
      {item.bodyText && (
        <p className="line-clamp-5 whitespace-pre-wrap text-sm text-muted-foreground">
          {item.bodyText}
        </p>
      )}
      <TagRow item={item} />
    </div>
  );
}

function TaskCardBody({ item }: { item: ApiItem }) {
  return (
    <div className="space-y-1.5 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TypeIcon icon={CheckSquare} gradient="gradient-sage" />
        Task
      </div>
      <p className="text-sm font-medium">{item.title}</p>
      <TagRow item={item} />
    </div>
  );
}

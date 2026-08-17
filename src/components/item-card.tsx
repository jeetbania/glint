"use client";

import Image from "next/image";
import { FileText, CheckSquare, Link as LinkIcon, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiItem } from "@/types/item";

export function ItemCard({
  item,
  onClick,
}: {
  item: ApiItem;
  onClick: () => void;
}) {
  const hasVisual =
    item.type === "image" || (item.type === "link" && !!item.previewImageUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative block w-full overflow-hidden rounded-xl text-left shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !hasVisual && "glass-panel",
      )}
    >
      {item.type === "image" && item.blobUrl && <ImageCardBody item={item} />}
      {item.type === "link" && <LinkCardBody item={item} />}
      {item.type === "note" && <NoteCardBody item={item} />}
      {item.type === "task" && <TaskCardBody item={item} />}
    </button>
  );
}

function HoverScrim({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/10 to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      {children}
    </div>
  );
}

/** Floating corner controls that appear on card hover, over image/preview
 * content — a selection affordance top-left and an explicit "expand"
 * hint bottom-right, both rendered as neutral glass circles so they read
 * against any image regardless of its own colors. */
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

function ImageCardBody({ item }: { item: ApiItem }) {
  const ratio =
    item.width && item.height ? item.width / item.height : 4 / 3;
  const hasTags = item.tags.length > 0;
  const hasColors = (item.dominantColors?.length ?? 0) > 0;

  return (
    <div className="relative w-full" style={{ aspectRatio: ratio }}>
      <Image
        src={item.blobUrl!}
        alt={item.title ?? "Saved image"}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        unoptimized
      />
      <HoverControls />
      {(hasTags || hasColors) && (
        <HoverScrim>
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
              >
                {tag.name}
              </span>
            ))}
          </div>
          {hasColors && (
            <div className="flex shrink-0 gap-1">
              {item.dominantColors!.slice(0, 4).map((c, i) => (
                <span
                  key={i}
                  className="size-2.5 rounded-full ring-1 ring-white/60"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </HoverScrim>
      )}
    </div>
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
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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
        <HoverScrim>
          <p className="line-clamp-2 text-xs font-medium text-white">
            {item.title ?? item.url}
          </p>
        </HoverScrim>
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

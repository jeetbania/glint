"use client";

import Image from "next/image";
import { FileText, CheckSquare, Link as LinkIcon } from "lucide-react";
import type { ApiItem } from "@/types/item";

export function ItemCard({
  item,
  onClick,
}: {
  item: ApiItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {item.type === "image" && item.blobUrl && (
        <ImageCardBody item={item} />
      )}
      {item.type === "link" && <LinkCardBody item={item} />}
      {item.type === "note" && <NoteCardBody item={item} />}
      {item.type === "task" && <TaskCardBody item={item} />}

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-3 pt-1">
          {item.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function ImageCardBody({ item }: { item: ApiItem }) {
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
      {item.dominantColors && item.dominantColors.length > 0 && (
        <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {item.dominantColors.slice(0, 5).map((c, i) => (
            <span
              key={i}
              className="size-3 rounded-full ring-1 ring-white/70"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkCardBody({ item }: { item: ApiItem }) {
  return (
    <div>
      {item.previewImageUrl && (
        <div className="relative aspect-video w-full bg-muted">
          <Image
            src={item.previewImageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="space-y-1 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.faviconUrl} alt="" className="size-3.5" />
          ) : (
            <LinkIcon className="size-3.5" />
          )}
          <span className="truncate">{item.domain ?? item.url}</span>
        </div>
        <p className="line-clamp-2 text-sm font-medium">
          {item.title ?? item.url}
        </p>
      </div>
    </div>
  );
}

function NoteCardBody({ item }: { item: ApiItem }) {
  return (
    <div className="space-y-1 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="size-3.5" />
        Note
      </div>
      {item.title && <p className="text-sm font-medium">{item.title}</p>}
      {item.bodyText && (
        <p className="line-clamp-5 whitespace-pre-wrap text-sm text-muted-foreground">
          {item.bodyText}
        </p>
      )}
    </div>
  );
}

function TaskCardBody({ item }: { item: ApiItem }) {
  return (
    <div className="space-y-1 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckSquare className="size-3.5" />
        Task
      </div>
      <p className="text-sm font-medium">{item.title}</p>
    </div>
  );
}

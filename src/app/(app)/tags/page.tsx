"use client";

import Link from "next/link";
import useSWR from "swr";
import { Tag } from "lucide-react";
import type { ApiTag } from "@/types/item";

type TagWithCount = ApiTag & { count: number };

// Tags now live in this browser's own IndexedDB (see lib/local/*), not a
// server DB — there's no build-time snapshot to worry about serving
// stale, so this is a plain client fetch instead of a force-dynamic
// Server Component reading the DB directly.
export default function TagsPage() {
  const { data, isLoading } = useSWR<{ tags: TagWithCount[] }>("/api/tags");
  const tags = data?.tags ?? [];

  if (!isLoading && tags.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Tag className="size-6" />
        No tags yet. Add tags to items from the Library to see them here.
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <h1 className="mb-5 font-heading text-lg font-semibold tracking-heading">
        Tags
      </h1>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/library?tag=${tag.slug}`}
            className="glass-pill px-3 py-1.5 text-sm text-foreground transition-all hover:brightness-105"
          >
            {tag.name}{" "}
            <span className="text-muted-foreground">· {tag.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

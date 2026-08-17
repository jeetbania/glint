"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import useSWR from "swr";
import { Folder, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type CollectionPreview = {
  id: string;
  name: string;
  slug: string;
  count: number;
  previews: string[];
};

/** Glass "folder" tiles for the reference app's Collections concept —
 * a lightweight, user-named grouping shown as a horizontal row above the
 * Library grid, styled like the rest of the app's glass surfaces. */
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
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    mutate();
  }

  return (
    <div className="flex gap-3 overflow-x-auto px-6 pb-1 pt-6">
      {collections.map((c) => (
        <Link
          key={c.id}
          href={`/library?collection=${c.slug}`}
          className={cn(
            "glass-panel group flex h-28 w-44 shrink-0 flex-col overflow-hidden rounded-xl transition-all hover:brightness-105",
            activeSlug === c.slug && "ring-2 ring-primary",
          )}
        >
          <div className="relative flex h-16 shrink-0 gap-px overflow-hidden bg-foreground/4">
            {c.previews.length > 0 ? (
              c.previews.slice(0, 2).map((src, i) => (
                <div key={i} className="relative flex-1">
                  <Image src={src} alt="" fill className="object-cover" unoptimized />
                </div>
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Folder className="size-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 px-3 py-2">
            <p className="truncate text-sm font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.count} saves</p>
          </div>
        </Link>
      ))}

      {creating ? (
        <div className="glass-panel flex h-28 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-xl p-3">
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
          className="glass-panel flex h-28 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground transition-all hover:brightness-105"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}

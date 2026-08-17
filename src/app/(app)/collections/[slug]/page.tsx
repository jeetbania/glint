"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { CollectionCanvas } from "@/components/collection-canvas";
import { ItemDetailDialog } from "@/components/item-detail-dialog";
import type { ApiItem } from "@/types/item";

type CollectionDetail = {
  collection: { id: string; name: string; slug: string };
  items: ApiItem[];
  positions: Record<string, { x: number; y: number; w: number; h: number; zIndex: number }>;
};

export default function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data } = useSWR<CollectionDetail>(`/api/collections/${slug}`);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 px-6 pb-1 pt-3">
        <Link
          href="/library"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
          aria-label="Back to Library"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-lg font-semibold tracking-heading">
            {data?.collection.name ?? "Collection"}
          </h1>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.items.length} {data.items.length === 1 ? "item" : "items"}
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {data && data.items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Nothing in this collection yet. Add items to it from the Library.
          </div>
        ) : data ? (
          <CollectionCanvas
            items={data.items}
            positions={data.positions}
            collectionSlug={slug}
            onItemClick={setSelectedItemId}
          />
        ) : null}
      </div>

      <ItemDetailDialog
        itemId={selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </div>
  );
}

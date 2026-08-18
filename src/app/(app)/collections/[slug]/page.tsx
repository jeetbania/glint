"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { CollectionCanvas } from "@/components/collection-canvas";
import { ItemDetailDialog } from "@/components/item-detail-dialog";
import type { ApiItem } from "@/types/item";
import type { ApiCanvasObject } from "@/types/canvas-object";

type CollectionDetail = {
  collection: { id: string; name: string; slug: string };
  items: ApiItem[];
  positions: Record<string, { x: number; y: number; w: number; h: number; zIndex: number }>;
  canvasObjects: ApiCanvasObject[];
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
        {data ? (
          <CollectionCanvas
            key={slug}
            items={data.items}
            positions={data.positions}
            canvasObjects={data.canvasObjects}
            collectionSlug={slug}
            collectionName={data.collection.name}
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

import Link from "next/link";
import { Tag } from "lucide-react";
import { listTagsWithCounts } from "@/lib/items";

// Tag counts change on every paste — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = (await listTagsWithCounts()).filter((t) => t.count > 0);

  if (tags.length === 0) {
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

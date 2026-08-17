import Link from "next/link";
import { Tag } from "lucide-react";
import { listTagsWithCounts } from "@/lib/items";

export default async function TagsPage() {
  const tags = await listTagsWithCounts();

  if (tags.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Tag className="size-6" />
        No tags yet. Add tags to items from the Library to see them here.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Tags</h1>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/library?tag=${tag.slug}`}
            className="rounded-full bg-muted px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/70"
          >
            {tag.name}{" "}
            <span className="text-muted-foreground">· {tag.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { LibraryView } from "@/components/library-view";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; color?: string; collection?: string }>;
}) {
  const { tag, color, collection } = await searchParams;
  return (
    <LibraryView
      initialTag={tag ?? null}
      initialColor={color ?? null}
      initialCollection={collection ?? null}
      showCollections
    />
  );
}

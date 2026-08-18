import { LibraryView } from "@/components/library-view";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; color?: string; item?: string }>;
}) {
  const { tag, color, item } = await searchParams;
  return (
    <LibraryView
      initialTag={tag ?? null}
      initialColor={color ?? null}
      initialItemId={item ?? null}
      showCollections
    />
  );
}

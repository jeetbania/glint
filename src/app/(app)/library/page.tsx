import { LibraryView } from "@/components/library-view";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; color?: string }>;
}) {
  const { tag, color } = await searchParams;
  return (
    <LibraryView initialTag={tag ?? null} initialColor={color ?? null} showCollections />
  );
}

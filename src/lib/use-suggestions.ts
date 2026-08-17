import useSWR from "swr";

/** Existing collection/tag names, for TagEditor's autocomplete dropdown
 * — reuses the same SWR keys already fetched elsewhere in the app
 * (FilterMenu, the Notes sidebar, …), so this is a cache hit, not an
 * extra request, on any page where those are already mounted. */
export function useCollectionNames(): string[] {
  const { data } = useSWR<{ collections: { name: string }[] }>(
    "/api/collections",
  );
  return data?.collections.map((c) => c.name) ?? [];
}

export function useTagNames(): string[] {
  const { data } = useSWR<{ tags: { name: string }[] }>("/api/tags");
  return data?.tags.map((t) => t.name) ?? [];
}

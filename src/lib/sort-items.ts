import type { SortValue } from "@/components/sort-menu";
import type { ApiItem } from "@/types/item";

/** Shared comparator behind the Notes/Tasks list sort menus — the same
 * three orderings the Library grid already offers (SortMenu is reused
 * as-is), applied client-side here since these two views already hold
 * their full item list in memory for search/grouping. */
export function sortItems(items: ApiItem[], sort: SortValue): ApiItem[] {
  const arr = [...items];
  if (sort === "name-asc") {
    return arr.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }
  if (sort === "recent-asc") {
    return arr.sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
  }
  return arr.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

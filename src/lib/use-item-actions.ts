import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSound } from "@/lib/use-sound";
import type { ApiItem } from "@/types/item";

/** Delete/copy-link/download for a saved item — the same three actions
 * item-detail-dialog.tsx already offers, pulled out so item-card's new
 * context menu doesn't need the whole dialog open just to delete or grab
 * a link. */
export function useItemActions() {
  const { mutate } = useSWRConfig();
  const play = useSound();

  const refreshLibrary = () =>
    mutate((key) => typeof key === "string" && key.startsWith("/api/items"));

  async function remove(item: ApiItem) {
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete that item");
      return;
    }
    play("delete");
    toast.success("Deleted");
    void refreshLibrary();
  }

  async function copyLink(item: ApiItem) {
    const value = item.url ?? item.blobUrl;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  }

  function download(item: ApiItem) {
    const href = item.blobUrl ?? item.previewImageUrl;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = item.title ?? "";
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  return { remove, copyLink, download, refreshLibrary };
}

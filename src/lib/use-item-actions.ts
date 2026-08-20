import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSound } from "@/lib/use-sound";
import type { ApiItem } from "@/types/item";
import { localFetch } from "@/lib/local/api";
import { isLocalBlobRef, resolveBlobSrc } from "@/lib/local/blobs";

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
    const res = await localFetch(`/api/items/${item.id}`, { method: "DELETE" });
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
    // A local-blob reference isn't a real, shareable link — it's a
    // pointer into this browser's own storage that means nothing
    // outside this device (and won't even survive a reload). Say so
    // instead of copying something that looks like a link but isn't one.
    if (isLocalBlobRef(value)) {
      toast("This image is stored only on this device", {
        description: "There's no link to share — download it instead.",
      });
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  }

  async function download(item: ApiItem) {
    const raw = item.blobUrl ?? item.previewImageUrl;
    if (!raw) return;
    const href = await resolveBlobSrc(raw);
    if (!href) {
      toast.error("Couldn't find that image");
      return;
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = item.title ?? "";
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  return { remove, copyLink, download, refreshLibrary };
}

import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSound } from "@/lib/use-sound";
import type { FolderHue } from "@/lib/folder-color";

/** Rename/recolor/delete for a Collection, shared between every surface
 * that shows one (the Library folder row, the Notes sidebar's folder
 * list) so the fetch calls, cache invalidation, and toasts only exist
 * once. */
export function useCollectionActions() {
  const { mutate } = useSWRConfig();
  const play = useSound();

  async function rename(id: string, slug: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const res = await fetch(`/api/collections/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      toast.error("Couldn't rename that folder");
      return false;
    }
    void mutate("/api/collections");
    return true;
  }

  /** Live color change — same PATCH endpoint as rename, just the other
   * field. No optimistic update: this is a single cheap field write, and
   * mutate()'s own revalidation lands well within one interaction, not
   * worth the complexity of rolling back an optimistic color on failure. */
  async function setColor(slug: string, colorHue: FolderHue) {
    const res = await fetch(`/api/collections/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colorHue }),
    });
    if (!res.ok) {
      toast.error("Couldn't change that folder's color");
      return false;
    }
    void mutate("/api/collections");
    return true;
  }

  async function remove(slug: string, name: string) {
    const res = await fetch(`/api/collections/${slug}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete that folder");
      return;
    }
    play("delete");
    toast.success(`Deleted "${name}"`);
    void mutate("/api/collections");
  }

  return { rename, remove, setColor };
}

"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { localFetch } from "@/lib/local/api";
import { putBlob, localBlobRef } from "@/lib/local/blobs";
import { extractImageColors } from "@/lib/color-extraction-client";
import { readImageDimensions } from "@/lib/use-capture-ingest";
import { enrichSavedImage } from "@/lib/auto-enrich-image";

/** What content-script.js relays in from the extension's background
 * worker — see browser-extension/background.js for the other half. */
type ExtensionSavePayload =
  | { kind: "link"; url: string; title?: string }
  | {
      kind: "image";
      title?: string;
      mimeType: string;
      bytes: ArrayBuffer;
      fileName?: string;
    };

/**
 * Mounted once in the (app) layout — deliberately NOT present on /login
 * or /landingpage, even though content-script.js is injected across the
 * whole Glint origin (its match pattern has no way to distinguish
 * authenticated pages from the login screen). That mismatch is exactly
 * why every `glint-extension-save` this component handles gets ack'd
 * back with a matching id (see the `finally` block below): without it,
 * background.js has no way to tell "delivered to a real listening app
 * tab" apart from "delivered to a /login tab where nothing was
 * listening," and would report a save as successful when it silently
 * went nowhere.
 *
 * Now that saved items live only in this browser's IndexedDB (see
 * lib/local/*), the extension can't just POST to a server API and let
 * the DB fan it out anymore — the actual write has to happen HERE, in an
 * already-open (and authenticated) Glint tab, using this app's own local
 * data layer. content-script.js relays a message from the background
 * service worker into a `glint-extension-save` DOM CustomEvent (a
 * content script runs in an isolated JS world and can't call this app's
 * functions directly, but window.dispatchEvent crosses that boundary
 * fine — it's just a DOM event). If no Glint tab was open (or open but
 * unauthenticated) when something got saved, background.js queues it and
 * content-script.js asks for the backlog the next time a tab loads,
 * which arrives here the same way.
 */
export function ExtensionSyncProvider() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    async function handleSave(event: Event) {
      const detail = (event as CustomEvent<{ id: string; payload: ExtensionSavePayload }>).detail;
      if (!detail) return;
      const { id, payload } = detail;
      let success = false;
      console.log(`[glint-extension-sync] received ${payload.kind} save, id=${id}`);

      try {
        if (payload.kind === "link") {
          const res = await localFetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "link",
              url: payload.url,
              title: payload.title || undefined,
            }),
          });
          if (!res.ok) throw new Error("Failed to save link");
        } else {
          const blob = new Blob([payload.bytes], { type: payload.mimeType });
          const [colors, dims, blobId] = await Promise.all([
            extractImageColors(
              new File([blob], payload.fileName || "image", { type: payload.mimeType }),
            ),
            readImageDimensions(blob),
            putBlob(blob, payload.mimeType),
          ]);
          const res = await localFetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "image",
              title: payload.title || undefined,
              blobUrl: localBlobRef(blobId),
              blobPathname: blobId,
              width: dims.width || undefined,
              height: dims.height || undefined,
              fileSizeBytes: blob.size,
              mimeType: payload.mimeType,
              dominantColors: colors?.dominantColors ?? [],
              colorFamily: colors?.colorFamily ?? [],
            }),
          });
          if (!res.ok) throw new Error("Failed to save image");
          const { item } = await res.json();
          void enrichSavedImage(item.id, blob).then(() =>
            mutate((key) => typeof key === "string" && key.startsWith("/api/items")),
          );
        }
        toast.success("Saved from the extension", { duration: 2500 });
        void mutate((key) => typeof key === "string" && key.startsWith("/api/items"));
        success = true;
        console.log(`[glint-extension-sync] id=${id} saved successfully`);
      } catch (error) {
        console.error(`[extension-sync] id=${id} failed`, error);
        toast.error("Couldn't save something the extension sent over");
      } finally {
        if (id) {
          window.dispatchEvent(new CustomEvent("glint-extension-save-result", { detail: { id, success } }));
        }
      }
    }

    window.addEventListener("glint-extension-save", handleSave);
    return () => window.removeEventListener("glint-extension-save", handleSave);
  }, [mutate]);

  return null;
}

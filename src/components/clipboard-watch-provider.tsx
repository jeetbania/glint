"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isTauri } from "@/lib/is-tauri";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useCaptureIngest, asUrl } from "@/lib/use-capture-ingest";
import { showLinkSaveToast } from "@/components/link-save-toast";

type ClipboardCapture = { kind: "image" | "text"; data: string };

function base64PngToFile(base64: string): File {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new File([bytes], `clipboard-${Date.now()}.png`, { type: "image/png" });
}

/**
 * Tauri-only: watches the OS clipboard (via a Rust background poller in
 * src-tauri/src/lib.rs, emitting a `clipboard-changed` event) and offers
 * to save new screenshots/links/text even when the app isn't focused —
 * not possible from a plain web page, since browsers deliberately don't
 * allow passive background clipboard access for security reasons. Reuses
 * the exact same ingest path as in-app paste capture (useCaptureIngest),
 * so a clipboard-watch save and a Cmd+V paste behave identically.
 */
export function ClipboardWatchProvider() {
  const { ingestImage, ingestText } = useCaptureIngest();
  const [enabled] = useLocalStorage("glint:settings:clipboard-watch", true);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<ClipboardCapture>("clipboard-changed", (event) => {
        if (!enabledRef.current) return;
        const { kind, data } = event.payload;

        if (kind === "image") {
          toast("New screenshot copied", {
            description: "Save it to Glint?",
            duration: 8000,
            icon: (
              // eslint-disable-next-line @next/next/no-img-element -- data: URI thumbnail, not a Next-optimizable remote asset
              <img
                src={`data:image/png;base64,${data}`}
                alt=""
                className="size-8 rounded-md object-cover"
              />
            ),
            action: {
              label: "Save",
              onClick: () => void ingestImage(base64PngToFile(data)),
            },
          });
        } else {
          const url = asUrl(data);
          if (url) {
            showLinkSaveToast(url, () => void ingestText(data));
          } else {
            toast("New text copied", {
              description: data.length > 80 ? `${data.slice(0, 80)}…` : data,
              duration: 8000,
              action: {
                label: "Save",
                onClick: () => void ingestText(data),
              },
            });
          }
        }
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [ingestImage, ingestText]);

  return null;
}

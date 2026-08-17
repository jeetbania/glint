import Image from "next/image";
import { toast } from "sonner";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LinkMetadata } from "@/lib/link-metadata";

/** The clipboard-watcher's "a link was copied" notification — a rich
 * preview card (favicon/OG image, title, domain) with an explicit
 * Dismiss/Save choice, modeled on the reference app's own "Save a URL"
 * prompt, instead of a plain "New link copied [Save]" text toast that
 * asked the user to commit blind. Shown via toast.custom so it can hold
 * its own async fetch + loading state, not sonner's built-in
 * loading→success pattern (this isn't a background job, it's a prompt). */
export function showLinkSaveToast(url: string, onSave: () => void) {
  const id = toast.custom(() => <LoadingCard url={url} />, { duration: Infinity });

  void fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
    .then((r) => (r.ok ? (r.json() as Promise<LinkMetadata>) : null))
    .catch(() => null)
    .then((metadata) => {
      toast.custom(
        () => (
          <PreviewCard
            url={url}
            metadata={metadata}
            onDismiss={() => toast.dismiss(id)}
            onSave={() => {
              onSave();
              toast.dismiss(id);
            }}
          />
        ),
        { id, duration: Infinity },
      );
    });
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel w-80 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <LinkIcon className="size-3.5" />
        Save a URL
      </div>
      {children}
    </div>
  );
}

function LoadingCard({ url }: { url: string }) {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url as a fallback label
  }
  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <div className="size-12 shrink-0 animate-pulse rounded-xl bg-foreground/8" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-foreground/8" />
          <p className="truncate text-xs text-muted-foreground">{domain}</p>
        </div>
      </div>
    </CardShell>
  );
}

function PreviewCard({
  metadata,
  onDismiss,
  onSave,
}: {
  url: string;
  metadata: LinkMetadata | null;
  onDismiss: () => void;
  onSave: () => void;
}) {
  const thumbnail = metadata?.previewImageUrl ?? metadata?.faviconUrl;

  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground/6">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt=""
              width={48}
              height={48}
              unoptimized
              className={
                metadata?.previewImageUrl
                  ? "size-full object-cover"
                  : "size-6 object-contain"
              }
            />
          ) : (
            <LinkIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {metadata?.title ?? metadata?.domain ?? "Untitled link"}
          </p>
          {metadata?.domain && (
            <p className="truncate text-xs text-muted-foreground">
              {metadata.domain}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button size="sm" onClick={onSave}>
          Save this link
        </Button>
      </div>
    </CardShell>
  );
}

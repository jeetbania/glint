"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { isLocalBlobRef, resolveBlobSrc } from "@/lib/local/blobs";

/** Deterministic 1-4 pick from React's own per-instance id, not
 * Math.random() — random would run once during SSR and again during
 * client hydration (two separate JS engine calls), disagree, and trip a
 * hydration-mismatch warning. useId() returns the same string on both
 * passes by construction, so hashing it is stable while still differing
 * across instances — see globals.css's img-skeleton-glow-N rules for why
 * that variance matters (ported from jeetcreates-portfolio's
 * ImageSkeleton.tsx). */
function pickVariant(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return 1 + (Math.abs(hash) % 4);
}

/**
 * Loading placeholder for real photos — the ChatGPT/Gemini-style
 * "generating..." treatment: a dot grid with a soft blob-shaped
 * highlight that drifts and morphs across it, reused here (minus the
 * generation-specific label/prompt chrome, since this just means "the
 * photo hasn't arrived yet") from jeetcreates-portfolio's own
 * ImageSkeleton.tsx. Colors ride on --muted / --foreground via
 * color-mix (globals.css) so it's automatically correct in both themes
 * instead of needing separate light/dark rules. Purely presentational —
 * see SkeletonImage below for the actual "is it loaded yet" wiring.
 */
export function ImageSkeleton({ visible }: { visible: boolean }) {
  const variant = pickVariant(useId());
  return (
    <div className="img-skeleton" aria-hidden="true" style={{ opacity: visible ? 1 : 0 }}>
      <span className="img-skeleton-dots" />
      <span className={`img-skeleton-glow img-skeleton-glow-${variant}`} />
    </div>
  );
}

/**
 * Drop-in replacement for next/image's <Image fill .../> that shows
 * ImageSkeleton above until the real photo has decoded, then cross-fades
 * it in instead of popping in abruptly — that pop (especially for
 * lazy-loaded cards scrolling into view) is what read as "images loading
 * again" while scrolling the library. Needs a position:relative ancestor
 * with the target aspect ratio already set, same as a plain <Image fill>
 * would (every call site here already has one for that reason).
 *
 * `showSkeleton` stays mounted ~320ms past `loaded` so the skeleton's
 * own opacity transition can finish playing before it unmounts, instead
 * of leaving its infinite CSS animation running in the background for
 * the rest of the card's life — multiplied across a whole grid of
 * loaded cards, that's real animation work with no visible benefit.
 * Resets both if `src` changes under an already-mounted instance.
 */
export function SkeletonImage({
  src,
  alt,
  className,
  style,
  onLoad,
  ...rest
}: React.ComponentProps<typeof Image>) {
  const [loaded, setLoaded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  // Resets both if `src` changes under an already-mounted instance (e.g.
  // a future gallery/carousel reusing this component) — React's
  // documented "adjusting state when a prop changes" pattern (compare +
  // setState during render, not in an effect), same fix used for the
  // command palette's deep-link navigation in library-view.tsx.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // A `local-blob:` reference (see lib/local/blobs.ts) isn't directly
  // renderable — it's a pointer into this browser's IndexedDB, not a
  // URL. Resolve it to a real object URL before handing it to <Image>;
  // a real http(s) src (bundled demo images, scraped link previews)
  // passes straight through untouched, synchronously, at render time
  // (folded into the same prevSrc comparison below) — no extra flash of
  // skeleton for those, and no setState-during-effect for a case that
  // was never actually async to begin with.
  const [resolvedSrc, setResolvedSrc] = useState<typeof src | null>(() =>
    typeof src === "string" && isLocalBlobRef(src) ? null : src,
  );
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setLoaded(false);
    setShowSkeleton(true);
    setResolvedSrc(typeof src === "string" && isLocalBlobRef(src) ? null : src);
  }

  useEffect(() => {
    if (typeof src !== "string" || !isLocalBlobRef(src)) return;
    let cancelled = false;
    void resolveBlobSrc(src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setShowSkeleton(false), 320);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <>
      {showSkeleton && <ImageSkeleton visible={!loaded} />}
      {resolvedSrc && (
        <Image
          {...rest}
          src={resolvedSrc}
          alt={alt}
          className={className}
          onLoad={(e) => {
            setLoaded(true);
            onLoad?.(e);
          }}
          style={{
            ...style,
            opacity: loaded ? 1 : 0,
            transition: "opacity 280ms ease-out",
          }}
        />
      )}
    </>
  );
}

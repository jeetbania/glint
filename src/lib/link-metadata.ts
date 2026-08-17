import ogs from "open-graph-scraper";

export type LinkMetadata = {
  title: string | null;
  description: string | null;
  previewImageUrl: string | null;
  faviconUrl: string | null;
  domain: string;
};

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Server-side OG/meta scrape with a hard timeout and a graceful fallback
 * to a bare domain + Google's favicon service if the site is slow, blocks
 * scraping, or errors out. Never throws. */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const domain = getDomain(url);
  const fallback: LinkMetadata = {
    title: domain,
    description: null,
    previewImageUrl: null,
    faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    domain,
  };

  try {
    const { result } = await ogs({ url, timeout: 8000 });
    const image = Array.isArray(result.ogImage)
      ? result.ogImage[0]
      : result.ogImage;
    return {
      title: result.ogTitle ?? fallback.title,
      description: result.ogDescription ?? null,
      previewImageUrl: image?.url ?? null,
      faviconUrl: result.favicon
        ? new URL(result.favicon, url).toString()
        : fallback.faviconUrl,
      domain,
    };
  } catch {
    return fallback;
  }
}

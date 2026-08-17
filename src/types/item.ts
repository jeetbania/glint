export type ItemType = "image" | "link" | "note" | "task";

export type ApiTag = { id: string; name: string; slug: string; color: string | null };

export type ApiItem = {
  id: string;
  type: ItemType;
  title: string | null;
  bodyText: string | null;
  bodyJson: unknown;
  url: string | null;
  domain: string | null;
  faviconUrl: string | null;
  previewImageUrl: string | null;
  blobUrl: string | null;
  blobPathname: string | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  dominantColors: { hex: string; percentage: number }[] | null;
  colorFamily: string[] | null;
  aiTags: string[] | null;
  aiCategory: string | null;
  aiStatus: string;
  ocrText: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  tags: ApiTag[];
};

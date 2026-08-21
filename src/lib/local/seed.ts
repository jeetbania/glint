import { getLocalDb, uuid } from "@/lib/local/db";
import type { LocalItemRow, LocalCollectionRow } from "@/lib/local/db";

/**
 * First-run demo content — bundled straight into the app (public/seed/,
 * real static files, not a network fetch), not a copy of anyone's real
 * library. Every fresh local store starts empty otherwise, which is a
 * confusing first impression for a visual app ("paste something in" means
 * nothing if you've never seen what a saved item looks like) — this
 * gives a new visitor, or a friend trying the shared build, something to
 * actually look at and delete/replace as they save their own things.
 *
 * Runs once per browser: gated on a localStorage flag rather than "is
 * the items store empty," so deleting every demo item on purpose doesn't
 * bring them back on the next reload.
 */
const SEED_FLAG_KEY = "glint:local-seeded";

const IMG = (n: number) => `/seed/seed-${n}.webp`;

// Dimensions of the actual bundled files (public/seed/*.webp) — known
// up front since these are fixed assets, not user uploads, so there's
// no client-side decode step needed just to fill in width/height.
const SEED_IMAGES: {
  src: string;
  width: number;
  height: number;
  title: string;
  colorFamily: string[];
  dominantColors: { hex: string; percentage: number }[];
}[] = [
  {
    src: IMG(1),
    width: 1400,
    height: 933,
    title: "Studio desk setup",
    colorFamily: ["brown", "beige"],
    dominantColors: [
      { hex: "#a9855f", percentage: 0.4 },
      { hex: "#e4dccb", percentage: 0.3 },
    ],
  },
  {
    src: IMG(2),
    width: 1400,
    height: 1050,
    title: "Working on the new deck",
    colorFamily: ["gray", "beige"],
    dominantColors: [
      { hex: "#cfc9bd", percentage: 0.4 },
      { hex: "#8a8a86", percentage: 0.25 },
    ],
  },
  {
    src: IMG(3),
    width: 1400,
    height: 1050,
    title: "Morning light",
    colorFamily: ["orange", "brown"],
    dominantColors: [
      { hex: "#d9a26b", percentage: 0.35 },
      { hex: "#6b4a2f", percentage: 0.25 },
    ],
  },
  {
    src: IMG(4),
    width: 1400,
    height: 1050,
    title: "Reading in the lounge",
    colorFamily: ["green", "beige"],
    dominantColors: [
      { hex: "#8ba888", percentage: 0.35 },
      { hex: "#e6ddc9", percentage: 0.3 },
    ],
  },
  {
    src: IMG(5),
    width: 1400,
    height: 1050,
    title: "Sketch review",
    colorFamily: ["brown", "gray"],
    dominantColors: [
      { hex: "#9c7f5f", percentage: 0.35 },
      { hex: "#c9c2b4", percentage: 0.3 },
    ],
  },
  {
    src: IMG(6),
    width: 1400,
    height: 1050,
    title: "Casual workspace",
    colorFamily: ["blue", "gray"],
    dominantColors: [
      { hex: "#4c6fa3", percentage: 0.3 },
      { hex: "#d6d2c8", percentage: 0.3 },
    ],
  },
  {
    src: IMG(7),
    width: 933,
    height: 1400,
    title: "Field notes",
    colorFamily: ["green", "brown"],
    dominantColors: [
      { hex: "#5c7452", percentage: 0.35 },
      { hex: "#8a6b4a", percentage: 0.25 },
    ],
  },
  {
    src: IMG(8),
    width: 1400,
    height: 1050,
    title: "Coffee and a call",
    colorFamily: ["red", "beige"],
    dominantColors: [
      { hex: "#b5523f", percentage: 0.3 },
      { hex: "#e8ddc9", percentage: 0.3 },
    ],
  },
];

export async function seedLocalDbIfEmpty(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_FLAG_KEY)) return;
  localStorage.setItem(SEED_FLAG_KEY, "1");

  const db = await getLocalDb();
  const existing = await db.count("items");
  if (existing > 0) return;

  const now = Date.now();
  // Staggered, oldest-to-newest timestamps rather than "all just now" —
  // so recent-first sort shows a sensible order instead of an
  // arbitrary tie-broken clump, same as a real library would look.
  const ts = (stepsAgoMinutes: number) =>
    new Date(now - stepsAgoMinutes * 60_000).toISOString();

  const branding: LocalCollectionRow = {
    id: uuid(),
    name: "Branding",
    slug: "branding",
    colorHue: 355,
    createdAt: ts(120),
    updatedAt: ts(20),
  };
  const websites: LocalCollectionRow = {
    id: uuid(),
    name: "Websites",
    slug: "websites",
    colorHue: 233,
    createdAt: ts(110),
    updatedAt: ts(15),
  };
  await db.put("collections", branding);
  await db.put("collections", websites);

  const inspirationTag = { id: uuid(), name: "inspiration", slug: "inspiration", color: null };
  await db.put("tags", inspirationTag);

  let minutesAgo = 100;
  const imageRows: { row: LocalItemRow; collection?: LocalCollectionRow; tagged?: boolean }[] = [];
  SEED_IMAGES.forEach((img, i) => {
    minutesAgo -= 8;
    const row: LocalItemRow = {
      id: uuid(),
      type: "image",
      title: img.title,
      bodyText: null,
      bodyJson: null,
      url: null,
      domain: null,
      faviconUrl: null,
      previewImageUrl: null,
      blobUrl: img.src,
      blobPathname: img.src,
      width: img.width,
      height: img.height,
      fileSizeBytes: null,
      mimeType: "image/webp",
      dominantColors: img.dominantColors,
      colorFamily: img.colorFamily,
      aiTags: null,
      aiCategory: null,
      aiStatus: "disabled",
      ocrText: null,
      status: "active",
      completed: false,
      createdAt: ts(minutesAgo),
      updatedAt: ts(minutesAgo),
    };
    // First 4 into Branding, next 4 into Websites — matches the two
    // demo collections above.
    const collection = i < 4 ? branding : websites;
    imageRows.push({ row, collection, tagged: i === 0 || i === 4 });
  });

  for (const { row } of imageRows) {
    await db.put("items", row);
  }

  const itemCollectionTx = db.transaction("itemCollections", "readwrite");
  await Promise.all(
    imageRows.map(({ row, collection }) =>
      collection
        ? itemCollectionTx.store.put({
            id: `${row.id}:${collection.id}`,
            itemId: row.id,
            collectionId: collection.id,
            x: null,
            y: null,
            w: null,
            h: null,
            zIndex: 0,
            parentId: null,
            flipX: false,
            flipY: false,
            createdAt: row.createdAt,
          })
        : Promise.resolve(),
    ),
  );
  await itemCollectionTx.done;

  const itemTagTx = db.transaction("itemTags", "readwrite");
  await Promise.all(
    imageRows
      .filter((r) => r.tagged)
      .map((r) =>
        itemTagTx.store.put({
          id: `${r.row.id}:${inspirationTag.id}`,
          itemId: r.row.id,
          tagId: inspirationTag.id,
        }),
      ),
  );
  await itemTagTx.done;

  // A note and a task, so Notes/Tasks aren't empty either — and a link,
  // rendered with just a title/domain (no scraped preview image, kept
  // fully offline so seeding never depends on the network).
  minutesAgo -= 6;
  const note: LocalItemRow = {
    id: uuid(),
    type: "note",
    title: "Welcome to Glint",
    bodyText:
      "This is a demo library so you can see what Glint looks like with something in it. Paste an image, a link, or just some text anywhere in the app to save your own — everything here (including this note) is only ever stored on this device, delete it whenever you're ready.",
    bodyJson: null,
    url: null,
    domain: null,
    faviconUrl: null,
    previewImageUrl: null,
    blobUrl: null,
    blobPathname: null,
    width: null,
    height: null,
    fileSizeBytes: null,
    mimeType: null,
    dominantColors: null,
    colorFamily: null,
    aiTags: null,
    aiCategory: null,
    aiStatus: "disabled",
    ocrText: null,
    status: "active",
    completed: false,
    createdAt: ts(minutesAgo),
    updatedAt: ts(minutesAgo),
  };
  await db.put("items", note);

  minutesAgo -= 5;
  const task: LocalItemRow = {
    id: uuid(),
    type: "task",
    title: "Paste something in to get started",
    bodyText: null,
    bodyJson: null,
    url: null,
    domain: null,
    faviconUrl: null,
    previewImageUrl: null,
    blobUrl: null,
    blobPathname: null,
    width: null,
    height: null,
    fileSizeBytes: null,
    mimeType: null,
    dominantColors: null,
    colorFamily: null,
    aiTags: null,
    aiCategory: null,
    aiStatus: "disabled",
    ocrText: null,
    status: "active",
    completed: false,
    createdAt: ts(minutesAgo),
    updatedAt: ts(minutesAgo),
  };
  await db.put("items", task);

  minutesAgo -= 4;
  const link: LocalItemRow = {
    id: uuid(),
    type: "link",
    title: "Glint on GitHub",
    bodyText: null,
    bodyJson: null,
    url: "https://github.com/jeetbania/glint",
    domain: "github.com",
    faviconUrl: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
    previewImageUrl: null,
    blobUrl: null,
    blobPathname: null,
    width: null,
    height: null,
    fileSizeBytes: null,
    mimeType: null,
    dominantColors: null,
    colorFamily: null,
    aiTags: null,
    aiCategory: null,
    aiStatus: "disabled",
    ocrText: null,
    status: "active",
    completed: false,
    createdAt: ts(minutesAgo),
    updatedAt: ts(minutesAgo),
  };
  await db.put("items", link);
}

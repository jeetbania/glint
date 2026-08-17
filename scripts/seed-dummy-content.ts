/**
 * One-off seed script: uploads the user's provided mockup images as
 * dummy image items, plus a couple of dummy notes/tasks, so the app has
 * real-looking content to demo. Run via:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-dummy-content.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { put } from "@vercel/blob";
import { imageSize } from "image-size";
import { createItem, setItemTags } from "../src/lib/items";

const SOURCE_DIR = "/Users/jeetbania/Downloads/Temp Images";

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.webp$/i, "")
    .replace(/^mockuuups-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function seedImages() {
  const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".webp"));
  for (const file of files) {
    const filePath = join(SOURCE_DIR, file);
    const buffer = readFileSync(filePath);
    const { width, height } = imageSize(buffer);

    const blob = await put(`seed/${file}`, buffer, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: true,
    });

    const item = await createItem({
      type: "image",
      title: titleFromFilename(file),
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      width,
      height,
      fileSizeBytes: buffer.byteLength,
      mimeType: "image/webp",
    });
    await setItemTags(item.id, ["mockup", "design"]);
    console.log(`Uploaded ${file} -> ${blob.url}`);
  }
}

async function seedNotesAndTasks() {
  const notes = [
    {
      title: "Design system notes",
      bodyText:
        "Instrument Sans everywhere, -3% tracking on headings. Glass panels use blur(16px) saturate(1.4).",
    },
    {
      title: "Ideas for v3",
      bodyText:
        "Kanban board for tasks. AI auto-tagging once billing is sorted. Maybe a weekly digest email?",
    },
  ];
  for (const n of notes) {
    await createItem({ type: "note", title: n.title, bodyText: n.bodyText });
  }

  const tasks = [
    { title: "Review mockup exports" },
    { title: "Write launch announcement" },
    { title: "Follow up with design contractor" },
  ];
  for (const t of tasks) {
    await createItem({ type: "task", title: t.title });
  }
}

async function main() {
  await seedImages();
  await seedNotesAndTasks();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-off (but rerunnable) seed script: adds 3 "Getting Started" notes
 * with real rich-text formatting (headings, bold, bullet lists, a task
 * checklist) that walk through what the app can do, tagged so they're
 * findable and filed into their own "Getting Started" collection.
 *
 * Run via:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-getting-started-notes.ts
 */
import { createItem, setItemTags } from "../src/lib/items";
import { createCollection, setItemCollections } from "../src/lib/collections";
import type { JSONContent } from "@tiptap/react";

function heading(level: 2 | 3, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}
function p(
  parts: (string | { text: string; bold?: boolean; italic?: boolean })[],
): JSONContent {
  return {
    type: "paragraph",
    content: parts.map((part) =>
      typeof part === "string"
        ? { type: "text", text: part }
        : {
            type: "text",
            text: part.text,
            marks: [
              ...(part.bold ? [{ type: "bold" }] : []),
              ...(part.italic ? [{ type: "italic" }] : []),
            ],
          },
    ),
  };
}
function bulletList(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((text) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  };
}
function taskList(items: string[]): JSONContent {
  return {
    type: "taskList",
    content: items.map((text) => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  };
}
function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}
function plainText(content: JSONContent): string {
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) parts.push(node.text);
    node.content?.forEach(walk);
  }
  walk(content);
  return parts.join(" ");
}

const NOTES: { title: string; tags: string[]; body: JSONContent }[] = [
  {
    title: "Welcome to Glint 👋",
    tags: ["getting-started", "guide"],
    body: doc(
      heading(2, "Welcome to Glint 👋"),
      p([
        "Glint is your visual memory — paste anything, anywhere in the app, and it's saved instantly. No import step, no filing decision up front.",
      ]),
      heading(3, "Save anything, instantly"),
      bulletList([
        "Paste (⌘V) an image, link, or text from anywhere in the app",
        "Drag and drop images straight onto the Library",
        "On the desktop app, copy a screenshot or a link anywhere on your Mac and Glint offers to save it — even when the app isn't focused",
      ]),
      heading(3, "Organize your way"),
      p([
        { text: "Collections", bold: true },
        " group anything — images, notes, tasks — into a folder. ",
        { text: "Tags", bold: true },
        " cut across folders, for labels like ",
        { text: "inspiration", italic: true },
        " or ",
        { text: "client-work", italic: true },
        " that don't belong to just one place.",
      ]),
      taskList([
        "Create your first collection",
        "Tag an item",
        "Open the command palette (⌘K) and search for something",
      ]),
    ),
  },
  {
    title: "Move fast: shortcuts & right-click menus",
    tags: ["getting-started", "shortcuts"],
    body: doc(
      heading(2, "Move fast ⌨️"),
      p(["A few things that make Glint faster once you know them're there."]),
      heading(3, "Keyboard shortcuts"),
      bulletList([
        "⌘K — open the command palette / search",
        "⌘⇧N — new note",
        "⌘⇧T — new task",
        "Esc — close whatever's open",
      ]),
      p([
        "The full list lives in ",
        { text: "Settings → Shortcuts", bold: true },
        " any time you forget one.",
      ]),
      heading(3, "Right-click everything"),
      p([
        "Folders, images, links, and notes all have a right-click menu — rename, delete, download, copy link — usually with the same options behind a \"…\" button too, for trackpad-free use.",
      ]),
      heading(3, "Drag notes into folders"),
      p([
        "In the Notes tab, drag a note from the list straight onto a folder in the sidebar to file it — no need to open the note and edit its collections by hand.",
      ]),
    ),
  },
  {
    title: "On the desktop app 🖥️",
    tags: ["getting-started", "desktop"],
    body: doc(
      heading(2, "On the desktop app 🖥️"),
      p([
        "If you're running Glint as a native app (not just in the browser), a few extra things are available.",
      ]),
      bulletList([
        "Real macOS window vibrancy — the frosted-glass look is the actual OS material, not a CSS approximation",
        "Clipboard watching: copy a screenshot or a link anywhere on your Mac and Glint pops up a \"Save?\" prompt — toggle this off anytime in Settings → Capture",
        "Auto-updates: check for the latest version from Settings → About whenever you like, no reinstalling by hand",
      ]),
      p([
        "Most day-to-day changes to the app show up automatically next time you open it, since the desktop app is a thin native shell around the same app you're using right now.",
      ]),
    ),
  },
];

async function main() {
  const collection = await createCollection("Getting Started");

  for (const note of NOTES) {
    const item = await createItem({
      type: "note",
      title: note.title,
      bodyJson: note.body,
      bodyText: plainText(note.body),
    });
    await setItemTags(item.id, note.tags);
    await setItemCollections(item.id, [collection.name]);
    console.log(`Created note: ${note.title}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-off (but rerunnable) seed script: adds a few demo tasks showing
 * off what the Tasks view can do — tags, a rich checklist body (headed
 * sections of sub-items, Things-style), and one already-completed task
 * so the "Completed" smart view isn't empty on first look.
 *
 * Run via:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-demo-tasks.ts
 */
import { createItem, setItemTags, updateItem } from "../src/lib/items";
import { createCollection, setItemCollections } from "../src/lib/collections";
import type { JSONContent } from "@tiptap/react";

function heading(level: 2 | 3, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}
function p(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function checklist(items: string[]): JSONContent {
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

const TASKS: {
  title: string;
  tags: string[];
  completed?: boolean;
  body?: JSONContent;
}[] = [
  {
    title: "Plan the Q3 launch",
    tags: ["planning"],
    body: doc(
      p("Keep the launch simple: what are the three things people need to know?"),
      heading(3, "Research"),
      checklist([
        "Review last quarter's launch retro",
        "Check competitor announcements this month",
      ]),
      heading(3, "Preparation"),
      checklist([
        "Draft the announcement post",
        "Confirm the launch date with the team",
        "Line up screenshots for the changelog",
      ]),
    ),
  },
  {
    title: "Review onboarding flow",
    tags: ["ux"],
    body: doc(
      p("Walk through the first-run experience end to end, note anything confusing."),
      checklist([
        "Try it on a fresh account",
        "Time how long it takes to save the first item",
        "Write up findings",
      ]),
    ),
  },
  {
    title: "Reply to design feedback thread",
    tags: [],
  },
  {
    title: "Ship v1 announcement",
    tags: ["marketing"],
    completed: true,
    body: doc(p("Posted to the changelog and shared in the community.")),
  },
];

async function main() {
  const collection = await createCollection("Getting Started");

  for (const task of TASKS) {
    const item = await createItem({
      type: "task",
      title: task.title,
      bodyJson: task.body,
      bodyText: task.body ? plainText(task.body) : null,
    });
    if (task.tags.length > 0) await setItemTags(item.id, task.tags);
    await setItemCollections(item.id, [collection.name]);
    if (task.completed) await updateItem(item.id, { completed: true });
    console.log(`Created task: ${task.title}${task.completed ? " (completed)" : ""}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { asc, eq } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { getDb } from "@/db";
import { kanbanColumns, kanbanCards, items } from "@/db/schema";
import { attachTags, createItem, type ItemWithTags } from "@/lib/items";

export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type KanbanCard = {
  id: string;
  columnId: string;
  sortOrder: string;
  item: ItemWithTags;
};

const DEFAULT_COLUMNS: { name: string; color: string }[] = [
  { name: "Todo", color: "#94a3b8" },
  { name: "In Progress", color: "#fbbf24" },
  { name: "Done", color: "#4ade80" },
];

/** Seeds the three standard columns on first-ever visit to the Tasks
 * tab — idempotent (a second call is a no-op once any column exists),
 * so nothing needs a separate "run once" migration/seed step. */
async function ensureDefaultColumns(): Promise<KanbanColumn[]> {
  const db = getDb();
  const existing = await db
    .select()
    .from(kanbanColumns)
    .orderBy(asc(kanbanColumns.sortOrder));
  if (existing.length > 0) return existing;

  const inserted = await db
    .insert(kanbanColumns)
    .values(DEFAULT_COLUMNS.map((c, i) => ({ ...c, sortOrder: i })))
    .returning();
  return inserted.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listBoard(): Promise<{
  columns: KanbanColumn[];
  cards: KanbanCard[];
}> {
  const db = getDb();
  const columns = await ensureDefaultColumns();

  // Only active (non-trashed) task items show up — deleting a task via
  // the normal item-delete path (soft delete) makes it vanish from the
  // board with no separate kanban-specific cleanup needed.
  const rows = await db
    .select({ card: kanbanCards, item: items })
    .from(kanbanCards)
    .innerJoin(items, eq(kanbanCards.itemId, items.id))
    .where(eq(items.status, "active"))
    .orderBy(asc(kanbanCards.sortOrder));

  const itemsWithTags = await attachTags(rows.map((r) => r.item));
  const itemById = new Map(itemsWithTags.map((i) => [i.id, i]));

  const cards: KanbanCard[] = rows
    .map((r) => {
      const item = itemById.get(r.item.id);
      if (!item) return null;
      return { id: r.card.id, columnId: r.card.columnId, sortOrder: r.card.sortOrder, item };
    })
    .filter((c): c is KanbanCard => c !== null);

  return { columns, cards };
}

/** Creates a new task item and files it at the end of the given column
 * in one step — the Tasks board's "+ New task" affordance. */
export async function createCard(columnId: string, title: string): Promise<KanbanCard> {
  const db = getDb();
  const columnCards = await db
    .select({ sortOrder: kanbanCards.sortOrder })
    .from(kanbanCards)
    .where(eq(kanbanCards.columnId, columnId))
    .orderBy(asc(kanbanCards.sortOrder));
  const sortOrder = generateKeyBetween(columnCards.at(-1)?.sortOrder ?? null, null);

  const item = await createItem({ type: "task", title });
  const [card] = await db
    .insert(kanbanCards)
    .values({ itemId: item.id, columnId, sortOrder })
    .returning();
  const [withTags] = await attachTags([item]);
  return { id: card.id, columnId: card.columnId, sortOrder: card.sortOrder, item: withTags };
}

/** Moves a card to a (possibly different) column, positioned between
 * the two neighboring cards the client observed at drop time —
 * fractional-indexing means this never needs to touch any other card's
 * sortOrder, so drags stay O(1) regardless of column size. */
export async function moveCard(
  cardId: string,
  columnId: string,
  beforeOrder: string | null,
  afterOrder: string | null,
): Promise<void> {
  const db = getDb();
  const sortOrder = generateKeyBetween(beforeOrder, afterOrder);
  await db
    .update(kanbanCards)
    .set({ columnId, sortOrder, updatedAt: new Date() })
    .where(eq(kanbanCards.id, cardId));
}

export async function createColumn(name: string): Promise<KanbanColumn> {
  const db = getDb();
  const existing = await db.select().from(kanbanColumns);
  const nextOrder =
    existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;
  const [column] = await db
    .insert(kanbanColumns)
    .values({ name, sortOrder: nextOrder })
    .returning();
  return column;
}

export async function renameColumn(id: string, name: string): Promise<KanbanColumn | null> {
  const db = getDb();
  const [column] = await db
    .update(kanbanColumns)
    .set({ name })
    .where(eq(kanbanColumns.id, id))
    .returning();
  return column ?? null;
}

/** Deleting a column cascades its kanban_cards rows (FK ON DELETE
 * CASCADE) but deliberately leaves the underlying task items intact —
 * they just stop being on any board, same as removing a note from a
 * collection doesn't delete the note. */
export async function deleteColumn(id: string): Promise<void> {
  const db = getDb();
  await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));
}


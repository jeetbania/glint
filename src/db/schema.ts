import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Postgres tsvector isn't a first-class Drizzle type yet — wrap it as a custom
// type so we can select it (mostly unused directly; querying goes through
// the generated column + GIN index via raw `sql` in search queries).
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const itemTypeValues = ["image", "link", "note", "task"] as const;
export type ItemType = (typeof itemTypeValues)[number];

export const itemStatusValues = ["active", "archived", "trashed"] as const;
export type ItemStatus = (typeof itemStatusValues)[number];

export const aiStatusValues = [
  "disabled",
  "pending",
  "processing",
  "done",
  "skipped",
  "failed",
] as const;
export type AiStatus = (typeof aiStatusValues)[number];

/**
 * The single polymorphic content unit: image | link | note | task.
 * Library, Notes, and Kanban all read from this same table so editing
 * an item from any view is reflected everywhere else instantly.
 *
 * AI fields (ai_tags, ai_category, ai_status, ai_raw, ocr_text) exist from
 * day one but stay dormant (`ai_status = 'disabled'`) until a v4 enrichment
 * pipeline is switched on — no future migration required to add them.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", { enum: itemTypeValues }).notNull(),

    title: text("title"),
    bodyText: text("body_text"), // plaintext mirror (note body / link description / future OCR) for FTS
    bodyJson: jsonb("body_json"), // Tiptap rich-text doc (notes/checklists only)

    // Link-only fields
    url: text("url"),
    domain: text("domain"),
    faviconUrl: text("favicon_url"),
    previewImageUrl: text("preview_image_url"),

    // Image-only fields
    blobUrl: text("blob_url"),
    blobPathname: text("blob_pathname"),
    width: integer("width"),
    height: integer("height"),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type"),

    // Color extraction (client-side, no AI)
    dominantColors: jsonb("dominant_colors").$type<
      { hex: string; percentage: number }[]
    >(),
    colorFamily: text("color_family").array(),

    // Deferred AI enrichment pipeline (v4) — dormant by default
    aiTags: text("ai_tags").array(),
    aiCategory: text("ai_category"),
    aiStatus: text("ai_status", { enum: aiStatusValues })
      .notNull()
      .default("disabled"),
    aiRaw: jsonb("ai_raw"),
    ocrText: text("ocr_text"),

    status: text("status", { enum: itemStatusValues })
      .notNull()
      .default("active"),

    // Task-only — the Things-style Tasks view's checkbox state. Lives on
    // the shared items table (not a separate task_details table) since
    // every other type-specific field here (url, blobUrl, …) already
    // follows that pattern; harmless `false` default on non-task rows.
    completed: boolean("completed").notNull().default(false),

    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`to_tsvector('english',
          coalesce(title, '') || ' ' ||
          coalesce(body_text, '') || ' ' ||
          coalesce(url, '') || ' ' ||
          coalesce(domain, '')
        )`,
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("items_search_vector_idx").using("gin", table.searchVector),
    index("items_color_family_idx").using("gin", table.colorFamily),
    index("items_type_idx").on(table.type),
    index("items_status_idx").on(table.status),
    index("items_created_at_idx").on(table.createdAt),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tags_name_idx").on(table.name),
    uniqueIndex("tags_slug_idx").on(table.slug),
  ],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_tags_pk_idx").on(table.itemId, table.tagId),
    index("item_tags_tag_id_idx").on(table.tagId),
  ],
);

/**
 * User-organized folders ("Collections", jeetcreates.cc/reference-app
 * style) — a lightweight many-to-many grouping, independent of tags and
 * of boards. An item can belong to any number of collections.
 */
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("collections_slug_idx").on(table.slug)],
);

export const itemCollections = pgTable(
  "item_collections",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    // Spatial placement on that collection's infinite canvas. Nullable —
    // an item with no position yet falls back to an auto-arranged grid
    // spot computed client-side; a value is only written once the user
    // actually drags the card, same lazy-persistence idea as boards'
    // item_positions but folded onto this join row instead of a second
    // table, since a position here is meaningless outside its collection.
    x: real("x"),
    y: real("y"),
    w: real("w"),
    h: real("h"),
    zIndex: integer("z_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("item_collections_pk_idx").on(table.itemId, table.collectionId),
    index("item_collections_collection_id_idx").on(table.collectionId),
  ],
);

export const canvasObjectTypeValues = ["sticky", "text", "shape", "frame"] as const;
export type CanvasObjectType = (typeof canvasObjectTypeValues)[number];

export const canvasShapeVariantValues = ["rectangle", "ellipse"] as const;
export type CanvasShapeVariant = (typeof canvasShapeVariantValues)[number];

export const canvasFontFamilyValues = ["sans", "serif", "mono"] as const;
export type CanvasFontFamily = (typeof canvasFontFamilyValues)[number];

export const canvasTextAlignValues = ["left", "center", "right"] as const;
export type CanvasTextAlign = (typeof canvasTextAlignValues)[number];

/**
 * FigJam-style annotation objects on a collection's infinite canvas —
 * sticky notes, freeform text, basic shapes, and frames. Deliberately a
 * separate table from `items`: these are canvas-only marks (no title, no
 * tags, never shown in Library/Notes/Tasks), not a fifth item type, so
 * they don't need to carry all of items' polymorphic baggage (url,
 * blobUrl, search_vector, …) for fields that would always be null.
 * Scoped directly to a collection (not via a join table like
 * item_collections) since — unlike items — a canvas object only ever
 * exists on the one canvas it was drawn on.
 */
export const canvasObjects = pgTable(
  "canvas_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    type: text("type", { enum: canvasObjectTypeValues }).notNull(),

    // sticky/text: note body. frame: its label. shape: unused.
    text: text("text"),
    // shape only — which primitive to render.
    shapeVariant: text("shape_variant", { enum: canvasShapeVariantValues }),

    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    w: real("w").notNull().default(220),
    h: real("h").notNull().default(220),
    rotation: real("rotation").notNull().default(0),
    zIndex: integer("z_index").notNull().default(0),

    // sticky/shape/frame background fill; null on plain text (no box).
    fill: text("fill"),
    textColor: text("text_color"),
    fontFamily: text("font_family", { enum: canvasFontFamilyValues })
      .notNull()
      .default("sans"),
    fontSize: integer("font_size").notNull().default(14),
    bold: boolean("bold").notNull().default(false),
    italic: boolean("italic").notNull().default(false),
    align: text("align", { enum: canvasTextAlignValues }).notNull().default("left"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("canvas_objects_collection_id_idx").on(table.collectionId),
  ],
);

/**
 * Canvas "files" (FigJam-style, multiple boards). A board is a spatial view
 * layered on top of items via item_positions — it is not a separate content
 * store, so any item can be placed on any board without duplicating data.
 */
export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Spatial placement of an item on a board. Postgres is the source of
 * truth; tldraw's in-memory store is hydrated from this on load and
 * debounce-persisted back into it on change. */
export const itemPositions = pgTable(
  "item_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    w: real("w").notNull().default(320),
    h: real("h").notNull().default(240),
    rotation: real("rotation").notNull().default(0),
    zIndex: integer("z_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("item_positions_item_board_idx").on(
      table.itemId,
      table.boardId,
    ),
    index("item_positions_board_id_idx").on(table.boardId),
  ],
);

export const kanbanColumns = pgTable("kanban_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Ordinal placement (fractional-indexing string), deliberately separate
 * from item_positions since kanban ordering is 1D, not spatial. */
export const kanbanCards = pgTable(
  "kanban_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .unique()
      .references(() => items.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => kanbanColumns.id, { onDelete: "cascade" }),
    sortOrder: text("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("kanban_cards_column_sort_idx").on(
      table.columnId,
      table.sortOrder,
    ),
  ],
);

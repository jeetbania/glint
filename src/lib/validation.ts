import { z } from "zod";
import {
  itemTypeValues,
  canvasObjectTypeValues,
  canvasShapeVariantValues,
  canvasFontFamilyValues,
  canvasTextAlignValues,
} from "@/db/schema";
import { FOLDER_HUE_PALETTE } from "@/lib/folder-color";

const colorEntry = z.object({
  hex: z.string(),
  percentage: z.number(),
});

export const createItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    title: z.string().optional(),
    blobUrl: z.string().url(),
    blobPathname: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fileSizeBytes: z.number().int().positive().optional(),
    mimeType: z.string().optional(),
    dominantColors: z.array(colorEntry).optional(),
    colorFamily: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("link"),
    url: z.string().url(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("note"),
    title: z.string().optional(),
    bodyText: z.string().optional(),
    bodyJson: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("task"),
    title: z.string().min(1),
    bodyText: z.string().optional(),
  }),
]);
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  title: z.string().optional(),
  bodyText: z.string().optional(),
  bodyJson: z.unknown().optional(),
  completed: z.boolean().optional(),
  // Written by lib/auto-enrich-image.ts once local OCR (lib/ocr.ts)
  // finds text in a saved screenshot — previously a "dormant" schema
  // field nothing ever actually wrote to, so its absence here was never
  // noticed: Zod silently drops unknown keys rather than erroring,
  // which meant a PATCH carrying ocrText looked like it succeeded while
  // quietly not persisting it at all.
  ocrText: z.string().optional(),
  tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const listItemsQuerySchema = z.object({
  // Comma-separated list of types, e.g. "image,link" — the Library's
  // "visuals only" default view passes multiple; a single dedicated tab
  // (Notes, Tasks) passes one.
  type: z
    .string()
    .optional()
    .transform((v) => v?.split(",").filter(Boolean))
    .pipe(z.array(z.enum(itemTypeValues)).optional()),
  tag: z.string().optional(),
  color: z.string().optional(),
  collection: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["recent-desc", "recent-asc", "name-asc"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(80),
});
// Backing the folder's right-click "Change color" editor as well as
// rename — colorHue is checked against the curated FOLDER_HUE_PALETTE
// (not just "any integer") so a live color change can only ever land on
// one of the app's own designed swatches, never an arbitrary/off-palette
// hue smuggled in through the API. At least one of name/colorHue must be
// present, or there's nothing to update.
export const updateCollectionSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    colorHue: z
      .number()
      .int()
      .refine((v) => (FOLDER_HUE_PALETTE as readonly number[]).includes(v), {
        message: "Not one of the app's folder colors",
      })
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.colorHue !== undefined, {
    message: "Nothing to update",
  });

export const setItemPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  zIndex: z.number().int(),
});

export const createCanvasObjectSchema = z.object({
  type: z.enum(canvasObjectTypeValues),
  // .nullable() as well as .optional() on the four genuinely-nullable
  // fields: a brand-new object from the toolbar's "add" actions omits
  // these entirely (undefined, dropped by JSON.stringify), but
  // duplicating or undo-recreating an EXISTING object round-trips its
  // full stored shape — which always has a real explicit `null`, not a
  // missing key, for "not set" (see lib/local/canvas-objects.ts's
  // DEFAULTS). Both need to validate here.
  text: z.string().max(4000).nullable().optional(),
  shapeVariant: z.enum(canvasShapeVariantValues).nullable().optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  zIndex: z.number().int(),
  fill: z.string().max(60).nullable().optional(),
  textColor: z.string().max(60).nullable().optional(),
  fontFamily: z.enum(canvasFontFamilyValues).optional(),
  fontSize: z.number().int().positive().max(400).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(canvasTextAlignValues).optional(),
});
export type CreateCanvasObjectInput = z.infer<typeof createCanvasObjectSchema>;

export const updateCanvasObjectSchema = createCanvasObjectSchema.partial();
export type UpdateCanvasObjectInput = z.infer<typeof updateCanvasObjectSchema>;

export const createKanbanColumnSchema = z.object({
  name: z.string().min(1).max(60),
});
export const renameKanbanColumnSchema = z.object({
  name: z.string().min(1).max(60),
});
export const createKanbanCardSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().min(1).max(300),
});
export const moveKanbanCardSchema = z.object({
  columnId: z.string().uuid(),
  beforeOrder: z.string().nullable(),
  afterOrder: z.string().nullable(),
});

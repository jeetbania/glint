import { z } from "zod";
import { itemTypeValues } from "@/db/schema";

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
export const renameCollectionSchema = z.object({
  name: z.string().min(1).max(80),
});

export const setItemPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  zIndex: z.number().int(),
});

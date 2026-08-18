/**
 * One-off migration: adds collections.color_hue (see schema.ts) and
 * backfills every existing collection with a random hue from
 * FOLDER_HUE_PALETTE (lib/folder-color.ts) — plain `drizzle-kit push`
 * can't be used here since it needs an interactive TTY prompt this
 * environment doesn't have, so this runs the ALTER TABLE directly.
 *
 * Safe to re-run: the ADD COLUMN is idempotent (IF NOT EXISTS), and the
 * backfill only touches rows where color_hue is still null.
 *
 * Run via:
 *   npx dotenv -e .env.local -- npx tsx scripts/add-collection-color-hue.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { collections } from "../src/db/schema";
import { eq, isNull } from "drizzle-orm";
import { randomFolderHue } from "../src/lib/folder-color";

async function main() {
  const db = getDb();

  await db.execute(sql`ALTER TABLE collections ADD COLUMN IF NOT EXISTS color_hue integer`);
  console.log("Column ready.");

  const unset = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(isNull(collections.colorHue));

  for (const row of unset) {
    await db
      .update(collections)
      .set({ colorHue: randomFolderHue() })
      .where(eq(collections.id, row.id));
    console.log(`  ${row.name}: assigned a hue`);
  }

  console.log(`Backfilled ${unset.length} collection(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy initialization: `neon()` throws if DATABASE_URL is unset, and
// Next.js evaluates top-level module code at build time, which would
// crash `next build` before env vars are configured. A plain lazy `let`
// (not a Proxy — those break libraries that inspect the client object)
// defers the throw until first real use at request time.
type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

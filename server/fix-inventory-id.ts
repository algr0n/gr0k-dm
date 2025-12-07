import { db } from "./db";
import { sql } from "drizzle-orm";

async function fixIdDefault() {
  await db.execute(sql`ALTER TABLE inventory_items ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
  console.log("Default added to id column!");
}

fixIdDefault().catch(console.error);
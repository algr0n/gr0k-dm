import { db } from "./db";
import { sql } from "drizzle-orm";

async function listTables() {
  const result = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`);
  console.log("Tables in DB:", result.rows.map(row => row.tablename));
  await db.execute(sql`DROP TABLE IF EXISTS game_sessions CASCADE;`);
}

listTables().catch(console.error);
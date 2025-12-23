#!/usr/bin/env node
/**
 * One-off migration runner to add rooms.password_hash.
 * Usage:
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/run-one-off-migration.js
 */
import { createClient } from "@libsql/client";

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("TURSO_DATABASE_URL not set. Aborting.");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  try {
    console.log("Applying ALTER TABLE to add rooms.password_hash ...");
    await client.execute(`ALTER TABLE rooms ADD COLUMN password_hash TEXT;`);
    console.log("Migration applied successfully.");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    try { client.close && client.close(); } catch (e) {}
  }
}

run();

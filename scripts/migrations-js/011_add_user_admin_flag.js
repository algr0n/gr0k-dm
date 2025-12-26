#!/usr/bin/env node
/**
 * Migration 011: Add admin flag to users table (idempotent)
 */

import { createClient } from "@libsql/client";

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("❌ TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set.");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  try {
    console.log("🧩 Running JS migration 011: add admin flag to users (idempotent)");

    // Check if admin column exists
    const tableInfo = await client.execute({ sql: "PRAGMA table_info('users')" });
    const columns = tableInfo.rows.map(row => row.name);

    if (!columns.includes('admin')) {
      console.log("   ➕ Adding admin column to users table");
      await client.execute("ALTER TABLE users ADD COLUMN admin INTEGER DEFAULT 0");
    } else {
      console.log("   ℹ️  Column admin already exists on users, skipping");
    }

    console.log("✅ JS migration 011 complete");
  } catch (err) {
    console.error("❌ Migration 011 error:", err);
    process.exit(1);
  } finally {
    try { client.close && client.close(); } catch {}
  }
}

run();

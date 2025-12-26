#!/usr/bin/env node
/**
 * Migration 013: Add NPC reputation system (idempotent)
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
    console.log("🧩 Running JS migration 013: add NPC reputation system (idempotent)");

    // Check existing columns on dynamic_npcs
    const tableInfo = await client.execute({ sql: "PRAGMA table_info('dynamic_npcs')" });
    const columns = tableInfo.rows.map(row => row.name);

    // Add reputation column
    if (!columns.includes('reputation')) {
      console.log("   ➕ Adding reputation column");
      await client.execute("ALTER TABLE dynamic_npcs ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0");
    } else {
      console.log("   ℹ️  Column reputation already exists, skipping");
    }

    // Add quests_completed column
    if (!columns.includes('quests_completed')) {
      console.log("   ➕ Adding quests_completed column");
      await client.execute("ALTER TABLE dynamic_npcs ADD COLUMN quests_completed INTEGER NOT NULL DEFAULT 0");
    } else {
      console.log("   ℹ️  Column quests_completed already exists, skipping");
    }

    // Add last_interaction column
    if (!columns.includes('last_interaction')) {
      console.log("   ➕ Adding last_interaction column");
      await client.execute("ALTER TABLE dynamic_npcs ADD COLUMN last_interaction INTEGER");
    } else {
      console.log("   ℹ️  Column last_interaction already exists, skipping");
    }

    // Check if reputation index exists
    const indexes = await client.execute({ 
      sql: "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_dynamic_npcs_reputation'" 
    });
    
    if (indexes.rows.length === 0) {
      console.log("   ➕ Creating reputation index");
      await client.execute("CREATE INDEX idx_dynamic_npcs_reputation ON dynamic_npcs(reputation)");
    } else {
      console.log("   ℹ️  Index idx_dynamic_npcs_reputation already exists, skipping");
    }

    // Update existing NPCs with default reputations based on role
    // Only update if reputation is still 0 (default)
    console.log("   🔄 Updating default reputations based on roles");
    await client.execute(`
      UPDATE dynamic_npcs 
      SET reputation = CASE 
        WHEN role = 'enemy' THEN -50
        WHEN role = 'ally' THEN 50
        WHEN role = 'questgiver' THEN 25
        ELSE 0
      END
      WHERE reputation = 0 AND role IS NOT NULL
    `);

    console.log("✅ JS migration 013 complete");
  } catch (err) {
    console.error("❌ Migration 013 error:", err);
    process.exit(1);
  } finally {
    try { client.close && client.close(); } catch {}
  }
}

run();

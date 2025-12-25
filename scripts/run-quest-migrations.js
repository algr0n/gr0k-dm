#!/usr/bin/env node
/**
 * Run quest system migrations (005 and 006)
 * Usage:
 *   node scripts/run-quest-migrations.js
 * 
 * Reads TURSO credentials from GitHub Secrets via environment
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("❌ TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set.");
    console.error("Set them in your environment or .env file.");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  try {
    console.log("🚀 Running quest system migrations...\n");

    // Migration 005: Dynamic NPCs and Locations
    console.log("📝 Migration 005: Adding dynamic_npcs and dynamic_locations tables...");
    const migration005 = readFileSync(
      join(__dirname, "..", "migrations", "005_add_dynamic_npcs_locations.sql"),
      "utf-8"
    );
    await client.executeMultiple(migration005);
    console.log("✅ Migration 005 complete\n");

    // Migration 006: Quest Status and NPC Quest Givers
    console.log("📝 Migration 006: Adding quest status and NPC quest giver linking...");
    const migration006 = readFileSync(
      join(__dirname, "..", "migrations", "006_add_quest_status_and_npc_questgivers.sql"),
      "utf-8"
    );
    
    // Execute each statement individually (SQLite doesn't support multiple ALTER TABLE in one go)
    const statements = migration006
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      await client.execute(statement);
    }
    console.log("✅ Migration 006 complete\n");

    console.log("🎉 All quest system migrations completed successfully!");

  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    try { client.close && client.close(); } catch {}
  }
}

run();

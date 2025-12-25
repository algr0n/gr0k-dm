#!/usr/bin/env node
/**
 * Generic migration runner - runs all .sql migrations in order
 * Usage:
 *   node scripts/run-all-migrations.js [startFrom]
 * 
 * Examples:
 *   node scripts/run-all-migrations.js         # Run all migrations
 *   node scripts/run-all-migrations.js 005     # Run from migration 005 onwards
 * 
 * Reads TURSO credentials from environment variables
 */

import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "fs";
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

  const startFrom = process.argv[2] || "000";
  const migrationsDir = join(__dirname, "..", "migrations");
  
  // Get all .sql files, sorted by name
  const allFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql") && f >= startFrom)
    .sort();

  if (allFiles.length === 0) {
    console.log("✅ No migrations to run.");
    return;
  }

  const client = createClient({ url, authToken });

  try {
    console.log(`🚀 Running ${allFiles.length} migration(s)...\n`);

    for (const file of allFiles) {
      console.log(`📝 ${file}...`);
      const migrationPath = join(migrationsDir, file);
      const migrationSQL = readFileSync(migrationPath, "utf-8");

      // Try to execute as a batch first (for BEGIN TRANSACTION blocks)
      try {
        await client.executeMultiple(migrationSQL);
      } catch (err) {
        // If batch fails, try executing statements individually
        console.log("   ⚠️  Batch execution failed, trying statement-by-statement...");
        const statements = migrationSQL
          .split(";")
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith("--"));
        
        for (const statement of statements) {
          try {
            await client.execute(statement);
          } catch (stmtErr) {
            // Ignore "already exists" errors
            if (stmtErr.message && stmtErr.message.includes("already exists")) {
              console.log(`   ℹ️  Skipping (already exists)`);
            } else {
              throw stmtErr;
            }
          }
        }
      }
      
      console.log(`   ✅ Complete\n`);
    }

    console.log("🎉 All migrations completed successfully!");

  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    try { client.close && client.close(); } catch {}
  }
}

run();

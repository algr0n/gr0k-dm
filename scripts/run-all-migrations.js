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
import { readFileSync, readdirSync, existsSync } from "fs";
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

      // If a JS migration exists for this SQL file, run it instead (idempotent JS handles checks)
      const jsMigrationPath = join(__dirname, "..", "scripts", "migrations-js", file.replace('.sql', '.js'));
      if (existsSync(jsMigrationPath)) {
        console.log(`   🧩 Found JS migration for ${file}, running ${jsMigrationPath}`);
        // Run the JS migration as a child process so it has a full runtime and logs to stdout
        const { spawn } = await import('child_process');
        await new Promise((resolve, reject) => {
          const cp = spawn('node', [jsMigrationPath], { stdio: 'inherit' });
          cp.on('close', (code) => code === 0 ? resolve() : reject(new Error(`JS migration failed with code ${code}`)));
        });
        console.log(`   ✅ JS migration complete\n`);
        continue;
      }

      const migrationPath = join(migrationsDir, file);
      const migrationSQL = readFileSync(migrationPath, "utf-8");

      // Try to execute as a batch first (for BEGIN TRANSACTION blocks)
      try {
        await client.executeMultiple(migrationSQL);
      } catch (err) {
        // If batch fails, log the underlying error and try executing statements individually
        console.log("   ⚠️  Batch execution failed, trying statement-by-statement...");
        // Print a concise error message and the first few stack lines for quick diagnostics
        console.log("   ❌ Batch error:", err && err.message ? err.message : err);
        if (err && err.stack) {
          const shortStack = err.stack.split("\n").slice(0,3).join("\n");
          console.log(shortStack);
        }

        const statements = migrationSQL
          .split(";")
          // Strip out SQL line comments and collapse lines so comments don't prevent parsing
          .map(s => s.split('\n').map(l => l.trim()).filter(l => !l.startsWith('--')).join(' ').trim())
          .filter(s => s.length > 0);

        console.log(`   · Found ${statements.length} statements in the migration`);

        for (const statement of statements) {
          // Proactive checks: avoid running ALTER/CREATE statements that would duplicate
          const normalized = statement.replace(/\s+/g, ' ').trim();
          // DEBUG: print statement snippet (trim long statements)
          console.log(`   · stmt: ${normalized.replace(/\n/g, ' ').slice(0, 120)}${normalized.length > 120 ? '...' : ''}`);

          // Check for ALTER TABLE ... ADD COLUMN
          const alterMatch = statement.match(/ALTER\s+TABLE\s+["'`]?([\w_]+)["'`]?.*?ADD\s+COLUMN\s+["'`]?([\w_]+)["'`]?/i);
          if (alterMatch) {
            const table = alterMatch[1];
            const column = alterMatch[2];
            try {
              const info = await client.execute({ sql: `PRAGMA table_info('${table}')` });
              const cols = (info && info.rows) ? info.rows.map(r => r.name) : [];
              if (cols.includes(column)) {
                console.log(`   ℹ️  Skipping ALTER TABLE ${table} ADD COLUMN ${column} (already exists)`);
                continue;
              }
            } catch (checkErr) {
              // If the check fails, fall back to running the statement so the original behavior remains
              console.log(`   ⚠️  Could not check table info for ${table}, executing statement anyway`);
            }
          }

          // Check for CREATE TABLE
          const createTableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([\w_]+)["'`]?/i);
          if (createTableMatch) {
            const table = createTableMatch[1];
            try {
              const exists = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'` });
              if (exists && exists.rows && exists.rows.length > 0) {
                console.log(`   ℹ️  Skipping CREATE TABLE ${table} (already exists)`);
                continue;
              }
            } catch (checkErr) {
              console.log(`   ⚠️  Could not check if table ${table} exists, executing statement anyway`);
            }
          }

          // Check for CREATE INDEX
          const createIndexMatch = statement.match(/CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([\w_]+)["'`]?/i);
          if (createIndexMatch) {
            const index = createIndexMatch[1];
            try {
              const exists = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type='index' AND name='${index}'` });
              if (exists && exists.rows && exists.rows.length > 0) {
                console.log(`   ℹ️  Skipping CREATE INDEX ${index} (already exists)`);
                continue;
              }
            } catch (checkErr) {
              console.log(`   ⚠️  Could not check if index ${index} exists, executing statement anyway`);
            }
          }

          try {
            await client.execute(statement);
          } catch (stmtErr) {
            // Ignore various "already exists" / duplicate errors from SQLite
            const msg = (stmtErr && stmtErr.message) ? stmtErr.message.toLowerCase() : '';
            if (
              msg.includes('already exists') ||
              msg.includes('duplicate column name') ||
              (msg.includes('duplicate') && msg.includes('column')) ||
              msg.includes('unique constraint') ||
              msg.includes('already an index') ||
              msg.includes('duplicate key')
            ) {
              console.log(`   ℹ️  Skipping (already exists / duplicate): ${stmtErr.message}`);
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

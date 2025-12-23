#!/usr/bin/env tsx
/**
 * Automatic Database Migration Runner
 * 
 * This script applies pending SQL migrations from the migrations/ directory
 * using Drizzle ORM's migrate function. It runs automatically before the
 * server starts in production.
 * 
 * Features:
 * - Applies all pending migrations in order
 * - Idempotent (safe to run multiple times)
 * - Proper error handling and logging
 * - Compatible with Turso/libSQL
 * 
 * Usage:
 *   npm run migrate:prod
 *   
 * Or directly:
 *   TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> tsx script/run-migrations.ts
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { resolve } from "path";
import { config } from "dotenv";

// Load environment variables
config({ path: resolve(process.cwd(), ".env") });

async function runMigrations() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // Validate required environment variables
  if (!dbUrl) {
    console.error("❌ Error: TURSO_DATABASE_URL environment variable is not set");
    console.error("   Please set your database connection URL");
    process.exit(1);
  }

  console.log("🔄 Starting database migrations...");
  console.log(`📍 Database: ${dbUrl.substring(0, 40)}...`);

  let client;
  
  try {
    // Create database client
    client = createClient({
      url: dbUrl,
      authToken: authToken,
    });

    // Create Drizzle instance
    const db = drizzle(client);

    console.log("📂 Applying migrations from ./migrations directory...");

    // Run migrations
    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), "./migrations"),
    });

    console.log("✅ All migrations applied successfully!");
    console.log("🎉 Database is up to date");

  } catch (error) {
    console.error("\n❌ Migration failed:");
    
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      // Provide helpful error context
      if (error.message.includes("no such table")) {
        console.error("\n💡 Tip: This might be a new database. Migrations will create the tables.");
      } else if (error.message.includes("authentication") || error.message.includes("token")) {
        console.error("\n💡 Tip: Check that TURSO_AUTH_TOKEN is valid and not expired.");
      } else if (error.message.includes("connect") || error.message.includes("network")) {
        console.error("\n💡 Tip: Verify network connection and that TURSO_DATABASE_URL is correct.");
      }
    } else {
      console.error(`   ${error}`);
    }
    
    console.error("\n📚 For more help, see MIGRATIONS.md");
    process.exit(1);
    
  } finally {
    // Clean up database connection
    if (client) {
      try {
        client.close();
      } catch (closeError) {
        // Ignore errors during cleanup
        console.error("Warning: Error closing database connection:", closeError);
      }
    }
  }
}

// Run migrations
runMigrations();

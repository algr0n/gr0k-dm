import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error(
    "❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables"
  );
  process.exit(1);
}

async function runMigration() {
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  try {
    console.log("🔍 Checking if currency column exists...");
    const result = await client.execute(
      "PRAGMA table_info(unified_characters);"
    );

    const hasCurrencyColumn = result.rows.some(
      (row: any) => row.name === "currency"
    );

    if (!hasCurrencyColumn) {
      console.log(
        "✅ Currency column does not exist. Schema is already clean."
      );
      return;
    }

    console.log("❌ Found currency column. Running migration...");

    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "migrations",
      "0002_remove_currency_column.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await client.execute(statement);
    }

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

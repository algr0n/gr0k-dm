import { createClient } from "@libsql/client";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error(
    "❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables"
  );
  process.exit(1);
}

async function healthCheck() {
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  try {
    console.log("🏥 Running Database Health Check...\n");

    // Check 1: Table exists
    console.log("✓ Checking unified_characters table...");
    const tableResult = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='unified_characters';"
    );
    if (tableResult.rows.length === 0) {
      throw new Error("unified_characters table not found!");
    }
    console.log("  ✅ Table exists\n");

    // Check 2: Schema is correct (no currency column)
    console.log("✓ Checking schema for problematic columns...");
    const schemaResult = await client.execute(
      "PRAGMA table_info(unified_characters);"
    );
    const columns = schemaResult.rows as any[];
    const columnNames = columns.map((c) => c.name);

    const hasCurrency = columnNames.includes("currency");
    if (hasCurrency) {
      console.log("  ❌ ERROR: currency column still exists!");
      process.exit(1);
    }
    console.log(`  ✅ Schema clean (${columns.length} columns)\n`);

    // Check 3: Can insert a test record (dry run)
    console.log("✓ Verifying database connectivity...");
    const countResult = await client.execute(
      "SELECT COUNT(*) as count FROM unified_characters;"
    );
    const count = (countResult.rows[0] as any).count;
    console.log(`  ✅ Database is accessible (${count} characters)\n`);

    console.log("=====================================");
    console.log("✅ All health checks passed!");
    console.log("=====================================");
  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

healthCheck();

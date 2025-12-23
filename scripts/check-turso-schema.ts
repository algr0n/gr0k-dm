import { createClient } from "@libsql/client";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error(
    "❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables"
  );
  process.exit(1);
}

async function checkSchema() {
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  try {
    console.log("🔍 Checking unified_characters schema...\n");
    const result = await client.execute(
      "PRAGMA table_info(unified_characters);"
    );

    console.log("Columns in unified_characters table:");
    console.log("=====================================");
    
    const columns = result.rows as any[];
    columns.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    const hasCurrency = columns.some((col) => col.name === "currency");
    console.log("\n" + (hasCurrency ? "❌ Currency column EXISTS" : "✅ Currency column does NOT exist"));

    // Also check total row count
    const countResult = await client.execute(
      "SELECT COUNT(*) as count FROM unified_characters;"
    );
    const count = (countResult.rows[0] as any).count;
    console.log(`📊 Total characters in database: ${count}`);
  } catch (error) {
    console.error("❌ Error checking schema:", error);
    process.exit(1);
  }
}

checkSchema();

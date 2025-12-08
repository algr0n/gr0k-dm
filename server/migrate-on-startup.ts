// server/migrate-on-startup.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

async function runMigrationsIfNeeded() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL — skipping migrations');
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    
    // Check if users table exists
    const res = await client.query("SELECT to_regclass('public.users')");
    
    if (res.rows[0].to_regclass) {
      console.log('✓ Database tables already exist — skipping migration');
      await client.end();
      return;
    }

    console.log('Running database migrations...');
    await client.end();

    // Create drizzle instance for migrations
    const db = drizzle(client);
    
    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder: "./migrations" });
    
    console.log('✓ All migrations completed successfully!');
    
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  }
}

// Run it immediately
runMigrationsIfNeeded();

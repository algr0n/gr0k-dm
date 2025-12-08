// server/migrate-on-startup.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function runMigrationsIfNeeded() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL — skipping migrations');
    return;
  }

  const checkClient = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    await checkClient.connect();
    
    // Check if users table exists
    const res = await checkClient.query("SELECT to_regclass('public.users')");
    
    if (res.rows[0].to_regclass) {
      console.log('✓ Database tables already exist — skipping migration');
      await checkClient.end();
      return;
    }

    console.log('Running database migrations...');
    
    // Close the check connection FIRST
    await checkClient.end();

    // Create NEW pool for migrations (don't reuse closed client)
    const migrationPool = new pg.Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    
    const db = drizzle(migrationPool);
    
    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder: "./migrations" });
    
    console.log('✓ All migrations completed successfully!');
    
    // Close the migration pool
    await migrationPool.end();
    
  } catch (err) {
    console.error('✗ Migration failed:', err);
    await checkClient.end().catch(() => {}); // Safely close if still open
    process.exit(1);
  }
}

// Run it and WAIT for it to complete before continuing
await runMigrationsIfNeeded();

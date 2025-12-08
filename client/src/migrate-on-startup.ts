import { execSync } from 'child_process';
import { Client } from 'pg';

async function runMigrationsIfNeeded() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL — skipping migrations');
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT to_regclass('public.users')");
    if (res.rows[0].to_regclass) {
      console.log('users table already exists — skipping migration');
      return;
    }

    console.log('Running drizzle-kit push:pg...');
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
    console.log('All tables created!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

// Run it immediately
runMigrationsIfNeeded();

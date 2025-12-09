#!/usr/bin/env node
/**
 * Database migration script
 * 
 * This script applies the database schema to the configured Turso database using drizzle-kit.
 * It should be run during deployment or when setting up a new environment.
 * 
 * Usage:
 *   npm run db:migrate-prod
 *   
 * Or directly:
 *   TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> node script/migrate-db.js
 */

import { execSync } from 'child_process';

function runMigration() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl) {
    console.error('Error: TURSO_DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  console.log(`Database URL: ${dbUrl.substring(0, 30)}...`);

  try {
    console.log('Running migrations with drizzle-kit...');
    
    // Use drizzle-kit push which applies schema directly to the database
    // This is safer than migrate for SQLite/libSQL as it handles the schema comparison
    execSync('npx drizzle-kit push', {
      stdio: 'inherit',
      env: {
        ...process.env,
        TURSO_DATABASE_URL: dbUrl,
        TURSO_AUTH_TOKEN: authToken,
      }
    });
    
    console.log('✓ Database migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();


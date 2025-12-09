#!/usr/bin/env node
/**
 * Database connectivity and schema verification script
 * 
 * This script checks:
 * 1. Can connect to Turso database
 * 2. Which tables exist in the database
 * 3. If required tables are present
 * 
 * Usage:
 *   TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> node script/check-db.mjs
 */

import { createClient } from '@libsql/client';

const REQUIRED_TABLES = [
  'items',
  'spells',
  'rooms',
  'players',
  'users',
  'unified_characters',
  'character_inventory_items',
  'character_status_effects',
  'sessions',
  'dice_rolls',
  'characters',
  'inventory_items',
];

async function checkDatabase() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl) {
    console.error('❌ Error: TURSO_DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔍 Checking database connection...');
  console.log(`   Database URL: ${dbUrl.substring(0, 40)}...`);

  let client;
  try {
    client = createClient({
      url: dbUrl,
      authToken: authToken,
    });

    console.log('✅ Successfully connected to database\n');

    // Query for existing tables
    console.log('📋 Checking tables...');
    const result = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);

    const existingTables = new Set(result.rows.map(row => row.name));
    console.log(`   Found ${existingTables.size} tables\n`);

    // Check required tables
    let missingTables = [];
    let foundTables = [];

    for (const table of REQUIRED_TABLES) {
      if (existingTables.has(table)) {
        foundTables.push(table);
        console.log(`✅ ${table}`);
      } else {
        missingTables.push(table);
        console.log(`❌ ${table} - MISSING`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Summary: ${foundTables.length}/${REQUIRED_TABLES.length} required tables present`);
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables detected!');
      console.log('   Please run: npm run db:migrate-prod');
      console.log('   See MIGRATION_FIX_INSTRUCTIONS.md for details');
      process.exit(1);
    } else {
      console.log('\n✅ All required tables are present!');
      console.log('   Database schema is up to date.');
    }

  } catch (error) {
    console.error('\n❌ Database check failed:');
    console.error('   ', error.message);
    console.error('\nTroubleshooting:');
    console.error('   1. Verify TURSO_DATABASE_URL is correct');
    console.error('   2. Verify TURSO_AUTH_TOKEN is valid');
    console.error('   3. Check network connectivity to Turso');
    process.exit(1);
  } finally {
    if (client) {
      client.close();
    }
  }
}

checkDatabase();
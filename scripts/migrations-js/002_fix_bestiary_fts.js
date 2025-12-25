#!/usr/bin/env node
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) { console.error('Missing Turso env vars'); process.exit(1); }
const client = createClient({ url, authToken });

async function tableExists(name) {
  const res = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type IN ('table','virtual table') AND name='${name}'` });
  return res && res.rows && res.rows.length > 0;
}

async function run() {
  console.log('🧩 Running JS migration 002: fix bestiary FTS (idempotent)');
  try {
    if (await tableExists('bestiary_fts')) {
      console.log('   ℹ️  Dropping existing bestiary_fts');
      await client.execute({ sql: `DROP TABLE IF EXISTS bestiary_fts` });
    }

    console.log('   ➕ Creating bestiary_fts virtual table');
    await client.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS bestiary_fts USING fts5(
      monster_id UNINDEXED,
      name,
      description,
      traits_text,
      actions_text
    );` });

    console.log('✅ JS migration 002 complete');
  } catch (err) {
    console.error('❌ JS migration 002 failed:', err.message || err);
    throw err;
  }
}

run().catch(err => { process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });
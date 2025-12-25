#!/usr/bin/env node
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) { console.error('Missing Turso env vars'); process.exit(1); }

const client = createClient({ url, authToken });

async function columnExists(table, column) {
  const res = await client.execute({ sql: `PRAGMA table_info('${table}')` });
  const cols = (res && res.rows) ? res.rows.map(r => r.name) : [];
  return cols.includes(column);
}

async function run() {
  console.log('🧩 Running JS migration 0001: add password_hash to rooms (idempotent)');

  const exists = await columnExists('rooms', 'password_hash');
  if (exists) {
    console.log('   ℹ️  Column password_hash already exists on rooms, skipping');
    console.log('✅ JS migration 0001 complete');
    return;
  }

  try {
    console.log('   ➕ Adding password_hash column to rooms...');
    await client.execute({ sql: `ALTER TABLE rooms ADD COLUMN password_hash TEXT` });
    console.log('✅ JS migration 0001 complete');
  } catch (err) {
    console.error('❌ JS migration 0001 failed:', err.message || err);
    throw err;
  }
}

run().catch(err => { process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });
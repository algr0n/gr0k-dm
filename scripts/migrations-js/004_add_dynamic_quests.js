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

async function indexExists(index) {
  const res = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type='index' AND name='${index}'` });
  return res && res.rows && res.rows.length > 0;
}

async function run() {
  console.log('🧩 Running JS migration 004: add dynamic quests (idempotent)');

  await client.execute({ sql: `PRAGMA foreign_keys = ON` });

  // Columns to add on adventure_quests
  const columns = [
    { name: 'room_id', sql: `ALTER TABLE adventure_quests ADD COLUMN room_id TEXT` },
    { name: 'quest_giver', sql: `ALTER TABLE adventure_quests ADD COLUMN quest_giver TEXT` },
    { name: 'is_dynamic', sql: `ALTER TABLE adventure_quests ADD COLUMN is_dynamic INTEGER DEFAULT 0 NOT NULL` },
    { name: 'urgency', sql: `ALTER TABLE adventure_quests ADD COLUMN urgency TEXT` },
  ];

  for (const col of columns) {
    const exists = await columnExists('adventure_quests', col.name);
    if (exists) {
      console.log(`   ℹ️  Column ${col.name} already exists on adventure_quests, skipping`);
      continue;
    }
    console.log(`   ➕ Adding column ${col.name} to adventure_quests...`);
    await client.execute({ sql: col.sql });
  }

  // Indexes
  const indexes = [
    { name: 'idx_quests_room', sql: `CREATE INDEX IF NOT EXISTS idx_quests_room ON adventure_quests(room_id)` },
    { name: 'idx_quests_dynamic', sql: `CREATE INDEX IF NOT EXISTS idx_quests_dynamic ON adventure_quests(is_dynamic)` },
  ];

  for (const idx of indexes) {
    const exists = await indexExists(idx.name);
    if (exists) {
      console.log(`   ℹ️  Index ${idx.name} already exists, skipping`);
      continue;
    }
    console.log(`   ➕ Creating index ${idx.name}...`);
    await client.execute({ sql: idx.sql });
  }

  console.log('✅ JS migration 004 complete');
}

run().catch(err => { console.error('❌ Migration 004 failed:', err); process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });

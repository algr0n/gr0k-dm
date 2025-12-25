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
  console.log('🧩 Running JS migration 006: quest status & NPC quest givers (idempotent)');

  // Migration statements
  const checks = [
    { table: 'adventure_quests', column: 'status', sql: `ALTER TABLE adventure_quests ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'in_progress', 'completed', 'failed'))` },
    { table: 'adventure_quests', column: 'dynamic_quest_giver_id', sql: `ALTER TABLE adventure_quests ADD COLUMN dynamic_quest_giver_id TEXT REFERENCES dynamic_npcs(id) ON DELETE SET NULL` },
    { table: 'dynamic_npcs', column: 'is_quest_giver', sql: `ALTER TABLE dynamic_npcs ADD COLUMN is_quest_giver INTEGER DEFAULT 0 CHECK(is_quest_giver IN (0, 1))` },
  ];

  for (const c of checks) {
    const exists = await columnExists(c.table, c.column);
    if (exists) {
      console.log(`   ℹ️  Column ${c.column} already exists on ${c.table}, skipping`);
      continue;
    }
    console.log(`   ➕ Adding column ${c.column} to ${c.table}...`);
    await client.execute({ sql: c.sql });
  }

  const indexes = [
    { name: 'idx_quests_status', sql: `CREATE INDEX IF NOT EXISTS idx_quests_status ON adventure_quests(status)` },
    { name: 'idx_quests_dynamic_giver', sql: `CREATE INDEX IF NOT EXISTS idx_quests_dynamic_giver ON adventure_quests(dynamic_quest_giver_id)` },
    { name: 'idx_dynamic_npcs_quest_giver', sql: `CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_quest_giver ON dynamic_npcs(is_quest_giver)` },
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

  console.log('✅ JS migration 006 complete');
}

run().catch(err => { console.error('❌ Migration 006 failed:', err); process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });

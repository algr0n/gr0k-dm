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

async function tableExists(name) {
  const res = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type IN ('table','virtual table') AND name='${name}'` });
  return res && res.rows && res.rows.length > 0;
}

async function run() {
  console.log('🧩 Running JS migration 003: add story tracking and room migrations (idempotent)');

  // Many of the story tracking tables are created with IF NOT EXISTS in SQL; ensure they exist.
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS quest_objective_progress (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      room_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      objective_index INTEGER NOT NULL,
      objective_text TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0 NOT NULL,
      completed_at INTEGER,
      completed_by TEXT,
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (quest_id) REFERENCES adventure_quests(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_quest_progress_room ON quest_objective_progress(room_id);`,
    `CREATE INDEX IF NOT EXISTS idx_quest_progress_quest ON quest_objective_progress(quest_id);`,

    `CREATE TABLE IF NOT EXISTS story_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      room_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      participants TEXT DEFAULT '[]' NOT NULL,
      related_quest_id TEXT,
      related_npc_id TEXT,
      related_location_id TEXT,
      importance INTEGER DEFAULT 1 NOT NULL,
      timestamp INTEGER DEFAULT (unixepoch()) NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_story_events_room ON story_events(room_id);`,
    `CREATE INDEX IF NOT EXISTS idx_story_events_type ON story_events(event_type);`,
    `CREATE INDEX IF NOT EXISTS idx_story_events_importance ON story_events(importance);`,

    `CREATE TABLE IF NOT EXISTS session_summaries (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      room_id TEXT NOT NULL,
      session_number INTEGER NOT NULL,
      summary TEXT NOT NULL,
      key_events TEXT DEFAULT '[]' NOT NULL,
      quests_progressed TEXT DEFAULT '[]' NOT NULL,
      npcs_encountered TEXT DEFAULT '[]' NOT NULL,
      locations_visited TEXT DEFAULT '[]' NOT NULL,
      message_count INTEGER DEFAULT 0 NOT NULL,
      started_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      ended_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_session_summaries_room ON session_summaries(room_id);`,
    `CREATE INDEX IF NOT EXISTS idx_session_summaries_number ON session_summaries(session_number);`
  ];

  try {
    for (const s of createStatements) {
      await client.execute({ sql: s });
    }

    // The SQL migration also recreated the `rooms` table to add password_hash and adventure fields.
    // If any of those columns already exist, skip the table swap; otherwise perform the safe copy/rename process.
    const needsRoomRebuild = !(await columnExists('rooms', 'password_hash')) || !(await columnExists('rooms', 'adventure_id')) || !(await columnExists('rooms', 'use_adventure_mode'));

    if (!needsRoomRebuild) {
      console.log('   ℹ️  rooms table already has target columns, skipping rebuild');
    } else {
      console.log('   ➕ Rebuilding rooms table to add missing columns (password_hash / adventure_id / use_adventure_mode)');
      await client.execute({ sql: `PRAGMA foreign_keys=OFF;` });

      await client.execute({ sql: `CREATE TABLE IF NOT EXISTS __new_rooms (
        id text PRIMARY KEY NOT NULL,
        code text NOT NULL,
        name text NOT NULL,
        game_system text DEFAULT 'dnd' NOT NULL,
        host_name text NOT NULL,
        description text,
        current_scene text,
        message_history text DEFAULT '[]' NOT NULL,
        is_active integer DEFAULT true NOT NULL,
        is_public integer DEFAULT true NOT NULL,
        max_players integer DEFAULT 6 NOT NULL,
        password_hash text,
        adventure_id text,
        use_adventure_mode integer DEFAULT false,
        last_activity_at integer DEFAULT (unixepoch()) NOT NULL,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch())
      );` });

      await client.execute({ sql: `INSERT INTO __new_rooms (id, code, name, game_system, host_name, description, current_scene, message_history, is_active, is_public, max_players, password_hash, adventure_id, use_adventure_mode, last_activity_at, created_at, updated_at)
        SELECT id, code, name, game_system, host_name, description, current_scene, message_history, is_active, is_public, max_players, password_hash, adventure_id, use_adventure_mode, last_activity_at, created_at, updated_at FROM rooms;` });

      await client.execute({ sql: `DROP TABLE IF EXISTS rooms;` });
      await client.execute({ sql: `ALTER TABLE __new_rooms RENAME TO rooms;` });
      await client.execute({ sql: `PRAGMA foreign_keys=ON;` });

      // Recreate indexes
      await client.execute({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON rooms (code);` });
      await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms (code);` });
      await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms (is_active);` });
      await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_rooms_adventure ON rooms (adventure_id);` });

      console.log('   ✅ rooms table rebuilt');
    }

    console.log('✅ JS migration 003 complete');
  } catch (err) {
    console.error('❌ JS migration 003 failed:', err.message || err);
    throw err;
  }
}

run().catch(err => { process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });
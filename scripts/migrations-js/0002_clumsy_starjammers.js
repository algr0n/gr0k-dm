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

async function indexExists(name) {
  const res = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type='index' AND name='${name}'` });
  return res && res.rows && res.rows.length > 0;
}

async function run() {
  console.log('🧩 Running JS migration 0002: room/adventure progress & related tables (idempotent)');

  try {
    const tables = [
      { name: 'room_adventure_progress', sql: `CREATE TABLE IF NOT EXISTS room_adventure_progress (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        room_id text NOT NULL,
        adventure_id text NOT NULL,
        current_chapter_id text,
        current_location_id text,
        completed_chapter_ids text DEFAULT '[]',
        discovered_location_ids text DEFAULT '[]',
        completed_quest_ids text DEFAULT '[]',
        active_quest_ids text DEFAULT '[]',
        completed_encounter_ids text DEFAULT '[]',
        met_npc_ids text DEFAULT '[]',
        notes text,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch()),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE no action ON DELETE cascade
      );` },
      { name: 'adventure_chapters', sql: `CREATE TABLE IF NOT EXISTS adventure_chapters (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        adventure_id text NOT NULL,
        chapter_number integer NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        objectives text DEFAULT '[]' NOT NULL,
        summary text,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE
      );` },
      { name: 'adventure_encounters', sql: `CREATE TABLE IF NOT EXISTS adventure_encounters (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        adventure_id text NOT NULL,
        location_id text,
        name text NOT NULL,
        type text NOT NULL,
        difficulty text,
        description text NOT NULL,
        enemies text DEFAULT '[]',
        xp_reward integer DEFAULT 0,
        treasure text DEFAULT '[]',
        trigger_condition text,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES adventure_locations(id) ON DELETE CASCADE
      );` },
      { name: 'adventure_locations', sql: `CREATE TABLE IF NOT EXISTS adventure_locations (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        adventure_id text NOT NULL,
        chapter_id text,
        name text NOT NULL,
        type text NOT NULL,
        description text NOT NULL,
        boxed_text text,
        map_image_url text,
        features text DEFAULT '[]',
        connections text DEFAULT '[]',
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES adventure_chapters(id) ON DELETE CASCADE
      );` },
      { name: 'adventure_npcs', sql: `CREATE TABLE IF NOT EXISTS adventure_npcs (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        adventure_id text NOT NULL,
        location_id text,
        name text NOT NULL,
        race text,
        role text NOT NULL,
        description text NOT NULL,
        personality text,
        ideals text,
        bonds text,
        flaws text,
        stats_block text,
        quest_connections text DEFAULT '[]',
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES adventure_locations(id) ON DELETE SET NULL
      );` },
      { name: 'adventure_quests', sql: `CREATE TABLE IF NOT EXISTS adventure_quests (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        adventure_id text NOT NULL,
        chapter_id text,
        quest_giver_id text,
        name text NOT NULL,
        description text NOT NULL,
        objectives text DEFAULT '[]' NOT NULL,
        rewards text,
        is_main_quest integer DEFAULT false NOT NULL,
        prerequisite_quest_ids text DEFAULT '[]',
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (chapter_id) REFERENCES adventure_chapters(id) ON UPDATE no action ON DELETE set null,
        FOREIGN KEY (quest_giver_id) REFERENCES adventure_npcs(id) ON UPDATE no action ON DELETE set null
      );` },
      { name: 'adventures', sql: `CREATE TABLE IF NOT EXISTS adventures (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        slug text NOT NULL,
        name text NOT NULL,
        description text NOT NULL,
        long_description text,
        game_system text DEFAULT 'dnd' NOT NULL,
        min_level integer DEFAULT 1 NOT NULL,
        max_level integer DEFAULT 5 NOT NULL,
        estimated_hours text,
        source text NOT NULL,
        cover_image_url text,
        is_published integer DEFAULT true NOT NULL,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch())
      );` }
    ];

    for (const t of tables) {
      if (await tableExists(t.name)) {
        console.log(`   ℹ️  Skipping CREATE TABLE ${t.name} (already exists)`);
        continue;
      }
      console.log(`   ➕ Creating table ${t.name}...`);
      await client.execute({ sql: t.sql });
    }

    const indexes = [
      { name: 'idx_progress_room', sql: `CREATE INDEX IF NOT EXISTS idx_progress_room ON room_adventure_progress(room_id)` },
      { name: 'idx_progress_adventure', sql: `CREATE INDEX IF NOT EXISTS idx_progress_adventure ON room_adventure_progress(adventure_id)` },
      { name: 'idx_chapters_adventure', sql: `CREATE INDEX IF NOT EXISTS idx_chapters_adventure ON adventure_chapters(adventure_id)` },
      { name: 'idx_chapters_number', sql: `CREATE INDEX IF NOT EXISTS idx_chapters_number ON adventure_chapters(chapter_number)` },
      { name: 'idx_encounters_adventure', sql: `CREATE INDEX IF NOT EXISTS idx_encounters_adventure ON adventure_encounters(adventure_id)` },
      { name: 'idx_encounters_location', sql: `CREATE INDEX IF NOT EXISTS idx_encounters_location ON adventure_encounters(location_id)` },
      { name: 'idx_encounters_type', sql: `CREATE INDEX IF NOT EXISTS idx_encounters_type ON adventure_encounters(type)` },
      { name: 'idx_locations_adventure', sql: `CREATE INDEX IF NOT EXISTS idx_locations_adventure ON adventure_locations(adventure_id)` },
      { name: 'idx_locations_chapter', sql: `CREATE INDEX IF NOT EXISTS idx_locations_chapter ON adventure_locations(chapter_id)` },
      { name: 'idx_locations_type', sql: `CREATE INDEX IF NOT EXISTS idx_locations_type ON adventure_locations(type)` },
      { name: 'idx_npcs_adventure', sql: `CREATE INDEX IF NOT EXISTS idx_npcs_adventure ON adventure_npcs(adventure_id)` },
      { name: 'idx_npcs_location', sql: `CREATE INDEX IF NOT EXISTS idx_npcs_location ON adventure_npcs(location_id)` },
      { name: 'idx_npcs_role', sql: `CREATE INDEX IF NOT EXISTS idx_npcs_role ON adventure_npcs(role)` },
      { name: 'idx_quests_adventure', sql: `CREATE INDEX IF NOT EXISTS idx_quests_adventure ON adventure_quests(adventure_id)` },
      { name: 'idx_quests_chapter', sql: `CREATE INDEX IF NOT EXISTS idx_quests_chapter ON adventure_quests(chapter_id)` },
      { name: 'idx_quests_giver', sql: `CREATE INDEX IF NOT EXISTS idx_quests_giver ON adventure_quests(quest_giver_id)` },
      { name: 'adventures_slug_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS adventures_slug_unique ON adventures (slug)` },
      { name: 'idx_adventures_slug', sql: `CREATE INDEX IF NOT EXISTS idx_adventures_slug ON adventures (slug)` },
      { name: 'idx_adventures_published', sql: `CREATE INDEX IF NOT EXISTS idx_adventures_published ON adventures (is_published)` },
      { name: 'idx_adventures_game_system', sql: `CREATE INDEX IF NOT EXISTS idx_adventures_game_system ON adventures (game_system)` }
    ];

    for (const idx of indexes) {
      if (await indexExists(idx.name)) {
        console.log(`   ℹ️  Skipping ${idx.name} (already exists)`);
        continue;
      }
      console.log(`   ➕ Creating index ${idx.name}...`);
      await client.execute({ sql: idx.sql });
    }

    // The SQL originally swapped rooms table; keep behavior idempotent: only rebuild rooms if missing expected columns
    const roomColsNeeded = ['password_hash','adventure_id','use_adventure_mode'];
    const res = await client.execute({ sql: `PRAGMA table_info('rooms')` });
    const existingCols = (res && res.rows) ? res.rows.map(r => r.name) : [];
    const missing = roomColsNeeded.filter(c => !existingCols.includes(c));

    if (missing.length === 0) {
      console.log('   ℹ️  rooms table already contains new columns, skipping rebuild');
    } else {
      console.log('   ➕ Rebuilding rooms table to add missing columns');
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

      await client.execute({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON rooms (code);` });
      await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms (code);` });
      await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms (is_active);` });
      await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_rooms_adventure ON rooms (adventure_id);` });

      console.log('   ✅ rooms table rebuilt');
    }

    console.log('✅ JS migration 0002 complete');
  } catch (err) {
    console.error('❌ JS migration 0002 failed:', err.message || err);
    throw err;
  }
}

run().catch(err => { process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });
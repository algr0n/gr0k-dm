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
  console.log('🧩 Running JS migration 0000: create core tables & indexes (idempotent)');

  try {
    const tableCreates = [
      { name: 'character_inventory_items', sql: `CREATE TABLE IF NOT EXISTS character_inventory_items (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        character_id text NOT NULL,
        item_id text NOT NULL,
        quantity integer DEFAULT 1 NOT NULL,
        equipped integer DEFAULT false NOT NULL,
        notes text,
        attunement_slot integer DEFAULT false,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch()),
        FOREIGN KEY (character_id) REFERENCES unified_characters(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (item_id) REFERENCES items(id) ON UPDATE no action ON DELETE restrict
      );` },
      { name: 'character_status_effects', sql: `CREATE TABLE IF NOT EXISTS character_status_effects (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        character_id text NOT NULL,
        name text NOT NULL,
        description text,
        is_predefined integer DEFAULT true NOT NULL,
        duration text,
        applied_by_dm integer DEFAULT true NOT NULL,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (character_id) REFERENCES unified_characters(id) ON UPDATE no action ON DELETE cascade
      );` },
      { name: 'characters', sql: `CREATE TABLE IF NOT EXISTS characters (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        room_id text NOT NULL,
        player_id text NOT NULL,
        player_name text NOT NULL,
        character_name text NOT NULL,
        race text,
        class text,
        level integer DEFAULT 1,
        background text,
        alignment text,
        stats text,
        skills text DEFAULT '[]',
        spells text DEFAULT '[]',
        current_hp integer DEFAULT 10 NOT NULL,
        max_hp integer DEFAULT 10 NOT NULL,
        ac integer DEFAULT 10 NOT NULL,
        speed integer DEFAULT 30 NOT NULL,
        initiative_modifier integer DEFAULT 0 NOT NULL,
        backstory text,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch()),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (player_id) REFERENCES players(id) ON UPDATE no action ON DELETE cascade
      );` },
      { name: 'dice_rolls', sql: `CREATE TABLE IF NOT EXISTS dice_rolls (
        id text PRIMARY KEY NOT NULL,
        room_id text,
        player_id text,
        expression text NOT NULL,
        rolls text NOT NULL,
        modifier integer DEFAULT 0 NOT NULL,
        total integer NOT NULL,
        purpose text,
        timestamp integer DEFAULT (unixepoch()) NOT NULL
      );` },
      { name: 'inventory_items', sql: `CREATE TABLE IF NOT EXISTS inventory_items (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        character_id text NOT NULL,
        item_id text NOT NULL,
        quantity integer DEFAULT 1 NOT NULL,
        equipped integer DEFAULT false NOT NULL,
        notes text,
        attunement_slot integer DEFAULT false,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch()),
        FOREIGN KEY (character_id) REFERENCES characters(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (item_id) REFERENCES items(id) ON UPDATE no action ON DELETE restrict
      );` },
      { name: 'items', sql: `CREATE TABLE IF NOT EXISTS items (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        category text NOT NULL,
        type text NOT NULL,
        subtype text,
        rarity text DEFAULT 'common',
        cost integer,
        weight real,
        description text NOT NULL,
        properties text,
        requires_attunement integer DEFAULT false,
        game_system text DEFAULT 'dnd' NOT NULL,
        source text DEFAULT 'SRD',
        created_at integer DEFAULT (unixepoch())
      );` },
      { name: 'players', sql: `CREATE TABLE IF NOT EXISTS players (
        id text PRIMARY KEY NOT NULL,
        room_id text NOT NULL,
        user_id text,
        name text NOT NULL,
        is_host integer DEFAULT false NOT NULL,
        joined_at integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE no action ON DELETE cascade
      );` },
      { name: 'rooms', sql: `CREATE TABLE IF NOT EXISTS rooms (
        id text PRIMARY KEY NOT NULL,
        code text NOT NULL,
        name text NOT NULL,
        game_system text DEFAULT 'dnd' NOT NULL,
        host_name text NOT NULL,
        description text,
        current_scene text,
        message_history text DEFAULT '[]' NOT NULL,
        is_active integer DEFAULT true NOT NULL,
        is_public integer DEFAULT false NOT NULL,
        max_players integer DEFAULT 6 NOT NULL,
        last_activity_at integer DEFAULT (unixepoch()) NOT NULL,
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch())
      );` },
      { name: 'unified_characters', sql: `CREATE TABLE IF NOT EXISTS unified_characters (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        user_id text NOT NULL,
        character_name text NOT NULL,
        race text,
        class text,
        level integer DEFAULT 1 NOT NULL,
        background text,
        alignment text,
        stats text,
        skills text DEFAULT '[]',
        proficiencies text DEFAULT '[]',
        spells text DEFAULT '[]',
        spell_slots text DEFAULT '{"current":[0,0,0,0,0,0,0,0,0,0],"max":[0,0,0,0,0,0,0,0,0,0]}',
        hit_dice text,
        max_hp integer DEFAULT 10 NOT NULL,
        current_hp integer DEFAULT 10 NOT NULL,
        temporary_hp integer DEFAULT 0 NOT NULL,
        ac integer DEFAULT 10 NOT NULL,
        speed integer DEFAULT 30 NOT NULL,
        initiative_modifier integer DEFAULT 0 NOT NULL,
        xp integer DEFAULT 0 NOT NULL,
        gold integer DEFAULT 0 NOT NULL,
        is_alive integer DEFAULT true NOT NULL,
        backstory text,
        notes text,
        game_system text DEFAULT 'dnd' NOT NULL,
        current_room_code text,
        level_choices text DEFAULT '[]',
        created_at integer DEFAULT (unixepoch()) NOT NULL,
        updated_at integer DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
      );` },
      { name: 'sessions', sql: `CREATE TABLE IF NOT EXISTS sessions (
        sid text PRIMARY KEY NOT NULL,
        sess text NOT NULL,
        expire integer NOT NULL
      );` },
      { name: 'spells', sql: `CREATE TABLE IF NOT EXISTS spells (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        level integer DEFAULT 0 NOT NULL,
        school text NOT NULL,
        casting_time text NOT NULL,
        range text NOT NULL,
        components text NOT NULL,
        duration text NOT NULL,
        concentration integer DEFAULT false NOT NULL,
        ritual integer DEFAULT false NOT NULL,
        description text NOT NULL,
        higher_levels text,
        classes text DEFAULT '[]' NOT NULL,
        source text DEFAULT 'SRD',
        created_at integer DEFAULT (unixepoch())
      );` },
      { name: 'users', sql: `CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
        email text,
        password text,
        first_name text,
        last_name text,
        username text,
        profile_image_url text,
        custom_profile_image_url text,
        created_at integer DEFAULT (unixepoch()),
        updated_at integer DEFAULT (unixepoch())
      );` }
    ];

    for (const t of tableCreates) {
      if (await tableExists(t.name)) {
        console.log(`   ℹ️  Skipping CREATE TABLE ${t.name} (already exists)`);
        continue;
      }
      console.log(`   ➕ Creating table ${t.name}...`);
      await client.execute({ sql: t.sql });
    }

    const indexCreates = [
      { name: 'idx_character_inventory_character', sql: `CREATE INDEX IF NOT EXISTS idx_character_inventory_character ON character_inventory_items (character_id)` },
      { name: 'idx_character_inventory_item', sql: `CREATE INDEX IF NOT EXISTS idx_character_inventory_item ON character_inventory_items (item_id)` },
      { name: 'idx_status_effects_character', sql: `CREATE INDEX IF NOT EXISTS idx_status_effects_character ON character_status_effects (character_id)` },
      { name: 'idx_characters_room', sql: `CREATE INDEX IF NOT EXISTS idx_characters_room ON characters (room_id)` },
      { name: 'idx_characters_player', sql: `CREATE INDEX IF NOT EXISTS idx_characters_player ON characters (player_id)` },
      { name: 'idx_inventory_character', sql: `CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory_items (character_id)` },
      { name: 'idx_inventory_item', sql: `CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory_items (item_id)` },
      { name: 'idx_items_name', sql: `CREATE INDEX IF NOT EXISTS idx_items_name ON items (name)` },
      { name: 'idx_items_category', sql: `CREATE INDEX IF NOT EXISTS idx_items_category ON items (category)` },
      { name: 'idx_items_rarity', sql: `CREATE INDEX IF NOT EXISTS idx_items_rarity ON items (rarity)` },
      { name: 'rooms_code_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON rooms (code)` },
      { name: 'idx_rooms_code', sql: `CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms (code)` },
      { name: 'idx_rooms_active', sql: `CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms (is_active)` },
      { name: 'idx_unified_characters_user', sql: `CREATE INDEX IF NOT EXISTS idx_unified_characters_user ON unified_characters (user_id)` },
      { name: 'idx_unified_characters_room', sql: `CREATE INDEX IF NOT EXISTS idx_unified_characters_room ON unified_characters (current_room_code)` },
      { name: 'IDX_session_expire', sql: `CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)` },
      { name: 'idx_spells_name', sql: `CREATE INDEX IF NOT EXISTS idx_spells_name ON spells (name)` },
      { name: 'idx_spells_level', sql: `CREATE INDEX IF NOT EXISTS idx_spells_level ON spells (level)` },
      { name: 'idx_spells_school', sql: `CREATE INDEX IF NOT EXISTS idx_spells_school ON spells (school)` },
      { name: 'users_email_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)` },
      { name: 'users_username_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)` }
    ];

    for (const idx of indexCreates) {
      if (await indexExists(idx.name)) {
        console.log(`   ℹ️  Skipping ${idx.name} (already exists)`);
        continue;
      }
      console.log(`   ➕ Creating index ${idx.name}...`);
      await client.execute({ sql: idx.sql });
    }

    console.log('✅ JS migration 0000 complete');
  } catch (err) {
    console.error('❌ JS migration 0000 failed:', err.message || err);
    throw err;
  }
}

run().catch(err => { process.exit(1); }).finally(()=>{ try { client.close && client.close(); } catch {} });
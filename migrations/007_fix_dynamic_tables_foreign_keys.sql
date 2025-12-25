-- Migration: Fix Foreign Key References in Dynamic Tables
-- Purpose: Correct dynamic_npcs and dynamic_locations to reference rooms(id) instead of adventures(id)
-- This fixes the FOREIGN KEY constraint errors when creating dynamic content

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- =============================================================================
-- Fix dynamic_npcs table
-- =============================================================================

-- Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS dynamic_npcs_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  description TEXT,
  personality TEXT,
  stats_block TEXT,
  is_quest_giver INTEGER DEFAULT 0 CHECK(is_quest_giver IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Copy existing data (if any)
INSERT INTO dynamic_npcs_new (id, room_id, name, role, description, personality, stats_block, is_quest_giver, created_at)
SELECT id, room_id, name, role, description, personality, stats_block, is_quest_giver, created_at
FROM dynamic_npcs
WHERE EXISTS (SELECT 1 FROM dynamic_npcs);

-- Drop old table
DROP TABLE IF EXISTS dynamic_npcs;

-- Rename new table
ALTER TABLE dynamic_npcs_new RENAME TO dynamic_npcs;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_room ON dynamic_npcs(room_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_role ON dynamic_npcs(role);
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_quest_giver ON dynamic_npcs(is_quest_giver);

-- =============================================================================
-- Fix dynamic_locations table
-- =============================================================================

-- Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS dynamic_locations_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  boxed_text TEXT,
  features TEXT DEFAULT '[]',
  connections TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Copy existing data (if any)
INSERT INTO dynamic_locations_new (id, room_id, name, type, description, boxed_text, features, connections, created_at)
SELECT id, room_id, name, type, description, boxed_text, features, connections, created_at
FROM dynamic_locations
WHERE EXISTS (SELECT 1 FROM dynamic_locations);

-- Drop old table
DROP TABLE IF EXISTS dynamic_locations;

-- Rename new table
ALTER TABLE dynamic_locations_new RENAME TO dynamic_locations;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_dynamic_locations_room ON dynamic_locations(room_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_locations_type ON dynamic_locations(type);

COMMIT;

PRAGMA foreign_keys = ON;

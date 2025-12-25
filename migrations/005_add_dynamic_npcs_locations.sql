-- Migration: Add dynamic_npcs and dynamic_locations tables

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS dynamic_npcs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  description TEXT,
  personality TEXT,
  stats_block TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_room ON dynamic_npcs(room_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_role ON dynamic_npcs(role);

CREATE TABLE IF NOT EXISTS dynamic_locations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  boxed_text TEXT,
  features TEXT DEFAULT '[]',
  connections TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dynamic_locations_room ON dynamic_locations(room_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_locations_type ON dynamic_locations(type);

COMMIT;
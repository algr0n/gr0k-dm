-- Migration: Add Room Status Effects (environmental/scene-level effects)
-- Purpose: Persist room-level or object-level temporary effects such as a spell that buffs a location

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS room_status_effects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  applied_by TEXT NOT NULL DEFAULT 'dm',
  source_id TEXT,
  metadata TEXT,
  duration TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_room_status_effects_room ON room_status_effects(room_id);

COMMIT;

-- Migration: Add Advanced Combat System Tables
-- Purpose: Add tables for persistent combat encounters, environment features, and spawn points

BEGIN TRANSACTION;

-- Combat Encounters - persistent combat scenarios
CREATE TABLE IF NOT EXISTS combat_encounters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  location_id TEXT,
  name TEXT NOT NULL,
  seed TEXT,
  generated_by TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_combat_encounters_room ON combat_encounters(room_id);
CREATE INDEX IF NOT EXISTS idx_combat_encounters_location ON combat_encounters(location_id);

-- Combat Environment Features - terrain, cover, hazards
CREATE TABLE IF NOT EXISTS combat_environment_features (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  encounter_id TEXT NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  radius INTEGER NOT NULL DEFAULT 5,
  properties TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_combat_env_features_encounter ON combat_environment_features(encounter_id);

-- Combat Spawns - monster/NPC spawn points
CREATE TABLE IF NOT EXISTS combat_spawns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  encounter_id TEXT NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
  monster_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  position_x INTEGER,
  position_y INTEGER,
  behavior TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_combat_spawns_encounter ON combat_spawns(encounter_id);

COMMIT;

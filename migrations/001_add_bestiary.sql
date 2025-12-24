-- Migration: Add Bestiary Tables
-- Purpose: Create namespaced bestiary tables for storing D&D 5e monster data
-- Safety: Uses CREATE TABLE IF NOT EXISTS for idempotency, does not drop existing tables

PRAGMA foreign_keys = ON;

-- Main monsters table
CREATE TABLE IF NOT EXISTS bestiary_monsters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  alignment TEXT,
  armor_class INTEGER NOT NULL,
  armor_type TEXT,
  hit_points TEXT NOT NULL,
  hp_avg INTEGER,
  speed TEXT NOT NULL,
  speed_json TEXT,
  str INTEGER NOT NULL,
  dex INTEGER NOT NULL,
  con INTEGER NOT NULL,
  int INTEGER NOT NULL,
  wis INTEGER NOT NULL,
  cha INTEGER NOT NULL,
  saving_throws TEXT,
  skills TEXT,
  damage_resistances TEXT,
  damage_immunities TEXT,
  damage_vulnerabilities TEXT,
  condition_immunities TEXT,
  senses TEXT,
  languages TEXT,
  challenge_rating TEXT NOT NULL,
  cr_decimal REAL NOT NULL,
  xp INTEGER,
  legendary_action_count INTEGER DEFAULT 0,
  raw_json TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);
--> statement-breakpoint

-- Traits table (passive abilities)
CREATE TABLE IF NOT EXISTS bestiary_traits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  monster_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (monster_id) REFERENCES bestiary_monsters(id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Actions table
CREATE TABLE IF NOT EXISTS bestiary_actions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  monster_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  attack_bonus INTEGER,
  reach TEXT,
  range TEXT,
  target TEXT,
  hit TEXT,
  description TEXT,
  damage TEXT,
  has_rays INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (monster_id) REFERENCES bestiary_monsters(id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Action rays table (for multi-ray attacks like Beholder eye rays)
CREATE TABLE IF NOT EXISTS bestiary_action_rays (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action_id TEXT NOT NULL,
  name TEXT NOT NULL,
  save TEXT,
  effect TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (action_id) REFERENCES bestiary_actions(id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Legendary actions table
CREATE TABLE IF NOT EXISTS bestiary_legendary_actions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  monster_id TEXT NOT NULL,
  option_text TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (monster_id) REFERENCES bestiary_monsters(id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_name ON bestiary_monsters(name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_type ON bestiary_monsters(type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_cr ON bestiary_monsters(cr_decimal);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_size ON bestiary_monsters(size);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_traits_monster ON bestiary_traits(monster_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_actions_monster ON bestiary_actions(monster_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_action_rays_action ON bestiary_action_rays(action_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_legendary_actions_monster ON bestiary_legendary_actions(monster_id);
--> statement-breakpoint

-- Full-text search virtual table (FTS5)
-- This creates a virtual table for fast text search across monster data
-- Gracefully handle if FTS5 is not available by catching errors in the import script
CREATE VIRTUAL TABLE IF NOT EXISTS bestiary_fts USING fts5(
  monster_id UNINDEXED,
  name,
  description,
  traits_text,
  actions_text,
  content='bestiary_monsters',
  content_rowid='rowid'
);

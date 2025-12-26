-- Migration: Add global NPC stat cache table
-- This table stores AI-generated and reference NPC stat blocks for reuse across all rooms
-- Once an NPC type is created, it can be reused without regenerating, saving tokens

CREATE TABLE IF NOT EXISTS npc_stat_cache (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,  -- Normalized name for lookup (lowercase)
  display_name TEXT NOT NULL, -- Original name with capitalization
  size TEXT NOT NULL DEFAULT 'Medium',
  type TEXT NOT NULL DEFAULT 'humanoid',
  alignment TEXT,
  ac INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  speed TEXT DEFAULT '30 ft.',
  str INTEGER NOT NULL DEFAULT 10,
  dex INTEGER NOT NULL DEFAULT 10,
  con INTEGER NOT NULL DEFAULT 10,
  int INTEGER NOT NULL DEFAULT 10,
  wis INTEGER NOT NULL DEFAULT 10,
  cha INTEGER NOT NULL DEFAULT 10,
  cr TEXT NOT NULL DEFAULT '0',
  xp INTEGER NOT NULL DEFAULT 10,
  traits TEXT DEFAULT '[]',  -- JSON array of {name, description}
  actions TEXT DEFAULT '[]', -- JSON array of {name, description}
  reactions TEXT,            -- JSON array of {name, description}, nullable
  source TEXT NOT NULL DEFAULT 'ai', -- 'ai' | 'reference' | 'bestiary'
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_npc_stat_cache_name ON npc_stat_cache(name);
CREATE INDEX IF NOT EXISTS idx_npc_stat_cache_cr ON npc_stat_cache(cr);

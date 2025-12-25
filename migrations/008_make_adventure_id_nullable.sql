-- Migration: Make adventure_id nullable in adventure_quests
-- Purpose: Allow dynamic quests (AI-generated) to have NULL adventure_id
-- Dynamic quests use room_id instead of adventure_id

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Create new table with nullable adventure_id
CREATE TABLE adventure_quests_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  adventure_id TEXT REFERENCES adventures(id) ON DELETE CASCADE,  -- Now nullable!
  chapter_id TEXT REFERENCES adventure_chapters(id) ON DELETE SET NULL,
  quest_giver_id TEXT REFERENCES adventure_npcs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  objectives TEXT DEFAULT '[]' NOT NULL,
  rewards TEXT,
  is_main_quest INTEGER DEFAULT 0 NOT NULL,
  prerequisite_quest_ids TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  room_id TEXT,
  quest_giver TEXT,
  is_dynamic INTEGER DEFAULT 0 NOT NULL,
  urgency TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'in_progress', 'completed', 'failed')),
  dynamic_quest_giver_id TEXT REFERENCES dynamic_npcs(id) ON DELETE SET NULL
);

-- Copy existing data
INSERT INTO adventure_quests_new 
SELECT * FROM adventure_quests;

-- Drop old table
DROP TABLE adventure_quests;

-- Rename new table
ALTER TABLE adventure_quests_new RENAME TO adventure_quests;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_quests_adventure ON adventure_quests(adventure_id);
CREATE INDEX IF NOT EXISTS idx_quests_chapter ON adventure_quests(chapter_id);
CREATE INDEX IF NOT EXISTS idx_quests_giver ON adventure_quests(quest_giver_id);
CREATE INDEX IF NOT EXISTS idx_quests_dynamic_giver ON adventure_quests(dynamic_quest_giver_id);
CREATE INDEX IF NOT EXISTS idx_quests_room ON adventure_quests(room_id);
CREATE INDEX IF NOT EXISTS idx_quests_dynamic ON adventure_quests(is_dynamic);
CREATE INDEX IF NOT EXISTS idx_quests_status ON adventure_quests(status);

COMMIT;

PRAGMA foreign_keys = ON;

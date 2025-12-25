-- Add quest status tracking and link dynamic NPCs as quest givers
-- Migration: 006_add_quest_status_and_npc_questgivers.sql

-- Add status field to adventure_quests
ALTER TABLE adventure_quests ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'in_progress', 'completed', 'failed'));

-- Add dynamic_quest_giver_id to link to dynamic_npcs (separate from predefined questGiverId)
ALTER TABLE adventure_quests ADD COLUMN dynamic_quest_giver_id TEXT REFERENCES dynamic_npcs(id) ON DELETE SET NULL;

-- Add index for quest status filtering
CREATE INDEX IF NOT EXISTS idx_quests_status ON adventure_quests(status);

-- Add index for dynamic quest giver linking
CREATE INDEX IF NOT EXISTS idx_quests_dynamic_giver ON adventure_quests(dynamic_quest_giver_id);

-- Add is_quest_giver flag to dynamic_npcs
ALTER TABLE dynamic_npcs ADD COLUMN is_quest_giver INTEGER DEFAULT 0 CHECK(is_quest_giver IN (0, 1));

-- Add index for quest giver NPCs
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_quest_giver ON dynamic_npcs(is_quest_giver);

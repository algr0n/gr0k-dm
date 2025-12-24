-- Migration: Add Dynamic Quest Support
-- Purpose: Enable AI-generated quests for on-the-fly games without predefined adventures
-- Safety: Uses ALTER TABLE ADD COLUMN with default values for backward compatibility

PRAGMA foreign_keys = ON;

-- =============================================================================
-- Modify adventure_quests to support dynamic (AI-generated) quests
-- =============================================================================

-- Make adventureId nullable for dynamic quests
-- SQLite doesn't support ALTER COLUMN, so we work with the existing NOT NULL constraint
-- New dynamic quests will need to explicitly set adventureId to NULL

-- Add roomId column for dynamic quests (links quest to specific room)
ALTER TABLE adventure_quests ADD COLUMN room_id TEXT;
--> statement-breakpoint

-- Add questGiver column for free-form NPC name (for dynamic quests)
ALTER TABLE adventure_quests ADD COLUMN quest_giver TEXT;
--> statement-breakpoint

-- Add isDynamic flag to differentiate AI-generated quests
ALTER TABLE adventure_quests ADD COLUMN is_dynamic INTEGER DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Add urgency field for quest prioritization
ALTER TABLE adventure_quests ADD COLUMN urgency TEXT;
--> statement-breakpoint

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_quests_room ON adventure_quests(room_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quests_dynamic ON adventure_quests(is_dynamic);
--> statement-breakpoint

-- =============================================================================
-- Note: To make adventureId truly nullable, we would need to:
-- 1. Create new table with nullable adventureId
-- 2. Copy data
-- 3. Drop old table
-- 4. Rename new table
-- 
-- For now, dynamic quests will work by:
-- - Setting adventureId to a special placeholder value OR
-- - Keeping existing quests with adventureId, new dynamic quests just use isDynamic flag
-- =============================================================================

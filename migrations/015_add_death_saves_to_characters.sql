-- Add death save tracking to unified_characters table
ALTER TABLE unified_characters ADD COLUMN death_save_successes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE unified_characters ADD COLUMN death_save_failures INTEGER NOT NULL DEFAULT 0;

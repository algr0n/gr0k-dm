-- Migration: Fix Bestiary FTS Table
-- Purpose: Recreate FTS table as standalone (not contentless) for manual management
-- Safety: Drops and recreates FTS table

-- Drop the old FTS table
DROP TABLE IF EXISTS bestiary_fts;
--> statement-breakpoint

-- Create a standalone FTS5 table (not contentless)
CREATE VIRTUAL TABLE IF NOT EXISTS bestiary_fts USING fts5(
  monster_id UNINDEXED,
  name,
  description,
  traits_text,
  actions_text
);

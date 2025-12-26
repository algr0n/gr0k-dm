-- Migration: Add generation tracking columns to bestiary_monsters
-- Purpose: Track AI-generated monsters and their publication status
-- Safety: Uses ALTER TABLE ADD COLUMN IF NOT EXISTS for idempotency

PRAGMA foreign_keys = ON;

-- Add publication and generation tracking columns
ALTER TABLE bestiary_monsters ADD COLUMN is_published INTEGER DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE bestiary_monsters ADD COLUMN is_generated INTEGER DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE bestiary_monsters ADD COLUMN created_by TEXT;
--> statement-breakpoint
ALTER TABLE bestiary_monsters ADD COLUMN created_by_type TEXT;
--> statement-breakpoint
ALTER TABLE bestiary_monsters ADD COLUMN is_deleted INTEGER DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_published ON bestiary_monsters(is_published);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_generated ON bestiary_monsters(is_generated);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bestiary_monsters_deleted ON bestiary_monsters(is_deleted);
--> statement-breakpoint

-- Note: Existing monsters remain published (is_published=1, is_generated=0, is_deleted=0)

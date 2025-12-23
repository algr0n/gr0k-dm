-- Migration to remove orphaned currency column from unified_characters
-- This column was defined in the production database but is not in the current schema

-- SQLite doesn't support DROP COLUMN directly in older versions
-- We need to recreate the table without the currency column

-- Create a temporary table with the current schema
CREATE TABLE `unified_characters_new` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text NOT NULL,
	`character_name` text NOT NULL,
	`race` text,
	`class` text,
	`level` integer DEFAULT 1 NOT NULL,
	`background` text,
	`alignment` text,
	`stats` text,
	`skills` text DEFAULT '[]',
	`proficiencies` text DEFAULT '[]',
	`spells` text DEFAULT '[]',
	`spell_slots` text DEFAULT '{"current":[0,0,0,0,0,0,0,0,0,0],"max":[0,0,0,0,0,0,0,0,0,0]}',
	`hit_dice` text,
	`max_hp` integer DEFAULT 10 NOT NULL,
	`current_hp` integer DEFAULT 10 NOT NULL,
	`temporary_hp` integer DEFAULT 0 NOT NULL,
	`ac` integer DEFAULT 10 NOT NULL,
	`speed` integer DEFAULT 30 NOT NULL,
	`initiative_modifier` integer DEFAULT 0 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`is_alive` integer DEFAULT true NOT NULL,
	`backstory` text,
	`notes` text,
	`game_system` text DEFAULT 'dnd' NOT NULL,
	`current_room_code` text,
	`level_choices` text DEFAULT '[]',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Copy data from old table to new table (excluding currency column)
INSERT INTO `unified_characters_new` 
SELECT 
	`id`, `user_id`, `character_name`, `race`, `class`, `level`, `background`, `alignment`, 
	`stats`, `skills`, `proficiencies`, `spells`, `spell_slots`, `hit_dice`, `max_hp`, 
	`current_hp`, `temporary_hp`, `ac`, `speed`, `initiative_modifier`, `xp`, `gold`, 
	`is_alive`, `backstory`, `notes`, `game_system`, `current_room_code`, `level_choices`, 
	`created_at`, `updated_at`
FROM `unified_characters`;
--> statement-breakpoint

-- Drop the old table
DROP TABLE `unified_characters`;
--> statement-breakpoint

-- Rename the new table to the original name
ALTER TABLE `unified_characters_new` RENAME TO `unified_characters`;
--> statement-breakpoint

-- Recreate indices
CREATE INDEX `idx_unified_characters_user` ON `unified_characters` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_unified_characters_room` ON `unified_characters` (`current_room_code`);

CREATE TABLE `room_adventure_progress` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`room_id` text NOT NULL,
	`adventure_id` text NOT NULL,
	`current_chapter_id` text,
	`current_location_id` text,
	`completed_chapter_ids` text DEFAULT '[]',
	`discovered_location_ids` text DEFAULT '[]',
	`completed_quest_ids` text DEFAULT '[]',
	`active_quest_ids` text DEFAULT '[]',
	`completed_encounter_ids` text DEFAULT '[]',
	`met_npc_ids` text DEFAULT '[]',
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_progress_room` ON `room_adventure_progress` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_progress_adventure` ON `room_adventure_progress` (`adventure_id`);--> statement-breakpoint
CREATE TABLE `adventure_chapters` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`adventure_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`objectives` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chapters_adventure` ON `adventure_chapters` (`adventure_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_number` ON `adventure_chapters` (`chapter_number`);--> statement-breakpoint
CREATE TABLE `adventure_encounters` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`adventure_id` text NOT NULL,
	`location_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`difficulty` text,
	`description` text NOT NULL,
	`enemies` text DEFAULT '[]',
	`xp_reward` integer DEFAULT 0,
	`treasure` text DEFAULT '[]',
	`trigger_condition` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `adventure_locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_encounters_adventure` ON `adventure_encounters` (`adventure_id`);--> statement-breakpoint
CREATE INDEX `idx_encounters_location` ON `adventure_encounters` (`location_id`);--> statement-breakpoint
CREATE INDEX `idx_encounters_type` ON `adventure_encounters` (`type`);--> statement-breakpoint
CREATE TABLE `adventure_locations` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`adventure_id` text NOT NULL,
	`chapter_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`boxed_text` text,
	`map_image_url` text,
	`features` text DEFAULT '[]',
	`connections` text DEFAULT '[]',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `adventure_chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_locations_adventure` ON `adventure_locations` (`adventure_id`);--> statement-breakpoint
CREATE INDEX `idx_locations_chapter` ON `adventure_locations` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_locations_type` ON `adventure_locations` (`type`);--> statement-breakpoint
CREATE TABLE `adventure_npcs` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`adventure_id` text NOT NULL,
	`location_id` text,
	`name` text NOT NULL,
	`race` text,
	`role` text NOT NULL,
	`description` text NOT NULL,
	`personality` text,
	`ideals` text,
	`bonds` text,
	`flaws` text,
	`stats_block` text,
	`quest_connections` text DEFAULT '[]',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `adventure_locations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_npcs_adventure` ON `adventure_npcs` (`adventure_id`);--> statement-breakpoint
CREATE INDEX `idx_npcs_location` ON `adventure_npcs` (`location_id`);--> statement-breakpoint
CREATE INDEX `idx_npcs_role` ON `adventure_npcs` (`role`);--> statement-breakpoint
CREATE TABLE `adventure_quests` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`adventure_id` text NOT NULL,
	`chapter_id` text,
	`quest_giver_id` text,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`objectives` text DEFAULT '[]' NOT NULL,
	`rewards` text,
	`is_main_quest` integer DEFAULT false NOT NULL,
	`prerequisite_quest_ids` text DEFAULT '[]',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `adventure_chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`quest_giver_id`) REFERENCES `adventure_npcs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_quests_adventure` ON `adventure_quests` (`adventure_id`);--> statement-breakpoint
CREATE INDEX `idx_quests_chapter` ON `adventure_quests` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_quests_giver` ON `adventure_quests` (`quest_giver_id`);--> statement-breakpoint
CREATE TABLE `adventures` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`long_description` text,
	`game_system` text DEFAULT 'dnd' NOT NULL,
	`min_level` integer DEFAULT 1 NOT NULL,
	`max_level` integer DEFAULT 5 NOT NULL,
	`estimated_hours` text,
	`source` text NOT NULL,
	`cover_image_url` text,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adventures_slug_unique` ON `adventures` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_adventures_slug` ON `adventures` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_adventures_published` ON `adventures` (`is_published`);--> statement-breakpoint
CREATE INDEX `idx_adventures_game_system` ON `adventures` (`game_system`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`game_system` text DEFAULT 'dnd' NOT NULL,
	`host_name` text NOT NULL,
	`description` text,
	`current_scene` text,
	`message_history` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`max_players` integer DEFAULT 6 NOT NULL,
	`password_hash` text,
	`adventure_id` text,
	`use_adventure_mode` integer DEFAULT false,
	`last_activity_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `__new_rooms`("id", "code", "name", "game_system", "host_name", "description", "current_scene", "message_history", "is_active", "is_public", "max_players", "password_hash", "adventure_id", "use_adventure_mode", "last_activity_at", "created_at", "updated_at") SELECT "id", "code", "name", "game_system", "host_name", "description", "current_scene", "message_history", "is_active", "is_public", "max_players", "password_hash", "adventure_id", "use_adventure_mode", "last_activity_at", "created_at", "updated_at" FROM `rooms`;--> statement-breakpoint
DROP TABLE `rooms`;--> statement-breakpoint
ALTER TABLE `__new_rooms` RENAME TO `rooms`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_code` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_active` ON `rooms` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_rooms_adventure` ON `rooms` (`adventure_id`);
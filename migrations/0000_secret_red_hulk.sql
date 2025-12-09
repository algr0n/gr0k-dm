CREATE TABLE `character_inventory_items` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`character_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`equipped` integer DEFAULT false NOT NULL,
	`notes` text,
	`attunement_slot` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`character_id`) REFERENCES `unified_characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_character_inventory_character` ON `character_inventory_items` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_inventory_item` ON `character_inventory_items` (`item_id`);--> statement-breakpoint
CREATE TABLE `character_status_effects` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`character_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_predefined` integer DEFAULT true NOT NULL,
	`duration` text,
	`applied_by_dm` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `unified_characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_status_effects_character` ON `character_status_effects` (`character_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`character_name` text NOT NULL,
	`race` text,
	`class` text,
	`level` integer DEFAULT 1,
	`background` text,
	`alignment` text,
	`stats` text,
	`skills` text DEFAULT '[]',
	`spells` text DEFAULT '[]',
	`current_hp` integer DEFAULT 10 NOT NULL,
	`max_hp` integer DEFAULT 10 NOT NULL,
	`ac` integer DEFAULT 10 NOT NULL,
	`speed` integer DEFAULT 30 NOT NULL,
	`initiative_modifier` integer DEFAULT 0 NOT NULL,
	`backstory` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_characters_room` ON `characters` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_characters_player` ON `characters` (`player_id`);--> statement-breakpoint
CREATE TABLE `dice_rolls` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text,
	`player_id` text,
	`expression` text NOT NULL,
	`rolls` text NOT NULL,
	`modifier` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`purpose` text,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`character_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`equipped` integer DEFAULT false NOT NULL,
	`notes` text,
	`attunement_slot` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_character` ON `inventory_items` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_inventory_item` ON `inventory_items` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`subtype` text,
	`rarity` text DEFAULT 'common',
	`cost` integer,
	`weight` real,
	`description` text NOT NULL,
	`properties` text,
	`requires_attunement` integer DEFAULT false,
	`game_system` text DEFAULT 'dnd' NOT NULL,
	`source` text DEFAULT 'SRD',
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_items_name` ON `items` (`name`);--> statement-breakpoint
CREATE INDEX `idx_items_category` ON `items` (`category`);--> statement-breakpoint
CREATE INDEX `idx_items_rarity` ON `items` (`rarity`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`game_system` text DEFAULT 'dnd' NOT NULL,
	`host_name` text NOT NULL,
	`description` text,
	`current_scene` text,
	`message_history` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`max_players` integer DEFAULT 6 NOT NULL,
	`last_activity_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_code` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_active` ON `rooms` (`is_active`);--> statement-breakpoint
CREATE TABLE `unified_characters` (
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
CREATE INDEX `idx_unified_characters_user` ON `unified_characters` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_unified_characters_room` ON `unified_characters` (`current_room_code`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`sess` text NOT NULL,
	`expire` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IDX_session_expire` ON `sessions` (`expire`);--> statement-breakpoint
CREATE TABLE `spells` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`school` text NOT NULL,
	`casting_time` text NOT NULL,
	`range` text NOT NULL,
	`components` text NOT NULL,
	`duration` text NOT NULL,
	`concentration` integer DEFAULT false NOT NULL,
	`ritual` integer DEFAULT false NOT NULL,
	`description` text NOT NULL,
	`higher_levels` text,
	`classes` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'SRD',
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_spells_name` ON `spells` (`name`);--> statement-breakpoint
CREATE INDEX `idx_spells_level` ON `spells` (`level`);--> statement-breakpoint
CREATE INDEX `idx_spells_school` ON `spells` (`school`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`email` text,
	`password` text,
	`first_name` text,
	`last_name` text,
	`username` text,
	`profile_image_url` text,
	`custom_profile_image_url` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
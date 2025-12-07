-- Create the two new enums
CREATE TYPE "item_category" AS ENUM (
	'weapon', 'armor', 'potion', 'scroll', 'wondrous_item', 'ring', 'rod',
	'staff', 'wand', 'ammunition', 'tool', 'adventuring_gear', 'container',
	'mount', 'vehicle', 'other'
);

CREATE TYPE "item_rarity" AS ENUM (
	'common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact', 'varies'
);

-- 1. Clean up the old inventory_items table (the columns we no longer need)
ALTER TABLE "inventory_items"
	DROP COLUMN IF EXISTS "name",
	DROP COLUMN IF EXISTS "description",
	DROP COLUMN IF EXISTS "granted_by";

--  -- (optional but safe – removes any old data that would block the changes)
TRUNCATE TABLE "inventory_items" RESTART IDENTITY CASCADE;

-- 2. Add the new columns to inventory_items
ALTER TABLE "inventory_items"
	ADD COLUMN IF NOT EXISTS "item_id" varchar(64) NOT NULL,
	ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1,
	ADD COLUMN IF NOT EXISTS "equipped" boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS "notes" text,
	ADD COLUMN IF NOT EXISTS "attunement_slot" boolean DEFAULT false,
	ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Index for faster lookups by item
CREATE INDEX IF NOT EXISTS "idx_inventory_item" ON "inventory_items" ("item_id");

-- 3. Create the master items table
CREATE TABLE IF NOT EXISTS "items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "item_category" NOT NULL,
	"type" text NOT NULL,
	"subtype" text,
	"rarity" "item_rarity" DEFAULT 'common',
	"cost" integer,
	"weight" numeric(5,2),
	"description" text NOT NULL,
	"properties" jsonb,
	"requires_attunement" boolean DEFAULT false,
	"game_system" text NOT NULL DEFAULT 'dnd',
	"source" text DEFAULT 'SRD',
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes on the items table
CREATE INDEX IF NOT EXISTS "idx_items_name"     ON "items" ("name");
CREATE INDEX IF NOT EXISTS "idx_items_category" ON "items" ("category");
CREATE INDEX IF NOT EXISTS "idx_items_rarity"   ON "items" ("rarity");

-- 4. Foreign key from inventory_items → items
ALTER TABLE "inventory_items"
	ADD CONSTRAINT "inventory_items_item_id_items_id_fk"
	FOREIGN KEY ("item_id") REFERENCES "items"("id")
	ON DELETE RESTRICT;
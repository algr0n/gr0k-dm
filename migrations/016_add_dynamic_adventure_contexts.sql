-- Add dynamic adventure context table to group generated adventures and related entities
CREATE TABLE IF NOT EXISTS dynamic_adventure_contexts (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed TEXT,
    summary TEXT,
    current_location_id TEXT,
    active_quest_ids TEXT DEFAULT '[]',
    npc_ids TEXT DEFAULT '[]',
    location_ids TEXT DEFAULT '[]',
    encounter_ids TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dynamic_adv_room ON dynamic_adventure_contexts(room_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_adv_status ON dynamic_adventure_contexts(status);

-- Link generated entities back to a dynamic adventure context
ALTER TABLE dynamic_npcs ADD COLUMN adventure_context_id TEXT REFERENCES dynamic_adventure_contexts(id) ON DELETE SET NULL;
ALTER TABLE dynamic_locations ADD COLUMN adventure_context_id TEXT REFERENCES dynamic_adventure_contexts(id) ON DELETE SET NULL;
ALTER TABLE combat_encounters ADD COLUMN adventure_context_id TEXT REFERENCES dynamic_adventure_contexts(id) ON DELETE SET NULL;

-- Add accepted_quests table to track which quests have been accepted by rooms
-- This separates "available quests" from "active quests" for pre-made adventures

CREATE TABLE IF NOT EXISTS accepted_quests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL,
  quest_id TEXT NOT NULL REFERENCES adventure_quests(id) ON DELETE CASCADE,
  accepted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  accepted_by TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accepted_quests_room ON accepted_quests(room_id);
CREATE INDEX IF NOT EXISTS idx_accepted_quests_quest ON accepted_quests(quest_id);

-- For existing rooms with adventures, auto-accept all quests that are dynamic
-- (so they continue to show up as they were before this change)
INSERT INTO accepted_quests (room_id, quest_id, accepted_at)
SELECT DISTINCT r.id, aq.id, unixepoch()
FROM rooms r
INNER JOIN adventure_quests aq ON (aq.room_id = r.id OR (aq.adventure_id = r.adventure_id AND r.use_adventure_mode = 1))
WHERE aq.is_dynamic = 1
  AND NOT EXISTS (
    SELECT 1 FROM accepted_quests acc
    WHERE acc.room_id = r.id AND acc.quest_id = aq.id
  );

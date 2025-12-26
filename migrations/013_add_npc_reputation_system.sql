-- Add reputation system to dynamic NPCs
-- Reputation scale: -100 (hostile enemy) to +100 (trusted ally)

-- Add reputation column (default to neutral 0)
ALTER TABLE dynamic_npcs ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0;

-- Add quest completion tracking
ALTER TABLE dynamic_npcs ADD COLUMN quests_completed INTEGER NOT NULL DEFAULT 0;

-- Add last interaction timestamp
ALTER TABLE dynamic_npcs ADD COLUMN last_interaction INTEGER;

-- Create index for reputation queries
CREATE INDEX IF NOT EXISTS idx_dynamic_npcs_reputation ON dynamic_npcs(reputation);

-- Update existing NPCs based on their role
UPDATE dynamic_npcs 
SET reputation = CASE 
  WHEN role = 'enemy' THEN -50
  WHEN role = 'ally' THEN 50
  WHEN role = 'questgiver' THEN 25
  ELSE 0
END
WHERE reputation = 0;

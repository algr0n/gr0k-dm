-- Add currency JSON column to unified_characters table
-- Migrates existing gold values to the new currency system
ALTER TABLE unified_characters ADD COLUMN currency TEXT DEFAULT '{"cp":0,"sp":0,"gp":0}';

-- Migrate existing gold values to the new currency.gp field
UPDATE unified_characters 
SET currency = json_object('cp', 0, 'sp', 0, 'gp', gold)
WHERE currency = '{"cp":0,"sp":0,"gp":0}';

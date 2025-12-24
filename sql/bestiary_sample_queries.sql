-- Bestiary Sample Queries
-- Example queries for working with the bestiary tables

-- ========================================
-- BASIC MONSTER QUERIES
-- ========================================

-- Get all monsters
SELECT id, name, type, size, cr_decimal, hp_avg
FROM bestiary_monsters
ORDER BY name;

-- Get a specific monster by name
SELECT * FROM bestiary_monsters
WHERE name = 'Beholder';

-- Get monsters by exact CR
SELECT name, type, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE cr_decimal = 13
ORDER BY name;

-- ========================================
-- FILTER BY CR RANGE
-- ========================================

-- Get low-CR monsters (CR 0-2) - good for level 1-3 parties
SELECT name, type, size, cr_decimal, hp_avg, xp
FROM bestiary_monsters
WHERE cr_decimal >= 0 AND cr_decimal <= 2
ORDER BY cr_decimal, name;

-- Get medium-CR monsters (CR 3-8) - good for level 4-10 parties
SELECT name, type, size, cr_decimal, hp_avg, xp
FROM bestiary_monsters
WHERE cr_decimal > 2 AND cr_decimal <= 8
ORDER BY cr_decimal DESC, name;

-- Get high-CR monsters (CR 9-16) - good for level 11-16 parties
SELECT name, type, size, cr_decimal, hp_avg, xp
FROM bestiary_monsters
WHERE cr_decimal > 8 AND cr_decimal <= 16
ORDER BY cr_decimal DESC, name;

-- Get legendary monsters (CR 17+) - good for level 17-20 parties
SELECT name, type, size, cr_decimal, hp_avg, xp, legendary_action_count
FROM bestiary_monsters
WHERE cr_decimal > 16
ORDER BY cr_decimal DESC, name;

-- ========================================
-- FILTER BY TYPE
-- ========================================

-- Get all dragons
SELECT name, size, cr_decimal, hp_avg, alignment
FROM bestiary_monsters
WHERE type = 'dragon'
ORDER BY cr_decimal DESC;

-- Get all undead creatures
SELECT name, size, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE type = 'undead'
ORDER BY cr_decimal DESC;

-- Get all aberrations (weird/alien creatures)
SELECT name, size, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE type = 'aberration'
ORDER BY cr_decimal DESC;

-- Get all fiends (demons/devils)
SELECT name, size, cr_decimal, hp_avg, alignment
FROM bestiary_monsters
WHERE type = 'fiend'
ORDER BY cr_decimal DESC;

-- Get all humanoids
SELECT name, subtype, size, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE type = 'humanoid'
ORDER BY cr_decimal, name;

-- ========================================
-- FILTER BY SIZE
-- ========================================

-- Get all Huge and Gargantuan creatures
SELECT name, size, type, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE size IN ('Huge', 'Gargantuan')
ORDER BY cr_decimal DESC;

-- Get all Tiny and Small creatures
SELECT name, size, type, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE size IN ('Tiny', 'Small')
ORDER BY cr_decimal;

-- ========================================
-- MONSTERS WITH SPECIFIC ABILITIES
-- ========================================

-- Get monsters with legendary actions
SELECT m.name, m.type, m.cr_decimal, m.legendary_action_count
FROM bestiary_monsters m
WHERE m.legendary_action_count > 0
ORDER BY m.cr_decimal DESC;

-- Get monsters with specific traits (e.g., "flying")
SELECT DISTINCT m.name, m.type, m.cr_decimal, m.speed
FROM bestiary_monsters m
WHERE m.speed LIKE '%fly%'
ORDER BY m.cr_decimal;

-- Get monsters immune to fire damage
SELECT name, type, cr_decimal, damage_immunities
FROM bestiary_monsters
WHERE damage_immunities LIKE '%fire%'
ORDER BY cr_decimal DESC;

-- ========================================
-- COMPLETE MONSTER DATA WITH JOINS
-- ========================================

-- Get complete monster info with trait and action counts
SELECT 
  m.name,
  m.type,
  m.size,
  m.cr_decimal,
  m.hp_avg,
  m.alignment,
  COUNT(DISTINCT t.id) as trait_count,
  COUNT(DISTINCT a.id) as action_count,
  COUNT(DISTINCT la.id) as legendary_action_count
FROM bestiary_monsters m
LEFT JOIN bestiary_traits t ON t.monster_id = m.id
LEFT JOIN bestiary_actions a ON a.monster_id = m.id
LEFT JOIN bestiary_legendary_actions la ON la.monster_id = m.id
WHERE m.name = 'Beholder'
GROUP BY m.id;

-- Get monster with all traits
SELECT 
  m.name,
  m.cr_decimal,
  t.name as trait_name,
  t.description as trait_description
FROM bestiary_monsters m
JOIN bestiary_traits t ON t.monster_id = m.id
WHERE m.name = 'Banshee'
ORDER BY t.name;

-- Get monster with all actions
SELECT 
  m.name,
  m.cr_decimal,
  a.name as action_name,
  a.type,
  a.attack_bonus,
  a.hit,
  a.description
FROM bestiary_monsters m
JOIN bestiary_actions a ON a.monster_id = m.id
WHERE m.name = 'Aarakocra'
ORDER BY a.name;

-- ========================================
-- ACTIONS WITH NESTED RAYS
-- ========================================

-- Get actions that have multiple rays (like Beholder eye rays)
SELECT 
  m.name as monster_name,
  m.cr_decimal,
  a.name as action_name,
  a.description as action_description
FROM bestiary_monsters m
JOIN bestiary_actions a ON a.monster_id = m.id
WHERE a.has_rays = 1
ORDER BY m.cr_decimal DESC;

-- Get all rays for a specific action
SELECT 
  m.name as monster_name,
  a.name as action_name,
  r.name as ray_name,
  r.save,
  r.effect
FROM bestiary_monsters m
JOIN bestiary_actions a ON a.monster_id = m.id
JOIN bestiary_action_rays r ON r.action_id = a.id
WHERE m.name = 'Beholder'
ORDER BY r.name;

-- Get all monsters with ray attacks
SELECT DISTINCT
  m.name,
  m.type,
  m.cr_decimal,
  COUNT(r.id) as ray_count
FROM bestiary_monsters m
JOIN bestiary_actions a ON a.monster_id = m.id
JOIN bestiary_action_rays r ON r.action_id = a.id
GROUP BY m.id
ORDER BY ray_count DESC, m.cr_decimal DESC;

-- ========================================
-- LEGENDARY ACTIONS
-- ========================================

-- Get all legendary actions for a monster
SELECT 
  m.name,
  m.legendary_action_count,
  la.option_text
FROM bestiary_monsters m
JOIN bestiary_legendary_actions la ON la.monster_id = m.id
WHERE m.name = 'Aboleth'
ORDER BY la.option_text;

-- Find monsters with the most legendary actions
SELECT 
  m.name,
  m.type,
  m.cr_decimal,
  COUNT(la.id) as legendary_option_count
FROM bestiary_monsters m
JOIN bestiary_legendary_actions la ON la.monster_id = m.id
GROUP BY m.id
ORDER BY legendary_option_count DESC, m.cr_decimal DESC
LIMIT 10;

-- ========================================
-- ENCOUNTER BUILDING QUERIES
-- ========================================

-- Get appropriate monsters for a specific party level (e.g., level 5)
-- Using CR guidelines: Easy (CR 1-2), Medium (CR 3-5), Hard (CR 6-7), Deadly (CR 8+)
SELECT 
  name,
  type,
  cr_decimal,
  hp_avg,
  xp,
  CASE 
    WHEN cr_decimal <= 2 THEN 'Easy'
    WHEN cr_decimal <= 5 THEN 'Medium'
    WHEN cr_decimal <= 7 THEN 'Hard'
    ELSE 'Deadly'
  END as difficulty_for_level_5
FROM bestiary_monsters
WHERE cr_decimal >= 1 AND cr_decimal <= 10
ORDER BY cr_decimal, name;

-- Get monsters suitable for a themed encounter (e.g., undead dungeon)
SELECT name, subtype, cr_decimal, hp_avg, alignment
FROM bestiary_monsters
WHERE type = 'undead' AND cr_decimal <= 5
ORDER BY cr_decimal;

-- Random encounter selection (get 3 random monsters within CR range)
SELECT name, type, cr_decimal, hp_avg
FROM bestiary_monsters
WHERE cr_decimal >= 2 AND cr_decimal <= 4
ORDER BY RANDOM()
LIMIT 3;

-- ========================================
-- FULL-TEXT SEARCH (FTS5)
-- ========================================
-- Note: Only works if FTS5 is available and bestiary_fts is populated

-- Search for monsters with specific keywords in any text field
SELECT DISTINCT
  bm.name,
  bm.type,
  bm.cr_decimal,
  bm.hp_avg
FROM bestiary_fts bf
JOIN bestiary_monsters bm ON bm.id = bf.monster_id
WHERE bestiary_fts MATCH 'charm'
ORDER BY bm.cr_decimal DESC;

-- Search for fire-related abilities
SELECT DISTINCT
  bm.name,
  bm.type,
  bm.cr_decimal
FROM bestiary_fts bf
JOIN bestiary_monsters bm ON bm.id = bf.monster_id
WHERE bestiary_fts MATCH 'fire OR flame OR burning'
ORDER BY bm.cr_decimal DESC;

-- ========================================
-- UPDATE FTS TABLE
-- ========================================
-- Use this to manually rebuild the FTS index if needed

-- Rebuild FTS for all monsters (run if FTS data gets out of sync)
DELETE FROM bestiary_fts;

INSERT INTO bestiary_fts (monster_id, name, description, traits_text, actions_text)
SELECT 
  m.id,
  m.name,
  COALESCE(
    (SELECT GROUP_CONCAT(t.description, ' ') FROM bestiary_traits t WHERE t.monster_id = m.id),
    ''
  ),
  COALESCE(
    (SELECT GROUP_CONCAT(t.name || ': ' || t.description, ' ') FROM bestiary_traits t WHERE t.monster_id = m.id),
    ''
  ),
  COALESCE(
    (SELECT GROUP_CONCAT(a.name || ': ' || COALESCE(a.description, ''), ' ') FROM bestiary_actions a WHERE a.monster_id = m.id),
    ''
  )
FROM bestiary_monsters m;

-- ========================================
-- STATISTICS AND ANALYTICS
-- ========================================

-- Count monsters by type
SELECT type, COUNT(*) as count
FROM bestiary_monsters
GROUP BY type
ORDER BY count DESC;

-- Count monsters by CR bracket
SELECT 
  CASE
    WHEN cr_decimal < 1 THEN '0 (Trivial)'
    WHEN cr_decimal < 5 THEN '1-4 (Low)'
    WHEN cr_decimal < 10 THEN '5-9 (Medium)'
    WHEN cr_decimal < 15 THEN '10-14 (High)'
    WHEN cr_decimal < 20 THEN '15-19 (Very High)'
    ELSE '20+ (Legendary)'
  END as cr_bracket,
  COUNT(*) as count
FROM bestiary_monsters
GROUP BY cr_bracket
ORDER BY MIN(cr_decimal);

-- Average HP by CR bracket
SELECT 
  FLOOR(cr_decimal) as cr,
  ROUND(AVG(hp_avg), 0) as avg_hp,
  MIN(hp_avg) as min_hp,
  MAX(hp_avg) as max_hp,
  COUNT(*) as count
FROM bestiary_monsters
WHERE hp_avg IS NOT NULL
GROUP BY FLOOR(cr_decimal)
ORDER BY cr;

-- Most common alignments
SELECT alignment, COUNT(*) as count
FROM bestiary_monsters
WHERE alignment IS NOT NULL
GROUP BY alignment
ORDER BY count DESC;

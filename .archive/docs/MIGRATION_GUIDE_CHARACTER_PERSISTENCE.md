# Character Persistence Migration Guide

## Executive Summary

**Status:** ✅ **No migration required - Schema is complete**

After thorough analysis of the codebase, the existing database schema already supports all character creation, item management, and saved character persistence requirements. No schema changes or migrations are needed.

## Findings Report

### 1. Fields Analysis

#### Character Creation Fields (from `client/src/pages/characters.tsx`)

**D&D 5th Edition Characters:**
- Core attributes: characterName, race, subrace, class, level, background, alignment
- Stats: JSON object with strength, dexterity, constitution, intelligence, wisdom, charisma
- Skills & Proficiencies: skills array, proficiencies array, spells array
- Combat stats: maxHp, currentHp, ac, speed, initiativeModifier
- Progression: xp, gold, levelChoices (JSON array for expertise/level-up tracking)
- Descriptive: backstory, notes

**Cyberpunk RED Characters:**
- Core attributes: characterName, role (stored in race/class), level
- Stats: JSON object with int, ref, dex, tech, cool, will, luck, move, body, emp
- Lifepath: stored in background field as concatenated string
- Combat stats: maxHp, ac, speed, initiativeModifier
- Progression: xp

#### Inventory Management Fields (from `server/routes.ts`)
- characterId (FK to unified_characters)
- itemId (FK to items table)
- quantity (default 1)
- equipped (boolean, default false)
- notes (optional text)
- attunementSlot (boolean, for D&D magic items)

### 2. Schema Validation

#### `unified_characters` Table

| Field | Type | Usage | Status |
|-------|------|-------|--------|
| id | text PRIMARY KEY | Character identifier | ✅ Present |
| userId | text FK | Owner reference | ✅ Present |
| characterName | text | Character's name | ✅ Present |
| race | text | Race/subrace | ✅ Present |
| class | text | Character class/role | ✅ Present |
| level | integer | Character level | ✅ Present |
| background | text | Background/lifepath | ✅ Present |
| alignment | text | Moral alignment | ✅ Present |
| stats | text (JSON) | Ability scores | ✅ Present |
| skills | text (JSON array) | Skill proficiencies | ✅ Present |
| proficiencies | text (JSON array) | Other proficiencies | ✅ Present |
| spells | text (JSON array) | Known spells | ✅ Present |
| spellSlots | text (JSON) | Spell slot tracking | ✅ Present |
| hitDice | text | Hit dice pool | ✅ Present |
| maxHp | integer | Maximum hit points | ✅ Present |
| currentHp | integer | Current hit points | ✅ Present |
| temporaryHp | integer | Temporary HP | ✅ Present |
| ac | integer | Armor class | ✅ Present |
| speed | integer | Movement speed | ✅ Present |
| initiativeModifier | integer | Initiative bonus | ✅ Present |
| xp | integer | Experience points | ✅ Present |
| gold | integer | Currency | ✅ Present |
| isAlive | integer (boolean) | Living status | ✅ Present |
| backstory | text | Character backstory | ✅ Present |
| notes | text | Additional notes | ✅ Present |
| gameSystem | text | dnd/cyberpunk | ✅ Present |
| currentRoomCode | text | Active game room | ✅ Present |
| levelChoices | text (JSON array) | Level-up choices | ✅ Present |
| createdAt | integer (timestamp) | Creation time | ✅ Present |
| updatedAt | integer (timestamp) | Last update time | ✅ Present |

**Notes:**
- The `stats` JSON field flexibly handles both D&D ability scores (str, dex, con, int, wis, cha) and Cyberpunk stats (int, ref, dex, tech, cool, will, luck, move, body, emp)
- The `stats` field also stores `skillSources` metadata for tracking where skills came from (race, class, subrace)
- The `levelChoices` JSON array stores expertise selections and other level-up decisions

#### `character_inventory_items` Table

| Field | Type | Usage | Status |
|-------|------|-------|--------|
| id | text PRIMARY KEY | Inventory item ID | ✅ Present |
| characterId | text FK | Links to character | ✅ Present |
| itemId | text FK | Links to item definition | ✅ Present |
| quantity | integer | Item stack size | ✅ Present |
| equipped | integer (boolean) | Is item equipped | ✅ Present |
| notes | text | Custom notes | ✅ Present |
| attunementSlot | integer (boolean) | D&D attunement | ✅ Present |
| createdAt | integer (timestamp) | Creation time | ✅ Present |
| updatedAt | integer (timestamp) | Last update | ✅ Present |

**Foreign Keys:**
- `characterId` → `unified_characters.id` (CASCADE DELETE)
- `itemId` → `items.id` (RESTRICT DELETE)

#### `items` Table

| Field | Type | Usage | Status |
|-------|------|-------|--------|
| id | text PRIMARY KEY | Item identifier | ✅ Present |
| name | text | Item name | ✅ Present |
| category | text | Item category | ✅ Present |
| type | text | Item type | ✅ Present |
| subtype | text | Item subtype | ✅ Present |
| rarity | text | Common/rare/legendary | ✅ Present |
| cost | integer | Purchase cost | ✅ Present |
| weight | real | Item weight | ✅ Present |
| description | text | Full description | ✅ Present |
| properties | text (JSON) | Item mechanics | ✅ Present |
| requiresAttunement | integer (boolean) | Needs attunement | ✅ Present |
| gameSystem | text | dnd/cyberpunk | ✅ Present |
| source | text | Source book | ✅ Present |
| createdAt | integer (timestamp) | Creation time | ✅ Present |

### 3. Database Helpers Created

New file: `server/db/characters.ts`

Type-safe helper functions for common character operations:
- `createCharacter(character)` - Create new character
- `updateCharacter(id, updates)` - Update character fields
- `getCharacter(id)` - Fetch character by ID
- `getCharactersByUser(userId)` - Get all user's characters
- `addItemToCharacter(characterId, itemId, quantity)` - Add item to inventory (with stacking)
- `getCharacterWithInventory(characterId)` - Get character with full inventory details
- `removeItemFromCharacter(characterId, itemId, quantity)` - Remove item from inventory
- `deleteCharacter(id)` - Delete character and cascade inventory

These helpers complement the existing `server/storage.ts` module and provide convenient type-safe wrappers for common operations.

## Migration Commands

### Database Schema Already Applied

The current schema in `migrations/0000_secret_red_hulk.sql` already contains all necessary tables and columns. No new migration is needed.

### Verify Schema Locally

```bash
# Set database URL to local test file
export TURSO_DATABASE_URL="file:./dev.sqlite"

# Install dependencies if needed
npm ci

# Push schema to verify (idempotent, safe to run)
npm run db:push
```

### If You Need to Start Fresh (Development Only)

```bash
# Remove local database file
rm -f dev.sqlite

# Recreate schema
npm run db:push
```

## Safety Constraints

⚠️ **CRITICAL SAFETY NOTES:**

1. **DO NOT** run migrations against production databases manually
2. **DO NOT** use `drizzle-kit push` in production - it bypasses migration history
3. **DO NOT** modify the existing migration file `0000_secret_red_hulk.sql`
4. **ALWAYS** use environment variables for database credentials
5. **ALWAYS** test schema changes on local SQLite files first

### Production Migration Best Practices

When deploying schema changes to production (not needed for this PR):

1. Generate migration SQL with `drizzle-kit generate`
2. Review the generated SQL carefully
3. Test on staging environment
4. Backup production database
5. Apply migration during maintenance window
6. Verify data integrity
7. Monitor for errors

## Rollback Procedure

Since no schema changes were made, no rollback is necessary. The existing schema already supports all required functionality.

If you ever need to rollback a migration:

```bash
# Identify the migration to rollback to
ls -la migrations/

# Manually restore database from backup
# (Drizzle does not have automatic rollback - use database backups)
```

## Verification Checklist

✅ All character creation fields are supported by `unified_characters` table
✅ All inventory fields are supported by `character_inventory_items` table
✅ All item definition fields are supported by `items` table
✅ JSON fields (stats, skills, levelChoices) handle flexible data structures
✅ Foreign key constraints are properly defined
✅ Cascade deletes configured for character → inventory relationship
✅ Indexes exist for common query patterns
✅ Database helpers created for type-safe operations
✅ No migration needed - existing schema is complete

## Testing Character Persistence

### Manual Testing Steps

1. **Create a D&D Character:**
   ```bash
   # Start dev server
   npm run dev
   
   # Navigate to http://localhost:5000/characters
   # Click "New Character"
   # Select "D&D 5th Edition"
   # Fill in character details
   # Click "Create Character"
   ```

2. **Verify Character Saved:**
   ```bash
   # Check database directly
   sqlite3 dev.sqlite "SELECT id, character_name, class, level FROM unified_characters;"
   ```

3. **Add Items to Inventory:**
   ```bash
   # In the UI, go to character page
   # Click "Show Inventory"
   # Items should load from character_inventory_items table
   ```

4. **Create a Cyberpunk Character:**
   ```bash
   # Click "New Character"
   # Select "Cyberpunk RED"
   # Fill in edgerunner details
   # Verify stats JSON stores cyberpunk-specific fields
   ```

### Database Query Examples

```sql
-- View all characters
SELECT 
  id, 
  character_name, 
  race, 
  class, 
  level, 
  game_system 
FROM unified_characters;

-- View character inventory with item details
SELECT 
  ci.quantity,
  ci.equipped,
  i.name as item_name,
  i.rarity,
  i.description
FROM character_inventory_items ci
JOIN items i ON ci.item_id = i.id
WHERE ci.character_id = '<character_id>';

-- Check character stats structure
SELECT 
  character_name,
  json(stats) as stats_json,
  json(skills) as skills_json,
  json(level_choices) as level_choices_json
FROM unified_characters
WHERE id = '<character_id>';
```

## Integration Points

### Existing Code Using Character Persistence

1. **`server/routes.ts`:**
   - `/api/saved-characters` - Character CRUD endpoints
   - `/api/saved-characters/:id/inventory` - Inventory management
   - `/api/rooms/:code/join` - Character joins game room
   - Starting item grants on character creation

2. **`server/storage.ts`:**
   - `createSavedCharacter()` - Uses insertSavedCharacterSchema validation
   - `updateSavedCharacter()` - Updates character fields
   - `addToSavedInventory()` - Adds items with quantity stacking
   - `getSavedInventoryWithDetails()` - Fetches inventory with item details

3. **`client/src/pages/characters.tsx`:**
   - Character creation form for D&D and Cyberpunk
   - Skill proficiency selection with race/class tracking
   - Expertise selection for applicable classes
   - Inventory display component

## Conclusion

The database schema is **production-ready** and requires no changes. All character creation, item management, and saved character persistence functionality is already properly backed by:

1. ✅ Comprehensive `unified_characters` table with all needed fields
2. ✅ Properly structured `character_inventory_items` with foreign key constraints
3. ✅ Complete `items` table for item definitions
4. ✅ JSON columns for flexible data (stats, skills, levelChoices, spellSlots)
5. ✅ Appropriate indexes for query performance
6. ✅ Cascade delete for referential integrity

The existing migration `migrations/0000_secret_red_hulk.sql` contains the complete schema and is ready for deployment.

## Questions or Issues

If you encounter any issues with character persistence:

1. Check that database connection is configured correctly
2. Verify environment variables are set: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. Ensure `npm run db:push` has been run to apply schema
4. Check browser console and server logs for errors
5. Refer to `server/db/characters.ts` helper functions for examples

For schema questions, refer to `shared/schema.ts` which contains the complete table definitions and type exports.

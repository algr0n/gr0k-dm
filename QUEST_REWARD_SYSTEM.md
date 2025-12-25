# Quest Reward Distribution and Dynamic Item Creation System

## Overview

This implementation solves the FOREIGN KEY constraint errors that occur when quest rewards reference items that don't exist in the database. It introduces an AI-powered dynamic item creation system and ensures quest rewards are properly distributed to characters when quests are completed.

## Problem Addressed

### Original Issues
1. **Quest rewards were NOT being distributed on completion** - Only status was updated
2. **FOREIGN KEY constraint errors** - Quest rewards with non-existent items failed to save
3. **No dynamic item creation** - DM-generated quest rewards couldn't include custom items
4. **Rewards were potentially given on creation** (not on completion)

### Error Example
```
[DM Action] Failed to create dynamic NPC: LibsqlError: SQLITE_CONSTRAINT: SQLite error: FOREIGN KEY constraint failed
```

## Solution Components

### 1. Dynamic Item Creation System (`server/utils/item-creation.ts`)

A new utility module that uses AI (Grok) to generate D&D 5e appropriate item stats:

```typescript
export async function createItemFromReward(
  itemName: string,
  context?: {
    questDescription?: string;
    gameSystem?: string;
  }
): Promise<Item>
```

**Features:**
- Uses Grok AI to generate complete D&D 5e item stats
- Handles weapons, armor, potions, magic items, and more
- Falls back to generic item if AI fails
- Generates unique IDs with slugification
- Includes proper error handling and logging

**AI Prompt Structure:**
- Requests specific JSON format for item properties
- Provides context from quest description
- Generates appropriate category, type, rarity, cost, weight
- Creates balanced D&D 5e properties (damage, AC, effects, etc.)

### 2. Quest Reward Distribution (`server/routes.ts` - quest_update handler)

When a quest status changes to 'completed', the system now:

**For each character in the room:**

1. **Awards Gold**
   - Updates character's `currency.gp` field
   - Preserves existing copper and silver values
   - Logs the transaction

2. **Awards XP**
   - Updates character's `xp` field (not `currentXP`)
   - Adds to existing XP total
   - Logs the transaction

3. **Awards Items**
   - First tries to find existing item by ID
   - Then tries to find by name
   - If not found, creates item dynamically using AI
   - Adds item to character's inventory
   - Handles each item independently with try-catch

**Error Handling:**
- Individual try-catch for each character
- Individual try-catch for each item
- Failures don't block other characters/items
- All errors logged with context

### 3. Enhanced Item Add Handler (`server/routes.ts` - item_add action)

The DM's manual item addition now supports:

1. **AI-Powered Creation** (when no custom properties provided)
   - Automatically generates item stats using AI
   - Creates balanced D&D 5e items
   
2. **Manual Creation** (when custom properties provided)
   - Preserves existing manual item creation logic
   - Supports custom damage, armor class, properties
   - Uses weapon damage mapping for common weapons

## Usage Examples

### Creating a Quest with Custom Item Reward

```javascript
// DM creates quest with custom item
{
  type: "quest_add",
  questTitle: "The Lost Amulet",
  questDescription: "Find the ancient amulet in the ruins",
  questObjectives: ["Search the ruins", "Defeat the guardian"],
  questRewards: {
    xp: 500,
    gold: 100,
    items: ["Ancient Amulet of Protection"] // Item doesn't exist yet
  }
}

// When quest is completed
{
  type: "quest_update",
  questId: "quest-id-or-title",
  questStatus: "completed"
}
// System will:
// 1. Create "Ancient Amulet of Protection" with AI-generated stats
// 2. Give 500 xp to all characters
// 3. Give 100 gp to all characters
// 4. Give the amulet to all characters
```

### Adding Custom Item Manually

```javascript
// Without custom properties (uses AI)
{
  type: "item_add",
  playerName: "Gandalf",
  itemName: "Staff of Power"
  // AI generates D&D 5e appropriate stats
}

// With custom properties (manual)
{
  type: "item_add",
  playerName: "Aragorn",
  itemName: "Anduril",
  customProperties: JSON.stringify({
    category: "weapon",
    type: "longsword",
    rarity: "legendary",
    damage: "1d8",
    damageType: "slashing",
    description: "Flame of the West, sword of kings"
  })
}
```

## Database Schema Changes

No schema changes required. Uses existing tables:
- `items` - Master items table
- `adventure_quests` - Quests with rewards JSON
- `unified_characters` - Character currency and XP
- `character_inventory_items` - Character inventories

## Key Implementation Details

### Character Schema Fields
```typescript
{
  xp: integer,                           // NOT currentXP
  currency: { cp: number, sp: number, gp: number }  // JSON field
}
```

### Quest Rewards Schema
```typescript
{
  rewards: {
    xp?: number;
    gold?: number;
    items?: string[];  // Item IDs or names
    other?: string[];
  }
}
```

### Item Creation Flow
```
1. Quest completed with item reward
2. Try to find item by ID → Not found
3. Try to find item by name → Not found
4. Call createItemFromReward(itemName, context)
5. AI generates item stats as JSON
6. Parse and validate JSON response
7. Create unique item ID (ai-{slug}-{random})
8. Insert into items table
9. Return created item
10. Add to character inventory
```

## Error Handling

### Quest Reward Distribution
- Each character processed independently
- Each reward type (gold/xp/items) handled separately
- Item creation failures don't block other items
- All errors logged with context
- Continues processing remaining characters/items

### AI Item Creation
- Falls back to generic item if AI fails
- Handles JSON parsing errors
- Validates required fields
- Ensures unique IDs with random suffix

## Logging

All operations logged for debugging:
```
[Quest Reward] Distributing rewards for quest "..." to N character(s)
[Quest Reward] Gave X gp to CharacterName
[Quest Reward] Gave X xp to CharacterName
[Quest Reward] Item "..." not found, creating dynamically...
[Quest Reward] Created new item: ItemName (item-id)
[Quest Reward] Gave ItemName to CharacterName
[Quest Complete] Distributed rewards to N character(s)
```

## Testing

### Build Verification
```bash
npm run check  # TypeScript type checking
npm run build  # Full build (client + server)
```

### Manual Testing Checklist
1. ✅ Create room with characters
2. ✅ Create quest with custom item reward
3. ✅ Complete the quest
4. ✅ Verify all characters receive rewards
5. ✅ Verify new item created in database
6. ✅ Verify item added to inventories
7. ✅ Verify no FOREIGN KEY errors
8. ✅ Check logs for proper distribution

### Expected Results
- ✅ Quest saves successfully (no constraint errors)
- ✅ Quest rewards distributed ONLY on completion
- ✅ Missing items created with AI-generated stats
- ✅ All characters in room receive rewards
- ✅ Database gradually fills with narrative items
- ✅ Gold added to currency.gp
- ✅ XP added to xp field

## Performance Considerations

- AI calls only made for non-existent items
- Items cached after creation (subsequent uses are instant)
- Parallel processing of characters (no blocking)
- Individual error isolation prevents cascade failures

## Security Considerations

- AI-generated content validated before database insertion
- Item properties sanitized through Zod schemas
- No SQL injection risk (using Drizzle ORM)
- Unique ID generation prevents conflicts

## Future Enhancements

Potential improvements:
1. Cache AI-generated items by name to avoid duplicate API calls
2. Add admin UI to review/edit AI-generated items
3. Support batch item creation for performance
4. Add item template system for common quest rewards
5. Implement item rarity balancing based on quest difficulty
6. Add notification to players when rewards are distributed

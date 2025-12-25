# NPC Stat Block Generation

This feature provides automatic generation of complete NPC stat blocks for use in combat and skill checks. It supports both AI-powered generation (via Grok) and a deterministic fallback.

## Overview

The system generates D&D 5th Edition compatible stat blocks for NPCs that are missing `stats_block` data. This ensures dynamic NPCs are immediately playable in combat without requiring manual stat authoring.

## Architecture

### Files Added

1. **`server/npc-stats.ts`** - Core stat generation module
   - Type definitions: `AbilityScores`, `Attack`, `NpcStatBlock`, `NpcRow`
   - Deterministic generation: `roll4d6DropLowest()`, `modFor()`, `averageHpForHd()`
   - Main function: `generateNpcStatBlock()` - tries AI first, falls back to deterministic
   - Helper: `ensureNpcHasStats()` - returns parsed or generated stats with optional DB save

2. **`server/grok.ts`** - Extended with AI integration
   - Function: `generateNpcWithGrok()` - calls Grok API for structured JSON stat blocks
   - Uses conservative temperature (0.3) for consistent output
   - Returns `null` if no API key available (triggers fallback)

3. **`server/example-combat-integration.ts`** - Integration helpers
   - `ensureNpcsForCombat()` - batch ensures all NPCs have stats
   - `npcToCombatEntry()` - formats NPC for combat engine
   - Example usage patterns and documentation

## Usage

### Basic Generation

```typescript
import { generateNpcStatBlock, type NpcRow } from "./server/npc-stats";

const npc: NpcRow = {
  id: "npc-123",
  name: "Guard Captain",
  role: "Guard Captain",
  description: "A battle-hardened veteran",
  personality: "Stern but fair",
  statsBlock: null,
};

const stats = await generateNpcStatBlock(npc);
// Returns complete NpcStatBlock with abilities, hp, ac, attacks, etc.
```

### Ensuring Stats with DB Save

```typescript
import { ensureNpcHasStats } from "./server/npc-stats";
import { db } from "./db";
import { dynamicNpcs } from "@shared/adventure-schema";
import { eq } from "drizzle-orm";

// Define save adapter
async function saveNpcStatsToDb(npcId: string, statsBlock: NpcStatBlock) {
  await db
    .update(dynamicNpcs)
    .set({ statsBlock: statsBlock as any })
    .where(eq(dynamicNpcs.id, npcId));
}

// Get or generate stats
const stats = await ensureNpcHasStats(npc, {
  forceRegenerate: false, // Only generate if missing
  saveStats: saveNpcStatsToDb,
});
```

### Combat Integration

```typescript
import { ensureNpcsForCombat, npcToCombatEntry } from "./server/example-combat-integration";

// In your combat start handler
app.post("/api/rooms/:code/combat/start", async (req, res) => {
  const { npcIds } = req.body;
  
  // Fetch NPCs from database
  const npcRows = await db
    .select()
    .from(dynamicNpcs)
    .where(inArray(dynamicNpcs.id, npcIds));
  
  // Ensure all NPCs have stats
  const npcsWithStats = await ensureNpcsForCombat(npcRows, saveNpcStatsToDb);
  
  // Convert to combat format
  const monsters = npcsWithStats.map(npcToCombatEntry);
  
  // Use with existing combat engine
  // ...
});
```

## Stat Block Structure

Generated stat blocks include:

```typescript
interface NpcStatBlock {
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  modifiers: { /* same structure as abilities */ };
  profBonus: number;
  ac: number;
  hp: number;
  maxHp: number;
  speed: string; // e.g., "30 ft"
  attacks: Array<{
    name: string;
    attackBonus: number;
    damage: string; // e.g., "1d8+3"
    damageType?: string; // e.g., "slashing"
    range?: string;
  }>;
  passivePerception: number;
  skills?: Record<string, number>;
  savingThrows?: Record<string, number>;
  notes?: string;
}
```

## Generation Strategy

### AI Generation (Grok)
- **Trigger**: When `XAI_API_KEY` is present
- **Method**: Structured JSON prompt to Grok API
- **Temperature**: 0.3 (conservative for consistency)
- **Model**: grok-beta
- **Fallback**: On API failure or invalid response, uses deterministic generator

### Deterministic Generation
- **Trigger**: No API key or AI generation fails
- **Abilities**: 4d6 drop lowest (standard D&D method)
- **HP**: Average based on estimated hit dice and CON modifier
- **AC**: 10 + DEX modifier + armor bonus
- **Proficiency**: Estimated from NPC role/description keywords
- **Attacks**: Default melee attack, ranged if DEX > 0
- **Notes**: Includes "Generated deterministically (fallback)" flag

## Configuration

### Environment Variables
- `XAI_API_KEY` - Optional. If present, enables AI generation

### No Configuration Required
- Works out of the box with deterministic fallback
- No database migrations needed (uses existing `stats_block` column)

## Testing

Run the test script:

```bash
npx tsx test-npc-stats.ts
```

This will:
1. Generate stats for 3 sample NPCs (Guard Captain, Goblin Scout, Ancient Dragon)
2. Display detailed stat blocks
3. Test the `ensureNpcHasStats` function with save callback
4. Show generation mode (AI or deterministic) and timing

## Implementation Notes

### Design Decisions
1. **Non-invasive**: Creates new files only, doesn't modify existing routes
2. **Self-contained**: Uses Node's crypto.randomInt, no external dice dependencies
3. **Flexible**: Provides helpers but doesn't enforce usage pattern
4. **Safe**: Graceful fallback ensures NPCs are always playable

### Database Integration
- Reuses existing `stats_block` column in `dynamicNpcs` and `adventureNpcs` tables
- No schema changes or migrations required
- Stats stored as JSON for flexibility

### AI Integration
- Minimal wrapper, uses native fetch-like API
- Doesn't couple to specific xAI client library features
- Strict JSON-only prompt for reliable parsing
- Handles markdown-wrapped responses gracefully

## Future Enhancements

Potential improvements (not in this PR):
1. Support for more game systems (Cyberpunk RED, etc.)
2. Cache generated stats to reduce API calls
3. UI for manual stat editing
4. Batch regeneration command for system updates
5. More sophisticated estimation based on CR or level
6. Support for special abilities and spell casting

## Troubleshooting

### Stats Not Saving
- Verify the save adapter is correctly updating the database
- Check database permissions
- Ensure `statsBlock` column accepts JSON

### AI Generation Failing
- Verify `XAI_API_KEY` is set correctly
- Check API quota/rate limits
- Monitor console logs for detailed error messages
- Fallback should trigger automatically

### Invalid Stat Blocks
- Deterministic generator will always produce valid stats
- AI responses are validated before use
- Invalid AI responses trigger deterministic fallback

## Examples

See `server/example-combat-integration.ts` for:
- Complete combat integration example
- Batch stat generation
- Preview/debugging helpers
- Detailed usage patterns with comments

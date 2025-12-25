# PR Summary: NPC Stat Block Generation

## Overview
This PR adds automatic generation of complete D&D 5e NPC stat blocks for combat and skill checks, with AI-powered generation and deterministic fallback.

## Problem Statement
Dynamic NPC rows exist in the database but many are missing usable stat blocks (stats_block column is NULL). This prevents NPCs from being immediately playable in combat encounters.

## Solution
Added a modular, non-invasive stat generation system that:
- Generates complete stat blocks (abilities, HP, AC, attacks, etc.)
- Prefers AI generation via Grok/xAI API when available
- Falls back to deterministic 4d6-drop-lowest generation
- Provides helpers for combat integration
- Saves generated stats back to database

## Files Added

### Core Module: `server/npc-stats.ts` (319 lines)
- **Types**: `AbilityScores`, `Attack`, `NpcStatBlock`, `NpcRow`
- **Deterministic Generation**:
  - `roll4d6DropLowest()` - Standard D&D ability score generation
  - `modFor()` - Calculate ability modifiers
  - `averageHpForHd()` - Calculate HP from hit dice
  - `categorizeNpc()` - Categorize NPCs by role keywords into tiers
- **Main Functions**:
  - `generateNpcStatBlock()` - Generate complete stat block (AI with fallback)
  - `ensureNpcHasStats()` - Get or generate stats with optional DB save
- **Utilities**:
  - `extractJsonFromResponse()` - Parse JSON from markdown-wrapped API responses

### AI Integration: `server/grok.ts` (169 lines)
- Added `generateNpcWithGrok()` function
- Uses Grok API with structured JSON prompt
- Conservative temperature (0.3) for consistent output
- Returns `null` when API unavailable (triggers fallback)
- Validates response structure before returning

### Combat Helpers: `server/example-combat-integration.ts` (195 lines)
- `ensureNpcsForCombat()` - Batch ensure stats for all combat NPCs
- `npcToCombatEntry()` - Format NPC for combat engine
- `previewNpcStats()` - Generate without saving (testing/debugging)
- `regenerateAllNpcStats()` - Batch regenerate with parallel processing
- Comprehensive examples and usage documentation

### Documentation: `NPC_STATS_README.md` (226 lines)
- Complete feature documentation
- Architecture overview
- Usage examples
- Stat block structure
- Generation strategy details
- Configuration guide
- Testing instructions
- Troubleshooting guide

## Implementation Details

### Design Principles
✅ **Non-invasive**: Creates new files only, no route modifications
✅ **Self-contained**: Uses Node crypto, no external dice dependencies  
✅ **Flexible**: Provides helpers without enforcing usage patterns
✅ **Safe**: Graceful fallback ensures NPCs are always playable
✅ **No schema changes**: Reuses existing `stats_block` column

### NPC Role Categorization
The system categorizes NPCs into tiers based on keywords:
- **Legendary**: powerful, legendary, boss, ancient, elder → Prof +4, 10d10 HP
- **Veteran**: veteran, leader, captain, champion, master → Prof +3, 8d8 HP
- **Trained**: guard, soldier, warrior, knight, fighter → Prof +2, 4d8 HP
- **Common**: default fallback → Prof +2, 3d8 HP

### Generated Stat Block Structure
```typescript
{
  abilities: { str, dex, con, int, wis, cha },
  modifiers: { str, dex, con, int, wis, cha },
  profBonus: number,
  ac: number,
  hp: number,
  maxHp: number,
  speed: string,
  attacks: [{ name, attackBonus, damage, damageType, range }],
  passivePerception: number,
  skills: { perception, stealth, athletics },
  notes: string
}
```

## Testing

### Manual Testing
Created `test-npc-stats.ts` script that validates:
- ✅ Deterministic generation works correctly
- ✅ All required fields present in stat blocks
- ✅ HP/AC/attacks generated appropriately for role
- ✅ `ensureNpcHasStats` works with save callback
- ✅ Generation is fast (< 1ms for deterministic)

### Build Verification
- ✅ TypeScript compilation succeeds
- ✅ No blocking errors introduced
- ✅ Build succeeds (npm run build)
- ✅ Test script runs successfully

### Security
- ✅ CodeQL analysis: 0 vulnerabilities
- ✅ No secrets committed
- ✅ Secure random number generation (crypto.randomInt)

### Code Quality
Addressed all code review feedback:
- ✅ Extracted role categorization into configuration object
- ✅ Shared categorization logic between functions
- ✅ Extracted JSON parsing into reusable utility
- ✅ Improved parallel processing with Promise.allSettled

## Usage Example

```typescript
import { ensureNpcsForCombat } from "./server/example-combat-integration";
import { db } from "./db";
import { dynamicNpcs } from "@shared/adventure-schema";
import { eq } from "drizzle-orm";

// Save adapter
async function saveNpcStatsToDb(npcId: string, statsBlock: NpcStatBlock) {
  await db
    .update(dynamicNpcs)
    .set({ statsBlock: statsBlock as any })
    .where(eq(dynamicNpcs.id, npcId));
}

// In combat start handler
const npcsWithStats = await ensureNpcsForCombat(npcRows, saveNpcStatsToDb);
const monsters = npcsWithStats.map(npcToCombatEntry);
// Use monsters with combat engine...
```

## Configuration

### Environment Variables
- `XAI_API_KEY` - Optional. Enables AI generation when present

### No Configuration Required
- Works immediately with deterministic fallback
- No database migrations needed

## Performance

- **Deterministic Generation**: < 1ms per NPC
- **AI Generation**: ~2-5s per NPC (API dependent)
- **Batch Processing**: Parallel with Promise.allSettled
- **No Performance Impact**: Only runs when explicitly called

## Future Enhancements
- Support for additional game systems (Cyberpunk RED, etc.)
- Cache generated stats to reduce API calls
- UI for manual stat editing
- More sophisticated CR/level estimation
- Support for spell casting NPCs

## Breaking Changes
None. This PR is purely additive.

## Migration Required
None. Uses existing database schema.

## Security Summary
- No vulnerabilities introduced (CodeQL verified)
- Uses secure random generation (crypto.randomInt)
- No secrets or credentials in code
- Safe API key handling (environment variables)

## Commits
1. `204342c` - Add NPC stat block generation with AI and deterministic fallback
2. `ca45bc4` - Add documentation and test script for NPC stat generation  
3. `63f0c7d` - Refactor NPC stats generation based on code review feedback

## Lines Changed
- 909 lines added across 4 new files
- 0 lines modified in existing files
- 0 breaking changes

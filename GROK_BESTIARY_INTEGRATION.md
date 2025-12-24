# Integration Steps: Enable Grok to Access Bestiary

## Current Flow

```
routes.ts (has db)
    ↓
generateBatchedDMResponse(openai, messages, room...)
    ↓
DM response generated WITHOUT database context
```

## Problem

The generators don't receive the `db` client, so they can't query the bestiary.

## Solution

### Step 1: Update Generator Signatures

**File:** `server/generators/dm-response.ts`
```typescript
// Add Client import
import type { Client } from "@libsql/client";

// Update function signature
export async function generateDMResponse(
  openaiClient: OpenAI,
  messages: ChatCompletionMessageParam[],
  room: Room,
  partyCharacters?: CharacterInfo[],
  gameSystem?: string,
  client?: Client,  // ← NEW: Pass database client
  additionalContext?: string
): Promise<string> {
  // Now can use: getMonsterByName(client, "Goblin")
}
```

### Step 2: Update Combat Generator

**File:** `server/generators/combat.ts`
```typescript
import type { Client } from "@libsql/client";
import { getMonsterByName, formatMonsterStatBlock } from "../db/bestiary";

export async function generateCombatDMTurn(
  openaiClient: OpenAI,
  room: Room,
  partyCharacters?: CharacterInfo[],
  client?: Client  // ← NEW
): Promise<string> {
  // Can now use bestiary data:
  // const monster = await getMonsterByName(client, "Goblin");
  // const stats = formatMonsterStatBlock(monster);
}
```

### Step 3: Update Route Calls

**File:** `server/routes.ts`

**Current:**
```typescript
const dmResponse = await generateBatchedDMResponse(
  openai,
  batchedMessages, 
  room, 
  undefined, 
  characterInfos, 
  undefined,
  adventureContext
);
```

**Updated:**
```typescript
const dmResponse = await generateBatchedDMResponse(
  openai,
  batchedMessages, 
  room, 
  undefined, 
  characterInfos, 
  undefined,
  adventureContext,
  db  // ← Pass the database client
);
```

### Step 4: Use Bestiary in Context Builder

**File:** `server/context/context-builder.ts`

Add method to include monster stat blocks:
```typescript
async addMonsterContext(monsterName: string, client: Client) {
  const monster = await getMonsterByName(client, monsterName);
  if (monster) {
    const statBlock = formatMonsterStatBlock(monster);
    this.messages.push({
      role: "system",
      content: `MONSTER STATS:\n${statBlock}`
    });
  }
}
```

## Implementation Checklist

- [ ] Update `generateDMResponse` signature to accept `client`
- [ ] Update `generateBatchedDMResponse` signature to accept `client`  
- [ ] Update `generateCombatDMTurn` signature to accept `client`
- [ ] Update `generateSceneDescription` signature to accept `client`
- [ ] Update all route calls to pass `db` client
- [ ] Add monster lookup to combat generator
- [ ] Add monster suggestion to scene generator
- [ ] Test with actual monster encounters

## Example: Combat with Bestiary

### Before
```typescript
export async function generateCombatDMTurn(
  openaiClient: OpenAI,
  room: Room
): Promise<string> {
  const builder = new ContextBuilder();
  builder.addSystemPrompt(room.gameSystem);
  builder.addCombatContext("The enemies attack...");
  // AI just improvises stats
}
```

### After
```typescript
export async function generateCombatDMTurn(
  openaiClient: OpenAI,
  room: Room,
  partyCharacters?: CharacterInfo[],
  client?: Client  // ← Database access
): Promise<string> {
  const builder = new ContextBuilder();
  builder.addSystemPrompt(room.gameSystem);
  builder.addCombatContext("The enemies attack...");
  
  // ← NEW: Get actual monster stats
  if (client && room.currentEnemies) {
    for (const enemyName of room.currentEnemies) {
      await builder.addMonsterContext(enemyName, client);
    }
  }
  
  // AI now uses real D&D 5e stats
}
```

## Why This Matters

**Without Bestiary:**
- AI improvises: "The goblin swings... 5 damage!"
- Stats might be inconsistent
- No legendary actions or traits

**With Bestiary:**
- AI knows: Goblin has AC 15, 7 HP, +4 attack, scimitar 1d6+2
- Stats are accurate D&D 5e mechanics
- Includes all abilities and traits
- Can reference "Pack Tactics" trait
- Combat is mechanically consistent

## Quick Win: Combat Turn

Minimal change to get immediate benefit:

```typescript
// In server/generators/combat.ts
if (client) {
  const monsterStatsHint = `
    Remember these monster abilities when describing combat:
    - Goblins: AC 15, 7 HP, Pack Tactics (advantage when ally nearby)
    - Orcs: AC 13, 15 HP, Aggressive (bonus action movement toward enemy)
    - Skeletons: AC 8, 13 HP, Immune to poison
  `;
  builder.addUserMessage(monsterStatsHint);
}
```

---

Once integrated, Grok can ask the database: "What are the stats for this enemy?" and get accurate answers! 🐉

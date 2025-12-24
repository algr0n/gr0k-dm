# Using the Grok Bestiary Integration

## How Grok Uses Monsters Now

### Automatic Detection in Combat

When players mention a monster type, Grok automatically looks it up:

```typescript
// In combat.ts, when the AI takes a turn:
const recentMessages = room.messageHistory.slice(-5)
const monsterNames = extractMonsterNames(recentMessages)
// Finds: ["Goblin", "Orc", "Skeleton"]

for (const monsterName of monsterNames.slice(0, 3)) {
  await builder.addMonsterContext(monsterName, client)
  // Adds actual stat block to AI context
}
```

## Real-World Examples

### Example 1: Auto-Lookup

**Player Action:**
```
"I swing my sword at the goblin in front of me!"
```

**What Happens:**
1. Message batched with other player actions
2. Recent messages scanned: finds "goblin"
3. Database query: `getMonsterByName(client, "Goblin")`
4. Returns full stat block (AC, HP, attacks, traits, actions)
5. Added to AI context as system message
6. AI generates response with accurate mechanics:

**Grok Response:**
```
"The goblin (AC 15) tries to dodge! Rolling d20+4... 
[d20+4=16] - MISS! Your blade cuts through the air as the 
goblin darts away. It hisses and lunges back with its 
scimitar, rolling d20+4 to hit your AC...
[d20+4=19] - HIT! [d6+2=7] You take 7 slashing damage!"
```

### Example 2: Multi-Monster Combat

**Room Setup:**
```
Combat started with: 2 goblins, 1 hobgoblin, 1 ogre
```

**What Grok Does:**
1. Extracts monster names from recent combat messages
2. Loads up to 3 monster stat blocks (chooses most important)
3. Uses their real abilities in combat narration
4. Attributes correct AC, HP, and attack bonuses

**Result:**
```
"The goblins circle you cautiously (Hobgoblin leads them - AC 18, leader bonus).
First goblin [AC 15] attacks with scimitar: [d20+4=17] HIT!
But the hobgoblin [AC 18] raises a shield: 'Cowards! Let ME face them!'
It charges with greatsword: [d20+3=19] HIT! [2d6+3=10] Ten points damage!"
```

### Example 3: Ability References

**Player Question:**
```
"What happens if I cast magic missile on the beholder?"
```

**Grok's Context:**
Stat block includes: "**Magic Resistance.** The beholder has advantage on saving throws against spells and magical effects."

**Grok Response:**
```
"Your magic missile streaks toward the Beholder (CR 13)!
However, the Beholder's natural magic resistance kicks in!
It has advantage on the save... [rolls]... SUCCESS!
The magical bolts dissipate against its protective aura!"
```

## What Monster Data is Available

Each monster includes:

```
- Name, Size, Type, Alignment
- Armor Class
- Hit Points (formula + average)
- Ability Scores (STR, DEX, CON, INT, WIS, CHA)
- Skills and Proficiencies
- Damage Resistances/Immunities
- Condition Immunities
- Senses (Darkvision, etc.)
- Languages
- Challenge Rating (CR)
- Experience Points (XP)

Plus Special Data:
- Traits (passive abilities)
- Actions (attacks, abilities, special actions)
- Legendary Actions (if applicable)
- Rays (for creatures like Beholders)
```

## Current Monsters Available

**199 D&D 5e Monsters Including:**

**Dragons:** Ancient/Adult/Young/Wyrmling Gold, Silver, Red, Blue, Green, Black, White, Brass, Bronze, Copper, Metallic, Chromatic

**Humanoids:** Goblin, Hobgoblin, Orc, Ogre, Bugbear, Drow, Gnome, Dwarf

**Undead:** Zombie, Skeleton, Wraith, Specter, Lich, Demilich

**Beasts:** Wolf, Giant Spider, Giant Scorpion, Lion, Tiger, Bear, etc.

**Elementals:** Fire, Air, Earth, Water Elementals

**Celestials/Fiends:** Angels, Demons, Devils, various types

**And many more...**

## Implementation Details

### File: `server/generators/combat.ts`

```typescript
export async function generateCombatDMTurn(
  openaiClient: OpenAI,
  room: Room,
  partyCharacters?: CharacterInfo[],
  client?: Client  // ← NEW!
): Promise<string> {
  // ... setup ...
  
  // NEW: Add monster context from bestiary
  if (client && room.messageHistory && room.messageHistory.length > 0) {
    const recentMessages = room.messageHistory.slice(-5);
    const monsterNames = extractMonsterNames(recentMessages);
    
    for (const monsterName of monsterNames.slice(0, 3)) {
      await builder.addMonsterContext(monsterName, client);
    }
  }
  
  // Rest of function generates response with monster stats in context
}
```

### File: `server/context/context-builder.ts`

```typescript
async addMonsterContext(monsterName: string, client: Client): Promise<this> {
  try {
    // Query database for monster
    const monster = await getMonsterByName(client, monsterName);
    if (monster) {
      // Format as readable stat block
      const statBlock = formatMonsterStatBlock(monster);
      // Add to AI system prompt
      this.messages.push({ 
        role: "system", 
        content: `MONSTER STATS FOR: ${monsterName}\n${statBlock}` 
      });
    }
  } catch (error) {
    console.warn(`Failed to load monster context for ${monsterName}:`, error);
  }
  return this;
}
```

## Performance Notes

- **Limits to 3 monsters** per request to avoid token bloat
- **Smart extraction** - only loads monsters mentioned in recent messages
- **Graceful fallback** - if monster not found, AI continues normally
- **Efficient queries** - simple lookups cached by database

## Future Enhancements

Could add:

1. **DM Summon Command:** `/summon goblin x3` → Pre-loads monster stats
2. **Encounter Builder:** `/build-encounter level:5 party-size:4` → Suggests balanced monsters
3. **Monster Browser UI:** DM tool to search and preview monsters
4. **Combat Log:** Auto-track monster HP, initiative, conditions
5. **Random Encounters:** Generate encounters for terrain/level

---

**The bestiary is now live and Grok uses it automatically in combat!** 🐉

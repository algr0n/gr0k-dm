# NPC Reputation System

## Overview

Grok DM now features a dynamic reputation system for all NPCs. Player actions and quest completions affect how NPCs view the party, influencing combat behavior, quest rewards, and information sharing.

## Reputation Scale

Reputation ranges from **-100** (hostile enemy) to **+100** (trusted ally):

| Score Range | Status | Role | Behavior |
|-------------|--------|------|----------|
| +75 to +100 | Trusted Ally | ally | Always helps in combat, best rewards, shares secrets |
| +50 to +74 | Friend | ally | Helps in combat if present, good rewards |
| +25 to +49 | Friendly | neutral | Won't attack unless provoked, standard rewards |
| -24 to +24 | Neutral | neutral | Indifferent, may avoid combat |
| -49 to -25 | Unfriendly | enemy | May attack if hostile situation arises |
| -74 to -50 | Hostile | enemy | Will attack on sight |
| -99 to -75 | Enemy | enemy | Actively seeks to harm players |

## How Reputation Changes

### Quest Completion
- **First quest**: +10 reputation
- **Subsequent quests**: +10 + (2 × quests_completed)
- Example: 5th quest = +20 reputation

### Combat Actions
- Attacking an NPC: -30 reputation
- Killing an NPC's ally: -20 reputation
- Defending an NPC: +15 reputation

### Roleplay Interactions (future)
- Successful persuasion: +5 to +15
- Failed intimidation: -10
- Helping without quest: +10

## Combat Inclusion

NPCs join combat if:
1. They have a statsBlock defined, AND
2. Either:
   - Their reputation is < -25 (hostile threshold), OR
   - Their role is explicitly "ally", "enemy", or "Monster"

This means:
- **Quest givers** with stats will defend themselves if attacked (reputation drops)
- **Friendly NPCs** won't attack unless provoked
- **Hostile NPCs** automatically join combat encounters

## AI Integration

The AI can use these tags to create NPCs with initial reputation:

```
[NPC_ADD: name="Gundren" role="questgiver" stats={...} reputation=25]
```

Default reputations by role:
- `enemy`: -50
- `ally`: +50  
- `questgiver`: +25
- `neutral`: 0

## Quest Rewards Scaling (Future Enhancement)

Reputation could affect:
- **Gold rewards**: Base × (1 + reputation/100)
  - Neutral (0): 100% base reward
  - Friend (+50): 150% base reward
  - Trusted (+100): 200% base reward
  
- **Information sharing**: Higher reputation = more quest hints
- **Item quality**: Better reputation = better magic items
- **Quest availability**: Some quests only available at high reputation

## Implementation Details

### Database Schema

```sql
-- Added to dynamic_npcs table
reputation INTEGER NOT NULL DEFAULT 0  -- -100 to +100
quests_completed INTEGER NOT NULL DEFAULT 0
last_interaction INTEGER  -- Unix timestamp
```

### API Functions

```typescript
// Update reputation
await storage.updateNpcReputation(npcId, +10);

// Quest completion (auto-increments rep)
await storage.incrementNpcQuestCompletion(npcId);

// Get status text
const { status, role } = storage.getReputationStatus(reputation);
// Returns: { status: "Friend", role: "ally" }
```

### Example Workflow

1. Party meets Gundren (questgiver, reputation: +25)
2. Complete first quest → reputation becomes +35 (Friendly)
3. Complete second quest → reputation becomes +47 (Friendly, close to Friend)
4. Complete third quest → reputation becomes +63 (Friend)
5. Gundren now considered "ally", will help in combat if present

## Migration

Run migration `013_add_npc_reputation_system.sql` to add columns and set initial values based on existing NPC roles.

## Future Enhancements

- [ ] Track individual player reputation (currently party-wide)
- [ ] Reputation decay over time if not maintained
- [ ] Faction reputation systems
- [ ] NPC dialogue changes based on reputation
- [ ] Quest reward multipliers
- [ ] Shop price adjustments
- [ ] Random encounter probability affected by local reputation

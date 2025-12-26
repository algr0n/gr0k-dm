# NPC Reputation UI & AI Integration Guide

## 1. UI Implementation Plan

### New "NPCs" Tab in Room View

Add a new tab alongside Chat, Character, Inventory, Spells, and Quests to display all NPCs the party has encountered with their reputation status.

### UI Components Needed

#### A. NPC List View (`client/src/components/npc-reputation-panel.tsx`)

```tsx
interface NpcReputationPanelProps {
  roomId: string;
}

// Display format:
- NPC Avatar/Icon (colored by reputation)
- NPC Name
- Role badge (Quest Giver, Ally, Enemy, Neutral)
- Reputation bar (-100 to +100)
- Status text (Enemy, Hostile, Unfriendly, Neutral, Friendly, Friend, Trusted Ally)
- Quests completed count
- Last interaction time
- Expandable details showing:
  - Description/personality
  - Quest history
  - Combat stats (if applicable)
  - Interaction timeline
```

#### B. Visual Design

**Color Coding by Reputation:**
```
Enemy (-100 to -75):     Red (#ef4444)
Hostile (-74 to -50):    Orange (#f97316)
Unfriendly (-49 to -25): Yellow (#eab308)
Neutral (-24 to +24):    Gray (#6b7280)
Friendly (+25 to +49):   Light Green (#84cc16)
Friend (+50 to +74):     Green (#22c55e)
Trusted Ally (+75 to +100): Blue (#3b82f6)
```

**Reputation Bar:**
- Progress bar from -100 to +100
- Current position indicator
- Colored gradient based on status
- Threshold markers at -75, -50, -25, 0, +25, +50, +75

### C. API Endpoint

```typescript
// GET /api/rooms/:roomId/npcs-with-reputation
// Returns: { npcs: DynamicNpc[], spawns: CombatSpawn[] }
```

### D. Integration Points

1. **Add to room.tsx tabs:**
```tsx
const tabs = [
  { value: "chat", label: "Chat", icon: MessageSquare },
  { value: "character", label: "Character", icon: User },
  { value: "inventory", label: "Inventory", icon: Package },
  { value: "spells", label: "Spells", icon: Sparkles },
  { value: "quests", label: "Quests", icon: Scroll },
  { value: "npcs", label: "NPCs", icon: Users }, // NEW
  { value: "dm", label: "DM", icon: Crown },
];
```

2. **Real-time updates:**
- Listen for `npc_created` events
- Listen for `npc_reputation_changed` events (new)
- Update UI when quest completed
- Update UI when combat with NPC occurs

---

## 2. AI Integration

### A. Update System Prompt

Add reputation context to the DND_SYSTEM_PROMPT in `server/prompts/dnd.ts`:

```typescript
NPC REPUTATION SYSTEM:
- All NPCs have a reputation score from -100 (enemy) to +100 (trusted ally)
- Current NPC reputations are shown in THE NPCS section above
- Reputation affects NPC behavior, dialogue, and willingness to help

Reputation Thresholds:
  -100 to -75: Enemy (actively hostile, attacks on sight)
  -74 to -50: Hostile (will attack if provoked, refuses help)
  -49 to -25: Unfriendly (suspicious, unhelpful, may demand payment)
  -24 to +24: Neutral (indifferent, standard interactions)
  +25 to +49: Friendly (helpful, offers fair deals)
  +50 to +74: Friend (goes out of their way to help, discounts, extra info)
  +75 to +100: Trusted Ally (deeply loyal, best rewards, shares secrets)

NPC Behavior Guidelines:
- Adjust NPC dialogue tone based on reputation (cold vs warm)
- Hostile NPCs may refuse to engage or attack if threatened
- Friendly NPCs offer hints, warnings, and assistance
- Trusted allies share critical information and offer powerful aid
- NPCs remember past actions (track via reputation)

Creating NPCs with Initial Reputation:
[NPC: Name | Role | {"reputation": 50, "statsBlock": {...}}]

Reputation changes automatically on:
- Quest completion (+10 base + 2 per completed quest)
- Attacking NPC (-30)
- Defending NPC (+15)
- For manual adjustments: [REPUTATION: NPC Name | +/-X]
```

### B. Add NPC Context to Messages

Update `server/context/context-builder.ts` to include NPC reputation data:

```typescript
export async function buildContextForAI(payload: {
  // ... existing params
  includeNpcs?: boolean;
}) {
  // ... existing code
  
  if (payload.includeNpcs) {
    const npcs = await storage.getDynamicNpcsByRoom(payload.roomId);
    if (npcs.length > 0) {
      sections.push({
        title: "THE NPCS",
        content: npcs.map(npc => {
          const repStatus = storage.getReputationStatus(npc.reputation ?? 0);
          return [
            `**${npc.name}** (${npc.role || 'NPC'}) - ${repStatus.status}`,
            `  Reputation: ${npc.reputation ?? 0}/100`,
            `  Quests Completed: ${npc.questsCompleted ?? 0}`,
            npc.description ? `  Description: ${npc.description}` : '',
            npc.personality ? `  Personality: ${npc.personality}` : '',
          ].filter(Boolean).join('\n');
        }).join('\n\n')
      });
    }
  }
  
  // ... rest of function
}
```

### C. New AI Tag for Manual Reputation Changes

```typescript
case "reputation_change": {
  if (!action.npcName || !action.change) break;
  
  try {
    // Find NPC by name
    const npcs = await storage.getDynamicNpcsByRoom(room.id);
    const npc = npcs.find((n: any) => 
      n.name.toLowerCase() === action.npcName!.toLowerCase()
    );
    
    if (npc) {
      const updated = await storage.updateNpcReputation(npc.id, action.change);
      if (updated) {
        const repStatus = storage.getReputationStatus(updated.reputation);
        console.log(`[Reputation Change] ${npc.name}: ${npc.reputation} → ${updated.reputation} (${repStatus.status})`);
        
        // Broadcast reputation change
        broadcastFn(roomCode, {
          type: 'npc_reputation_changed',
          npcId: npc.id,
          npcName: npc.name,
          oldReputation: npc.reputation,
          newReputation: updated.reputation,
          status: repStatus.status,
        });
        
        broadcastFn(roomCode, {
          type: 'system',
          content: `Your reputation with ${npc.name} has ${action.change > 0 ? 'improved' : 'worsened'}! They now view you as ${repStatus.status.toLowerCase()}.`,
        });
      }
    }
  } catch (err) {
    console.error('[Reputation Change] Error:', err);
  }
  break;
}
```

Tag format: `[REPUTATION: NPC Name | +/-Amount]`

Examples:
- `[REPUTATION: Gundren | +15]` - Increases reputation by 15
- `[REPUTATION: Nezznar | -30]` - Decreases reputation by 30

---

## 3. Example AI Behaviors

### Low Reputation (-50)
```
Player: "Can you help us?"
Gundren (Hostile): *eyes you coldly* "Help YOU? After what you did? Get out of my sight before I call the guards."
```

### Neutral Reputation (0)
```
Player: "Can you help us?"
Gundren (Neutral): *shrugs* "I might know something. What's it worth to you? I don't do favors for strangers."
```

### High Reputation (+75)
```
Player: "Can you help us?"
Gundren (Trusted Ally): *grins warmly* "Of course, friend! After all you've done for me? Here, take this map—it shows a secret passage. And take some potions, on the house."
[ITEM: jordan | Healing Potion | 3]
```

---

## 4. Implementation Checklist

### Backend
- [x] Add reputation columns to dynamicNpcs table
- [x] Create reputation management functions in storage.ts
- [x] Hook reputation into quest completion
- [ ] Add reputation context to AI prompts
- [ ] Add [REPUTATION:] tag parsing
- [ ] Add npc_reputation_changed broadcast event
- [ ] Update /api/rooms/:roomId/dynamic-npcs to include reputation data

### Frontend
- [ ] Create NpcReputationPanel component
- [ ] Add NPCs tab to room view
- [ ] Design reputation bar component
- [ ] Add color coding by reputation status
- [ ] Listen for npc_reputation_changed events
- [ ] Add reputation tooltips/explanations
- [ ] Mobile-responsive design

### Documentation
- [x] Document reputation system (npc-reputation-system.md)
- [ ] Update AI prompting guide
- [ ] Add player-facing guide explaining reputation

---

## 5. Future Enhancements

### Dynamic Quest Rewards Based on Reputation
```typescript
function calculateQuestReward(baseReward: number, npcReputation: number): number {
  const multiplier = 1 + (npcReputation / 100); // -100 = 0x, 0 = 1x, +100 = 2x
  return Math.floor(baseReward * multiplier);
}
```

### Shop Price Adjustments
```typescript
function getShopPrice(basePrice: number, merchantReputation: number): number {
  const discount = Math.max(-0.5, Math.min(0.5, merchantReputation / 200)); // ±50% max
  return Math.floor(basePrice * (1 - discount));
}
```

### Reputation-Locked Content
```typescript
if (quest.minimumReputation && npcReputation < quest.minimumReputation) {
  return "I don't trust you enough to share that information yet.";
}
```

### Faction Reputation
- Extend to faction-wide reputation
- Actions affecting one NPC can affect their entire faction
- Guild memberships, town standing, etc.

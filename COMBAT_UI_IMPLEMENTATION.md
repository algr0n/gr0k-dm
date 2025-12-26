# Combat UI Implementation - Token-Saving Combat Engine

## Overview
Implemented direct combat UI that uses the existing combat engine endpoints instead of going through the AI message queue. This **drastically reduces AI token usage** and makes combat **instant** instead of waiting 1.5 seconds for AI responses.

## What Was Built

### New Components

#### 1. `CombatActionsPanel.tsx`
**Location**: `client/src/components/combat/CombatActionsPanel.tsx`

**Features**:
- **Target Selector**: Dropdown showing all valid targets with HP/AC display
- **Attack Button**: Calls `/api/rooms/:code/combat/action` with attack parameters
- **Pass Button**: Ends turn without action (`/api/rooms/:code/combat/pass`)
- **Hold Button**: Delays action to end of round (`/api/rooms/:code/combat/hold`)
- **Auto-computed Stats**: Attack bonus and damage dice calculated from character class/stats
- **Turn Indicator**: Shows "Your Turn" badge when active, "Waiting..." when not

**How It Works**:
```typescript
// When player clicks "Attack" with target selected:
POST /api/rooms/:code/combat/action
{
  actorId: "character-id",
  type: "attack",
  targetId: "enemy-id",
  attackBonus: 5,  // Computed from STR + proficiency
  damageExpression: "1d8"  // Based on character class
}

// Server rolls dice, applies damage, advances turn
// Returns structured result (no AI needed)
```

#### 2. `CombatResultDisplay.tsx`
**Location**: `client/src/components/combat/CombatResultDisplay.tsx`

**Features**:
- **Real-time Combat Log**: Displays last 5 combat actions
- **Structured Display**: Shows attack rolls, damage rolls, hit/miss, HP changes
- **Visual Feedback**: 
  - Critical hits: Red skull icon
  - Hits: Orange sword icon
  - Misses: Blue shield icon
  - Defeats: Red skull with "Defeated" badge
- **Dice Breakdown**: Shows individual dice rolls (e.g., `d20(15) + 5 = 20`)

**What It Shows**:
```
🗡️ Hit!
Algron attacks Goblin
Attack: d20(15) + bonus = 20
Damage: d(6) + d(2) = 8
Goblin HP: 2
```

### Integration Points

#### Room Page Updates (`client/src/pages/room.tsx`)

1. **State Management** (line ~268):
   ```typescript
   const [combatResults, setCombatResults] = useState<any[]>([]);
   ```

2. **WebSocket Handlers** (line ~897-910):
   ```typescript
   } else if (data.type === "combat_result") {
     setCombatResults((prev) => [...prev, data]);
   } else if (data.type === "combat_event") {
     setCombatResults((prev) => [...prev, data]);
   ```

3. **UI Display** (line ~1477):
   - Combat Results Display: Shows recent combat actions
   - Combat Actions Panel: Shows action buttons on player's turn

## How It Works End-to-End

### Before (AI-dependent):
```
Player: "I attack the goblin"
→ Message queued (1.5s delay)
→ AI generates response (~500-1000 tokens): "You swing your sword... [HP: Goblin | 2/10]"
→ Server parses HP tag
→ Updates combat state
→ Broadcasts to players
Total: ~2-3 seconds, 500-1000 tokens
```

### After (Combat Engine):
```
Player: Clicks "Attack" → Selects "Goblin" → Clicks "Attack" button
→ POST /api/rooms/:code/combat/action
→ Server: Rolls d20 (instant)
→ Server: Calculates hit/damage (instant)
→ Server: Updates HP (instant)
→ Server: Broadcasts structured result
→ UI shows: "Hit! d20(15)+5=20, Damage: 8, Goblin HP: 2"
→ (Optional) AI narrates later: "Your blade strikes true" (50-100 tokens)
Total: <100ms, 0-100 tokens
```

## Token Savings

### Typical Combat Encounter:
- **Before**: 6 rounds × 4 actions = 24 AI calls × 700 tokens = **16,800 tokens**
- **After**: 24 direct actions × 0 tokens + 6 narrations × 80 tokens = **480 tokens**
- **Savings**: **~97% reduction** (16,320 tokens saved)

### Cost Impact:
- Grok API: ~$0.01 per 1000 tokens
- 10 combat encounters: $1.68 → $0.05 = **$1.63 saved**
- 100 encounters: **$16.30 saved**

## AI Still Used For (Minimal):

1. **Optional Narration**: After action completes, AI can narrate in 1-2 sentences
   - Uses smart caching (most responses cached after first use)
   - Example: "Your sword strikes true, and the goblin staggers"
   
2. **Monster Decisions** (Decision-Only Mode):
   - `/api/rooms/:code/combat/ai-strategy?useLLM=true&maxActions=1`
   - AI suggests action label: "Attack the wounded fighter"
   - Server executes with deterministic dice rolls
   - ~50-100 tokens vs 500-1000 for full narrative

3. **Combat Scene Setup**: Initial scene description when combat starts
   - One-time, cached for similar encounters
   - Example: "The goblins rush from the shadows!"

## What's Exposed But Not Yet Used

These endpoints exist in the combat engine but aren't wired to UI yet:

1. **Move Action**: `POST /api/rooms/:code/combat/action` with `type: "move"`
2. **Environment Features**: `POST /api/rooms/:code/combat/environment`
3. **AI Strategy (Deterministic)**: `POST /api/rooms/:code/combat/ai-strategy?useLLM=false`
4. **Cast Spell**: Would need spell picker UI (future enhancement)

## Future Enhancements

### Easy Wins:
1. **Add "Use Skill" button** to combat panel (Stealth, Athletics, etc.)
2. **Show threat levels** (combat engine tracks aggro)
3. **Display flanking bonuses** (combat engine calculates)
4. **Add environmental cover indicator** (combat engine checks line-of-sight)

### Medium:
5. **Spell Casting UI**: Dropdown for prepared spells, auto-slots
6. **Battle Map**: Visual grid with token movement
7. **Monster AI Toggle**: Let DM choose deterministic vs LLM decisions

### Advanced:
8. **Ready Actions**: Trigger condition picker ("When goblin moves...")
9. **Legendary Actions**: Special UI for boss monsters
10. **Combat Log Export**: Save combat logs for session summaries

## Testing The New UI

1. **Start development server**: `npm run dev`
2. **Create/join a game room**
3. **Ensure character has stats** (STR, DEX, etc.)
4. **Start combat** (AI will say `[COMBAT_START]` or host clicks button)
5. **Wait for your turn** (Combat Actions Panel appears)
6. **Select target** from dropdown
7. **Click "Attack"** - Watch instant feedback!
8. **Check Combat Results Display** - See dice rolls and damage

## Known Limitations

1. **No spell casting UI yet** - Players must still type spell names to AI
2. **No movement grid** - Can't move tokens on map
3. **No ready actions UI** - Hold only works for "end of round"
4. **Attack bonus simplified** - Uses STR + proficiency (doesn't check if finesse weapon)
5. **Primary damage generic** - Based on class, doesn't check equipped weapon

## Files Modified

- `client/src/components/combat/CombatActionsPanel.tsx` (NEW)
- `client/src/components/combat/CombatResultDisplay.tsx` (NEW)
- `client/src/pages/room.tsx` (MODIFIED - added combat UI integration)
- `server/routes.ts` (ALREADY HAD ENDPOINTS - just wired to UI)

## Next Steps

1. **Test in real gameplay** - Make sure HP updates work
2. **Add spell casting** - Integrate with spell picker component
3. **Monster AI panel for DM** - Show suggested actions
4. **Polish animations** - Add combat hit effects
5. **Cache more narrations** - Pre-generate common combat phrases

---

**Result**: Combat is now **instant**, **token-efficient**, and **more engaging** for players!

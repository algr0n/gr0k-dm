# AI Dungeon Master Guide

> Comprehensive guide to understanding and extending the Grok AI DM system

## Overview

Grok DM uses xAI's Grok API to provide intelligent, context-aware Dungeon Master responses. The AI system is modular, extensible, and optimized for cost-efficiency and performance.

## Architecture

```
server/grok.ts (Main Entry Point)
├── server/prompts/          # Game system prompts
│   ├── dnd.ts              # D&D 5e system prompt
│   ├── cyberpunk.ts        # Cyberpunk RED system prompt
│   └── index.ts            # Prompt registry
├── server/generators/       # Response generators
│   ├── dm-response.ts      # Single player responses
│   ├── batched-response.ts # Multi-player batch responses
│   ├── combat.ts           # Combat turn generation
│   └── scene.ts            # Scene descriptions
├── server/context/          # Context building
│   └── context-builder.ts  # Fluent API for AI context
├── server/cache/            # Response caching
│   └── response-cache.ts   # LRU cache implementation
└── server/utils/            # Utilities
    ├── token-tracker.ts    # Token usage tracking
    └── conversation-summary.ts # Conversation summarization
```

## Game Systems

### Currently Supported

#### 1. D&D 5th Edition (`dnd`)
**Status**: ✅ Comprehensive Implementation

**Features**:
- Full SRD content (classes, races, spells, items)
- Combat management with initiative tracking
- HP tracking and death saving throws
- Spell slot management
- Inventory and currency management
- Status effects (16 standard conditions)
- Adventure module support (Lost Mine of Phandelver, Dragon of Icespire Peak)

**AI Capabilities**:
- Interprets d20 dice results (20=critical success, 1=critical failure)
- Narrates combat encounters
- Manages NPC dialogue and interactions
- Tracks character HP and applies damage
- Handles item drops and treasure
- Applies status effects contextually
- Generates scene descriptions

**System Prompt Location**: `server/prompts/dnd.ts`

#### 2. Cyberpunk RED (`cyberpunk`)
**Status**: ⚠️ Basic Implementation

**Features**:
- d10 dice system
- Basic character stats
- HP tracking
- Combat basics
- Night City atmosphere

**AI Capabilities**:
- Interprets d10 dice results
- Uses cyberpunk slang (choom, preem, nova, eddies)
- Gritty, punchy narration style
- Corporate and street-level NPCs

**System Prompt Location**: `server/prompts/cyberpunk.ts`

### Adding a New Game System

1. **Create a system prompt file** in `server/prompts/`:
   ```typescript
   // server/prompts/pathfinder.ts
   import type { SystemPrompt } from './base';
   
   export const pathfinderPrompt: SystemPrompt = {
     systemId: 'pathfinder',
     prompt: `You are an expert Pathfinder 2e Dungeon Master...
     
     DICE INTERPRETATION:
     - Critical Success (nat 20 or 10+ over DC)
     - Success (meets DC)
     - Failure (below DC)
     - Critical Failure (nat 1 or 10+ under DC)
     
     USE THESE TAGS:
     [HP: PlayerName | Current/Max]
     [STATUS: PlayerName | Condition]
     [ITEM: PlayerName | ItemName | Quantity]
     ...
     `
   };
   ```

2. **Register the prompt** in `server/prompts/index.ts`:
   ```typescript
   import { pathfinderPrompt } from './pathfinder';
   
   const systemPrompts: Record<string, SystemPrompt> = {
     dnd: dndPrompt,
     cyberpunk: cyberpunkPrompt,
     pathfinder: pathfinderPrompt, // Add here
   };
   ```

3. **Add schema support** in `shared/schema.ts`:
   - Add game system value to gameSystemEnum
   - Define system-specific classes/races
   - Add system-specific spell slots if needed

4. **Test the system**:
   ```bash
   npm run dev
   # Create a room with the new game system
   # Test AI responses and game mechanics
   ```

## AI Tags System

The AI DM communicates game state changes through special tags in its responses. These tags are parsed by the server and trigger database updates.

### Available Tags

#### Combat Tags

```
[COMBAT_START]
```
- Triggers: Combat mode for the room
- Effect: Initiative list appears, combat UI enabled

```
[COMBAT_END]
```
- Triggers: End of combat
- Effect: Combat mode disabled, initiative cleared

#### HP Management

```
[HP: PlayerName | Current/Max]
```
- Example: `[HP: Gandalf | 25/50]`
- Effect: Updates character's HP in database
- Validates: Character exists, values are numbers

```
[DEATH_SAVES: PlayerName | Successes/Failures]
```
- Example: `[DEATH_SAVES: Frodo | 2/1]`
- Effect: Updates death save counters
- Triggers at: HP = 0

```
[STABLE: PlayerName]
```
- Effect: Character stabilized at 0 HP
- Clears: Death save counters

```
[DEAD: PlayerName]
```
- Effect: Character marked as dead
- Triggers: 3 failed death saves

#### Inventory Management

```
[ITEM: PlayerName | ItemName | Quantity]
```
- Example: `[ITEM: Aragorn | Longsword | 1]`
- Effect: Adds item to character inventory
- Smart Stacking: If item exists, increments quantity

```
[REMOVE_ITEM: PlayerName | ItemName | Quantity]
```
- Example: `[REMOVE_ITEM: Legolas | Arrow | 5]`
- Effect: Removes quantity from inventory
- Auto-Delete: Removes item if quantity reaches 0

#### Currency Management

```
[GOLD: PlayerName | Amount]
```
- Example: `[GOLD: Gimli | 100]`
- Effect: Adds gold to character
- Note: Legacy tag, use CURRENCY for multi-currency

```
[CURRENCY: PlayerName | Copper/Silver/Gold/Platinum]
```
- Example: `[CURRENCY: Samwise | 50/10/5/0]`
- Effect: Adds currency to character
- Auto-Conversion: Handles mixed denominations

#### Status Effects

```
[STATUS: PlayerName | EffectName]
```
- Example: `[STATUS: Boromir | Poisoned]`
- Effect: Applies status effect to character
- Duration: Tracked by DM or time

```
[REMOVE_STATUS: PlayerName | EffectName]
```
- Example: `[REMOVE_STATUS: Merry | Frightened]`
- Effect: Removes status effect

**D&D 5e Standard Conditions**:
Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious, Exhaustion, Concentration

**Cyberpunk RED Status Effects**:
Stun, Wounded, Seriously Wounded, Critical, EMP'd, Netrunner Fried, Damaged Cyberware, On Fire, Bleeding, Pinned, Grabbed, Blind, Prone, Panic

## Context Building

The `ContextBuilder` class provides a fluent API for building AI context:

```typescript
import { ContextBuilder } from './context/context-builder';

const context = new ContextBuilder(gameSystem)
  .withSystemPrompt()
  .withCurrentScene(currentScene)
  .withAdventureContext(adventureData)
  .withPartyInfo(characters)
  .withInventory(items)
  .withConversationHistory(messages)
  .build();

const response = await openai.chat.completions.create({
  model: "grok-beta",
  messages: context,
});
```

### Context Layers (in order)

1. **System Prompt** - Game rules and AI instructions
2. **Current Scene** - Where the party is and what's happening
3. **Adventure Context** - Chapter, quests, NPCs, encounters
4. **Party Info** - Character names, HP, classes, levels
5. **Inventory** - Party items and gold
6. **Conversation History** - Recent messages (last 10-20)
7. **User Message** - Current player action

### Context Optimization

The system automatically:
- Summarizes long conversation histories (>30 messages)
- Caches deterministic queries (rules, status checks)
- Batches multiple player actions into single API calls
- Tracks token usage per room

## Response Caching

### Cache Strategy

**LRU Cache** with configurable TTL:
- **Max Size**: 100 entries
- **Default TTL**: 5 minutes
- **Rules TTL**: 1 hour (for deterministic queries)

**Cacheable Patterns**:
- "What are the rules for...?"
- "How does X work in D&D?"
- "What is the status of...?"
- Item/spell lookups

**Non-Cacheable**:
- Player actions
- Dice rolls
- Dynamic narrative
- Combat actions

### Cache Usage

```typescript
import { responseCache } from './cache/response-cache';

// Check cache before API call
const cacheKey = responseCache.getCacheKey(messages);
const cached = responseCache.get(cacheKey);

if (cached) {
  return cached; // Skip API call
}

// Make API call
const response = await generateResponse(messages);

// Store in cache if cacheable
if (responseCache.isCacheable(messages)) {
  responseCache.set(cacheKey, response);
}
```

## Token Usage Tracking

### Per-Room Tracking

The system tracks API usage per room:

```typescript
import { tokenTracker } from './utils/token-tracker';

// Record usage after API call
tokenTracker.record(roomId, {
  prompt_tokens: completion.usage.prompt_tokens,
  completion_tokens: completion.usage.completion_tokens,
  total_tokens: completion.usage.total_tokens,
});

// Get usage stats
const usage = tokenTracker.get(roomId);
console.log(`Room ${roomId}: ${usage.totalTokens} tokens, ${usage.callCount} calls`);
```

### Token Optimization Tips

1. **Use message batching** - Combine multiple player actions
2. **Cache rules queries** - Rules don't change
3. **Summarize long conversations** - Keep context window manageable
4. **Use shorter model responses** - Request concise narration
5. **Prune old messages** - Only keep relevant history

## Message Batching

### How It Works

Multiple player messages within 1.5 seconds are batched into a single API call:

```typescript
// Player 1 sends: "I attack the goblin"
// Player 2 sends: "I cast healing word on Player 1"
// Player 3 sends: "I ready my bow"

// Instead of 3 API calls, batched into 1:
const batch = [
  { playerName: "Aragorn", message: "I attack the goblin" },
  { playerName: "Gandalf", message: "I cast healing word on Aragorn" },
  { playerName: "Legolas", message: "I ready my bow" },
];

// AI responds to all actions in one narrative
const response = await generateBatchedDMResponse(batch, context);
```

### Configuration

```typescript
// server/routes.ts
const BATCH_WINDOW_MS = 1500; // 1.5 seconds
const MAX_BATCH_SIZE = 5;     // Maximum messages per batch
```

## Conversation Summarization

For long-running adventures, the system automatically summarizes old conversation history:

```typescript
import { getOrCreateConversationSummary } from './utils/conversation-summary';

// Summarize when history exceeds threshold
if (messageHistory.length > 30) {
  const summary = await getOrCreateConversationSummary(roomId, messageHistory);
  
  // Use summary + recent messages for context
  const context = new ContextBuilder(gameSystem)
    .withSystemPrompt()
    .withConversationSummary(summary)
    .withRecentMessages(messageHistory.slice(-10))
    .build();
}
```

## API Configuration

### Model Settings

```typescript
// server/grok.ts
export const openai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// In generators
const completion = await openai.chat.completions.create({
  model: "grok-beta",  // Fast, cost-effective
  messages: context,
  temperature: 0.8,     // Creative but coherent
  max_tokens: 500,      // Keep responses concise
});
```

### Rate Limiting (TODO)

Currently no rate limiting. Recommended for production:

```typescript
import rateLimit from 'express-rate-limit';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests per minute per user
  message: 'Too many AI requests, please slow down',
});

app.post('/api/rooms/:code/messages', aiLimiter, handleMessage);
```

## Testing AI Responses

### Manual Testing

```bash
# Start dev server
npm run dev

# Create a room
# Send test messages
# Check server logs for tag parsing
```

### Test Cases

1. **HP Management**: "The goblin hits you for 10 damage"
   - Expected: `[HP: PlayerName | NewHP/MaxHP]`

2. **Item Drops**: "You find a longsword and 50 gold pieces"
   - Expected: `[ITEM: PlayerName | Longsword | 1]`, `[GOLD: PlayerName | 50]`

3. **Status Effects**: "You are poisoned by the trap"
   - Expected: `[STATUS: PlayerName | Poisoned]`

4. **Combat Flow**: "Roll initiative!"
   - Expected: `[COMBAT_START]`

### Debugging

Enable detailed logging in server console:

```typescript
// server/routes.ts
console.log('[DM Response] AI response:', dmResponse);
console.log('[DM Response] Parsed actions:', gameActions);
console.log('[DM Response] Tags found:', tags);
```

## Best Practices

### For System Prompts

1. **Be specific about dice interpretation** - Explain what each result means
2. **Use clear tag examples** - Show exactly how to format tags
3. **Define the narrative style** - Concise, atmospheric, etc.
4. **Explain game mechanics** - So AI understands rules
5. **Include edge cases** - Death, unconsciousness, critical hits

### For Context Building

1. **Keep context focused** - Only include relevant information
2. **Order matters** - Most important info first
3. **Summarize old conversations** - Don't overload context
4. **Include character state** - HP, conditions, inventory
5. **Mention active quests** - So AI tracks objectives

### For Tag Parsing

1. **Validate tag format** - Use regex to ensure correctness
2. **Handle missing characters** - Gracefully fail if name not found
3. **Log all parsed tags** - For debugging
4. **Broadcast updates** - So all players see changes
5. **Update database** - Persist all game state

## Future Enhancements

### Planned Features

1. **Multi-Model Support** - GPT-4, Claude, local LLMs
2. **Voice Integration** - Text-to-speech for DM narration
3. **Image Generation** - Scene and character portraits
4. **Advanced Context** - DMG tables, monster stats, spell references
5. **Custom DM Personalities** - Adjustable tone and style

### Performance Improvements

1. **Streaming Responses** - Real-time text generation
2. **Semantic Caching** - Cache similar queries
3. **Context Compression** - More efficient context encoding
4. **Parallel Processing** - Process multiple rooms simultaneously

## Story Tracking & Multi-Session Continuity

The AI DM now includes a comprehensive story tracking system that maintains continuity across multiple play sessions, reducing token usage while improving narrative consistency.

### Architecture

```
server/cache/story-cache.ts        # In-memory story context cache
server/utils/story-detection.ts    # Auto-detect story events
server/context/context-builder.ts  # Story context methods
server/storage.ts                  # Database CRUD for story data
```

### Story Context Components

#### 1. Quest Objective Progress
Tracks individual quest objectives with completion status:
- **Granular tracking**: Each objective tracked separately
- **Completion metadata**: Who completed it, when, and notes
- **Percentage calculation**: X/Y objectives complete
- **AI guidance**: Helps AI track and guide players toward objectives

#### 2. Story Events
Automatically logged key moments for AI memory:
- **Event types**: quest_complete, npc_met, combat_victory, boss_defeated, player_death, location_discovered
- **Importance scale**: 1-5 (higher = more important for AI context)
- **Auto-detection**: Pattern matching extracts events from DM responses
- **Manual creation**: DMs can manually log important events

#### 3. Session Summaries
AI-generated summaries for long-term continuity:
- **Automatic generation**: Every 50+ messages
- **Key events**: Top 5-10 important moments
- **Metadata**: Quests progressed, NPCs encountered, locations visited
- **Resume capability**: Games can resume after weeks/months

### Context Builder Methods

```typescript
// Add quest progress to AI context
builder.addQuestProgress(questsWithProgress: QuestWithProgress[])

// Add recent story events
builder.addStoryHistory(events: StoryEvent[], limit: number = 10)

// Add previous session summary
builder.addSessionSummary(summary: SessionSummary)
```

### Auto-Detection Patterns

Story events are automatically detected from DM responses:

```typescript
// Quest completions
/quest.*(complete|finished|accomplished)/i

// Combat victories
/(defeated|killed|slain).*(enemy|monster)/i

// Boss defeats
/boss.*(defeated|killed)/i

// Player deaths
/\[DEAD:/i

// NPC encounters (checks adventure context)
Cross-reference availableNpcs with response text

// Location discoveries (checks adventure context)
Compare currentLocation with discoveredLocationIds
```

### Story Cache System

In-memory caching reduces database queries and token usage:

```typescript
interface StoryCacheEntry {
  questProgress: QuestWithProgress[];
  storyEvents: StoryEvent[];
  sessionSummary?: SessionSummary;
  lastUpdated: number;
}
```

**Cache behavior**:
- **TTL**: 5 minutes default
- **Invalidation**: On story event creation, quest updates, room close
- **Performance**: ~30% token usage reduction

### Integration with Batch Processing

Story tracking integrates seamlessly with the batch message processor:

```typescript
async function processBatch(roomCode: string) {
  // ... generate DM response
  
  // Detect and log story events
  const eventIds = await detectAndLogStoryEvents(
    dmResponse,
    room.id,
    adventureContext
  );
  
  // Invalidate cache if events created
  if (eventIds.length > 0) {
    storyCache.invalidate(room.id);
  }
}
```

### API Endpoints

REST endpoints for story tracking:

```http
GET    /api/rooms/:roomId/story-events
       Query params: limit, eventType, minImportance
       
POST   /api/rooms/:roomId/story-events
       Body: { eventType, title, summary, importance, ... }
       
GET    /api/rooms/:roomId/session-summaries
       
POST   /api/rooms/:roomId/session-summaries/generate
       Requires: 50+ messages since last summary
       
GET    /api/rooms/:roomId/quest-progress
       Returns: Quest objectives grouped by quest with completion %
       
PATCH  /api/rooms/:roomId/quest-progress/:objectiveId
       Body: { isCompleted, completedBy, notes }
```

### Performance Optimization

Story tracking reduces token usage through:

1. **Efficient context**: Only most important events included
2. **Smart caching**: 5-minute TTL prevents redundant DB queries
3. **Summarization**: Long sessions condensed to key points
4. **Selective history**: Recent messages + story context vs. full history

**Typical savings**:
- **Without story tracking**: 1000+ tokens per request (full history)
- **With story tracking**: 600-700 tokens per request (summary + events)
- **Savings**: 30-40% token reduction

### Best Practices

1. **Let auto-detection work**: Most events logged automatically
2. **Manual events for clarity**: Add important plot points manually
3. **Generate summaries regularly**: Every 50-100 messages
4. **Review quest progress**: Ensure objectives reflect actual progress
5. **Trust the cache**: Cache invalidation is automatic
6. **Monitor importance**: High-importance events prioritized in context

## Troubleshooting

### "AI not responding"

**Causes**:
- Missing XAI_API_KEY
- API rate limit exceeded
- Network connectivity issues

**Solutions**:
1. Check environment variables
2. Verify API key in xAI dashboard
3. Check server logs for error details

### "Tags not being parsed"

**Causes**:
- Incorrect tag format
- AI not following instructions
- Parser regex not matching

**Solutions**:
1. Review tag examples in system prompt
2. Check server logs for raw AI response
3. Update parser regex if needed

### "High token usage"

**Causes**:
- Long conversation histories
- Not using message batching
- Cache misses

**Solutions**:
1. Enable conversation summarization
2. Increase batch window (1.5s → 3s)
3. Review cache hit rate
4. Prune irrelevant messages

## Additional Resources

- [xAI Grok API Documentation](https://docs.x.ai/)
- [OpenAI SDK Documentation](https://github.com/openai/openai-node)
- [Project Context Builder](server/context/context-builder.ts)
- [System Prompts](server/prompts/)
- [Response Generators](server/generators/)

---

**Last Updated**: December 24, 2024  
**For questions**: See [GitHub Issues](https://github.com/algr0n/gr0k-dm/issues)

# Grok.ts Modular Architecture (updated: Dec 26, 2025)

```
┌────────────────────────────────────────────────────────────────────────┐
│                            server/grok.ts                              │
│                     Main entry & public Grok API surface               │
│  - Lazy-initializes xAI client (openai)                                │
│  - Re-exports generators, cache and utility helpers                     │
│  - NPC stat generation helpers (generateNpcWithGrok)                   │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                  ┌────────────────┬────────────────┬────────────────┐
                  │                │                │                │
                  ▼                ▼                ▼                ▼
┌───────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐
│  server/prompts/      │ │   server/cache/      │ │  server/utils/      │ │ server/context/   │
│  (base.ts, dnd.ts,    │ │  (response-cache.ts, │ │  (token-tracker.ts, │ │  (context-builder)│
│   cyberpunk.ts, index) │ │   monster-cache.ts,  │ │   conversation-     │ │  • Fluent API for │
│  • getSystemPrompt()   │ │   smart-cache.ts)    │ │   summary.ts, nl-   │ │    building OpenAI │
│                       │ │  • response caching   │ │   parser.ts, utils  │ │   message arrays   │
│                       │ │  • monster cache +   │ │  • token tracking,  │ │  • addMonsterContext│
│                       │ │    eviction policies │ │    summaries, quest │ │  • addAdventureContext│
└───────────────────────┘ └──────────────────────┘ └─────────────────────┘ └──────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────────────────┐
                   │           server/generators/              │
                   │   (dm-response.ts, batched-response.ts,  │
                   │    combat.ts, scene.ts, stage.ts, index) │
                   │  • All generators build messages via     │
                   │    ContextBuilder                        │
                   │  • New: `stage.ts` generates structured   │
                   │    combat stages (JSON)                   │
                   │  • Combat generator consults bestiary via │
                   │    db/bestiary + monster-cache            │
                   └───────────────────────────────────────────┘
                                   │
                                   ▼
                          ┌────────────────────┐
                          │   server/db/       │
                          │(bestiary.ts,       │
                          │ characters.ts, ...) │
                          │• Bestiary queries   │
                          │  & monster formatting│
                          └────────────────────┘
                                   │
                                   ▼
                          ┌────────────────────┐
                          │   OpenAI Grok API   │
                          │   (grok-4-1-fast-   │
                          │    reasoning, grok- │
                          │    beta)            │
                          └────────────────────┘
```

## Data Flow (updated)

### Single Player Request
```
routes.ts → generateDMResponse(openai, userMessage, room, ...) 
          → ContextBuilder (system prompt, party, history)
          → responseCache check (rules/deterministic queries)
          → OpenAI API (grok)
          → tokenTracker / responseCache store
          → Response returned
```

### Multi-Player Batched Request
```
routes.ts → generateBatchedDMResponse(openai, batchedMessages, room, ...)
          → ContextBuilder (adventure context, session summary when long)
          → Optional bestiary lookups (db/bestiary + monster-cache)
          → OpenAI API (grok)
          → tokenTracker
          → Response
```

### Combat & Stage Generation
```
routes.ts → generateCombatDMTurn(...) → ContextBuilder → addMonsterContext() (cached)
          → OpenAI (combat narrative or decision-only)

routes.ts → generateCombatStage(...) → stage.ts → OpenAI (returns JSON stage)
```

## Notable Changes since original doc

- Added `server/generators/stage.ts` to produce structured combat stages (JSON) for encounter maps
- Added `generateNpcWithGrok` in `server/grok.ts` for AI NPC stat block generation
- Monster lookup now uses `server/db/bestiary.ts` + `server/cache/monster-cache.ts` with smart caching
- Utilities expanded (`nl-parser`, `quest-detection`, `story-detection`) to improve prompt quality and story tracking

## Module Dependencies (summary)
```
grok.ts
├── generators/* → context-builder
├── prompts/*
├── cache/* → response-cache, monster-cache, smart-cache
├── context/* → context-builder
├── utils/* → token-tracker, conversation-summary, parsers
└── db/* → bestiary, characters
```

## Token-saving measures (cost & token optimizations)
- **Response caching** (`server/cache/response-cache.ts`) — deterministic/rules queries are detected with `isCacheable()` and served from cache (short/long TTLs), avoiding unnecessary Grok calls for repeated questions.
- **Deterministic combat engine** (`server/combat.ts`) — initiative, attack resolution (`resolveAttack`), action decision heuristics (`decideMonsterActions`) and stage/environment logic are computed server-side so most mechanical work doesn't consume tokens.
- **Combat generator controls** (`server/generators/combat.ts`) — supports **decision-only** mode (no dice or damage resolution) for compact, machine-parseable decisions and limits monster contexts to 3 to reduce token usage.
- **Monster cache** (`server/cache/monster-cache.ts`) + `server/db/bestiary.ts` — reduces DB/API lookups by caching fetched stat blocks per room.
- **Structured generation for deterministic outputs** (`server/generators/stage.ts`) — uses low temperature (0.0) and strict JSON output to keep responses compact and predictable.
- **Token tracking & monitoring** (`server/utils/token-tracker.ts`) — all generators call `tokenTracker.track(...)` so we can monitor usage and tune prompts/limits.

> The practical result: Grok is used primarily for narration, edge cases (critical hits, special abilities, complex tactics), and high-level structured outputs while deterministic systems and caches handle the bulk of combat logic to save tokens and ensure consistent outcomes.

## Adding New Features (reminder)
- New game system: add prompt file + export in prompts/index
- New generator: add file to `server/generators/` and export from `index.ts`
- New context: extend `ContextBuilder` and call from generators
- Extend caching: modify `server/cache/response-cache.ts` or `monster-cache.ts`

---

If you want, I can also add a small diagram image (SVG) and reference it here for easier reading in PRs—should I do that next?### Add New Generator
1. Create file in `server/generators/`
2. Import ContextBuilder, responseCache, tokenTracker
3. Export function
4. Add export to `server/generators/index.ts`

### Add New Context Source
1. Add method to ContextBuilder class
2. Call method in relevant generator
3. No changes needed to grok.ts

### Extend Caching
1. Modify ResponseCache class
2. Add new patterns or methods
3. No changes needed to generators

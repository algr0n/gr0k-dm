# Grok.ts Modular Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       server/grok.ts (51 lines)                 │
│                    Main Entry Point & Exports                   │
│  - OpenAI client initialization                                 │
│  - Re-exports all public APIs                                   │
│  - Backward compatible interface                                │
└─────────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
┌───────────────────────┐ ┌──────────────┐ ┌──────────────┐
│   server/prompts/     │ │server/cache/ │ │server/utils/ │
│   (186 lines)         │ │(116 lines)   │ │(134 lines)   │
├───────────────────────┤ ├──────────────┤ ├──────────────┤
│ • base.ts             │ │ • response-  │ │ • token-     │
│ • dnd.ts              │ │   cache.ts   │ │   tracker.ts │
│ • cyberpunk.ts        │ │              │ │ • conv-      │
│ • index.ts            │ │ LRU Cache    │ │   summary.ts │
│                       │ │ ResponseCache│ │              │
│ getSystemPrompt()     │ │ class        │ │ TokenTracker │
│                       │ │              │ │ class        │
└───────────────────────┘ └──────────────┘ └──────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    server/context/ (229 lines)                  │
│                      context-builder.ts                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            ContextBuilder (Fluent API)                   │  │
│  │  • addSystemPrompt()     • addPartyCharacters()          │  │
│  │  • addScene()            • addInventory()                │  │
│  │  • addAdventureContext() • addDroppedItems()             │  │
│  │  • addConversationSummary() • addMessageHistory()        │  │
│  │  • addCurrentMessage()   • build()                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  server/generators/ (285 lines)                 │
│                All generators use ContextBuilder                │
├─────────────────────────────────────────────────────────────────┤
│  • dm-response.ts (79 lines)                                    │
│    → generateDMResponse()                                       │
│                                                                 │
│  • batched-response.ts (87 lines)                               │
│    → generateBatchedDMResponse()                                │
│                                                                 │
│  • combat.ts (59 lines)                                         │
│    → generateCombatDMTurn()                                     │
│                                                                 │
│  • scene.ts (54 lines)                                          │
│    → generateSceneDescription()                                 │
│    → generateStartingScene()                                    │
│                                                                 │
│  • index.ts (6 lines) - Re-exports                              │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │  OpenAI Grok   │
                        │  API (xAI)     │
                        └────────────────┘
```

## Data Flow

### Single Player Request
```
routes.ts → generateDMResponse(openai, ...)
          → ContextBuilder
          → System Prompt (from prompts/)
          → Cache Check (response-cache)
          → OpenAI API
          → Token Tracking (token-tracker)
          → Response
```

### Multi-Player Batched Request
```
routes.ts → generateBatchedDMResponse(openai, ...)
          → ContextBuilder
          → Adventure Context (if available)
          → Conversation Summary (if >30 msgs)
          → System Prompt + Party Info
          → OpenAI API
          → Token Tracking
          → Response
```

## Module Dependencies

```
grok.ts
├── generators/*
│   ├── → context-builder
│   ├── → response-cache
│   ├── → token-tracker
│   └── → conversation-summary
├── prompts/*
├── cache/*
├── context/*
│   └── → prompts (for getSystemPrompt)
└── utils/*
```

## Adding New Features

### Add New Game System
1. Create `server/prompts/pathfinder.ts`
2. Export prompt constant
3. Import in `server/prompts/index.ts`
4. Update SYSTEM_PROMPTS record

### Add New Generator
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

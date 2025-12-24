# Grok DM - Quick Reference Guide

> **New to Grok DM?** Start here for a quick overview, then dive into [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) for comprehensive details.

---

## What is Grok DM?

**Grok DM** is a browser-based AI-powered Dungeon Master for tabletop RPGs. Think "virtual tabletop meets ChatGPT" — players create game rooms where xAI's Grok AI acts as your DM, narrating stories, managing combat, and responding to player actions in real-time.

### 🎮 Key Features at a Glance

- ✅ **AI Dungeon Master** - Grok AI narrates, controls NPCs, interprets dice
- ✅ **Multiplayer** - Real-time WebSocket chat with up to 6+ players
- ✅ **D&D 5e Complete** - All classes, races, spells, items from SRD
- ✅ **Character Management** - Full character sheets with stats, inventory, spells
- ✅ **Combat System** - Initiative tracking, HP management, death saves
- ✅ **Dice Rolling** - Built-in dice with automatic result interpretation
- ✅ **User Accounts** - Save characters, join multiple campaigns
- ✅ **Game Systems** - D&D 5e (full), Cyberpunk RED (basic)

---

## Technology at a Glance

```
Frontend:  React 18 + TypeScript + Vite + Tailwind + shadcn/ui
Backend:   Express.js + WebSocket (ws) + Drizzle ORM
Database:  Turso (libSQL/SQLite) - serverless
AI:        xAI Grok API (grok-4-1-fast-reasoning)
Storage:   Google Cloud Storage (profile images)
Auth:      Passport.js (local strategy)
```

---

## Project Structure (Simplified)

```
gr0k-dm/
├── client/src/
│   ├── pages/          # Landing, Dashboard, Room, Characters
│   ├── components/     # UI components (shadcn/ui based)
│   └── hooks/          # Custom React hooks
├── server/
│   ├── index.ts        # Express server entry
│   ├── routes.ts       # API + WebSocket handlers
│   ├── grok.ts         # AI integration (with caching)
│   ├── dice.ts         # Dice rolling engine
│   └── auth.ts         # Authentication (Passport)
├── shared/
│   └── schema.ts       # Database schema (Drizzle + Zod)
└── migrations/         # Database migrations
```

---

## Core Workflows

### 1️⃣ Host a Game
```
Dashboard → "Host a Game" → Enter details → Choose/Create Character → Get 8-char code → Share with players
```

### 2️⃣ Join a Game
```
Dashboard → "Join a Game" → Enter room code → Choose/Create Character → Enter room → Play!
```

### 3️⃣ Create a Character
```
Dashboard → "Characters" → "Create" → Wizard (Name, Race, Class, Stats, Skills, Spells) → Save
```

### 4️⃣ Gameplay
```
Room → Type message/action → AI responds → Roll dice (/roll 2d6+3) → AI interprets → Manage character sheet
```

---

## Key Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `rooms` | Game sessions | code, gameSystem, messageHistory, currentScene |
| `unifiedCharacters` | Player characters | userId, class, race, stats, inventory, spells, currentRoomCode |
| `items` | D&D 5e item compendium | name, category, rarity, description |
| `spells` | D&D 5e spell compendium | name, level, school, description |
| `characterInventoryItems` | Character item ownership | characterId, itemId, quantity, equipped |
| `characterStatusEffects` | Active conditions | characterId, name, duration |
| `users` | User accounts | username, password, profileImageUrl |

---

## AI Integration

### How It Works
1. Player sends message → Queued for batching (1.5s window)
2. Batched messages → Sent to Grok API with context
3. AI response → Parsed for game tags (`[HP: ...]`, `[ITEM: ...]`)
4. Game state updated → Broadcast to all players

### AI Tags (Parsed from Responses)
```
[COMBAT_START] / [COMBAT_END]           - Combat state
[HP: PlayerName | Current/Max]          - HP updates
[ITEM: Name | ItemName | Qty]           - Add item
[REMOVE_ITEM: Name | ItemName | Qty]    - Remove item
[STATUS: Name | Effect]                 - Apply status
[REMOVE_STATUS: Name | Effect]          - Remove status
[DEATH_SAVES: Name | Success/Fail]      - Death save tracking
[STABLE: Name] / [DEAD: Name]           - Stabilization/death
```

### Optimizations
- **LRU Cache**: 5min TTL (general), 1hr TTL (rules queries)
- **Message Batching**: 1.5s debounce, max 5 messages/batch
- **Token Tracking**: Per-room usage monitoring

---

## Environment Variables

```bash
DATABASE_URL=              # Turso database URL (libsql://...)
TURSO_AUTH_TOKEN=          # Turso auth token
XAI_API_KEY=               # xAI Grok API key
SESSION_SECRET=            # Express session secret (random string)
GCP_SERVICE_ACCOUNT_KEY=   # Google Cloud Storage JSON key (optional)
NODE_ENV=                  # development | production
PORT=5000                  # Server port (default: 5000)
```

---

## Development Commands

```bash
npm install             # Install dependencies
npm run dev             # Start dev server (Vite HMR on :5000)
npm run build           # Build for production (client + server)
npm start               # Run production build
npm run check           # TypeScript type checking
npm run db:push         # Push schema changes to database
```

---

## Top 10 Improvement Opportunities

### 🔴 High Priority
1. **~~Database Migration~~** - ✅ COMPLETED (SQLite types migration)
2. **Security Audit** - Verify bcrypt password hashing, add rate limiting
3. **Test Coverage** - Unit tests for dice, integration tests for API
4. **WebSocket Reconnection** - Auto-reconnect with exponential backoff
5. **Error Handling** - Centralized error handler, structured logging

### 🟡 Medium Priority
6. **Mobile Optimization** - Swipeable UI, touch-friendly controls
7. **Character Builder UX** - Visual wizard, guided spell selection
8. **Game System Expansion** - Pathfinder 2e, Call of Cthulhu
9. **Advanced Combat** - Battle map, token placement, AoE visualization
10. **NPC Management** - Monster compendium, stat blocks, auto-initiative

See [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) for 14 more improvement ideas!

---

## Quick Tips for Developers

### Adding a New API Endpoint
1. Define route in `server/routes.ts`
2. Add Zod validation schema
3. Implement handler with error handling
4. Update types in `shared/schema.ts` if needed

### Adding a New UI Component
1. Create in `client/src/components/`
2. Use shadcn/ui patterns (Radix UI + Tailwind)
3. Import types from `@shared/schema`
4. Use TanStack Query for server state

### Modifying Game Mechanics
1. Update `shared/schema.ts` (types, functions, constants)
2. Update AI prompt in `server/grok.ts` if needed
3. Update UI to display new mechanics
4. Test with `npm run check`

---

## Architecture Diagram

```
┌─────────────────────┐
│   Browser Client    │
│  React + WebSocket  │
└──────────┬──────────┘
           │ HTTP/WS
           ▼
┌─────────────────────┐
│  Express Server     │
│  REST + WebSocket   │
└──────────┬──────────┘
     │     │     │
     ▼     ▼     ▼
┌────┐ ┌────┐ ┌────┐
│ DB │ │ AI │ │GCS │
│Turso│ │Grok│ │ ☁️ │
└────┘ └────┘ └────┘
```

---

## Support & Resources

- **Main Design Doc**: [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) (comprehensive reference)
- **Design Guidelines**: [design_guidelines.md](./design_guidelines.md) (UI/UX patterns)
- **Copilot Instructions**: [.github/copilot-instructions.md](./.github/copilot-instructions.md)
- **Issues**: [GitHub Issues](https://github.com/algr0n/gr0k-dm/issues)

---

## Quick Stats

- **Lines of Code**: ~20,000+ (TypeScript)
- **Components**: 60+ React components
- **Database Tables**: 15+ tables (including adventure system)
- **API Endpoints**: 40+ REST endpoints
- **Game Systems**: 2 (D&D 5e full, Cyberpunk RED basic)
- **Adventure Modules**: 2 (Lost Mine of Phandelver, Dragon of Icespire Peak)
- **Supported Dice**: d4, d6, d8, d10, d12, d20, d100

---

**Version**: 1.0  
**Last Updated**: December 24, 2024  
**For detailed information, see**: [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md)

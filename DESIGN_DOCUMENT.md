# Grok DM - Comprehensive Design Document

## Executive Summary

Grok DM is a browser-based AI-powered Dungeon Master platform for tabletop role-playing games (TTRPGs). Players create or join game rooms where xAI's Grok serves as an intelligent DM that narrates stories, manages combat, tracks character stats, interprets dice rolls, and drives immersive adventures. The application provides a complete real-time multiplayer TTRPG experience with support for multiple game systems, character creation, inventory management, and AI-driven narrative.

**Current Status**: Production-ready browser application with authentication, persistent character management, comprehensive D&D 5e implementation, and real-time multiplayer support.

**Target Audience**: TTRPG players and game masters looking for an AI-assisted gaming experience, remote gaming groups, solo players, and newcomers to tabletop RPGs.

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Core Features](#core-features)
5. [Database Schema](#database-schema)
6. [AI Integration](#ai-integration)
7. [User Experience](#user-experience)
8. [Security & Authentication](#security--authentication)
9. [Improvement Opportunities](#improvement-opportunities)
10. [Development Guidelines](#development-guidelines)

---

## Application Overview

### What Does Grok DM Do?

Grok DM is a complete virtual tabletop platform where:

1. **Players create game rooms** with configurable game systems (D&D 5e, Cyberpunk RED)
2. **The AI acts as Dungeon Master**, narrating scenes, controlling NPCs, and responding to player actions
3. **Built-in dice rolling** with automatic result interpretation by the AI
4. **Character management** with full stat tracking, inventory, spells, and status effects
5. **Real-time multiplayer** through WebSocket connections
6. **Persistent progress** with user accounts and saved characters
7. **Combat management** with initiative tracking and turn-based combat
8. **Inventory system** with a complete D&D 5e item compendium

### Key Differentiators

- **Browser-native**: No Discord bot or external dependencies - pure web application
- **AI-driven narrative**: Grok AI provides dynamic, context-aware storytelling
- **Complete character sheets**: Full D&D 5e implementation with classes, races, stats, skills, spells
- **Item compendium**: Pre-seeded database of D&D 5e items, spells, and equipment
- **User authentication**: Persistent accounts with saved characters across sessions
- **Real-time collaboration**: WebSocket-based chat with instant updates for all players

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (Browser)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ React SPA (Vite) + shadcn/ui + Tailwind CSS          │  │
│  │ - Landing, Dashboard, Room, Character Management     │  │
│  │ - TanStack Query for server state                    │  │
│  │ - WebSocket client for real-time updates            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Server                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ REST API + WebSocket Server                          │  │
│  │ - Passport.js authentication (local + session)       │  │
│  │ - Room management, character CRUD, dice rolling      │  │
│  │ - WebSocket message routing & batching               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                      │                    │
           ▼                      ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐
│  Turso Database  │  │  xAI Grok API    │  │  Google Cloud  │
│  (libSQL/SQLite) │  │  (OpenAI client) │  │  Storage (GCS) │
│  - Drizzle ORM   │  │  - DM responses  │  │  - User images │
│  - PostgreSQL    │  │  - Scene gen     │  │  - Avatars     │
│    types (legacy)│  │  - Combat AI     │  │                │
└──────────────────┘  └──────────────────┘  └────────────────┘
```

### Component Architecture

**Frontend Components**:
- **Pages**: Landing, Dashboard, Room, Characters, Profile, Auth
- **UI Components**: shadcn/ui library (50+ components)
- **Feature Components**: 
  - `FloatingCharacterPanel` - Draggable character sheet overlay
  - `DMControlsPanel` - DM-specific tools (scene setting, combat, HP)
  - `SpellBrowser` - Searchable spell compendium
  - `CharacterList` - Party overview with quick stats
  - `ActivityFeed` - Real-time game events
  - `AdventureCreator` - AI-powered scene generation

**Backend Services**:
- **Routes** (`server/routes.ts`): REST API endpoints
- **WebSocket** (`server/routes.ts`): Real-time messaging with batching
- **Grok** (`server/grok.ts`): AI integration with caching and token tracking
- **Dice** (`server/dice.ts`): Dice expression parser and roller
- **Auth** (`server/auth.ts`): Passport.js with local strategy
- **Storage** (`server/storage.ts`, `server/objectStorage.ts`): Database and GCS operations

### Data Flow

1. **User Action** → Frontend component triggers mutation/query
2. **API Request** → TanStack Query sends HTTP/WebSocket message
3. **Backend Processing** → Express route handler validates and processes
4. **Database Operation** → Drizzle ORM queries Turso database
5. **AI Generation** (optional) → Grok API generates DM response
6. **Response** → Data returned to client, cache updated
7. **UI Update** → React components re-render with new data

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | 18.3.1 |
| TypeScript | Type safety | 5.6.3 |
| Vite | Build tool & dev server | 5.4.20 |
| Wouter | Client-side routing | 3.3.5 |
| TanStack Query | Server state management | 5.60.5 |
| shadcn/ui | Component library | Latest |
| Radix UI | Accessible primitives | Latest |
| Tailwind CSS | Utility-first styling | 3.4.17 |
| Framer Motion | Animations | 11.13.1 |
| React Hook Form | Form management | 7.55.0 |
| Zod | Schema validation | 3.24.2 |

### Backend

| Technology | Purpose | Version |
|-----------|---------|---------|
| Express | HTTP server | 4.21.2 |
| TypeScript | Type safety | 5.6.3 |
| ws | WebSocket server | 8.18.0 |
| Drizzle ORM | Database ORM | 0.39.3 |
| @libsql/client | Turso database client | 0.15.15 |
| Passport | Authentication | 0.7.0 |
| OpenAI | xAI Grok API client | 6.10.0 |
| Express Session | Session management | 1.18.1 |
| @google-cloud/storage | File storage | 7.18.0 |

### Database

| Technology | Purpose | Notes |
|-----------|---------|-------|
| Turso (libSQL) | Primary database | SQLite-compatible, serverless |
| Drizzle ORM | ORM & migrations | Type-safe query builder |
| PostgreSQL types | Schema definition | **Legacy - needs migration to SQLite types** |

### External Services

| Service | Purpose | Environment Variable |
|---------|---------|---------------------|
| xAI Grok API | AI Dungeon Master | `XAI_API_KEY` |
| Turso Database | Data persistence | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| Google Cloud Storage | User-uploaded images | `GCP_SERVICE_ACCOUNT_KEY` |

---

## Core Features

### 1. User Authentication & Profile Management

**Status**: ✅ Implemented

- Local username/password authentication (Passport.js)
- Persistent sessions with MemoryStore
- User profile with custom avatar upload (Google Cloud Storage)
- Session-based authentication for API endpoints

**Key Files**:
- `server/auth.ts` - Passport configuration and strategies
- `client/src/pages/auth-page.tsx` - Login/signup UI
- `client/src/pages/profile.tsx` - User profile management

### 2. Room Management

**Status**: ✅ Implemented

**Features**:
- Create game rooms with unique 8-character codes
- Support for multiple game systems (D&D 5e, Cyberpunk RED)
- Public/private room visibility
- Host privileges for room creator
- Player limit configuration (default: 6 players)
- Room discovery (browse public rooms)
- Rejoin last session functionality

**Key Endpoints**:
- `POST /api/rooms` - Create room
- `GET /api/rooms/:code` - Get room details
- `POST /api/rooms/:code/join` - Join room
- `GET /api/rooms/public` - Browse public rooms
- `DELETE /api/rooms/:code/players/:playerId` - Kick player (host only)

### 3. Character Management

**Status**: ✅ Comprehensive D&D 5e implementation

**Features**:
- Full D&D 5e character creation wizard
- 12 classes with hit dice, proficiencies, and spell progression
- 9 races with subraces and ability score increases
- Ability scores (STR, DEX, CON, INT, WIS, CHA)
- 18 skills with proficiency and expertise tracking
- HP, AC, speed, initiative modifier
- Level progression with XP tracking
- Spell slot management for spellcasters
- Status effects (conditions like Poisoned, Frightened, etc.)
- Character notes and backstory

**Key Features**:
- Unified character system (characters persist across sessions)
- Characters can join game rooms via `currentRoomCode`
- Pre-generated character templates for quick start
- Character import from saved library
- Automatic stat calculations (modifiers, proficiency bonus, skill bonuses)
- Class-specific features (expertise, Jack of All Trades, etc.)

**Key Files**:
- `shared/schema.ts` - Character schema and game mechanics (lines 324-1557)
- `client/src/pages/characters.tsx` - Character management UI
- `client/src/components/floating-character-panel.tsx` - In-game character sheet

### 4. Inventory & Item Management

**Status**: ✅ Implemented with D&D 5e item compendium

**Features**:
- Pre-seeded D&D 5e item database (SRD items)
- Item categories (weapon, armor, potion, scroll, wondrous item, etc.)
- Item rarity system (common to legendary)
- Weight and cost tracking
- Equipped items and attunement slots
- Quantity management
- Item search and filtering
- AI can add/remove items via tags in responses

**Database Tables**:
- `items` - Master item compendium (shared across all games)
- `character_inventory_items` - Character-owned items
- `inventoryItems` - Legacy table for room-based characters

**Key Files**:
- `server/seed-items.ts` - Item seeding script
- `shared/schema.ts` - Item schema (lines 168-196)

### 5. Spell System

**Status**: ✅ Comprehensive D&D 5e implementation

**Features**:
- Pre-seeded D&D 5e spell database (SRD spells)
- Spell schools (Abjuration, Conjuration, Divination, etc.)
- Spell levels (cantrips through 9th level)
- Spell slot tracking by character level
- Spell components (V, S, M)
- Concentration and ritual tracking
- Class-based spell lists
- Spellcasting types: known, prepared, spellbook, pact magic
- Spell browser with search and filtering

**Spell Slot Progression**:
- Full casters: Bard, Cleric, Druid, Sorcerer, Wizard
- Half casters: Paladin, Ranger (start at level 2)
- Warlock: Pact Magic (different slot system)

**Key Files**:
- `server/seed-spells.ts` - Spell seeding script
- `client/src/components/spell-browser.tsx` - Spell selection UI
- `shared/schema.ts` - Spell schema and progression tables (lines 198-1486)

### 6. Dice Rolling System

**Status**: ✅ Implemented

**Features**:
- Standard RPG notation parser (2d6+3, d20, etc.)
- Support for advantage/disadvantage
- Ability score generation (4d6 drop lowest)
- Roll history tracking
- Inline dice rolls in chat (`/roll 2d6+3`)
- AI interprets roll results contextually
- Visual dice animations (frontend)

**Dice Types Supported**:
- d4, d6, d8, d10, d12, d20, d100
- Modifiers (+/- N)
- Multiple dice (NdN format)
- Validation (max 100 dice, max 1000 sides)

**Key Files**:
- `server/dice.ts` - Dice engine
- `client/src/pages/room.tsx` - Dice UI

### 7. Combat System

**Status**: ✅ Implemented with initiative tracking

**Features**:
- Combat start/end detection via AI tags (`[COMBAT_START]`, `[COMBAT_END]`)
- Initiative rolling with modifier support
- Turn-based combat with initiative order
- Combat state persistence per room
- DM turn automation (AI generates enemy actions)
- HP tracking with AI tags (`[HP: PlayerName | Current/Max]`)
- Death saving throws (`[DEATH_SAVES]`, `[STABLE]`, `[DEAD]`)
- Skip turn functionality
- End combat (host only)

**Combat Flow**:
1. Players roll initiative (d20 + modifier)
2. Turn order established automatically
3. Current player highlighted in initiative list
4. Players take actions, AI responds
5. Next turn advances automatically or manually
6. AI takes DM turn when "DM's Turn" reached

**Key Files**:
- `client/src/pages/room.tsx` - Combat UI and state management
- `server/grok.ts` - Combat tag parsing and DM turn generation

### 8. AI Dungeon Master

**Status**: ✅ Production-ready with optimization

**Features**:
- Context-aware responses using message history
- Game system-specific prompts (D&D 5e, Cyberpunk RED)
- Dice roll interpretation
- NPC dialogue and scene narration
- Combat management
- Special instructions (Boofus the Radiant easter egg)
- Response caching for rules queries (LRU cache, 5min/1hr TTL)
- Token usage tracking per room
- Message batching (1.5s debounce window, max 5 messages)
- Dropped item handling (ignores mundane items)

**AI Tags** (parsed from responses):
- `[COMBAT_START]` / `[COMBAT_END]` - Combat state
- `[HP: Name | Current/Max]` - HP updates
- `[ITEM: Name | ItemName | Qty]` - Add item to inventory
- `[REMOVE_ITEM: Name | ItemName | Qty]` - Remove item
- `[STATUS: Name | Effect]` / `[REMOVE_STATUS: Name | Effect]` - Status effects
- `[DEATH_SAVES: Name | Successes/Failures]` - Death saves
- `[STABLE: Name]` / `[DEAD: Name]` - Stabilization/death

**Optimization**:
- LRU cache for deterministic queries (rules, status)
- Longer cache TTL (1hr) for rules queries
- Message batching to reduce API calls (1.5s window)
- Token usage monitoring and logging
- Grok-4-1-fast-reasoning model (fast inference)

**Key Files**:
- `server/grok.ts` - AI integration and caching
- `server/routes.ts` - Tag parsing and game state updates

### 9. Real-Time Multiplayer

**Status**: ✅ Implemented with WebSocket

**Features**:
- WebSocket connections per room
- Real-time chat with all players
- Message types: chat, action, roll, system, DM
- Player join/leave notifications
- Player list with online status
- Message history persistence (in-memory + database)
- Reconnection support

**Message Flow**:
1. Player sends message via WebSocket
2. Server queues message for batching
3. After 1.5s debounce, batch sent to Grok API
4. AI response parsed for game actions (HP, items, etc.)
5. Game state updated in database
6. Broadcast to all players in room

**Key Files**:
- `server/routes.ts` - WebSocket server and message routing
- `client/src/pages/room.tsx` - WebSocket client

### 10. Status Effects System

**Status**: ✅ Implemented

**Features**:
- Predefined status effects per game system
- D&D 5e: 16 standard conditions (Blinded, Charmed, Frightened, etc.)
- Cyberpunk RED: 14 status effects (Stun, Wounded, EMP'd, etc.)
- Custom status effects
- Duration tracking
- DM-applied effects
- Visual indicators in character panel
- AI can apply/remove via tags

**Key Files**:
- `shared/schema.ts` - Status effect definitions (lines 459-523)
- `client/src/components/floating-character-panel.tsx` - Status display

### 11. DM Tools

**Status**: ✅ Implemented

**Features**:
- Set current scene description
- Manually update player HP
- Apply status effects
- Start/end combat
- Roll for DM
- Generate scenes with AI
- Token usage monitoring

**Key Files**:
- `client/src/components/dm-controls-panel.tsx` - DM tools UI
- `client/src/components/adventure-creator.tsx` - AI scene generation

---

## Database Schema

### Overview

The database uses **Drizzle ORM** with **Turso (libSQL)** - a SQLite-compatible serverless database. 

**⚠️ Important Note**: The schema is currently defined using PostgreSQL types (`pgTable`, `pgEnum`) but connects to a SQLite database (Turso). This works because Drizzle's query builder is database-agnostic, but it's a **technical debt** that should be migrated to SQLite-specific types for consistency.

### Core Tables

#### Sessions
```typescript
sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
)
```
Express session storage for user authentication.

#### Users
```typescript
users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  password VARCHAR,
  firstName VARCHAR,
  lastName VARCHAR,
  username VARCHAR UNIQUE,
  profileImageUrl VARCHAR,
  customProfileImageUrl VARCHAR,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
)
```
User accounts with profile information.

#### Rooms
```typescript
rooms (
  id VARCHAR PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gameSystem TEXT NOT NULL DEFAULT 'dnd',
  hostName TEXT NOT NULL,
  description TEXT,
  currentScene TEXT,
  messageHistory JSONB DEFAULT [] NOT NULL,
  isActive BOOLEAN DEFAULT true NOT NULL,
  isPublic BOOLEAN DEFAULT false NOT NULL,
  maxPlayers INTEGER DEFAULT 6 NOT NULL,
  lastActivityAt TIMESTAMP DEFAULT NOW() NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW()
)
```
Game rooms with message history and configuration.

#### Unified Characters
```typescript
unifiedCharacters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  userId VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  characterName TEXT NOT NULL,
  race TEXT,
  class TEXT,
  level INTEGER DEFAULT 1 NOT NULL,
  background TEXT,
  alignment TEXT,
  stats JSONB,
  skills TEXT[] DEFAULT [],
  proficiencies TEXT[] DEFAULT [],
  spells TEXT[] DEFAULT [],
  spellSlots JSONB DEFAULT {...},
  hitDice TEXT,
  maxHp INTEGER DEFAULT 10 NOT NULL,
  currentHp INTEGER DEFAULT 10 NOT NULL,
  temporaryHp INTEGER DEFAULT 0 NOT NULL,
  ac INTEGER DEFAULT 10 NOT NULL,
  speed INTEGER DEFAULT 30 NOT NULL,
  initiativeModifier INTEGER DEFAULT 0 NOT NULL,
  xp INTEGER DEFAULT 0 NOT NULL,
  gold INTEGER DEFAULT 0 NOT NULL,
  isAlive BOOLEAN DEFAULT true NOT NULL,
  backstory TEXT,
  notes TEXT,
  gameSystem TEXT DEFAULT 'dnd' NOT NULL,
  currentRoomCode VARCHAR(8),
  levelChoices JSONB DEFAULT [],
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW()
)
```
Persistent characters that can join different game rooms.

#### Items (Master Compendium)
```typescript
items (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  category ENUM('weapon', 'armor', 'potion', ...) NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  rarity ENUM('common', 'uncommon', 'rare', ...) DEFAULT 'common',
  cost INTEGER,
  weight DECIMAL(5, 2),
  description TEXT NOT NULL,
  properties JSONB,
  requiresAttunement BOOLEAN DEFAULT false,
  gameSystem TEXT DEFAULT 'dnd' NOT NULL,
  source TEXT DEFAULT 'SRD',
  createdAt TIMESTAMP DEFAULT NOW()
)
```
Master item database seeded with D&D 5e SRD items.

#### Character Inventory
```typescript
characterInventoryItems (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  characterId VARCHAR NOT NULL REFERENCES unifiedCharacters(id) ON DELETE CASCADE,
  itemId VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1 NOT NULL,
  equipped BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  attunementSlot BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW()
)
```
Items owned by characters.

#### Spells (Master Compendium)
```typescript
spells (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER DEFAULT 0 NOT NULL,
  school ENUM('Abjuration', 'Conjuration', ...) NOT NULL,
  castingTime TEXT NOT NULL,
  range TEXT NOT NULL,
  components JSONB NOT NULL,
  duration TEXT NOT NULL,
  concentration BOOLEAN DEFAULT false NOT NULL,
  ritual BOOLEAN DEFAULT false NOT NULL,
  description TEXT NOT NULL,
  higherLevels TEXT,
  classes TEXT[] DEFAULT [] NOT NULL,
  source TEXT DEFAULT 'SRD',
  createdAt TIMESTAMP DEFAULT NOW()
)
```
Master spell database seeded with D&D 5e SRD spells.

#### Character Status Effects
```typescript
characterStatusEffects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  characterId VARCHAR NOT NULL REFERENCES unifiedCharacters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  isPredefined BOOLEAN DEFAULT true NOT NULL,
  duration TEXT,
  appliedByDm BOOLEAN DEFAULT true NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL
)
```
Active status effects on characters.

### Legacy Tables

These tables are still in the schema but may be deprecated in favor of unified character system:

- `players` - Players in specific rooms (being migrated to unified characters)
- `characters` - Room-specific characters (deprecated)
- `inventoryItems` - Room character inventory (deprecated)
- `diceRolls` - Dice roll history (currently not actively used)

---

## AI Integration

### Grok API Configuration

**Provider**: xAI (X.AI)  
**Model**: `grok-4-1-fast-reasoning`  
**Base URL**: `https://api.x.ai/v1`  
**Client**: OpenAI SDK (compatible API)

### System Prompts

The AI behavior is controlled by game system-specific prompts:

#### D&D 5e Prompt
- Concise, direct narration (1-2 paragraphs max)
- Dice result interpretation (20=amazing, 1=disaster)
- Combat management with tags
- HP tracking and death saving throws
- Inventory management
- Status effect tracking
- Easter egg: Boofus the Radiant (fabulous gay deity)

#### Cyberpunk RED Prompt
- Gritty, punchy Night City atmosphere
- Cyberpunk slang (choom, preem, nova, eddies)
- d10 dice system interpretation
- Combat and HP tracking
- Corporate and street-level NPCs

### Response Caching

**Purpose**: Reduce API costs and improve response times for deterministic queries.

**Cache Strategy**:
- **LRU Cache** (Least Recently Used eviction)
- **Max Size**: 100 entries
- **TTL**: 5 minutes (general), 1 hour (rules queries)
- **Cacheable Patterns**: Rules explanations, mechanics queries, status lookups
- **Non-cacheable**: Actions, rolls, dynamic narrative

**Cache Hit Rate**: Estimated 15-30% for typical gameplay sessions.

### Token Usage Tracking

Tracks API usage per room:
- Prompt tokens
- Completion tokens
- Total tokens
- Call count
- Last updated timestamp

Accessible via `getTokenUsage(roomId)` or DM controls panel.

### Message Batching

**Purpose**: Reduce API calls when multiple players act simultaneously.

**Configuration**:
- **Batch Window**: 1.5 seconds
- **Max Batch Size**: 5 messages
- **Behavior**: Collects player messages, sends single API request, AI responds to all actions in one narrative

**Benefits**:
- Fewer API calls (cost reduction)
- More cohesive narrative responses
- Better handling of simultaneous player actions

---

## User Experience

### Design System

Detailed in `design_guidelines.md`:

**Typography**:
- Headers: Cinzel (fantasy serif)
- Body: Inter (sans-serif)
- Stats/Code: JetBrains Mono

**Layout**:
- Tailwind spacing primitives (2, 4, 6, 8, 12, 16)
- Max container width: `max-w-7xl`
- Responsive grid: 3-column desktop, 1-column mobile

**Components**: shadcn/ui with custom theming

### User Flows

#### 1. New User Registration
1. Landing page → "Login" or "Sign Up"
2. Auth page with username/password form
3. Session created, redirect to dashboard

#### 2. Host a Game
1. Dashboard → "Host a Game"
2. Multi-step dialog:
   - Enter game name, select system, privacy
   - Choose or create character
3. Room created with unique 8-character code
4. Redirect to room page
5. Share code with players

#### 3. Join a Game
1. Dashboard → "Join a Game"
2. Enter room code
3. Multi-step dialog:
   - Enter player name
   - Choose or create character
4. Join room
5. Redirect to room page

#### 4. Gameplay
1. Chat with AI and other players
2. Roll dice with `/roll 2d6+3` or dice UI
3. View character sheet (floating panel)
4. Manage inventory (add/remove items)
5. Track HP, status effects, spell slots
6. Participate in combat (initiative order)

#### 5. Character Creation
1. Dashboard → "Characters" → "Create Character"
2. Multi-step wizard:
   - Name, race, class, level
   - Roll or assign ability scores
   - Select skills, spells, equipment
   - Add backstory
3. Character saved to library
4. Use in any game room

### Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Focus states on all buttons/inputs
- Sufficient color contrast ratios
- Screen reader compatibility

---

## Security & Authentication

### Authentication Strategy

**Passport.js** with local username/password strategy:
- Password hashing not explicitly shown (should use bcrypt)
- Session-based authentication with MemoryStore
- Session cookies with `httpOnly` flag
- Protected API routes with `isAuthenticated` middleware

### Session Management

**Store**: MemoryStore (development) / connect-pg-simple (production)  
**Configuration**:
- `secret`: Environment variable `SESSION_SECRET`
- `resave`: false
- `saveUninitialized`: false
- `cookie.httpOnly`: true
- `cookie.secure`: Auto (true in production)
- `cookie.maxAge`: 7 days

### File Upload Security

**Google Cloud Storage**:
- Service account authentication
- ACL: public-read for uploaded images
- File type validation (images only)
- File size limits (enforced client-side)

### Input Validation

**Zod schemas** for runtime validation:
- All API endpoints validate input
- Type coercion where appropriate
- Error messages returned to client

### Known Security Considerations

⚠️ **Areas for improvement**:
1. **Password hashing**: Verify bcrypt implementation in auth.ts
2. **Rate limiting**: No explicit rate limiting on API endpoints
3. **CSRF protection**: Should add CSRF tokens for state-changing operations
4. **SQL injection**: Mitigated by Drizzle ORM parameterized queries
5. **XSS protection**: React escapes by default, but validate AI responses
6. **Environment variables**: Ensure sensitive vars not committed to git

---

## Improvement Opportunities

### High Priority (Core Functionality)

#### 1. Database Schema Migration
**Issue**: Using PostgreSQL types (`pgTable`, `pgEnum`) with SQLite database (Turso).  
**Impact**: Inconsistency, potential future compatibility issues.  
**Solution**: Migrate to SQLite types (`sqliteTable`, text-based enums).  
**Effort**: Medium (2-3 days).  
**Files**: `shared/schema.ts`, `drizzle.config.ts`, migration scripts.

#### 2. Password Security Audit
**Issue**: Unclear if passwords are properly hashed (bcrypt).  
**Impact**: Critical security vulnerability if plaintext.  
**Solution**: Audit `server/auth.ts`, ensure bcrypt with salt rounds ≥10.  
**Effort**: Low (1 hour).  
**Files**: `server/auth.ts`.

#### 3. Rate Limiting
**Issue**: No rate limiting on API endpoints or AI requests.  
**Impact**: Potential abuse, API cost explosions, DDoS vulnerability.  
**Solution**: Implement express-rate-limit on critical endpoints.  
**Effort**: Low (2-3 hours).  
**Priority**: High for production deployment.

#### 4. Error Handling & Logging
**Issue**: Inconsistent error handling, limited structured logging.  
**Impact**: Difficult debugging, poor observability.  
**Solution**: Centralized error handler, structured logging (Winston/Pino).  
**Effort**: Medium (1-2 days).  
**Files**: `server/index.ts`, all route handlers.

#### 5. WebSocket Reconnection
**Issue**: WebSocket disconnections may not auto-reconnect gracefully.  
**Impact**: Users lose real-time updates, need manual page refresh.  
**Solution**: Implement reconnection logic with exponential backoff.  
**Effort**: Medium (4-6 hours).  
**Files**: `client/src/pages/room.tsx`.

### Medium Priority (UX & Features)

#### 6. Character Builder Improvements
**Current**: Functional but basic wizard.  
**Opportunities**:
- Visual class/race selection with images
- Guided spell selection based on class
- Equipment packages by class
- Background selection with personality traits
- Validation warnings (e.g., "You haven't selected 2 skills")

**Effort**: High (1-2 weeks).  
**Files**: `client/src/pages/characters.tsx`, new wizard components.

#### 7. Mobile Optimization
**Current**: Responsive but not mobile-first.  
**Opportunities**:
- Simplified mobile room layout (single column)
- Swipeable character sheet drawer
- Touch-friendly dice roller
- Mobile-optimized combat tracker
- PWA support (offline capabilities)

**Effort**: High (2 weeks).  
**Files**: All frontend components, new mobile-specific layouts.

#### 8. Game System Expansion
**Current**: D&D 5e (comprehensive), Cyberpunk RED (basic).  
**Opportunities**:
- Pathfinder 2e with full action economy
- Call of Cthulhu with sanity mechanics
- Daggerheart (Critical Role system)
- Custom system builder for homebrew games
- Import from D&D Beyond/Roll20

**Effort**: Very High (4-8 weeks per system).  
**Files**: `shared/schema.ts`, system-specific UI components, AI prompts.

#### 9. Advanced Combat Features
**Current**: Basic initiative and turn tracking.  
**Opportunities**:
- Grid-based battle map (canvas or SVG)
- Token placement and movement
- Area of effect visualizations
- Distance and range calculations
- Cover and concealment tracking
- Automated condition tracking (blinded = disadvantage)

**Effort**: Very High (3-4 weeks).  
**Files**: New battle map component, combat engine refactor.

#### 10. NPC & Monster Management
**Current**: AI generates NPCs on-the-fly.  
**Opportunities**:
- Monster compendium (D&D 5e SRD monsters)
- Stat blocks with CR and abilities
- Initiative auto-rolling for monsters
- NPC creation tool for DMs
- Monster HP tracking
- Bestiary browser

**Effort**: High (2-3 weeks).  
**Files**: New monster schema, seeding script, DM tools.

#### 11. Scene & Campaign Management
**Current**: Single scene description per room.  
**Opportunities**:
- Multi-scene campaigns with progression
- Scene templates (dungeon, tavern, wilderness)
- Scene history timeline
- Map uploads for scene context
- Quest tracking
- Session notes and summaries

**Effort**: High (2 weeks).  
**Files**: New campaign schema, scene management UI.

#### 12. Spell Slot Automation
**Current**: Manual spell slot tracking.  
**Opportunities**:
- Auto-decrement on spell cast (AI tags)
- Rest system (short/long rest restores slots)
- Warlock pact magic support
- Spell preparation workflow
- Domain/patron spell bonuses

**Effort**: Medium (1 week).  
**Files**: `client/src/components/floating-character-panel.tsx`, AI prompt updates.

### Low Priority (Polish & Enhancement)

#### 13. Dice Roll Animations
**Current**: Basic dice roll display.  
**Opportunities**:
- 3D dice physics animations (three.js or dice-box)
- Sound effects for rolls
- Roll history timeline
- Saved roll templates ("Greatsword Attack", "Fireball Damage")

**Effort**: Medium (1 week).  
**Files**: New dice animation component.

#### 14. Voice Integration
**Opportunities**:
- Text-to-speech for DM responses (ElevenLabs API)
- Voice-to-text for player input
- Voice changers for NPC dialogue
- Ambient sound effects

**Effort**: High (2 weeks).  
**Priority**: Low (nice-to-have).

#### 15. Social Features
**Opportunities**:
- Friend lists
- Party invitations
- Campaign sharing
- Public campaign gallery
- Player ratings/reviews
- Discord integration (webhook notifications)

**Effort**: High (2-3 weeks).  
**Files**: New social schema, friend system UI.

#### 16. Analytics & Insights
**Opportunities**:
- Player engagement metrics (rolls per session, messages sent)
- Character progression charts (level over time, XP gain)
- Campaign statistics (sessions played, enemies defeated)
- AI token usage dashboard
- Performance monitoring (Sentry, LogRocket)

**Effort**: Medium (1 week).  
**Files**: Analytics service, dashboard UI.

#### 17. Accessibility Improvements
**Opportunities**:
- Screen reader optimization
- High contrast mode
- Dyslexia-friendly font option
- Keyboard shortcut guide
- Customizable font sizes

**Effort**: Medium (1 week).  
**Files**: Accessibility utilities, theme provider updates.

#### 18. Internationalization (i18n)
**Opportunities**:
- Multi-language support (Spanish, French, German, Japanese)
- Translated game systems
- AI responses in user's language
- Date/time localization

**Effort**: Very High (3-4 weeks + ongoing).  
**Files**: i18n library setup, translation files, all UI text.

### Technical Debt & Infrastructure

#### 19. Test Coverage
**Current**: No automated tests.  
**Recommendations**:
- Unit tests for dice engine (100% coverage)
- Unit tests for game mechanics (stat calculations, spell slots)
- Integration tests for API endpoints
- E2E tests for critical flows (create room, join game, character creation)
- Visual regression tests for UI components

**Tools**: Vitest, React Testing Library, Playwright.  
**Effort**: High (2-3 weeks for initial setup).  
**Priority**: High for production stability.

#### 20. CI/CD Pipeline
**Current**: Manual deployment.  
**Recommendations**:
- GitHub Actions for automated testing
- Automated deployments to staging/production
- Database migration automation
- Bundle size monitoring
- Lighthouse CI for performance tracking

**Effort**: Medium (1 week).  
**Priority**: High for team collaboration.

#### 21. Database Migration Management
**Current**: Manual `db:push` for schema changes.  
**Recommendations**:
- Version-controlled migrations
- Rollback capability
- Seed data management
- Backup and restore procedures

**Effort**: Medium (3-5 days).  
**Priority**: High before production.

#### 22. Environment Configuration
**Current**: Environment variables in `.env`.  
**Recommendations**:
- Secrets management (AWS Secrets Manager, Vault)
- Multi-environment configs (dev, staging, prod)
- Feature flags (LaunchDarkly, PostHog)
- Configuration validation on startup

**Effort**: Medium (1 week).  
**Priority**: Medium.

#### 23. Performance Optimization
**Current**: Good performance, room for improvement.  
**Opportunities**:
- Code splitting by route
- Lazy loading for heavy components (spell browser, battle map)
- Image optimization (WebP, lazy loading)
- Virtual scrolling for long message history
- Service worker for offline support
- CDN for static assets

**Effort**: Medium (1-2 weeks).  
**Priority**: Medium.

#### 24. Documentation
**Current**: Basic README, design guidelines.  
**Recommendations**:
- API documentation (Swagger/OpenAPI)
- Component storybook (Storybook.js)
- Architecture decision records (ADRs)
- Contribution guidelines
- Deployment guide
- Troubleshooting guide

**Effort**: Medium (1 week).  
**Priority**: High for onboarding new developers.

---

## Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: No semicolons (project convention)
- **Naming**: 
  - Components: PascalCase (`CharacterList.tsx`)
  - Files: kebab-case (`dice-roller.ts`)
  - Functions: camelCase (`rollDice`)
  - Constants: UPPER_SNAKE_CASE (`MAX_PLAYERS`)

### Project Structure

```
/
├── client/           # React frontend
│   ├── src/
│   │   ├── pages/    # Route pages
│   │   ├── components/ # Reusable components
│   │   ├── hooks/    # Custom React hooks
│   │   └── lib/      # Utilities
│   └── index.html
├── server/           # Express backend
│   ├── index.ts      # Entry point
│   ├── routes.ts     # API & WebSocket
│   ├── grok.ts       # AI integration
│   ├── dice.ts       # Dice engine
│   └── auth.ts       # Authentication
├── shared/           # Shared code
│   └── schema.ts     # Database schema
├── migrations/       # Database migrations
└── script/           # Build scripts
```

### Adding New Features

1. **Database changes**: Update `shared/schema.ts`, run `npm run db:push`
2. **API endpoints**: Add to `server/routes.ts` with Zod validation
3. **UI components**: Create in `client/src/components/`, use shadcn/ui patterns
4. **State management**: Use TanStack Query for server state
5. **Real-time updates**: Use WebSocket broadcasts in `routes.ts`

### Commands

```bash
npm run dev         # Start dev server (Vite HMR)
npm run build       # Build for production
npm start           # Run production build
npm run check       # TypeScript type checking
npm run db:push     # Push schema changes to database
```

### Environment Variables

Required for development:

```bash
DATABASE_URL=          # Turso database URL
TURSO_AUTH_TOKEN=      # Turso auth token
XAI_API_KEY=           # xAI Grok API key
SESSION_SECRET=        # Express session secret
GCP_SERVICE_ACCOUNT_KEY= # Google Cloud Storage credentials (optional)
NODE_ENV=development   # Environment mode
```

### Deployment

**Production checklist**:
1. ✅ Environment variables configured
2. ✅ Database migrations applied
3. ✅ Seed data loaded (items, spells)
4. ⚠️ Rate limiting enabled
5. ⚠️ HTTPS enforced
6. ⚠️ Session store (connect-pg-simple, not MemoryStore)
7. ⚠️ Error monitoring (Sentry)
8. ⚠️ Backup strategy

---

## Conclusion

Grok DM is a feature-rich, production-ready browser-based TTRPG platform with comprehensive D&D 5e support, AI-driven narrative, and real-time multiplayer capabilities. The application has a solid foundation with room for significant enhancements in mobile experience, additional game systems, combat tools, and social features.

**Key Strengths**:
- Complete D&D 5e implementation (classes, races, spells, items)
- Intelligent AI Dungeon Master with context awareness
- Real-time multiplayer with WebSocket
- Persistent characters and progress
- User authentication and profiles
- Optimized AI usage (caching, batching)

**Priority Improvements**:
1. Database schema migration (PostgreSQL → SQLite types)
2. Security audit (rate limiting, password hashing)
3. Test coverage and CI/CD
4. Mobile optimization
5. Additional game systems

This document serves as a comprehensive reference for developers, designers, and stakeholders working on Grok DM.

---

**Document Version**: 1.0  
**Last Updated**: December 8, 2025  
**Maintained By**: Development Team

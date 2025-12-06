# Grok DM - AI-Powered Discord TTRPG Bot

## Overview

Grok DM is an AI-powered Dungeon Master bot for Discord that facilitates tabletop role-playing game (TTRPG) sessions. The application combines a Discord bot with a web dashboard to manage characters, track game sessions, roll dice, and enable AI-driven storytelling. The bot uses xAI's Grok AI to generate dynamic narrative responses and manage game sessions as an intelligent Dungeon Master.

The system provides a comprehensive TTRPG experience with character management, dice rolling mechanics, quest tracking, and real-time game session monitoring through both Discord interactions and a web interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & UI**: React-based single-page application using Vite as the build tool and development server. The UI is built with shadcn/ui components (Radix UI primitives) and styled with Tailwind CSS using a custom Material Design-inspired theme with fantasy/gaming aesthetic overlay.

**Design System**: Implements a typography hierarchy using Cinzel (fantasy serif) for headers, Inter (sans-serif) for body content, and JetBrains Mono for stats and code. The color system uses CSS custom properties with HSL values for comprehensive theming support (light/dark modes).

**State Management**: Uses TanStack Query (React Query) for server state management with optimistic updates and automatic cache invalidation. Query client is configured for manual refetching to reduce unnecessary network requests.

**Routing**: Implements client-side routing via Wouter (lightweight alternative to React Router). Currently features a single dashboard view with potential for expansion.

**Component Architecture**: Modular component structure with separation between UI primitives (`components/ui/`), feature components (character cards, dice roller, activity feed), and page-level components. Components follow atomic design principles.

### Backend Architecture

**Server Framework**: Express.js application serving both the REST API and static frontend assets. Uses HTTP server with middleware for JSON parsing and request logging.

**API Design**: RESTful endpoints organized by resource type:
- `/api/bot/status` - Discord bot connection status
- `/api/characters/*` - Character CRUD operations
- `/api/sessions/*` - Game session management
- `/api/dice/*` - Dice rolling and history

**Discord Integration**: Uses discord.js v14 with Gateway intents for message content and guild information. Implements command parsing for natural language interactions (e.g., `!roll 2d6+3`, `!create`, `!start`). Bot authentication handled through Replit's Discord connector system for OAuth token management.

**AI Integration**: Integrates with xAI's Grok API using the OpenAI client library pointed at xAI's base URL. Implements a sophisticated Dungeon Master system prompt that guides the AI to narrate stories, control NPCs, manage combat, and interpret dice roll results. Maintains conversation context through message history.

**Dice Mechanics**: Custom dice rolling engine supporting standard RPG notation (NdN+M format) with validation for reasonable ranges (1-100 dice, 2-1000 sides). Includes natural language extraction for dice commands embedded in messages.

**Data Storage**: Currently implements in-memory storage using Map structures for users, characters, game sessions, and dice roll history. Storage interface (`IStorage`) designed for easy swapping to persistent database implementation.

**Session Management**: Tracks active game sessions by Discord channel ID, managing session state including quest logs, inventory, and session metadata. Sessions persist character associations and activity history.

### Database Schema (Drizzle ORM)

**Schema Definition**: Uses Drizzle ORM with PostgreSQL dialect. Schema defined in `shared/schema.ts` with Zod validation schemas generated via `drizzle-zod` for runtime type safety.

**Key Entities**:
- **Characters**: Stores D&D-style character data including stats (strength, dexterity, constitution, intelligence, wisdom, charisma), HP, level, race, class, inventory (JSON), and quest log (JSON)
- **Game Sessions**: Tracks active games with channel associations, participant lists, session names, and story state
- **Dice Rolls**: Records roll history with expressions, results, timestamps, and associated character/purpose
- **Users**: Manages Discord user mappings and authentication

**Type Safety**: Leverages TypeScript with strict mode and Zod schemas for compile-time and runtime validation. Shared types between client and server prevent API contract mismatches.

### Build & Deployment

**Development Mode**: Vite dev server with HMR, runtime error overlay, and Replit-specific development tools (cartographer, dev banner). TSX for TypeScript execution without compilation step.

**Production Build**: Two-step build process:
1. Vite builds client assets to `dist/public`
2. esbuild bundles server code to `dist/index.cjs` with selective dependency bundling for cold start optimization

**Module System**: ESM throughout with appropriate Node.js module resolution. Path aliases configured for clean imports (`@/`, `@shared/`, `@assets/`).

## External Dependencies

### Third-Party Services

**xAI Grok API**: Primary AI service for generating Dungeon Master responses, character backstories, and narrative content. Requires `XAI_API_KEY` environment variable. Uses OpenAI-compatible client pointed at `https://api.x.ai/v1`.

**Discord API**: Bot integration via discord.js requiring Discord bot token. Uses Replit's Discord connector for OAuth credential management and token refresh. Requires `REPLIT_CONNECTORS_HOSTNAME` and `REPL_IDENTITY`/`WEB_REPL_RENEWAL` environment variables.

**PostgreSQL Database**: Configured for Drizzle ORM via `DATABASE_URL` environment variable. Schema migrations stored in `./migrations` directory. Currently running with in-memory fallback, but infrastructure prepared for database connection.

### Key Libraries

**UI & Styling**:
- Radix UI primitives for accessible component foundations
- Tailwind CSS for utility-first styling
- class-variance-authority for component variants
- Embla Carousel for any carousel needs

**Data & Forms**:
- React Hook Form with Zod resolvers for form validation
- TanStack Query for server state management
- date-fns for date manipulation

**Backend**:
- express for HTTP server
- drizzle-orm for database ORM
- zod for schema validation
- discord.js for Discord bot functionality

**Development**:
- Vite with React plugin for frontend tooling
- esbuild for server bundling
- tsx for TypeScript execution
- Replit-specific plugins for development experience
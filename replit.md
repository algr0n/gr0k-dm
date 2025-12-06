# Grok DM - AI-Powered Browser TTRPG Platform

## Overview

Grok DM is an AI-powered Dungeon Master platform for tabletop role-playing games (TTRPG). Players create or join game rooms directly in the browser, where Grok AI serves as an intelligent Dungeon Master that narrates stories, manages combat, interprets dice rolls, and brings adventures to life.

The system provides a real-time multiplayer TTRPG experience with support for multiple game systems, built-in dice rolling, and AI-driven narrative responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & UI**: React-based single-page application using Vite as the build tool and development server. The UI is built with shadcn/ui components (Radix UI primitives) and styled with Tailwind CSS using a custom fantasy/gaming aesthetic.

**Design System**: Implements a typography hierarchy using Cinzel (fantasy serif) for headers, Inter (sans-serif) for body content, and JetBrains Mono for dice results. The color system uses CSS custom properties with HSL values for comprehensive theming support (light/dark modes).

**State Management**: Uses TanStack Query (React Query) for server state management. WebSocket connection provides real-time updates for chat messages.

**Routing**: Implements client-side routing via Wouter:
- `/` - Landing page with Host/Join game options
- `/room/:code` - Game room with real-time chat

**Key Pages**:
- `client/src/pages/landing.tsx` - Landing page with Host a Game and Join a Game dialogs
- `client/src/pages/room.tsx` - Game room with WebSocket chat, player list, dice rolling

### Backend Architecture

**Server Framework**: Express.js application serving both the REST API and static frontend assets. HTTP server with WebSocket support for real-time messaging.

**API Design**: RESTful endpoints:
- `POST /api/rooms` - Create a new game room
- `GET /api/rooms/:code` - Get room details and player list
- `POST /api/rooms/:code/join` - Join a room as a player
- `GET /api/rooms/:code/messages` - Get message history
- `POST /api/dice/roll` - Standalone dice rolling
- `WebSocket /ws?room={code}&player={name}` - Real-time chat

**AI Integration**: Integrates with xAI's Grok API using the OpenAI client library. Implements system prompts tailored to each game system (D&D 5e, Pathfinder 2e, Cyberpunk RED, Call of Cthulhu, Daggerheart, Custom). The AI responds to player messages, interprets dice rolls, and drives the narrative.

**Dice Mechanics**: Custom dice rolling engine supporting standard RPG notation (NdN+M format) with validation. Dice commands can be used in chat with `/roll 2d6+3` syntax.

**Game Systems Supported**:
- D&D 5th Edition (dnd5e)
- Pathfinder 2e (pathfinder)
- Cyberpunk RED (cyberpunk)
- Call of Cthulhu (coc)
- Daggerheart (daggerheart)
- Custom System (custom)

### Database Schema (Drizzle ORM)

**Schema Definition**: Uses Drizzle ORM with PostgreSQL dialect. Schema defined in `shared/schema.ts`.

**Key Entities**:
- **Rooms**: Game rooms with unique 6-character codes, name, game system, host name, message history (JSONB), and active status
- **Players**: Players in rooms with name and host flag
- **Dice Rolls**: Roll history with expression, individual rolls, modifier, total, and room/player associations

**Type Safety**: Leverages TypeScript with Zod schemas for compile-time and runtime validation.

### Build & Deployment

**Development Mode**: Vite dev server with HMR, runtime error overlay, and Replit-specific development tools.

**Production Build**: Two-step build process:
1. Vite builds client assets to `dist/public`
2. esbuild bundles server code to `dist/index.cjs`

## External Dependencies

### Third-Party Services

**xAI Grok API**: Primary AI service for generating Dungeon Master responses. Requires `XAI_API_KEY` environment variable. Uses OpenAI-compatible client pointed at `https://api.x.ai/v1`.

**PostgreSQL Database**: Uses Drizzle ORM for database operations via `DATABASE_URL` environment variable.

### Key Libraries

**UI & Styling**:
- Radix UI primitives for accessible component foundations
- Tailwind CSS for utility-first styling
- class-variance-authority for component variants

**Data & Forms**:
- React Hook Form with Zod resolvers
- TanStack Query for server state management

**Backend**:
- express for HTTP server
- ws for WebSocket support
- drizzle-orm for database ORM
- openai client library for xAI integration

**Development**:
- Vite with React plugin
- esbuild for server bundling
- tsx for TypeScript execution

## How to Use

1. **Host a Game**: Click "Host a Game" on the landing page, enter your name, game name, and select a game system
2. **Share the Code**: Copy the 6-character room code and share it with your players
3. **Join a Game**: Players click "Join a Game" and enter the room code with their name
4. **Play**: Chat with the AI Dungeon Master, use `/roll 2d6+3` for dice rolls, and enjoy your adventure!

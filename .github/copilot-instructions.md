# Copilot Instructions for Grok DM

> **Note**: This is a browser-based TTRPG platform powered by Grok AI, not a Discord bot.

## Project Overview

Grok DM is an AI-powered Dungeon Master platform for tabletop role-playing games (TTRPG). Players create or join game rooms directly in the browser, where Grok AI serves as an intelligent Dungeon Master that narrates stories, manages combat, interprets dice rolls, and brings adventures to life.

The system provides a real-time multiplayer TTRPG experience with support for D&D 5th Edition and Cyberpunk RED (and is designed to support multiple game systems), built-in dice rolling, and AI-driven narrative responses.

## Technology Stack

- **Frontend**: React 18 with TypeScript, Vite build tool
- **Backend**: Express.js with WebSocket support (ws library)
- **Database**: libSQL (Turso) with Drizzle ORM (SQLite dialect)
- **UI Components**: shadcn/ui (Radix UI primitives) with Tailwind CSS
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **AI Integration**: xAI Grok API using OpenAI client library
- **Forms**: React Hook Form with Zod validation

## Project Structure

```
/
├── client/          # Frontend React application
│   ├── src/
│   │   ├── pages/   # Landing and room pages
│   │   ├── components/ # Reusable React components
│   │   └── lib/     # Client utilities
│   └── index.html
├── server/          # Backend Express application
│   ├── index.ts     # Main server entry point
│   ├── routes.ts    # API routes
│   ├── grok.ts      # AI integration
│   ├── dice.ts      # Dice rolling engine
│   ├── db.ts        # Database connection
│   └── auth.ts      # Authentication logic
├── shared/          # Shared code between client and server
│   ├── schema.ts    # Database schema (Drizzle)
│   └── race-class-bonuses.ts # Game system data
├── migrations/      # Database migrations
└── script/          # Build scripts
```

## Coding Standards

### TypeScript

- Use strict TypeScript mode (enabled in tsconfig.json)
- Always define types explicitly for function parameters and return values
- Use Zod schemas for runtime validation
- Leverage path aliases: `@/*` for client code, `@shared/*` for shared code
- No `any` types unless absolutely necessary with proper justification

### React

- Use functional components with hooks
- Prefer `const` for component declarations
- Use TypeScript interfaces for component props
- Keep components focused and single-responsibility
- Use TanStack Query for server state management, not useState for API data

### Code Style

- Use ES6+ features (arrow functions, destructuring, spread operators)
- Use `const` and `let`, never `var`
- Prefer async/await over promise chains
- Use template literals for string interpolation
- No semicolons (project follows no-semicolon convention)

### Naming Conventions

- Components: PascalCase (e.g., `GameRoom.tsx`)
- Files: kebab-case for non-components (e.g., `dice-roller.ts`)
- Functions: camelCase (e.g., `rollDice`)
- Constants: UPPER_SNAKE_CASE for true constants (e.g., `MAX_PLAYERS`)
- Database tables: snake_case (e.g., `rooms`, `dice_rolls`, `inventory_items`)

## Design Guidelines

The project implements a Material Design foundation with fantasy/gaming aesthetic overlay. See `design_guidelines.md` for comprehensive design specifications including:

- Typography: Cinzel for headers, Inter for body, JetBrains Mono for stats
- Layout: Tailwind spacing primitives (2, 4, 6, 8, 12, 16)
- Components: shadcn/ui with custom theming
- Animations: Use sparingly, only for dice rolls and loading states

When adding new UI components:
- Use existing shadcn/ui components from `client/src/components/ui/`
- Follow the established design system in `design_guidelines.md`
- Ensure responsive design (mobile-first with Tailwind breakpoints)
- Maintain accessibility (keyboard navigation, ARIA labels)

## Development Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production (client + server)
- `npm start` - Run production build
- `npm run check` - Type check with TypeScript
- `npm run db:push` - Push database schema changes

## Database Schema

- Uses Drizzle ORM with Turso (libSQL/SQLite)
- Connection configured in `server/db.ts` using `@libsql/client`
- Schema defined in `shared/schema.ts` using PostgreSQL-compatible syntax (Drizzle handles dialect differences)
- Key entities: Rooms, Players, Dice Rolls, Characters, Items, Spells
- Use Drizzle's type-safe query builder, not raw SQL
- Always use transactions for multi-table operations
- Keep migrations in `migrations/` directory
- Environment variables: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`

## API Design

- RESTful endpoints under `/api/` prefix
- WebSocket connections for real-time features (chat, game updates)
- All API responses should include proper HTTP status codes
- Use Zod schemas for request validation
- Error responses should have consistent format: `{ error: string }`

## AI Integration

- xAI Grok API used for Dungeon Master responses
- System prompts tailored to each game system (D&D 5e, Pathfinder, etc.)
- Located in `server/grok.ts`
- Always handle API errors gracefully with fallback messages
- Rate limiting and error handling is critical

## Game Systems Supported

- D&D 5th Edition (dnd5e)
- Pathfinder 2e (pathfinder)
- Cyberpunk RED (cyberpunk)
- Call of Cthulhu (coc)
- Daggerheart (daggerheart)
- Custom System (custom)

When adding new game system features, ensure compatibility across all systems or make it system-specific with clear conditionals.

## Testing Guidelines

- Write tests for critical business logic (dice rolling, game state)
- Mock external dependencies (database, AI API)
- Use descriptive test names that explain the scenario
- Test error cases and edge cases, not just happy paths

## Common Tasks

### Adding a New API Endpoint

1. Define the route in `server/routes.ts`
2. Add Zod validation schema for request body
3. Implement handler function with proper error handling
4. Update type definitions if needed
5. Test with real requests

### Adding a New UI Component

1. Create component in `client/src/components/`
2. Follow shadcn/ui patterns if it's a UI primitive
3. Use Tailwind classes for styling
4. Ensure responsive design
5. Add TypeScript interface for props

### Modifying Database Schema

1. Update schema in `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update related TypeScript types
4. Test queries with new schema

## Security Considerations

- Never commit API keys or secrets (use environment variables)
- Validate and sanitize all user inputs
- Use parameterized queries (Drizzle ORM handles this)
- Implement rate limiting for API endpoints
- Sanitize AI-generated content before displaying

## Performance Best Practices

- Use React.memo for expensive components
- Implement proper loading states with Suspense
- Optimize database queries (use indexes, limit results)
- Use WebSocket for real-time features, not polling
- Lazy load routes and heavy components

## Communication Style

Prefer simple, everyday language in code comments and documentation. Avoid overly technical jargon when simpler terms work.

## Before Submitting Changes

- Run `npm run check` to verify TypeScript types
- Test the feature manually in the browser
- Ensure responsive design works on mobile
- Check that existing functionality still works
- Review database queries for performance
- Verify AI integration still works if modified

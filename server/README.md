# Server Setup Guide

This directory contains the backend Express server for Grok DM, including database operations, AI integration, and WebSocket handling for real-time gameplay.

## Database Setup

### Initial Setup

1. **Configure Environment Variables**
   
   Ensure the following environment variables are set (see `.env.example` in the project root):
   ```bash
   TURSO_DATABASE_URL=your_database_url
   TURSO_AUTH_TOKEN=your_auth_token
   ```

2. **Push Database Schema**
   
   Apply the database schema to your Turso database:
   ```bash
   npm run db:push
   ```

3. **Seed Starting Items** ⚠️ **Important**
   
   After initializing the database, you must seed the core D&D starting items that are granted to newly created characters:
   ```bash
   tsx server/seed-starting-items.ts
   ```
   
   This command is **idempotent** - you can run it multiple times safely. It will skip items that already exist.

   **Why is this necessary?**
   - When players create characters, the system automatically grants starting items based on their class (e.g., a Wizard gets a quarterstaff, component pouch, etc.)
   - These items reference the master `items` table via foreign keys
   - If these items don't exist in the database, character creation will fail with foreign key constraint errors

### Optional Seeds

- **Seed All Equipment** (comprehensive but slower):
  ```bash
  tsx server/seed-items.ts
  ```
  This fetches all equipment and magic items from the D&D 5e API. It takes longer but provides the complete item catalog.

- **Seed Spells**:
  ```bash
  tsx server/seed-spells.ts
  ```
  Populates the spells table with D&D 5e SRD spells for spellcasting classes.

## Development Workflow

### Starting the Development Server

```bash
npm run dev
```

This starts the server with hot module reloading (HMR) on port 5000 (default).

### Type Checking

```bash
npm run check
```

Validates TypeScript types across the entire codebase.

### Building for Production

```bash
npm run build
```

Compiles the application into the `dist/` directory.

### Running Production Build

```bash
npm start
```

## Database Operations

### Checking Database Schema

```bash
npm run db:check
```

### Generating Migrations

```bash
npm run db:generate
```

Creates migration files based on schema changes.

### Applying Migrations Manually

```bash
npm run db:migrate
```

## Common Issues

### Foreign Key Constraint Failures on Character Creation

**Symptom**: Error messages like `SQLITE_CONSTRAINT: SQLite error: FOREIGN KEY constraint failed` when creating characters.

**Solution**: Run the starting items seed:
```bash
tsx server/seed-starting-items.ts
```

This ensures all items referenced in `dndStartingItems` (in `server/routes.ts`) exist in the database.

### Database Connection Errors

**Symptom**: `LibsqlError: UNAUTHORIZED` or connection timeouts.

**Solution**: Verify your `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are correct and the database is accessible.

## Project Structure

```
server/
├── auth.ts                    # Authentication logic (Passport.js)
├── db.ts                      # Database connection (Turso/libSQL)
├── dice.ts                    # Dice rolling engine
├── grok.ts                    # AI integration (xAI Grok API)
├── index.ts                   # Main server entry point
├── routes.ts                  # API routes and WebSocket handlers
├── storage.ts                 # Database access layer (storage interface)
├── seed-items.ts              # Full equipment/magic items seed
├── seed-spells.ts             # Spells seed
├── seed-starting-items.ts     # Core starting items seed (⚠️ required)
├── objectStorage.ts           # Google Cloud Storage integration
├── objectAcl.ts               # Object storage ACL helpers
└── static.ts                  # Static file serving
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | Yes | Turso database connection URL |
| `TURSO_AUTH_TOKEN` | Yes | Turso authentication token |
| `XAI_API_KEY` | Yes | xAI Grok API key for AI DM responses |
| `SESSION_SECRET` | Yes | Random string for Express session encryption |
| `NODE_ENV` | No | `development` or `production` (default: development) |
| `PORT` | No | Server port (default: 5000) |
| `GCP_SERVICE_ACCOUNT_KEY` | No | Google Cloud Storage credentials (for file uploads) |

## Logging

The server uses structured console logging with contextual information:

```typescript
console.log('[module] Message', { key: 'value', ... });
console.error('[module] Error', { context: '...', error: err.message });
```

Key logging prefixes:
- `[addToSavedInventory]` - Inventory operations
- `[grantStartingItems]` - Character creation item grants
- `[WebSocket]` - Real-time connection events
- `[Auth]` - Authentication events

## Testing

Currently, there is no automated test suite. Manual testing is performed via:
1. Creating characters and verifying starting items
2. Testing API endpoints with curl/Postman
3. Verifying WebSocket connections in the browser

## Contributing

When making changes to the server:
1. Run `npm run check` to verify TypeScript types
2. Test manually in the browser
3. Ensure database operations use Drizzle ORM (no raw SQL)
4. Add structured logging for debugging
5. Update this README if adding new features or changing setup steps

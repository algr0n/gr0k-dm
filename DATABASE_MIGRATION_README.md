# Database Migration & Setup Guide

> **Complete guide for database setup, migrations, and schema management**

## Quick Start

### First-Time Setup

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your Turso credentials

# 2. Install dependencies
npm install

# 3. Push database schema (creates all tables)
npm run db:push

# 4. Seed data (optional but recommended)
npm run seed:items
npm run seed:spells
```

### Available Migration Commands

```bash
# Push schema directly (development - recommended)
npm run db:push

# Generate a new migration from schema changes
npm run db:generate

# Apply migrations to database (production)
npm run db:migrate
```

## Migration Workflow

### 1. Development Workflow (Schema Changes)

**Recommended approach for development:**

```bash
# 1. Edit shared/schema.ts with your changes
# 2. Push schema directly (idempotent, safe to run multiple times)
npm run db:push

# 3. Test your changes
npm run dev
```

**Alternative approach (if you need migration history):**

```bash
# 1. Edit shared/schema.ts with your changes
# 2. Generate migration SQL
npm run db:generate

# 3. Review the generated SQL in migrations/ directory
# 4. Test migration locally
export TURSO_DATABASE_URL="file:./test.db"
npm run db:migrate

# 5. Verify database schema
sqlite3 test.db ".schema"

# 6. Commit migration file
git add migrations/
git commit -m "Add migration for [feature]"
```

### 2. Production Deployment

For production, you can use either approach depending on your needs:

**Option A: Direct schema push (simpler, recommended for small projects)**
```bash
# Set production database URL
export TURSO_DATABASE_URL="libsql://your-db.turso.io"
export TURSO_AUTH_TOKEN="your-token"

# Push schema
npm run db:push

# Verify application starts correctly
npm start
```

**Option B: Migration-based (for teams with migration history requirements)**
```bash
# Set production database URL
export TURSO_DATABASE_URL="libsql://your-db.turso.io"
export TURSO_AUTH_TOKEN="your-token"

# Apply migrations
npm run db:migrate

# Verify application starts correctly
npm start
```

## Current Schema Status

✅ **Schema is complete and production-ready**

The database schema (`shared/schema.ts`) includes:
- **User authentication**: `users`, `sessions`
- **Game rooms**: `rooms`, `players`
- **Characters**: `unified_characters` (supports D&D 5e and Cyberpunk RED)
- **Inventory**: `character_inventory_items`, `items`
- **Spells**: `spells` (D&D 5e spell compendium)
- **Combat**: `character_status_effects`
- **Dice history**: `dice_rolls`

### Schema Migrations

The project has two migration files:
- `0000_secret_red_hulk.sql` - Initial complete schema
- `0001_add_password_hash_to_rooms.sql` - Password protection for rooms

All character creation, item management, and saved character persistence functionality is fully supported.

## Safety Guidelines

### ⚠️ Best Practices

1. **Always backup production data** before running migrations or schema changes
2. **Test schema changes locally first** using `TURSO_DATABASE_URL="file:./test.db"`
3. **Review generated SQL** when using `db:generate` before applying
4. **Use environment variables** for database credentials (never commit secrets)
5. **Keep `.env` files out of version control** (use `.env.example` for templates)

### Schema Push vs Migrations

**Use `db:push` (recommended for most cases):**
- ✅ Simple and fast
- ✅ Idempotent (safe to run multiple times)
- ✅ Perfect for solo developers or small teams
- ✅ No migration file management needed

**Use migrations (for advanced use cases):**
- ✅ Provides migration history
- ✅ Useful for teams needing audit trail
- ✅ Can be more careful with data transformations
- ❌ More complex to manage

## Database Helpers

Type-safe helper functions are available in `server/db/characters.ts`:

```typescript
import { 
  createCharacter,
  updateCharacter,
  getCharacter,
  getCharactersByUser,
  addItemToCharacter,
  getCharacterWithInventory,
  removeItemFromCharacter,
  deleteCharacter
} from './server/db/characters';

// Example: Create a new D&D character
const character = await createCharacter({
  userId: "user-123",
  characterName: "Thorin Oakenshield",
  race: "Dwarf",
  class: "Fighter",
  level: 1,
  gameSystem: "dnd",
  maxHp: 12,
  currentHp: 12,
  ac: 16,
  speed: 25,
  initiativeModifier: 1,
  stats: {
    strength: 16,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 11,
    charisma: 13
  },
  skills: ["Athletics", "Intimidation"]
});

// Add item to inventory
await addItemToCharacter(character.id, "longsword", 1);

// Get character with full inventory
const characterWithInventory = await getCharacterWithInventory(character.id);
```

See `server/storage.ts` for additional database operations.

## Troubleshooting

### Migration Fails

```bash
# 1. Check database connection
sqlite3 $TURSO_DATABASE_URL ".tables"

# 2. Check Turso auth token is set
echo $TURSO_AUTH_TOKEN | wc -c  # Should be > 0

# 3. Try pushing schema directly
npm run db:push

# 4. Check for detailed errors
npm run check  # TypeScript type checking
```

### Schema Out of Sync

```bash
# Development: Reset local database
rm -f dev.sqlite *.db
npm run db:push

# Production: Never reset - use migrations or restore from backup
# Contact your database administrator
```

### Type Errors

```bash
# Regenerate types from schema
npm run check

# If schema types are missing, ensure shared/schema.ts is valid
# Check for TypeScript errors in the schema file
```

### Table Missing Errors

If you see "no such table" errors:

1. **Verify environment variables are set:**
   ```bash
   echo $TURSO_DATABASE_URL
   echo $TURSO_AUTH_TOKEN
   ```

2. **Run schema push:**
   ```bash
   npm run db:push
   ```

3. **Verify tables exist:**
   ```bash
   # Using Turso CLI
   turso db shell your-db-name
   .tables
   ```

## Database Structure

### Main Tables

- **`users`** - User accounts and authentication
- **`sessions`** - User session storage
- **`unified_characters`** - User-owned characters (can join multiple rooms)
- **`character_inventory_items`** - Character inventory with item links
- **`items`** - Item definitions (weapons, armor, potions, etc.)
- **`spells`** - Spell definitions for D&D 5e
- **`rooms`** - Game sessions
- **`players`** - Players in game rooms
- **`dice_rolls`** - Dice roll history
- **`character_status_effects`** - Combat status effects

### Key Relationships

```
users → unified_characters (1:many)
unified_characters → character_inventory_items (1:many)
items ← character_inventory_items (many:1)
rooms → players (1:many)
unified_characters.currentRoomCode → rooms.code (optional)
```

## PostgreSQL to SQLite Migration Notes

This project migrated from PostgreSQL types to SQLite in December 2025. Key changes:

| PostgreSQL | SQLite | Notes |
|------------|--------|-------|
| `varchar(n)` | `text` | No length limit in SQLite |
| `jsonb` | `text` with `mode: 'json'` | JSON stored as text |
| `boolean` | `integer` with `mode: 'boolean'` | 0/1 values |
| `timestamp` | `integer` with `mode: 'timestamp'` | Unix epoch |
| `decimal(p,s)` | `real` | Floating point |

The schema is defined using Drizzle ORM's SQLite adapter (`drizzle-orm/sqlite-core`).

## Additional Resources

- **Database Schema**: `shared/schema.ts` - Complete type-safe schema definitions
- **Database Helpers**: `server/db/characters.ts` - Type-safe helper functions
- **Storage Module**: `server/storage.ts` - Database operation abstractions
- **Drizzle Kit Docs**: https://orm.drizzle.team/kit-docs/overview
- **Turso Docs**: https://docs.turso.tech/

## Support

If you encounter issues:
1. Check that environment variables are set correctly
2. Review error messages carefully
3. Verify database file permissions (for local files)
4. Check Turso dashboard for connection issues (for remote databases)
5. Review the schema in `shared/schema.ts`
6. Check existing issues on GitHub

---

**Last Updated**: December 2025  
**Schema Version**: 1.0 (SQLite/Turso)

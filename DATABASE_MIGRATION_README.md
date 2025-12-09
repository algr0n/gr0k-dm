# Database Migration Guide

## Quick Start

### Running Migrations Locally

```bash
# Set database URL to local test file
export TURSO_DATABASE_URL="file:./dev.sqlite.test"

# Install dependencies
npm ci

# Apply current schema (idempotent, safe to run multiple times)
npm run db:push
```

### Available Migration Commands

```bash
# Generate a new migration from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Push schema directly (development only, bypasses migrations)
npm run db:push
```

## Migration Workflow

### 1. Development Workflow (Schema Changes)

When you need to make schema changes:

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

**NEVER** use `db:push` in production. Always use migrations:

```bash
# 1. Set production database URL
export TURSO_DATABASE_URL="libsql://your-db.turso.io"
export TURSO_AUTH_TOKEN="your-token"

# 2. Apply migrations
npm run db:migrate

# 3. Verify application starts correctly
npm start
```

## Current Schema Status

✅ **Schema is complete and production-ready**

The existing migration `migrations/0000_secret_red_hulk.sql` contains the complete schema for:
- User authentication (`users`, `sessions`)
- Game rooms (`rooms`, `players`)
- Characters (`unified_characters`, `characters`)
- Inventory (`character_inventory_items`, `inventory_items`)
- Items and spells (`items`, `spells`)
- Status effects (`character_status_effects`)
- Dice rolls (`dice_rolls`)

All character creation, item management, and saved character persistence functionality is fully supported.

## Safety Guidelines

### ⚠️ CRITICAL: Do NOT

1. **Do NOT** run `db:push` in production - it bypasses migration history
2. **Do NOT** manually edit existing migration files
3. **Do NOT** delete migration files
4. **Do NOT** share database credentials in code
5. **Do NOT** commit `.env` files with credentials

### ✅ DO

1. **DO** use `db:generate` to create migrations from schema changes
2. **DO** review generated SQL before committing
3. **DO** test migrations on local/staging databases first
4. **DO** backup production database before migrating
5. **DO** use environment variables for database URLs

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

// Create a new character
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

## Troubleshooting

### Migration Fails

```bash
# 1. Check database connection
sqlite3 $TURSO_DATABASE_URL ".tables"

# 2. Check migration history
sqlite3 $TURSO_DATABASE_URL "SELECT * FROM __drizzle_migrations"

# 3. If using Turso, verify auth token
echo $TURSO_AUTH_TOKEN | wc -c  # Should be > 0
```

### Schema Out of Sync

```bash
# Development: Reset local database
rm -f dev.sqlite
npm run db:push

# Production: NEVER reset - use migrations or restore from backup
```

### Type Errors

```bash
# Regenerate types from schema
npm run check

# If schema types are missing, ensure shared/schema.ts is valid
```

## Database Structure

### Main Tables

- **`unified_characters`** - User-owned characters (can join multiple rooms)
- **`character_inventory_items`** - Character inventory with item links
- **`items`** - Item definitions (weapons, armor, potions, etc.)
- **`spells`** - Spell definitions for D&D 5e
- **`rooms`** - Game sessions
- **`players`** - Players in game rooms
- **`users`** - Authentication and profiles

### Key Relationships

```
users → unified_characters (1:many)
unified_characters → character_inventory_items (1:many)
items ← character_inventory_items (many:1)
rooms → players (1:many)
unified_characters.currentRoomCode → rooms.code (optional)
```

## Additional Resources

- **Full Migration Guide:** `MIGRATION_GUIDE_CHARACTER_PERSISTENCE.md`
- **Database Schema:** `shared/schema.ts`
- **Database Helpers:** `server/db/characters.ts`
- **Storage Module:** `server/storage.ts`
- **Drizzle Kit Docs:** https://orm.drizzle.team/kit-docs/overview

## Questions?

If you encounter issues:
1. Check environment variables are set correctly
2. Review error messages carefully
3. Verify database file permissions
4. Check Turso dashboard for connection issues
5. Refer to `MIGRATION_GUIDE_CHARACTER_PERSISTENCE.md` for detailed guidance

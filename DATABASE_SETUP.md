# Database Setup & Migration Guide

> Complete guide for database setup, migrations, and schema management in Grok DM

## Quick Start

### First-Time Setup

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your Turso credentials:
#   - TURSO_DATABASE_URL=libsql://your-database.turso.io
#   - TURSO_AUTH_TOKEN=your-turso-auth-token

# 2. Install dependencies
npm install

# 3. Push database schema (creates all tables)
npm run db:push

# 4. Seed data (optional but recommended for D&D 5e)
npm run seed:adventures  # Seeds Lost Mine of Phandelver & Dragon of Icespire Peak
```

## Database Technology

- **Database**: Turso (libSQL) - SQLite-compatible serverless database
- **ORM**: Drizzle ORM with SQLite dialect
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Stored in `migrations/` directory

## Available Commands

```bash
# Development (push schema directly - idempotent)
npm run db:push          # Push schema changes to database

# Production (use migrations)
npm run migrate:prod     # Apply all pending migrations (uses run-all-migrations.js)
node scripts/run-all-migrations.js  # Direct migration runner (idempotent, handles all SQL and JS migrations)
npm run db:generate      # Generate new migration from schema changes

# Seeding
npm run seed:adventures  # Seed adventure modules (Lost Mine, Dragon Peak)
```

## How Migrations Work

### Automatic Migration on Deployment

When you start the production server:

1. `npm start` runs (defined in `package.json`)
2. `npm run migrate:prod` executes first (runs `scripts/run-all-migrations.js`)
3. Migration script connects to database using environment variables
4. All pending migrations from `migrations/` directory are applied in order
5. If successful, server starts; if migrations fail, process exits with error

### Migration Files Structure

```
migrations/
├── 0000_secret_red_hulk.sql       # Initial schema
├── 0001_add_feature_x.sql         # Feature addition
├── 0002_adventure_system.sql      # Adventure module system
└── meta/
    ├── 0000_snapshot.json         # Schema snapshot
    ├── 0001_snapshot.json
    └── _journal.json              # Migration history
```

## Development Workflow

### Making Schema Changes

**Recommended approach for development:**

```bash
# 1. Edit shared/schema.ts with your changes
# 2. Push schema directly (fast, idempotent)
npm run db:push

# 3. Test your changes
npm run dev
```

**For production or team environments (preserves history):**

```bash
# 1. Edit shared/schema.ts with your changes
# 2. Generate migration SQL
npm run db:generate

# 3. Review the generated SQL in migrations/ directory
# 4. Commit the migration file
git add migrations/
git commit -m "feat: add new feature to schema"

# 5. Apply migration
npm run migrate:prod
```

## Schema Organization

The database schema is organized into logical groups:

### Core Tables
- `sessions` - Express session storage
- `users` - User accounts and profiles
- `rooms` - Game rooms with message history

### Character System
- `unifiedCharacters` - Player characters (persistent across games)
- `characterInventoryItems` - Character-owned items
- `characterStatusEffects` - Active status effects

### Game Content
- `items` - Master item compendium (D&D 5e SRD)
- `spells` - Master spell compendium (D&D 5e SRD)

### Adventure System
- `adventures` - Adventure module metadata
- `adventureChapters` - Story chapters
- `adventureLocations` - Dungeons, towns, wilderness areas
- `adventureEncounters` - Combat, traps, puzzles
- `adventureNpcs` - Named NPCs with personalities
- `adventureQuests` - Quests/objectives
- `roomAdventureProgress` - Per-room progress tracking

### Legacy Tables (Deprecated)
- `players` - Being migrated to unified characters
- `characters` - Room-specific characters (deprecated)
- `inventoryItems` - Room character inventory (deprecated)

## Common Tasks

### Adding a New Table

1. Edit `shared/schema.ts`:
   ```typescript
   export const myNewTable = sqliteTable("my_new_table", {
     id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
     name: text("name").notNull(),
     createdAt: integer("created_at", { mode: "timestamp" })
       .notNull()
       .$defaultFn(() => new Date()),
   });
   ```

2. Push to database:
   ```bash
   npm run db:push
   ```

### Adding a Column to Existing Table

1. Edit the table definition in `shared/schema.ts`:
   ```typescript
   export const rooms = sqliteTable("rooms", {
     // ... existing columns
     newField: text("new_field"), // Add your new field
   });
   ```

2. Generate migration (production):
   ```bash
   npm run db:generate
   ```
   
   Or push directly (development):
   ```bash
   npm run db:push
   ```

### Renaming a Column

⚠️ **Warning**: SQLite doesn't support column renaming directly. You must:

1. Create new column
2. Copy data from old column
3. Drop old column

Or use Drizzle's migration system which handles this automatically.

## Troubleshooting

### "Failed to push schema" errors

**Cause**: Schema changes conflict with existing data or constraints.

**Solution**:
1. Review the error message carefully
2. Check for foreign key constraints
3. Ensure data types are compatible
4. Consider backing up data and recreating the table

### "Migration already applied" errors

**Cause**: Migration tracking is out of sync.

**Solution**:
```bash
# Check migration journal
cat migrations/meta/_journal.json

# If needed, manually update journal or re-push schema
npm run db:push
```

### Connection errors

**Cause**: Environment variables not set or incorrect.

**Solution**:
1. Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env`
2. Test connection with Turso CLI:
   ```bash
   turso db shell <database-name>
   ```

### Type errors after schema changes

**Cause**: TypeScript types not regenerated.

**Solution**:
```bash
# Regenerate types
npm run check

# If issues persist, restart TypeScript server in your editor
```

## Best Practices

1. **Always backup before major migrations** - Use Turso's backup features
2. **Test migrations locally first** - Use a test database
3. **Keep migrations small and focused** - One logical change per migration
4. **Use descriptive migration names** - Make them searchable
5. **Document breaking changes** - Add comments in migration SQL
6. **Commit migrations to git** - Track schema changes with code
7. **Use transactions** - Wrap multiple operations in transactions

## Production Deployment Checklist

- [ ] Environment variables configured (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)
- [ ] Database created in Turso dashboard
- [ ] All migrations applied (`npm run migrate:prod`)
- [ ] Seed data loaded if needed
- [ ] Connection tested
- [ ] Backup strategy in place

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Turso Documentation](https://docs.turso.tech/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Project Schema Reference](shared/schema.ts)

---

**Last Updated**: December 24, 2024  
**For questions or issues**: See [GitHub Issues](https://github.com/algr0n/gr0k-dm/issues)

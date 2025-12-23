# Database Migrations Guide

This document explains how the automatic database migration system works in Grok DM.

## Overview

Grok DM uses **Drizzle ORM** with **Turso (libSQL)** for database management. The application automatically applies pending migrations before the server starts, ensuring the database schema is always up to date.

## How It Works

### Automatic Migration on Deployment

When you deploy the application or start the production server:

1. **`npm start`** runs (defined in `package.json`)
2. **`npm run migrate:prod`** executes first (runs `script/run-migrations.ts`)
3. Migration script connects to the database using environment variables
4. All pending migrations from `migrations/` directory are applied in order
5. If successful, the server starts; if migrations fail, the process exits with an error

### Migration Files

Migrations are stored as SQL files in the `migrations/` directory:

```
migrations/
├── 0000_secret_red_hulk.sql       # Initial schema
├── 0001_add_password_hash_to_rooms.sql  # Adds password_hash column
└── meta/
    ├── 0000_snapshot.json         # Schema snapshot
    └── _journal.json              # Migration history
```

Each migration file:
- Has a sequential number prefix (`0000_`, `0001_`, etc.)
- Contains raw SQL statements
- Is tracked in `meta/_journal.json`

## Creating New Migrations

### Method 1: Using Drizzle Kit (Recommended)

1. **Edit the schema** in `shared/schema.ts`:
   ```typescript
   export const rooms = sqliteTable("rooms", {
     // ... existing fields
     newField: text("new_field"), // Add your new field
   });
   ```

2. **Generate the migration**:
   ```bash
   npm run db:generate
   ```

3. **Review the generated SQL** in `migrations/000X_descriptive_name.sql`

4. **Test locally** (optional but recommended):
   ```bash
   # Use a local test database
   export TURSO_DATABASE_URL="file:./test.db"
   npm run migrate:prod
   ```

5. **Commit the migration files**:
   ```bash
   git add migrations/
   git commit -m "Add migration: descriptive name"
   ```

6. **Deploy**: The migration runs automatically on deployment

### Method 2: Manual SQL Migration

If you need to write custom SQL:

1. **Create a new migration file** in `migrations/`:
   ```bash
   # Example: 0002_add_user_roles.sql
   touch migrations/0002_add_user_roles.sql
   ```

2. **Write your SQL**:
   ```sql
   -- Add a role column to users table
   ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'player';
   
   -- Create an index
   CREATE INDEX idx_users_role ON users(role);
   ```

3. **Update `meta/_journal.json`** (increment idx, add new entry):
   ```json
   {
     "idx": 2,
     "version": "6",
     "when": 1734912000000,
     "tag": "0002_add_user_roles",
     "breakpoints": true
   }
   ```

4. **Test and commit** as described above

## Running Migrations

### Production (Automatic)

Migrations run automatically when you start the server:

```bash
npm start
```

Output:
```
🔄 Starting database migrations...
📍 Database: libsql://your-db.turso.io...
📂 Applying migrations from ./migrations directory...
✅ All migrations applied successfully!
🎉 Database is up to date
```

### Manual Execution

You can also run migrations manually:

```bash
npm run migrate:prod
```

### Development

During development, you can push schema changes directly without creating migration files:

```bash
npm run db:push
```

This is faster for iterative development but doesn't create a migration history.

## Environment Variables

The migration system requires these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | Yes | Database connection URL (e.g., `libsql://your-db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Yes (for remote) | Authentication token for Turso database |

### Setting Environment Variables

**Local development** (`.env` file):
```bash
TURSO_DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your-token-here"
```

**Production** (Render, Heroku, etc.):
Set these in your hosting platform's environment variable settings.

## Idempotency

The migration system is **idempotent**, meaning it's safe to run multiple times:

- Drizzle tracks which migrations have been applied
- Already-applied migrations are skipped
- Only new migrations are executed
- No risk of duplicate operations

## Troubleshooting

### Migration Fails: "no such table"

**Cause**: This is normal for a brand new database.

**Solution**: The initial migration will create all tables. Just run again:
```bash
npm run migrate:prod
```

### Migration Fails: "authentication" or "token" error

**Cause**: Invalid or expired `TURSO_AUTH_TOKEN`.

**Solution**: 
1. Generate a new token from Turso dashboard
2. Update your environment variables
3. Retry the migration

### Migration Fails: "column already exists"

**Cause**: Migration was partially applied or run manually before.

**Solution**: 
1. Check the database schema to see what's already there:
   ```bash
   npm run db:check
   ```
2. If the column exists and is correct, you can safely ignore this error
3. If you need to fix it, manually adjust the database or create a new migration

### Migration Hangs or Times Out

**Cause**: Network issues or database is locked.

**Solution**:
1. Check your internet connection
2. Verify `TURSO_DATABASE_URL` is correct
3. Check Turso dashboard for any database issues
4. Try again after a few minutes

### "SQLITE_UNKNOWN: table rooms has no column named password_hash"

**Cause**: The `0001_add_password_hash_to_rooms.sql` migration hasn't been applied.

**Solution**: 
```bash
npm run migrate:prod
```

This will apply the missing migration.

## Migration Best Practices

### ✅ DO

- **Always test locally first** with a test database
- **Review generated SQL** before committing
- **Make migrations backward compatible** when possible
- **Use transactions** for complex multi-step migrations
- **Keep migrations small and focused** (one logical change per migration)
- **Commit migration files** along with schema changes
- **Document breaking changes** in commit messages

### ❌ DON'T

- **Don't edit applied migrations** (create a new migration instead)
- **Don't skip migrations** (run them in order)
- **Don't delete migration files** (they're part of the history)
- **Don't manually modify the database** in production (use migrations)
- **Don't commit sensitive data** in migrations

## Advanced Topics

### Rolling Back Migrations

Drizzle doesn't support automatic rollbacks. To undo a migration:

1. Create a new migration that reverses the changes
2. Test thoroughly before applying to production

Example:
```sql
-- If 0003 added a column, create 0004 to remove it:
ALTER TABLE users DROP COLUMN role;
```

### Data Migrations

For migrations that transform data (not just schema):

```sql
-- Example: Normalize data
UPDATE rooms SET game_system = 'dnd' WHERE game_system IS NULL;
UPDATE rooms SET game_system = 'cyberpunk' WHERE game_system = 'cp';
```

Always include a WHERE clause to prevent accidental full-table updates.

### Zero-Downtime Migrations

For large databases, follow this pattern:

1. **Add the new column** (nullable):
   ```sql
   ALTER TABLE users ADD COLUMN email TEXT;
   ```

2. **Backfill data** in a separate migration:
   ```sql
   UPDATE users SET email = username || '@example.com' WHERE email IS NULL;
   ```

3. **Make it required** in another migration:
   ```sql
   -- SQLite doesn't support ALTER COLUMN, so this would require recreating the table
   -- or using application-level validation
   ```

## Schema Management Strategy

Grok DM uses a **migration-first** approach:

1. **Source of truth**: `shared/schema.ts` (TypeScript schema definition)
2. **Migration generation**: `npm run db:generate` creates SQL migrations
3. **Application**: Migrations applied automatically on deployment
4. **Verification**: `npm run db:check` confirms schema is correct

This ensures:
- Type safety in application code
- Reproducible database setup
- Clear audit trail of changes
- Safe deployments

## Related Files

- **`script/run-migrations.ts`** - Migration runner (this runs automatically)
- **`shared/schema.ts`** - Source of truth for database schema
- **`drizzle.config.ts`** - Drizzle configuration
- **`server/db.ts`** - Database connection setup
- **`package.json`** - Scripts for migration commands

## Getting Help

If you encounter issues:

1. **Check logs**: Look for detailed error messages
2. **Verify environment**: Ensure all env variables are set correctly
3. **Test connection**: Run `npm run db:check` to verify database connectivity
4. **Review schema**: Compare `shared/schema.ts` with actual database tables
5. **Check documentation**: See `DATABASE_MIGRATION_README.md` for detailed setup
6. **Create an issue**: If all else fails, open a GitHub issue with:
   - Error message
   - Migration files involved
   - Environment (local/production)
   - Steps to reproduce

## References

- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [Turso Documentation](https://docs.turso.tech/)
- [SQLite SQL Reference](https://www.sqlite.org/lang.html)

---

**Last Updated**: December 2024  
**Migration System Version**: 1.0

# Database Migration Instructions for Production

## Problem

You're seeing errors like:
- `SQLITE_UNKNOWN: SQLite error: no such table: items`
- `Error fetching inventory: LibsqlError: SQLITE_UNKNOWN: SQLite error: no such table: items`

This means your production database schema is out of sync with the application code.

## Quick Fix

The fastest way to fix this is to run the database migration script:

```bash
# Make sure you have your Turso credentials
export TURSO_DATABASE_URL="your_turso_database_url"
export TURSO_AUTH_TOKEN="your_turso_auth_token"

# Run the migration
npm run db:migrate-prod
```

This will apply all database schema changes to your production database.

## Detailed Solutions

### Option 1: Automated Migration Script (Recommended)

1. **Ensure environment variables are set**:
   - `TURSO_DATABASE_URL` - Your Turso database URL
   - `TURSO_AUTH_TOKEN` - Your Turso authentication token

2. **Run the migration**:
   ```bash
   npm install  # Make sure dependencies are installed
   npm run db:migrate-prod
   ```

   The script will:
   - Connect to your Turso database
   - Apply the schema from `shared/schema.ts`
   - Create all missing tables

### Option 2: Use Drizzle Kit Directly

```bash
npm run db:push
```

This pushes the current schema directly to the database. It's safe to run multiple times (idempotent).

### Option 3: Add to Render Build Process

To ensure migrations run automatically on every deployment:

1. Go to your Render dashboard
2. Select your web service  
3. Go to "Settings"
4. Update the **Build Command** to:
   ```bash
   npm install && npm run db:migrate-prod && npm run build
   ```
5. Save and trigger a redeploy

### Option 4: Manual SQL Execution

If automated methods don't work, you can apply the SQL manually:

1. Find the migration file: `migrations/0000_secret_red_hulk.sql`
2. Use the Turso CLI or web interface to execute the SQL
3. Or use drizzle-kit studio: `npx drizzle-kit studio`

## Verifying the Migration

After migration, verify tables exist:

**Quick Check:**
```bash
npm run db:check
```

This will connect to your database and verify all required tables are present.

**Option B: Check via code**
```typescript
// In a test script or console
import { db } from './server/db';
import { items, spells, rooms } from '@shared/schema';

const testItems = await db.select().from(items).limit(1);
console.log('Items table exists:', testItems !== undefined);
```

**Option C: Use Turso CLI**
```bash
turso db shell your-database-name
.tables
```

You should see these tables:
- `items` ✓
- `spells` ✓
- `unified_characters` ✓
- `character_inventory_items` ✓
- `character_status_effects` ✓
- `rooms` ✓
- `players` ✓
- `users` ✓
- `sessions` ✓

## Room Creation Validation Error

If you're also seeing `POST /api/rooms 400 - {"error":"Invalid room data"}`, this is now fixed with better error messages. The error will now show:
- What field failed validation
- Why it failed

Common causes:
- Missing required field (name, hostName)
- Invalid game system value
- Invalid boolean values for isPublic/isActive

## Troubleshooting

### Error: "drizzle-kit: not found"

Install dependencies:
```bash
npm install
```

### Error: "TURSO_DATABASE_URL is not set"

Set your environment variables:
```bash
export TURSO_DATABASE_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-token-here"
```

### Still Getting "no such table" Errors

1. **Verify you're connected to the right database**
   - Check the `TURSO_DATABASE_URL` value
   - Ensure it matches your production database

2. **Clear any cached connections**
   - Restart your application server after migration

3. **Check migration actually ran**
   - Look for success message: "✓ Database migration completed successfully!"
   - Verify tables exist using methods above

### Migration Hangs or Times Out

- Check your network connectivity
- Verify Turso is accessible (not blocked by firewall)
- Try running with more verbose logging:
  ```bash
  DEBUG=* npm run db:migrate-prod
  ```

## Prevention: Automating Migrations

To prevent this issue in the future, add migration to your deployment process:

**For Render:**
Build Command: `npm install && npm run db:migrate-prod && npm run build`

**For other platforms:**
Add a pre-start or post-build hook that runs `npm run db:migrate-prod`

## Critical Fix: Missing password_hash Column (December 2024)

### Problem
Production database is missing the `rooms.password_hash` column, causing errors:
- `"no such column: rooms.password_hash"`
- `"table rooms has no column named password_hash"`

### Immediate Remediation

**Option 1: Run Migration Script (Recommended)**

```bash
# Set your production database credentials
export TURSO_DATABASE_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-token-here"

# Run the migration
npm run db:migrate-prod
```

This will apply migration `0001_add_room_password_hash.sql` which adds the missing column.

**Option 2: Manual SQL (If automated method fails)**

Connect to your Turso database and run:

```sql
-- Add password_hash column (safe - nullable column won't affect existing data)
ALTER TABLE rooms ADD COLUMN password_hash TEXT;

-- Set default visibility for existing rooms
UPDATE rooms SET is_public = 1 WHERE is_public = 0;
```

### Prevention: Auto-run Migrations on Deploy

To prevent schema drift in the future, configure your deployment platform to run migrations automatically.

**Render.com Build Command:**

```bash
npm install && npm run db:migrate-prod && npm run build
```

This ensures:
1. Dependencies are installed
2. Database migrations are applied
3. Application is built

**Other Platforms:**

Add migration step to your deployment pipeline before starting the application:
- **Heroku**: Add to `release` phase in Procfile
- **Vercel**: Add to build command or use build hooks
- **Docker**: Run migrations in entrypoint script before starting server

### Verification

After applying the migration, verify the column exists:

```bash
# Using Turso CLI
turso db shell your-database-name
.schema rooms
```

You should see `password_hash TEXT` in the rooms table definition.

### Migration Details

- **File**: `migrations/0001_add_room_password_hash.sql`
- **Changes**: Adds nullable `password_hash` column to `rooms` table
- **Safety**: Fully backward compatible, won't affect existing data
- **Idempotent**: Safe to run multiple times

## Need More Help?

If you continue having issues:
1. Share the full error output from running `npm run db:migrate-prod`
2. Verify your Turso database credentials are correct
3. Check if you can connect to Turso from your deployment environment
4. Review the migration SQL file to ensure it's valid

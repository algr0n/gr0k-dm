# Bestiary Import Guide

This guide explains how to safely import the D&D 5e monster bestiary into your Turso database.

## Overview

The bestiary system uses namespaced tables (prefixed with `bestiary_`) to store monster data from `ref/monster_stats.json`. This includes:

- **bestiary_monsters**: Main monster table with stats and metadata
- **bestiary_traits**: Monster traits and special abilities
- **bestiary_actions**: Monster actions and attacks
- **bestiary_action_rays**: Multi-ray attacks (e.g., Beholder eye rays)
- **bestiary_legendary_actions**: Legendary action options
- **bestiary_fts**: Full-text search virtual table (FTS5)

## Prerequisites

1. **Turso Database**: You need a Turso database instance
2. **Environment Variables**: Required variables must be set:
   - `TURSO_DATABASE_URL`: Your Turso database URL
   - `TURSO_AUTH_TOKEN`: Your Turso authentication token

## Step 1: Backup Your Database

**Important**: Always backup before running migrations or imports.

### Option A: Turso CLI Export

If you have the Turso CLI installed:

```bash
# Export entire database to SQL file
turso db shell <your-database> .dump > backup_$(date +%Y%m%d_%H%M%S).sql

# Or export specific tables
turso db shell <your-database> ".output backup.sql" ".dump bestiary_monsters"
```

### Option B: Manual Snapshot

```bash
# Create a snapshot using Turso CLI
turso db snapshot create <your-database> backup-before-bestiary-import
```

### Option C: Export via API

You can also use the Turso API to create a backup programmatically if needed.

## Step 2: Run the Migration

The migration file `migrations/001_add_bestiary.sql` creates all necessary tables and indexes.

### Option A: Using Turso CLI

```bash
# Navigate to project root
cd /path/to/gr0k-dm

# Run the migration
turso db shell $TURSO_DATABASE_URL < migrations/001_add_bestiary.sql
```

### Option B: Using the Import Script

The import script will automatically handle migrations if tables don't exist, but it's safer to run the migration explicitly first.

### Option C: Manual Execution

Copy the contents of `migrations/001_add_bestiary.sql` and execute in the Turso console:

```bash
turso db shell <your-database>
# Paste SQL statements
```

### Verify Migration Success

```bash
turso db shell <your-database>

# Check that tables exist
.tables

# Should see:
# bestiary_monsters
# bestiary_traits
# bestiary_actions
# bestiary_action_rays
# bestiary_legendary_actions
# bestiary_fts
```

## Step 3: Run the Import Script

The import script reads `ref/monster_stats.json` and populates the bestiary tables.

### Set Environment Variables

Create or update your `.env` file:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
BATCH_SIZE=10  # Optional: monsters per batch (default: 10)
```

Or export them directly:

```bash
export TURSO_DATABASE_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-auth-token-here"
export BATCH_SIZE=10
```

### Run the Import

```bash
# From project root
node scripts/import_bestiary_turso.js
```

### Expected Output

```
🐉 Starting Bestiary Import
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Found 199 monsters to import
🔄 Batch size: 10

📦 Processing batch 1/20 (10 monsters)
   ✅ Aarakocra
   ✅ Aboleth
   ✅ Adult Black Dragon
   ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Import Summary
   ✅ Successful: 199
   ❌ Failed: 0

🎉 Import complete!
```

### Import Options

- **BATCH_SIZE**: Control how many monsters are processed at once (default: 10)
  - Lower values = slower but safer
  - Higher values = faster but may timeout on slow connections

```bash
BATCH_SIZE=5 node scripts/import_bestiary_turso.js
```

## Step 4: Verify the Import

Run these queries to confirm the import succeeded:

### Check monster count

```bash
turso db shell <your-database>
```

```sql
-- Count total monsters
SELECT COUNT(*) FROM bestiary_monsters;
-- Expected: 199

-- Check a specific monster exists
SELECT * FROM bestiary_monsters WHERE name = 'Beholder' LIMIT 1;
```

### Check related data

```sql
-- Count traits
SELECT COUNT(*) FROM bestiary_traits;

-- Count actions
SELECT COUNT(*) FROM bestiary_actions;

-- Count action rays (Beholder should have 10)
SELECT COUNT(*) FROM bestiary_action_rays
WHERE action_id IN (
  SELECT ba.id FROM bestiary_actions ba
  JOIN bestiary_monsters bm ON ba.monster_id = bm.id
  WHERE bm.name = 'Beholder'
);

-- Count legendary actions
SELECT COUNT(*) FROM bestiary_legendary_actions;
```

### Test queries

```sql
-- Get a complete monster with all data
SELECT 
  m.name,
  m.size,
  m.type,
  m.cr_decimal,
  m.hp_avg,
  COUNT(DISTINCT t.id) as trait_count,
  COUNT(DISTINCT a.id) as action_count,
  COUNT(DISTINCT la.id) as legendary_action_count
FROM bestiary_monsters m
LEFT JOIN bestiary_traits t ON t.monster_id = m.id
LEFT JOIN bestiary_actions a ON a.monster_id = m.id
LEFT JOIN bestiary_legendary_actions la ON la.monster_id = m.id
WHERE m.name = 'Beholder'
GROUP BY m.id;
```

## Troubleshooting

### Error: "no such table: bestiary_monsters"

**Solution**: Run the migration first (Step 2)

### Error: "UNIQUE constraint failed: bestiary_monsters.name"

**Solution**: This is expected for re-imports. The script uses UPSERT to update existing monsters.

### Error: "no such table: bestiary_fts"

**Solution**: FTS5 might not be available in your SQLite build. The script handles this gracefully and skips FTS updates.

### Import is slow or timing out

**Solutions**:
- Reduce BATCH_SIZE: `BATCH_SIZE=5 node scripts/import_bestiary_turso.js`
- Check your network connection to Turso
- Run during off-peak hours if on a shared connection

### Partial import (some monsters failed)

**Solution**: The script will report which monsters failed. You can:
1. Fix the data in `ref/monster_stats.json`
2. Re-run the import (it will update existing monsters)

## Re-importing / Updating

The import script is **idempotent** - you can run it multiple times safely:

- Existing monsters are **updated** with new data
- Child records (traits, actions, etc.) are **deleted and recreated**
- No data loss for unrelated tables

```bash
# Safe to re-run
node scripts/import_bestiary_turso.js
```

## Rollback / Cleanup

If you need to remove the bestiary data:

### Remove all bestiary data (keep tables)

```sql
DELETE FROM bestiary_action_rays;
DELETE FROM bestiary_actions;
DELETE FROM bestiary_traits;
DELETE FROM bestiary_legendary_actions;
DELETE FROM bestiary_monsters;
DELETE FROM bestiary_fts;
```

### Remove tables completely

```sql
DROP TABLE IF EXISTS bestiary_action_rays;
DROP TABLE IF EXISTS bestiary_actions;
DROP TABLE IF EXISTS bestiary_traits;
DROP TABLE IF EXISTS bestiary_legendary_actions;
DROP TABLE IF EXISTS bestiary_fts;
DROP TABLE IF EXISTS bestiary_monsters;
```

### Restore from backup

```bash
# From SQL dump
turso db shell <your-database> < backup_20240101_120000.sql

# Or restore from snapshot
turso db snapshot restore <your-database> <snapshot-name>
```

## Example Verification Queries

```sql
-- List all dragons by CR
SELECT name, cr_decimal, hp_avg 
FROM bestiary_monsters 
WHERE type = 'dragon' 
ORDER BY cr_decimal DESC;

-- Get the most powerful monsters
SELECT name, type, cr_decimal 
FROM bestiary_monsters 
ORDER BY cr_decimal DESC 
LIMIT 10;

-- Find monsters with legendary actions
SELECT m.name, m.cr_decimal, COUNT(la.id) as legendary_count
FROM bestiary_monsters m
JOIN bestiary_legendary_actions la ON la.monster_id = m.id
GROUP BY m.id
ORDER BY m.cr_decimal DESC;

-- Search for specific abilities (if FTS5 is enabled)
SELECT DISTINCT bm.name, bm.type, bm.cr_decimal
FROM bestiary_fts bf
JOIN bestiary_monsters bm ON bm.id = bf.monster_id
WHERE bestiary_fts MATCH 'fire immunity'
ORDER BY bm.cr_decimal DESC;
```

## Additional Notes

### Safety Features

1. **Non-destructive**: Migration uses `CREATE TABLE IF NOT EXISTS`
2. **Namespaced**: All tables prefixed with `bestiary_` to avoid conflicts
3. **Transactional**: Each monster import is wrapped in a transaction
4. **Foreign Keys**: Enabled with `PRAGMA foreign_keys = ON`
5. **Cascade Deletes**: Child records auto-delete when monster is removed

### Performance

- **Indexes**: Created on name, type, cr_decimal, and size
- **FTS5**: Optional full-text search for fast text queries
- **Batch Processing**: Reduces memory usage and connection timeouts

### Data Integrity

- **UPSERT**: Updates existing monsters instead of failing
- **Raw JSON**: Original monster data preserved in `raw_json` column
- **Validation**: Script validates CR parsing, HP extraction, and speed parsing

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the script output for error messages
3. Verify environment variables are set correctly
4. Ensure Turso database is accessible and has proper permissions

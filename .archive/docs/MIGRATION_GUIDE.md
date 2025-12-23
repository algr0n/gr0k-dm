# Database Migration Guide: PostgreSQL to SQLite (Turso)

## Overview

This guide documents the migration from PostgreSQL types to SQLite-compatible types for the Grok DM database schema. The application now uses Turso (libSQL), a SQLite-compatible serverless database.

## Changes Made

### 1. Schema Type Conversions

#### Table Definitions
- **Old**: `pgTable` from `drizzle-orm/pg-core`
- **New**: `sqliteTable` from `drizzle-orm/sqlite-core`

#### Enums
- **Old**: `pgEnum` for categories like `item_category`, `item_rarity`, `spell_school`
- **New**: TypeScript const arrays with Zod validation schemas
  ```typescript
  export const itemCategories = ["weapon", "armor", ...] as const;
  export const itemCategorySchema = z.enum(itemCategories);
  export type ItemCategory = z.infer<typeof itemCategorySchema>;
  ```

#### Data Types

| PostgreSQL Type | SQLite Type | Notes |
|----------------|-------------|-------|
| `varchar(n)` | `text` | SQLite has no length limit |
| `jsonb` | `text` with `mode: 'json'` | JSON stored as text |
| `boolean` | `integer` with `mode: 'boolean'` | 0/1 values |
| `timestamp` | `integer` with `mode: 'timestamp'` | Unix epoch in seconds |
| `decimal(p,s)` | `real` | Floating point |
| `gen_random_uuid()` | `lower(hex(randomblob(16)))` | UUID generation |
| `now()` | `unixepoch()` | Current timestamp |

### 2. Default Values

#### Old (PostgreSQL)
```typescript
createdAt: timestamp("created_at").defaultNow()
```

#### New (SQLite)
```typescript
createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`)
```

### 3. JSON Fields

#### Old (PostgreSQL)
```typescript
messageHistory: jsonb("message_history").$type<Message[]>().default([])
```

#### New (SQLite)
```typescript
messageHistory: text("message_history", { mode: 'json' }).$type<Message[]>().default(sql`'[]'`)
```

### 4. Array Fields

#### Old (PostgreSQL)
```typescript
skills: text("skills").array().default([])
```

#### New (SQLite)
```typescript
skills: text("skills", { mode: 'json' }).$type<string[]>().default(sql`'[]'`)
```

## Migration Steps

### For New Deployments

1. Set up Turso database:
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # Create database
   turso db create grok-dm
   
   # Get connection URL and token
   turso db show grok-dm --url
   turso db tokens create grok-dm
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Turso credentials
   ```

3. Run migrations:
   ```bash
   npm run db:push
   ```

4. Seed data (items and spells):
   ```bash
   npm run seed:items
   npm run seed:spells
   ```

### For Existing PostgreSQL Deployments

⚠️ **Warning**: This is a breaking change requiring data migration.

#### Option 1: Fresh Start (Recommended for Development)

1. Create new Turso database as above
2. Run migrations
3. Re-seed data
4. Users will need to recreate accounts and characters

#### Option 2: Data Migration (For Production)

1. Export existing PostgreSQL data:
   ```bash
   pg_dump -h localhost -U user -d grok_dm --data-only --inserts > data_backup.sql
   ```

2. Transform SQL for SQLite compatibility:
   - Convert timestamps to Unix epoch integers
   - Convert booleans to 0/1 integers
   - Convert JSONB to JSON text strings
   - Update enum values to text strings

3. Import into Turso:
   ```bash
   turso db shell grok-dm < transformed_data.sql
   ```

## Code Changes Required

### 1. Import Statements

**Before:**
```typescript
import { pgTable, pgEnum, ... } from "drizzle-orm/pg-core";
import { itemCategoryEnum } from "@shared/schema";
```

**After:**
```typescript
import { sqliteTable, ... } from "drizzle-orm/sqlite-core";
import { itemCategories } from "@shared/schema";
```

### 2. Drizzle Config

**drizzle.config.ts:**
```typescript
export default {
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

### 3. Database Connection

**server/db.ts:**
```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });
```

## Benefits of SQLite/Turso

1. **Serverless**: No database server to manage
2. **Cost Effective**: Free tier for development, pay-as-you-go for production
3. **Edge Deployments**: Replicate database to edge locations
4. **Simple Backups**: Single file database
5. **ACID Compliance**: Full transaction support
6. **Fast Reads**: Optimized for read-heavy workloads

## Known Limitations

1. **No Native Arrays**: Arrays stored as JSON strings
2. **No Native Enums**: Enums stored as text with runtime validation
3. **Integer Timestamps**: JavaScript Date objects need conversion
4. **Limited Concurrent Writes**: SQLite write bottleneck (mitigated by Turso)

## Testing

After migration, test these critical paths:

- [ ] User registration and login
- [ ] Character creation and management
- [ ] Room creation and joining
- [ ] Chat and dice rolling
- [ ] Inventory and spell management
- [ ] Combat system

## Rollback Plan

If issues occur, rollback by:

1. Revert code changes:
   ```bash
   git revert <commit-hash>
   ```

2. Restore PostgreSQL database from backup

3. Update environment variables to point to PostgreSQL

## Support

For issues or questions:
- Check GitHub Issues
- Review Drizzle ORM SQLite docs: https://orm.drizzle.team/docs/get-started-sqlite
- Turso docs: https://docs.turso.tech/

---

**Migration Date**: December 9, 2025  
**Schema Version**: 1.0 (SQLite)  
**Drizzle ORM**: 0.39.3  
**Drizzle Kit**: 0.31.4

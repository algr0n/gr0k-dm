#!/usr/bin/env node
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config();

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error("Missing Turso env vars");
  process.exit(1);
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

async function run() {
  const res = await client.execute({ sql: `PRAGMA table_info('unified_characters')` });
  const cols = res.rows.map(r => r.name);
  if (cols.includes('currency')) {
    console.log('Currency column already exists');
    return;
  }

  console.log('Adding currency column to unified_characters...');
  await client.execute({ sql: `ALTER TABLE unified_characters ADD COLUMN currency TEXT DEFAULT '{"cp":0,"sp":0,"gp":0}'` });
  console.log('Column added. Updating null values to default...');
  await client.execute({ sql: `UPDATE unified_characters SET currency = '{"cp":0,"sp":0,"gp":0}' WHERE currency IS NULL` });
  console.log('Done');
}

run().catch(err => { console.error(err); process.exit(1); });
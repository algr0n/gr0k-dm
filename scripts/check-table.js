#!/usr/bin/env node
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) { console.error('Missing env'); process.exit(1); }
const client = createClient({ url, authToken });

async function run() {
  const res = await client.execute({ sql: `PRAGMA table_info('adventure_quests')` });
  console.log('PRAGMA rows:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
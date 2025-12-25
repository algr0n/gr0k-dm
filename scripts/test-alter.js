#!/usr/bin/env node
import { createClient } from '@libsql/client';
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) { console.error('Missing env'); process.exit(1); }
const client = createClient({ url, authToken });

async function run() {
  const stmt = `ALTER TABLE adventure_quests ADD COLUMN room_id TEXT`;
  try {
    const r = await client.execute(stmt);
    console.log('Result:', r);
  } catch (err) {
    console.error('Error message:', err && err.message);
    console.error('Full err:', err);
  }
}
run().catch(e=>console.error(e));
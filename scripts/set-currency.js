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
  const characterName = process.argv[2] || "Bootstrap";
  const gp = Number(process.argv[3] || 15);

  const json = JSON.stringify({ cp: 0, sp: 0, gp });
  console.log(`Setting currency for ${characterName} -> ${json}`);

  await client.execute({ sql: `UPDATE unified_characters SET currency = ? WHERE character_name = ?`, args: [json, characterName] });
  const res = await client.execute({ sql: `SELECT currency FROM unified_characters WHERE character_name = ? LIMIT 1`, args: [characterName] });
  console.log('Result:', res.rows[0]);
}

run().catch(err => { console.error(err); process.exit(1); });
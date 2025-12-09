#!/usr/bin/env node
require('dotenv').config();
const { execSync } = require('child_process');

// Pass environment variables explicitly
const env = {
  ...process.env,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN
};

console.log('✓ Loaded environment variables');
console.log('✓ TURSO_DATABASE_URL:', env.TURSO_DATABASE_URL ? 'Set' : 'Missing');
console.log('✓ TURSO_AUTH_TOKEN:', env.TURSO_AUTH_TOKEN ? `Set (${env.TURSO_AUTH_TOKEN.length} chars)` : 'Missing');

try {
  execSync('npx drizzle-kit push', { 
    stdio: 'inherit',
    env 
  });
} catch (error) {
  process.exit(1);
}

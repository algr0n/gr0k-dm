-- Add admin flag to users
ALTER TABLE users ADD COLUMN admin INTEGER DEFAULT 0;

-- Optionally set admin on startup via environment variable; prefer to manage admin users via the server (ADMIN_USERNAMES env) rather than hardcoding here.
-- Add nullable password_hash column to rooms table
-- Safe: adds a TEXT column, no default, nullable so existing rows are unaffected.
-- Idempotent: IF NOT EXISTS ensures safe re-runs if column already exists.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password_hash TEXT;

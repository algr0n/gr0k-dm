-- Add nullable password_hash column to rooms table
-- Safe: adds a TEXT column, no default, nullable so existing rows are unaffected.
ALTER TABLE rooms ADD COLUMN password_hash TEXT;

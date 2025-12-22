-- Migration: Add password_hash column to rooms table and change isPublic default
-- Date: 2025-12-22

-- Add password_hash column to rooms table (nullable for optional passwords)
ALTER TABLE rooms ADD COLUMN password_hash TEXT;

-- Update existing rooms to set isPublic to true (make rooms public by default)
UPDATE rooms SET is_public = 1 WHERE is_public = 0;

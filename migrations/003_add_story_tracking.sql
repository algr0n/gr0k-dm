-- Migration: Add Story Tracking Tables
-- Purpose: Enable multi-session story persistence and quest tracking
-- Safety: Uses CREATE TABLE IF NOT EXISTS for idempotency

PRAGMA foreign_keys = ON;

-- =============================================================================
-- Quest Objective Progress Table
-- Track individual quest objectives per room/quest combination
-- =============================================================================
CREATE TABLE IF NOT EXISTS quest_objective_progress (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  objective_index INTEGER NOT NULL,
  objective_text TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0 NOT NULL,
  completed_at INTEGER,
  completed_by TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (quest_id) REFERENCES adventure_quests(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_quest_progress_room ON quest_objective_progress(room_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_quest_progress_quest ON quest_objective_progress(quest_id);
--> statement-breakpoint

-- =============================================================================
-- Story Events Table
-- Log key story moments for AI memory and continuity
-- =============================================================================
CREATE TABLE IF NOT EXISTS story_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  participants TEXT DEFAULT '[]' NOT NULL,
  related_quest_id TEXT,
  related_npc_id TEXT,
  related_location_id TEXT,
  importance INTEGER DEFAULT 1 NOT NULL,
  timestamp INTEGER DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_story_events_room ON story_events(room_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_story_events_type ON story_events(event_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_story_events_importance ON story_events(importance);
--> statement-breakpoint

-- =============================================================================
-- Session Summaries Table
-- AI-generated or DM-written summaries of play sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  room_id TEXT NOT NULL,
  session_number INTEGER NOT NULL,
  summary TEXT NOT NULL,
  key_events TEXT DEFAULT '[]' NOT NULL,
  quests_progressed TEXT DEFAULT '[]' NOT NULL,
  npcs_encountered TEXT DEFAULT '[]' NOT NULL,
  locations_visited TEXT DEFAULT '[]' NOT NULL,
  message_count INTEGER DEFAULT 0 NOT NULL,
  started_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  ended_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_session_summaries_room ON session_summaries(room_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_session_summaries_number ON session_summaries(session_number);
--> statement-breakpoint

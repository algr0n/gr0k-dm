/**
 * Adventure Module Schema
 * Database schema for pre-made adventure modules like Lost Mine of Phandelver
 * 
 * Copyright Notice: Adventure content (Lost Mine of Phandelver) is from 
 * Wizards of the Coast's D&D 5e Starter Set and is for personal use only.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { rooms } from "./schema";

// SQLite Helper Functions (redefined to avoid circular dependency)
const generateUUID = () => sql`(lower(hex(randomblob(16))))`;
const currentTimestamp = () => sql`(unixepoch())`;
const emptyJsonArray = () => sql`'[]'`;

// =============================================================================
// Adventures Table - Core adventure metadata
// =============================================================================

export const adventures = sqliteTable("adventures", {
  id: text("id").primaryKey().default(generateUUID()),
  slug: text("slug").notNull().unique(), // URL-friendly identifier (e.g., "lost-mine-of-phandelver")
  name: text("name").notNull(),
  description: text("description").notNull(), // Short description for adventure cards
  longDescription: text("long_description"), // Detailed description/synopsis
  gameSystem: text("game_system").notNull().default("dnd"), // dnd, cyberpunk, etc.
  minLevel: integer("min_level").notNull().default(1),
  maxLevel: integer("max_level").notNull().default(5),
  estimatedHours: text("estimated_hours"), // e.g., "20-30 hours"
  source: text("source").notNull(), // e.g., "D&D 5e Starter Set"
  coverImageUrl: text("cover_image_url"), // Optional cover image
  isPublished: integer("is_published", { mode: 'boolean' }).notNull().default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
}, (table) => [
  index("idx_adventures_slug").on(table.slug),
  index("idx_adventures_published").on(table.isPublished),
  index("idx_adventures_game_system").on(table.gameSystem),
]);

export type Adventure = typeof adventures.$inferSelect;
export type InsertAdventure = typeof adventures.$inferInsert;
export const insertAdventureSchema = createInsertSchema(adventures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =============================================================================
// Adventure Chapters Table - Story chapters/acts within an adventure
// =============================================================================

export const adventureChapters = sqliteTable("adventure_chapters", {
  id: text("id").primaryKey().default(generateUUID()),
  adventureId: text("adventure_id")
    .notNull()
    .references(() => adventures.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(), // 1, 2, 3, etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  objectives: text("objectives", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()),
  summary: text("summary"), // DM summary of what happens in this chapter
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_chapters_adventure").on(table.adventureId),
  index("idx_chapters_number").on(table.chapterNumber),
]);

export type AdventureChapter = typeof adventureChapters.$inferSelect;
export type InsertAdventureChapter = typeof adventureChapters.$inferInsert;
export const insertAdventureChapterSchema = createInsertSchema(adventureChapters).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Adventure Locations Table - Dungeons, towns, wilderness areas
// =============================================================================

export const adventureLocations = sqliteTable("adventure_locations", {
  id: text("id").primaryKey().default(generateUUID()),
  adventureId: text("adventure_id")
    .notNull()
    .references(() => adventures.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .references(() => adventureChapters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // "dungeon", "town", "wilderness", "building", "room"
  description: text("description").notNull(),
  boxedText: text("boxed_text"), // Read-aloud descriptive text for DM
  mapImageUrl: text("map_image_url"), // Optional map image
  features: text("features", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()), // Notable features
  connections: text("connections", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()), // IDs of connected locations
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_locations_adventure").on(table.adventureId),
  index("idx_locations_chapter").on(table.chapterId),
  index("idx_locations_type").on(table.type),
]);

export type AdventureLocation = typeof adventureLocations.$inferSelect;
export type InsertAdventureLocation = typeof adventureLocations.$inferInsert;
export const insertAdventureLocationSchema = createInsertSchema(adventureLocations).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Adventure Encounters Table - Combat, traps, puzzles
// =============================================================================

export const adventureEncounters = sqliteTable("adventure_encounters", {
  id: text("id").primaryKey().default(generateUUID()),
  adventureId: text("adventure_id")
    .notNull()
    .references(() => adventures.id, { onDelete: "cascade" }),
  locationId: text("location_id")
    .references(() => adventureLocations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // "combat", "trap", "puzzle", "social", "exploration"
  difficulty: text("difficulty"), // "easy", "medium", "hard", "deadly"
  description: text("description").notNull(),
  enemies: text("enemies", { mode: 'json' }).$type<Array<{
    name: string;
    count: number;
    hp?: number;
    ac?: number;
    specialAbilities?: string[];
  }>>().default(emptyJsonArray()),
  xpReward: integer("xp_reward").default(0),
  treasure: text("treasure", { mode: 'json' }).$type<Array<{
    item: string;
    quantity?: number;
    description?: string;
  }>>().default(emptyJsonArray()),
  triggerCondition: text("trigger_condition"), // When/how this encounter triggers
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_encounters_adventure").on(table.adventureId),
  index("idx_encounters_location").on(table.locationId),
  index("idx_encounters_type").on(table.type),
]);

export type AdventureEncounter = typeof adventureEncounters.$inferSelect;
export type InsertAdventureEncounter = typeof adventureEncounters.$inferInsert;
export const insertAdventureEncounterSchema = createInsertSchema(adventureEncounters).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Combat Encounters (persisted per location)
// =============================================================================
export const combatEncounters = sqliteTable("combat_encounters", {
  id: text("id").primaryKey().default(generateUUID()),
  adventureId: text("adventure_id").references(() => adventures.id, { onDelete: "set null" }),
  locationId: text("location_id").references(() => adventureLocations.id, { onDelete: "set null" }),
  roomId: text("room_id"),
  name: text("name").notNull(),
  seed: text("seed"),
  generatedBy: text("generated_by"), // 'AI' or 'DM'
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>().default(emptyJsonArray()),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
}, (table) => [
  index("idx_combat_encounters_location").on(table.locationId),
  index("idx_combat_encounters_room").on(table.roomId),
]);

export type CombatEncounter = typeof combatEncounters.$inferSelect;
export type InsertCombatEncounter = typeof combatEncounters.$inferInsert;
export const insertCombatEncounterSchema = createInsertSchema(combatEncounters).omit({ id: true, createdAt: true });

export const combatEnvironmentFeatures = sqliteTable("combat_environment_features", {
  id: text("id").primaryKey().default(generateUUID()),
  encounterId: text("encounter_id").notNull().references(() => combatEncounters.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  radius: integer("radius").notNull().default(1),
  properties: text("properties", { mode: 'json' }).$type<Record<string, any>>().default(emptyJsonArray()),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [index("idx_features_encounter").on(table.encounterId)]);

export type CombatEnvironmentFeature = typeof combatEnvironmentFeatures.$inferSelect;
export const insertCombatEnvironmentFeatureSchema = createInsertSchema(combatEnvironmentFeatures).omit({ id: true, createdAt: true });

export const combatSpawns = sqliteTable("combat_spawns", {
  id: text("id").primaryKey().default(generateUUID()),
  encounterId: text("encounter_id").notNull().references(() => combatEncounters.id, { onDelete: "cascade" }),
  monsterName: text("monster_name").notNull(),
  count: integer("count").notNull().default(1),
  positionX: integer("position_x"),
  positionY: integer("position_y"),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>().default(emptyJsonArray()),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [index("idx_spawns_encounter").on(table.encounterId)]);

export type CombatSpawn = typeof combatSpawns.$inferSelect;
export const insertCombatSpawnSchema = createInsertSchema(combatSpawns).omit({ id: true, createdAt: true });

// =============================================================================
// Adventure NPCs Table - Named NPCs with personality and quest connections
// =============================================================================

export const adventureNpcs = sqliteTable("adventure_npcs", {
  id: text("id").primaryKey().default(generateUUID()),
  adventureId: text("adventure_id")
    .notNull()
    .references(() => adventures.id, { onDelete: "cascade" }),
  locationId: text("location_id")
    .references(() => adventureLocations.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  race: text("race"), // "Dwarf", "Human", "Drow", etc.
  role: text("role").notNull(), // "Quest Giver", "Villain", "Ally", "Merchant", etc.
  description: text("description").notNull(),
  personality: text("personality"), // Key personality traits
  ideals: text("ideals"),
  bonds: text("bonds"),
  flaws: text("flaws"),
  statsBlock: text("stats_block", { mode: 'json' }).$type<{
    ac?: number;
    hp?: number;
    speed?: string;
    abilities?: Record<string, number>;
    specialAbilities?: string[];
  }>(),
  questConnections: text("quest_connections", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()), // Quest IDs this NPC is involved in
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_npcs_adventure").on(table.adventureId),
  index("idx_npcs_location").on(table.locationId),
  index("idx_npcs_role").on(table.role),
]);

export type AdventureNpc = typeof adventureNpcs.$inferSelect;
export type InsertAdventureNpc = typeof adventureNpcs.$inferInsert;
export const insertAdventureNpcSchema = createInsertSchema(adventureNpcs).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Adventure Quests Table - Quests and objectives with rewards
// =============================================================================

export const adventureQuests = sqliteTable("adventure_quests", {
  id: text("id").primaryKey().default(generateUUID()),
  adventureId: text("adventure_id")
    .references(() => adventures.id, { onDelete: "cascade" }), // NULL for dynamic quests
  chapterId: text("chapter_id")
    .references(() => adventureChapters.id, { onDelete: "set null" }),
  questGiverId: text("quest_giver_id")
    .references(() => adventureNpcs.id, { onDelete: "set null" }), // Predefined NPC quest giver
  dynamicQuestGiverId: text("dynamic_quest_giver_id")
    .references(() => dynamicNpcs.id, { onDelete: "set null" }), // Dynamic NPC quest giver
  roomId: text("room_id"), // For dynamic quests not tied to adventures
  questGiver: text("quest_giver"), // Free-form NPC name for dynamic quests
  name: text("name").notNull(),
  description: text("description").notNull(),
  objectives: text("objectives", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()),
  rewards: text("rewards", { mode: 'json' }).$type<{
    xp?: number;
    gold?: number;
    items?: string[];
    other?: string[];
  }>(),
  isMainQuest: integer("is_main_quest", { mode: 'boolean' }).notNull().default(false),
  isDynamic: integer("is_dynamic", { mode: 'boolean' }).notNull().default(false), // AI-generated quest
  status: text("status").notNull().default("active"), // active, in_progress, completed, failed
  urgency: text("urgency"), // low, medium, high, critical
  prerequisiteQuestIds: text("prerequisite_quest_ids", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_quests_adventure").on(table.adventureId),
  index("idx_quests_chapter").on(table.chapterId),
  index("idx_quests_giver").on(table.questGiverId),
  index("idx_quests_dynamic_giver").on(table.dynamicQuestGiverId),
  index("idx_quests_room").on(table.roomId),
  index("idx_quests_dynamic").on(table.isDynamic),
  index("idx_quests_status").on(table.status),
]);

export type AdventureQuest = typeof adventureQuests.$inferSelect;
export type InsertAdventureQuest = typeof adventureQuests.$inferInsert;
export const insertAdventureQuestSchema = createInsertSchema(adventureQuests).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Quest Objective Progress Table - Track individual quest objectives per room
// =============================================================================

export const questObjectiveProgress = sqliteTable("quest_objective_progress", {
  id: text("id").primaryKey().default(generateUUID()),
  roomId: text("room_id").notNull(), // FK to rooms, cascade delete handled by application
  questId: text("quest_id")
    .notNull()
    .references(() => adventureQuests.id, { onDelete: "cascade" }),
  objectiveIndex: integer("objective_index").notNull(), // Which objective in the quest (0-based)
  objectiveText: text("objective_text").notNull(), // Description of objective
  isCompleted: integer("is_completed", { mode: 'boolean' }).notNull().default(false),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  completedBy: text("completed_by"), // Character name(s) who completed it
  notes: text("notes"), // DM or AI-generated notes
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_quest_progress_room").on(table.roomId),
  index("idx_quest_progress_quest").on(table.questId),
]);

export type QuestObjectiveProgress = typeof questObjectiveProgress.$inferSelect;
export type InsertQuestObjectiveProgress = typeof questObjectiveProgress.$inferInsert;
export const insertQuestObjectiveProgressSchema = createInsertSchema(questObjectiveProgress).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Story Events Table - Log key story moments for AI memory
// =============================================================================

export const storyEvents = sqliteTable("story_events", {
  id: text("id").primaryKey().default(generateUUID()),
  roomId: text("room_id").notNull(), // FK to rooms, cascade delete handled by application
  eventType: text("event_type").notNull(), // "quest_start", "quest_complete", "npc_met", "location_discovered", "combat_victory", "boss_defeated", "player_death", "milestone"
  title: text("title").notNull(), // Short title like "Met Sildar Hallwinter"
  summary: text("summary").notNull(), // 1-2 sentence description
  participants: text("participants", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()), // Character names involved
  relatedQuestId: text("related_quest_id"), // Optional FK to quest
  relatedNpcId: text("related_npc_id"), // Optional FK to NPC
  relatedLocationId: text("related_location_id"), // Optional FK to location
  importance: integer("importance").notNull().default(1), // 1-5 scale, higher = more important for AI context
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_story_events_room").on(table.roomId),
  index("idx_story_events_type").on(table.eventType),
  index("idx_story_events_importance").on(table.importance),
]);

export type StoryEvent = typeof storyEvents.$inferSelect;
export type InsertStoryEvent = typeof storyEvents.$inferInsert;
export const insertStoryEventSchema = createInsertSchema(storyEvents).omit({
  id: true,
  timestamp: true,
});

// =============================================================================
// Session Summaries Table - AI-generated or DM-written session summaries
// =============================================================================

export const sessionSummaries = sqliteTable("session_summaries", {
  id: text("id").primaryKey().default(generateUUID()),
  roomId: text("room_id").notNull(), // FK to rooms, cascade delete handled by application
  sessionNumber: integer("session_number").notNull(),
  summary: text("summary").notNull(), // AI-generated summary
  keyEvents: text("key_events", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()), // Top 5-10 events
  questsProgressed: text("quests_progressed", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()), // Quest IDs
  npcsEncountered: text("npcs_encountered", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()), // NPC names
  locationsVisited: text("locations_visited", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()), // Location names
  messageCount: integer("message_count").notNull().default(0), // Messages in this session
  startedAt: integer("started_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  endedAt: integer("ended_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_session_summaries_room").on(table.roomId),
  index("idx_session_summaries_number").on(table.sessionNumber),
]);

export type SessionSummary = typeof sessionSummaries.$inferSelect;
export type InsertSessionSummary = typeof sessionSummaries.$inferInsert;
export const insertSessionSummarySchema = createInsertSchema(sessionSummaries).omit({
  id: true,
  createdAt: true,
});

// =============================================================================
// Dynamic NPCs - AI-generated or DM-created persistent NPCs for a specific room
// =============================================================================

export const dynamicNpcs = sqliteTable("dynamic_npcs", {
  id: text("id").primaryKey().default(generateUUID()),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  role: text("role"),
  description: text("description"),
  personality: text("personality"),
  statsBlock: text("stats_block", { mode: 'json' }).$type<Record<string, any>>(),
  isQuestGiver: integer("is_quest_giver", { mode: 'boolean' }).notNull().default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_dynamic_npcs_room").on(table.roomId),
  index("idx_dynamic_npcs_role").on(table.role),
  index("idx_dynamic_npcs_quest_giver").on(table.isQuestGiver),
]);

export type DynamicNpc = typeof dynamicNpcs.$inferSelect;
export type InsertDynamicNpc = typeof dynamicNpcs.$inferInsert;
export const insertDynamicNpcSchema = createInsertSchema(dynamicNpcs).omit({ id: true, createdAt: true });

// =============================================================================
// Dynamic Locations - AI-generated or DM-created persistent locations for a room
// =============================================================================

export const dynamicLocations = sqliteTable("dynamic_locations", {
  id: text("id").primaryKey().default(generateUUID()),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: text("type").notNull().default("other"),
  description: text("description"),
  boxedText: text("boxed_text"),
  features: text("features", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  connections: text("connections", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
}, (table) => [
  index("idx_dynamic_locations_room").on(table.roomId),
  index("idx_dynamic_locations_type").on(table.type),
]);

export type DynamicLocation = typeof dynamicLocations.$inferSelect;
export type InsertDynamicLocation = typeof dynamicLocations.$inferInsert;
export const insertDynamicLocationSchema = createInsertSchema(dynamicLocations).omit({ id: true, createdAt: true });

// =============================================================================
// Relations
// =============================================================================

export const adventuresRelations = relations(adventures, ({ many }) => ({
  chapters: many(adventureChapters),
  locations: many(adventureLocations),
  encounters: many(adventureEncounters),
  npcs: many(adventureNpcs),
  quests: many(adventureQuests),
}));

export const adventureChaptersRelations = relations(adventureChapters, ({ one, many }) => ({
  adventure: one(adventures, {
    fields: [adventureChapters.adventureId],
    references: [adventures.id],
  }),
  locations: many(adventureLocations),
  quests: many(adventureQuests),
}));

export const adventureLocationsRelations = relations(adventureLocations, ({ one, many }) => ({
  adventure: one(adventures, {
    fields: [adventureLocations.adventureId],
    references: [adventures.id],
  }),
  chapter: one(adventureChapters, {
    fields: [adventureLocations.chapterId],
    references: [adventureChapters.id],
  }),
  encounters: many(adventureEncounters),
  npcs: many(adventureNpcs),
}));

export const adventureEncountersRelations = relations(adventureEncounters, ({ one }) => ({
  adventure: one(adventures, {
    fields: [adventureEncounters.adventureId],
    references: [adventures.id],
  }),
  location: one(adventureLocations, {
    fields: [adventureEncounters.locationId],
    references: [adventureLocations.id],
  }),
}));

export const adventureNpcsRelations = relations(adventureNpcs, ({ one, many }) => ({
  adventure: one(adventures, {
    fields: [adventureNpcs.adventureId],
    references: [adventures.id],
  }),
  location: one(adventureLocations, {
    fields: [adventureNpcs.locationId],
    references: [adventureLocations.id],
  }),
  questsGiven: many(adventureQuests),
}));

export const adventureQuestsRelations = relations(adventureQuests, ({ one, many }) => ({
  adventure: one(adventures, {
    fields: [adventureQuests.adventureId],
    references: [adventures.id],
  }),
  chapter: one(adventureChapters, {
    fields: [adventureQuests.chapterId],
    references: [adventureChapters.id],
  }),
  questGiver: one(adventureNpcs, {
    fields: [adventureQuests.questGiverId],
    references: [adventureNpcs.id],
  }),
  objectiveProgress: many(questObjectiveProgress),
}));

export const questObjectiveProgressRelations = relations(questObjectiveProgress, ({ one }) => ({
  quest: one(adventureQuests, {
    fields: [questObjectiveProgress.questId],
    references: [adventureQuests.id],
  }),
}));

// =============================================================================
// TypeScript Interfaces for Adventure Context
// =============================================================================
export interface AdventureContext {
  adventureName: string;
  currentChapter?: AdventureChapter;
  currentLocation?: AdventureLocation;
  activeQuests?: AdventureQuest[];
  availableNpcs?: AdventureNpc[];
  metNpcIds?: string[];
  discoveredLocationIds?: string[];
}

// Story tracking interfaces
export interface QuestWithProgress {
  quest: AdventureQuest;
  objectives: QuestObjectiveProgress[];
  completionPercentage: number;
}

export interface StoryContext {
  questProgress: QuestWithProgress[];
  storyEvents: StoryEvent[];
  sessionSummary?: SessionSummary;
}

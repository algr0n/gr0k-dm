import { pgTable, text, varchar, integer, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Game system type
export const gameSystemSchema = z.enum(["dnd", "cyberpunk"]);
export type GameSystem = z.infer<typeof gameSystemSchema>;

// D&D Character stats
export const dndStatsSchema = z.object({
  strength: z.number().min(1).max(30).default(10),
  dexterity: z.number().min(1).max(30).default(10),
  constitution: z.number().min(1).max(30).default(10),
  intelligence: z.number().min(1).max(30).default(10),
  wisdom: z.number().min(1).max(30).default(10),
  charisma: z.number().min(1).max(30).default(10),
});

export type DndStats = z.infer<typeof dndStatsSchema>;

// Cyberpunk Character stats (based on Cyberpunk RED)
export const cyberpunkStatsSchema = z.object({
  int: z.number().min(1).max(10).default(5),       // Intelligence
  ref: z.number().min(1).max(10).default(5),       // Reflexes
  dex: z.number().min(1).max(10).default(5),       // Dexterity
  tech: z.number().min(1).max(10).default(5),      // Technical Ability
  cool: z.number().min(1).max(10).default(5),      // Cool
  will: z.number().min(1).max(10).default(5),      // Willpower
  luck: z.number().min(1).max(10).default(5),      // Luck
  move: z.number().min(1).max(10).default(5),      // Movement
  body: z.number().min(1).max(10).default(5),      // Body
  emp: z.number().min(1).max(10).default(5),       // Empathy
});

export type CyberpunkStats = z.infer<typeof cyberpunkStatsSchema>;

// Combined character stats type (supports both systems)
export const characterStatsSchema = z.union([dndStatsSchema, cyberpunkStatsSchema]);
export type CharacterStats = z.infer<typeof characterStatsSchema>;

// Inventory item type
export const inventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().default(1),
  type: z.enum(["weapon", "armor", "potion", "misc", "gold"]),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

// Quest log entry type
export const questEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["active", "completed", "failed"]),
  objectives: z.array(z.object({
    text: z.string(),
    completed: z.boolean(),
  })).optional(),
});

export type QuestEntry = z.infer<typeof questEntrySchema>;

// Dice roll result type
export const diceRollSchema = z.object({
  id: z.string(),
  expression: z.string(),
  rolls: z.array(z.number()),
  modifier: z.number().default(0),
  total: z.number(),
  timestamp: z.string(),
  characterName: z.string().optional(),
  purpose: z.string().optional(),
});

export type DiceRoll = z.infer<typeof diceRollSchema>;

// Message history for context
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
  discordUserId: z.string().optional(),
  discordUsername: z.string().optional(),
});

export type Message = z.infer<typeof messageSchema>;

// Characters table (in-memory for MVP)
export const characters = pgTable("characters", {
  id: varchar("id").primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  discordUsername: text("discord_username").notNull(),
  name: text("name").notNull(),
  race: text("race").notNull(),
  characterClass: text("character_class").notNull(),
  level: integer("level").notNull().default(1),
  currentHp: integer("current_hp").notNull().default(10),
  maxHp: integer("max_hp").notNull().default(10),
  armorClass: integer("armor_class").notNull().default(10),
  stats: jsonb("stats").$type<CharacterStats>().notNull(),
  inventory: jsonb("inventory").$type<InventoryItem[]>().notNull().default([]),
  backstory: text("backstory"),
  isActive: boolean("is_active").notNull().default(true),
  gameSystem: text("game_system").notNull().default("dnd"),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// Game sessions table (in-memory for MVP)
export const gameSessions = pgTable("game_sessions", {
  id: varchar("id").primaryKey(),
  discordChannelId: text("discord_channel_id").notNull(),
  discordGuildId: text("discord_guild_id"),
  name: text("name").notNull(),
  description: text("description"),
  currentScene: text("current_scene"),
  messageHistory: jsonb("message_history").$type<Message[]>().notNull().default([]),
  quests: jsonb("quests").$type<QuestEntry[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  gameSystem: text("game_system").notNull().default("dnd"),
});

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({ id: true });
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// Dice roll history (in-memory for MVP)
export const diceRolls = pgTable("dice_rolls", {
  id: varchar("id").primaryKey(),
  sessionId: text("session_id"),
  characterId: text("character_id"),
  expression: text("expression").notNull(),
  rolls: jsonb("rolls").$type<number[]>().notNull(),
  modifier: integer("modifier").notNull().default(0),
  total: integer("total").notNull(),
  purpose: text("purpose"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertDiceRollSchema = createInsertSchema(diceRolls).omit({ id: true });
export type InsertDiceRoll = z.infer<typeof insertDiceRollSchema>;
export type DiceRollRecord = typeof diceRolls.$inferSelect;

// Bot status type for dashboard
export const botStatusSchema = z.object({
  isOnline: z.boolean(),
  connectedGuilds: z.number(),
  activeGames: z.number(),
  totalCharacters: z.number(),
  lastActivity: z.string().optional(),
});

export type BotStatus = z.infer<typeof botStatusSchema>;

// Users table (for reference)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

import { pgTable, text, varchar, integer, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table for express sessions
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Game systems supported
export const gameSystems = ["dnd", "cyberpunk"] as const;
export const gameSystemSchema = z.enum(gameSystems);
export type GameSystem = z.infer<typeof gameSystemSchema>;

export const gameSystemLabels: Record<GameSystem, string> = {
  dnd: "D&D 5th Edition",
  cyberpunk: "Cyberpunk RED",
};

// Message type for chat
export const messageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  playerName: z.string(),
  content: z.string(),
  type: z.enum(["chat", "action", "roll", "system", "dm"]),
  timestamp: z.string(),
  diceResult: z.object({
    expression: z.string(),
    rolls: z.array(z.number()),
    modifier: z.number(),
    total: z.number(),
  }).optional(),
});

export type Message = z.infer<typeof messageSchema>;

// Room/game session table
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  name: text("name").notNull(),
  gameSystem: text("game_system").notNull().default("dnd"),
  hostName: text("host_name").notNull(),
  description: text("description"),
  currentScene: text("current_scene"),
  messageHistory: jsonb("message_history").$type<Message[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
});

export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, createdAt: true, lastActivityAt: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

// Players in a room
export const players = pgTable("players", {
  id: varchar("id").primaryKey(),
  roomId: varchar("room_id").notNull(),
  name: text("name").notNull(),
  isHost: boolean("is_host").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, joinedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

// Character sheet for each player in a room
export const characters = pgTable("characters", {
  id: varchar("id").primaryKey(),
  playerId: varchar("player_id").notNull(),
  roomId: varchar("room_id").notNull(),
  name: text("name").notNull(),
  gameSystem: text("game_system").notNull(),
  stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true, createdAt: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// Inventory items for characters
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey(),
  characterId: varchar("character_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull().default(1),
  grantedBy: text("granted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

// Dice roll result type
export const diceRollSchema = z.object({
  id: z.string(),
  expression: z.string(),
  rolls: z.array(z.number()),
  modifier: z.number().default(0),
  total: z.number(),
  timestamp: z.string(),
  playerName: z.string().optional(),
  purpose: z.string().optional(),
});

export type DiceRoll = z.infer<typeof diceRollSchema>;

// Dice roll history table
export const diceRolls = pgTable("dice_rolls", {
  id: varchar("id").primaryKey(),
  roomId: text("room_id"),
  playerId: text("player_id"),
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

// Users table (for optional login later)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

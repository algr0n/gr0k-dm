import { 
  pgTable, text, varchar, integer, jsonb, boolean, timestamp, index, 
  pgEnum, decimal 
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";  // ← Changed this line
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

// Item enums for D&D
export const itemCategoryEnum = pgEnum("item_category", [
  "weapon",
  "armor",
  "potion",
  "scroll",
  "wondrous_item",
  "ring",
  "rod",
  "staff",
  "wand",
  "ammunition",
  "tool",
  "adventuring_gear",
  "container",
  "mount",
  "vehicle",
  "other",
]);

export const itemRarityEnum = pgEnum("item_rarity", [
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "artifact",
  "varies",
]);

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
  isPublic: boolean("is_public").notNull().default(false),
  maxPlayers: integer("max_players").notNull().default(6),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_rooms_code").on(table.code),
  index("idx_rooms_active").on(table.isActive),
]);

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  code: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

// Players in rooms
export const players = pgTable("players", {
  id: varchar("id").primaryKey(),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isHost: boolean("is_host").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

// Characters for players
export const characters = pgTable("characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  characterName: text("character_name").notNull(),
  race: text("race"),
  class: text("class"),
  level: integer("level").default(1),
  background: text("background"),
  alignment: text("alignment"),
  stats: jsonb("stats").$type<{
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    [key: string]: unknown;
  }>(),
  skills: jsonb("skills").$type<string[]>().default([]),
  spells: jsonb("spells").$type<string[]>().default([]),
  currentHp: integer("current_hp").notNull().default(10),
  maxHp: integer("max_hp").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  initiativeModifier: integer("initiative_modifier").notNull().default(0),
  backstory: text("backstory"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_characters_room").on(table.roomId),
  index("idx_characters_player").on(table.playerId),
]);

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// Master items table (D&D compendium reference)
export const items = pgTable("items", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull(),
  category: itemCategoryEnum("category").notNull(),
  type: text("type").notNull(),
  subtype: text("subtype"),
  rarity: itemRarityEnum("rarity").default("common"),
  cost: integer("cost"),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  description: text("description").notNull(),
  properties: jsonb("properties").$type<Record<string, unknown>>(),
  requiresAttunement: boolean("requires_attunement").default(false),
  gameSystem: text("game_system").notNull().default("dnd"),
  source: text("source").default("SRD"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_items_name").on(table.name),
  index("idx_items_category").on(table.category),
  index("idx_items_rarity").on(table.rarity),
]);

export const itemsRelations = relations(items, ({ many }) => ({
  inventoryItems: many(inventoryItems),
}));

export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;

// Character inventory (references master items)
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  itemId: varchar("item_id", { length: 64 })
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  equipped: boolean("equipped").notNull().default(false),
  notes: text("notes"),
  attunementSlot: boolean("attunement_slot").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_inventory_character").on(table.characterId),
  index("idx_inventory_item").on(table.itemId),
]);

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  character: one(characters, {
    fields: [inventoryItems.characterId],
    references: [characters.id],
  }),
  item: one(items, {
    fields: [inventoryItems.itemId],
    references: [items.id],
  }),
}));

export const insertInventoryItemSchema = createInsertSchema(inventoryItems)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    quantity: z.coerce.number().min(1),
  });
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

// Users table (for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username"),
  profileImageUrl: varchar("profile_image_url"),
  customProfileImageUrl: varchar("custom_profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const updateUserProfileSchema = z.object({
  username: z.string().min(2).max(30).optional(),
  customProfileImageUrl: z.string().url().optional().nullable(),
});
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// Saved characters (linked to user accounts, separate from room-specific characters)
export const savedCharacters = pgTable("saved_characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterName: text("character_name").notNull(),
  race: text("race"),
  class: text("class"),
  level: integer("level").default(1),
  background: text("background"),
  alignment: text("alignment"),
  stats: jsonb("stats").$type<{
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    [key: string]: unknown;
  }>(),
  skills: jsonb("skills").$type<string[]>().default([]),
  spells: jsonb("spells").$type<string[]>().default([]),
  maxHp: integer("max_hp").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  initiativeModifier: integer("initiative_modifier").notNull().default(0),
  backstory: text("backstory"),
  gameSystem: text("game_system").notNull().default("dnd"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_saved_characters_user").on(table.userId),
]);

export const insertSavedCharacterSchema = createInsertSchema(savedCharacters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSavedCharacter = z.infer<typeof insertSavedCharacterSchema>;
export type SavedCharacter = typeof savedCharacters.$inferSelect;

// Saved inventory (items owned by saved characters)
export const savedInventoryItems = pgTable("saved_inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  savedCharacterId: varchar("saved_character_id")
    .notNull()
    .references(() => savedCharacters.id, { onDelete: "cascade" }),
  itemId: varchar("item_id", { length: 64 })
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  equipped: boolean("equipped").notNull().default(false),
  notes: text("notes"),
  attunementSlot: boolean("attunement_slot").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_saved_inventory_character").on(table.savedCharacterId),
]);

export const insertSavedInventoryItemSchema = createInsertSchema(savedInventoryItems)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSavedInventoryItem = z.infer<typeof insertSavedInventoryItemSchema>;
export type SavedInventoryItem = typeof savedInventoryItems.$inferSelect;
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
  userId: text("user_id"),
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

// Users table (for local username/password auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username").unique(),
  profileImageUrl: varchar("profile_image_url"),
  customProfileImageUrl: varchar("custom_profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({ username: true, password: true })
  .extend({
    username: z.string().min(3).max(30),
    password: z.string().min(6).max(100),
  });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const updateUserProfileSchema = z.object({
  username: z.string().min(2).max(30).optional(),
  customProfileImageUrl: z.string().url().optional().nullable(),
});
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// Unified characters table - combines saved and room characters into one entity
// Characters persist across game sessions with currentRoomCode tracking active game
export const unifiedCharacters = pgTable("unified_characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterName: text("character_name").notNull(),
  race: text("race"),
  class: text("class"),
  level: integer("level").notNull().default(1),
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
  proficiencies: jsonb("proficiencies").$type<string[]>().default([]),
  spells: jsonb("spells").$type<string[]>().default([]),
  hitDice: text("hit_dice"),
  maxHp: integer("max_hp").notNull().default(10),
  currentHp: integer("current_hp").notNull().default(10),
  temporaryHp: integer("temporary_hp").notNull().default(0),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  initiativeModifier: integer("initiative_modifier").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  isAlive: boolean("is_alive").notNull().default(true),
  backstory: text("backstory"),
  notes: text("notes"),
  gameSystem: text("game_system").notNull().default("dnd"),
  currentRoomCode: varchar("current_room_code", { length: 8 }),
  levelChoices: jsonb("level_choices").$type<Record<string, unknown>[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_unified_characters_user").on(table.userId),
  index("idx_unified_characters_room").on(table.currentRoomCode),
]);

export const insertUnifiedCharacterSchema = createInsertSchema(unifiedCharacters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUnifiedCharacter = z.infer<typeof insertUnifiedCharacterSchema>;
export type UnifiedCharacter = typeof unifiedCharacters.$inferSelect;

// Keep savedCharacters as alias for backward compatibility during migration
export const savedCharacters = unifiedCharacters;
export type SavedCharacter = UnifiedCharacter;
export type InsertSavedCharacter = InsertUnifiedCharacter;
export const insertSavedCharacterSchema = insertUnifiedCharacterSchema;

// Character inventory (items owned by characters)
export const characterInventoryItems = pgTable("character_inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id")
    .notNull()
    .references(() => unifiedCharacters.id, { onDelete: "cascade" }),
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
  index("idx_character_inventory_character").on(table.characterId),
  index("idx_character_inventory_item").on(table.itemId),
]);

export const characterInventoryItemsRelations = relations(characterInventoryItems, ({ one }) => ({
  character: one(unifiedCharacters, {
    fields: [characterInventoryItems.characterId],
    references: [unifiedCharacters.id],
  }),
  item: one(items, {
    fields: [characterInventoryItems.itemId],
    references: [items.id],
  }),
}));

export const insertCharacterInventoryItemSchema = createInsertSchema(characterInventoryItems)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    quantity: z.coerce.number().min(1),
  });
export type InsertCharacterInventoryItem = z.infer<typeof insertCharacterInventoryItemSchema>;
export type CharacterInventoryItem = typeof characterInventoryItems.$inferSelect;

// Backward compatibility aliases for saved inventory
export const savedInventoryItems = characterInventoryItems;
export type SavedInventoryItem = CharacterInventoryItem;
export type InsertSavedInventoryItem = InsertCharacterInventoryItem;
export const insertSavedInventoryItemSchema = insertCharacterInventoryItemSchema;

// Relations for unified characters
export const unifiedCharactersRelations = relations(unifiedCharacters, ({ one, many }) => ({
  user: one(users, {
    fields: [unifiedCharacters.userId],
    references: [users.id],
  }),
  inventoryItems: many(characterInventoryItems),
  statusEffects: many(characterStatusEffects),
}));

// Predefined status effects per game system
export const statusEffectDefinitions: Record<GameSystem, Array<{name: string; description: string}>> = {
  dnd: [
    { name: "Blinded", description: "Can't see, auto-fail sight-based checks, attack rolls have disadvantage" },
    { name: "Charmed", description: "Can't attack the charmer, charmer has advantage on social checks" },
    { name: "Deafened", description: "Can't hear, auto-fail hearing-based checks" },
    { name: "Frightened", description: "Disadvantage on ability checks and attacks while source is visible" },
    { name: "Grappled", description: "Speed becomes 0, can't benefit from speed bonuses" },
    { name: "Incapacitated", description: "Can't take actions or reactions" },
    { name: "Invisible", description: "Can't be seen, attacks have advantage, attacks against have disadvantage" },
    { name: "Paralyzed", description: "Incapacitated, can't move or speak, auto-fail STR/DEX saves" },
    { name: "Petrified", description: "Transformed to stone, incapacitated, resistant to damage" },
    { name: "Poisoned", description: "Disadvantage on attack rolls and ability checks" },
    { name: "Prone", description: "Disadvantage on attacks, melee attacks against have advantage" },
    { name: "Restrained", description: "Speed 0, attacks have disadvantage, DEX saves have disadvantage" },
    { name: "Stunned", description: "Incapacitated, can't move, can only speak falteringly" },
    { name: "Unconscious", description: "Incapacitated, can't move or speak, unaware of surroundings" },
    { name: "Exhaustion", description: "Cumulative levels of fatigue with increasing penalties" },
    { name: "Concentration", description: "Maintaining a spell, can be broken by damage" },
  ],
  cyberpunk: [
    { name: "Stun", description: "Unable to act, -4 to all actions" },
    { name: "Wounded", description: "Critical injury, reduced effectiveness" },
    { name: "Mortally Wounded", description: "Dying, requires immediate medical attention" },
    { name: "Burning", description: "Taking fire damage each turn" },
    { name: "Prone", description: "On the ground, harder to hit at range, easier in melee" },
    { name: "Grappled", description: "Held by another character" },
    { name: "Blinded", description: "Cannot see, severe penalties to actions" },
    { name: "Deafened", description: "Cannot hear, penalties to awareness" },
    { name: "Drugged", description: "Under influence of drugs, various effects" },
    { name: "Drunk", description: "Intoxicated, penalties to coordination" },
    { name: "Humanity Loss", description: "Suffering cyberpsychosis effects" },
    { name: "Suppressed", description: "Taking cover from autofire" },
    { name: "EMP'd", description: "Cyberware temporarily disabled" },
    { name: "Hacked", description: "Compromised by netrunner" },
  ],
};

// Character status effects table (active effects on characters in game)
export const characterStatusEffects = pgTable("character_status_effects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => unifiedCharacters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isPredefined: boolean("is_predefined").notNull().default(true),
  duration: text("duration"),
  appliedByDm: boolean("applied_by_dm").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_status_effects_character").on(table.characterId),
]);

export const insertStatusEffectSchema = createInsertSchema(characterStatusEffects).omit({
  id: true,
  createdAt: true,
});
export type InsertStatusEffect = z.infer<typeof insertStatusEffectSchema>;
export type CharacterStatusEffect = typeof characterStatusEffects.$inferSelect;

// Relations for status effects
export const characterStatusEffectsRelations = relations(characterStatusEffects, ({ one }) => ({
  character: one(unifiedCharacters, {
    fields: [characterStatusEffects.characterId],
    references: [unifiedCharacters.id],
  }),
}));

// Schema to update unified character (combines room and base updates)
export const updateUnifiedCharacterSchema = z.object({
  currentHp: z.number().int().optional(),
  temporaryHp: z.number().int().min(0).optional(),
  isAlive: z.boolean().optional(),
  xp: z.number().int().min(0).optional(),
  gold: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  level: z.number().int().min(1).max(20).optional(),
  maxHp: z.number().int().min(1).optional(),
  ac: z.number().int().min(0).optional(),
  speed: z.number().int().min(0).optional(),
  initiativeModifier: z.number().int().optional(),
  stats: z.record(z.unknown()).optional(),
  skills: z.array(z.string()).optional(),
  proficiencies: z.array(z.string()).optional(),
  spells: z.array(z.string()).optional(),
  currentRoomCode: z.string().max(8).nullable().optional(),
});
export type UpdateUnifiedCharacter = z.infer<typeof updateUnifiedCharacterSchema>;

// Backward compatibility aliases
export const updateRoomCharacterSchema = updateUnifiedCharacterSchema;
export type UpdateRoomCharacter = UpdateUnifiedCharacter;
export const updateCharacterStatsSchema = updateUnifiedCharacterSchema;
export type UpdateCharacterStats = UpdateUnifiedCharacter;

// =============================================================================
// D&D 5e Class and Race Constants
// =============================================================================

// D&D 5e Skills
export const dndSkills = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
  "History", "Insight", "Intimidation", "Investigation", "Medicine",
  "Nature", "Perception", "Performance", "Persuasion", "Religion",
  "Sleight of Hand", "Stealth", "Survival"
] as const;
export type DndSkill = typeof dndSkills[number];

// Skill to ability mapping
export const skillAbilityMap: Record<DndSkill, string> = {
  "Acrobatics": "dexterity",
  "Animal Handling": "wisdom",
  "Arcana": "intelligence",
  "Athletics": "strength",
  "Deception": "charisma",
  "History": "intelligence",
  "Insight": "wisdom",
  "Intimidation": "charisma",
  "Investigation": "intelligence",
  "Medicine": "wisdom",
  "Nature": "intelligence",
  "Perception": "wisdom",
  "Performance": "charisma",
  "Persuasion": "charisma",
  "Religion": "intelligence",
  "Sleight of Hand": "dexterity",
  "Stealth": "dexterity",
  "Survival": "wisdom",
};

// D&D 5e Class definitions
export const dndClasses = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
] as const;
export type DndClass = typeof dndClasses[number];

export interface ClassDefinition {
  name: DndClass;
  hitDie: number;
  primaryAbility: string[];
  savingThrows: string[];
  skillChoices: DndSkill[];
  numSkillChoices: number;
  armorProficiencies: string[];
  weaponProficiencies: string[];
}

export const classDefinitions: Record<DndClass, ClassDefinition> = {
  Barbarian: {
    name: "Barbarian",
    hitDie: 12,
    primaryAbility: ["strength"],
    savingThrows: ["strength", "constitution"],
    skillChoices: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"],
    numSkillChoices: 2,
    armorProficiencies: ["Light armor", "Medium armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
  },
  Bard: {
    name: "Bard",
    hitDie: 8,
    primaryAbility: ["charisma"],
    savingThrows: ["dexterity", "charisma"],
    skillChoices: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"],
    numSkillChoices: 3,
    armorProficiencies: ["Light armor"],
    weaponProficiencies: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
  },
  Cleric: {
    name: "Cleric",
    hitDie: 8,
    primaryAbility: ["wisdom"],
    savingThrows: ["wisdom", "charisma"],
    skillChoices: ["History", "Insight", "Medicine", "Persuasion", "Religion"],
    numSkillChoices: 2,
    armorProficiencies: ["Light armor", "Medium armor", "Shields"],
    weaponProficiencies: ["Simple weapons"],
  },
  Druid: {
    name: "Druid",
    hitDie: 8,
    primaryAbility: ["wisdom"],
    savingThrows: ["intelligence", "wisdom"],
    skillChoices: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"],
    numSkillChoices: 2,
    armorProficiencies: ["Light armor", "Medium armor", "Shields (non-metal)"],
    weaponProficiencies: ["Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears"],
  },
  Fighter: {
    name: "Fighter",
    hitDie: 10,
    primaryAbility: ["strength", "dexterity"],
    savingThrows: ["strength", "constitution"],
    skillChoices: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"],
    numSkillChoices: 2,
    armorProficiencies: ["All armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
  },
  Monk: {
    name: "Monk",
    hitDie: 8,
    primaryAbility: ["dexterity", "wisdom"],
    savingThrows: ["strength", "dexterity"],
    skillChoices: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"],
    numSkillChoices: 2,
    armorProficiencies: [],
    weaponProficiencies: ["Simple weapons", "Shortswords"],
  },
  Paladin: {
    name: "Paladin",
    hitDie: 10,
    primaryAbility: ["strength", "charisma"],
    savingThrows: ["wisdom", "charisma"],
    skillChoices: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"],
    numSkillChoices: 2,
    armorProficiencies: ["All armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
  },
  Ranger: {
    name: "Ranger",
    hitDie: 10,
    primaryAbility: ["dexterity", "wisdom"],
    savingThrows: ["strength", "dexterity"],
    skillChoices: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"],
    numSkillChoices: 3,
    armorProficiencies: ["Light armor", "Medium armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
  },
  Rogue: {
    name: "Rogue",
    hitDie: 8,
    primaryAbility: ["dexterity"],
    savingThrows: ["dexterity", "intelligence"],
    skillChoices: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"],
    numSkillChoices: 4,
    armorProficiencies: ["Light armor"],
    weaponProficiencies: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
  },
  Sorcerer: {
    name: "Sorcerer",
    hitDie: 6,
    primaryAbility: ["charisma"],
    savingThrows: ["constitution", "charisma"],
    skillChoices: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"],
    numSkillChoices: 2,
    armorProficiencies: [],
    weaponProficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
  },
  Warlock: {
    name: "Warlock",
    hitDie: 8,
    primaryAbility: ["charisma"],
    savingThrows: ["wisdom", "charisma"],
    skillChoices: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"],
    numSkillChoices: 2,
    armorProficiencies: ["Light armor"],
    weaponProficiencies: ["Simple weapons"],
  },
  Wizard: {
    name: "Wizard",
    hitDie: 6,
    primaryAbility: ["intelligence"],
    savingThrows: ["intelligence", "wisdom"],
    skillChoices: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
    numSkillChoices: 2,
    armorProficiencies: [],
    weaponProficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
  },
};

// D&D 5e Race definitions
export const dndRaces = [
  "Human", "Elf", "Dwarf", "Halfling", "Dragonborn",
  "Gnome", "Half-Elf", "Half-Orc", "Tiefling"
] as const;
export type DndRace = typeof dndRaces[number];

export interface RaceDefinition {
  name: DndRace;
  abilityScoreIncreases: Record<string, number>;
  selectableAbilityBonuses?: {
    count: number;
    amount: number;
    eligible: string[];
  };
  speed: number;
  size: "Small" | "Medium";
  traits: string[];
  languages: string[];
  darkvision: number;
}

export const raceDefinitions: Record<DndRace, RaceDefinition> = {
  Human: {
    name: "Human",
    abilityScoreIncreases: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Extra Language"],
    languages: ["Common", "One extra language"],
    darkvision: 0,
  },
  Elf: {
    name: "Elf",
    abilityScoreIncreases: { dexterity: 2 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance"],
    languages: ["Common", "Elvish"],
    darkvision: 60,
  },
  Dwarf: {
    name: "Dwarf",
    abilityScoreIncreases: { constitution: 2 },
    speed: 25,
    size: "Medium",
    traits: ["Darkvision", "Dwarven Resilience", "Stonecunning"],
    languages: ["Common", "Dwarvish"],
    darkvision: 60,
  },
  Halfling: {
    name: "Halfling",
    abilityScoreIncreases: { dexterity: 2 },
    speed: 25,
    size: "Small",
    traits: ["Lucky", "Brave", "Halfling Nimbleness"],
    languages: ["Common", "Halfling"],
    darkvision: 0,
  },
  Dragonborn: {
    name: "Dragonborn",
    abilityScoreIncreases: { strength: 2, charisma: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
    languages: ["Common", "Draconic"],
    darkvision: 0,
  },
  Gnome: {
    name: "Gnome",
    abilityScoreIncreases: { intelligence: 2 },
    speed: 25,
    size: "Small",
    traits: ["Darkvision", "Gnome Cunning"],
    languages: ["Common", "Gnomish"],
    darkvision: 60,
  },
  "Half-Elf": {
    name: "Half-Elf",
    abilityScoreIncreases: { charisma: 2 },
    selectableAbilityBonuses: {
      count: 2,
      amount: 1,
      eligible: ["strength", "dexterity", "constitution", "intelligence", "wisdom"],
    },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Fey Ancestry", "Skill Versatility"],
    languages: ["Common", "Elvish", "One extra language"],
    darkvision: 60,
  },
  "Half-Orc": {
    name: "Half-Orc",
    abilityScoreIncreases: { strength: 2, constitution: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
    languages: ["Common", "Orc"],
    darkvision: 60,
  },
  Tiefling: {
    name: "Tiefling",
    abilityScoreIncreases: { intelligence: 1, charisma: 2 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
    languages: ["Common", "Infernal"],
    darkvision: 60,
  },
};

// XP thresholds for each level (D&D 5e)
export const xpThresholds: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

// Calculate level from XP
export function getLevelFromXP(xp: number): number {
  for (let level = 20; level >= 1; level--) {
    if (xp >= xpThresholds[level]) {
      return level;
    }
  }
  return 1;
}

// Calculate starting HP for a class at level 1
export function calculateStartingHP(className: DndClass, constitutionModifier: number): number {
  const classDef = classDefinitions[className];
  return classDef.hitDie + constitutionModifier;
}

// Calculate HP gain on level up (average method)
export function calculateLevelUpHP(className: DndClass, constitutionModifier: number): number {
  const classDef = classDefinitions[className];
  const averageRoll = Math.floor(classDef.hitDie / 2) + 1;
  return averageRoll + constitutionModifier;
}

// Calculate ability modifier from score
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// Proficiency bonus by level
export function getProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}
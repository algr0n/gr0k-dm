import { 
  sqliteTable, text, integer, real, index 
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// SQLite Helper Functions
// UUID generation for primary keys
export const generateUUID = () => sql`(lower(hex(randomblob(16))))`;
// Current timestamp (Unix epoch in seconds)
export const currentTimestamp = () => sql`(unixepoch())`;
// Empty array default for JSON arrays
export const emptyJsonArray = () => sql`'[]'`;

// Default spell slot structure for D&D 5e characters
// Index 0 = cantrips (unused), 1-9 = spell levels 1-9
export const DEFAULT_SPELL_SLOTS = {
  current: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  max: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
export const defaultSpellSlotsJson = () => sql`'${sql.raw(JSON.stringify(DEFAULT_SPELL_SLOTS))}'`;

// Session storage table for express sessions
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess", { mode: 'json' }).notNull().$type<Record<string, any>>(),
    expire: integer("expire", { mode: 'timestamp' }).notNull(),
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

// Item enums for D&D (SQLite uses text with runtime validation)
export const itemCategories = [
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
] as const;
export const itemCategorySchema = z.enum(itemCategories);
export type ItemCategory = z.infer<typeof itemCategorySchema>;

export const itemRarities = [
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "artifact",
  "varies",
] as const;
export const itemRaritySchema = z.enum(itemRarities);
export type ItemRarity = z.infer<typeof itemRaritySchema>;

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
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  gameSystem: text("game_system").notNull().default("dnd"),
  hostName: text("host_name").notNull(),
  description: text("description"),
  currentScene: text("current_scene"),
  messageHistory: text("message_history", { mode: 'json' }).$type<Message[]>().notNull().default(emptyJsonArray()),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  isPublic: integer("is_public", { mode: 'boolean' }).notNull().default(true),
  maxPlayers: integer("max_players").notNull().default(6),
  passwordHash: text("password_hash"),
  lastActivityAt: integer("last_activity_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
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
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  name: text("name").notNull(),
  isHost: integer("is_host", { mode: 'boolean' }).notNull().default(false),
  joinedAt: integer("joined_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

// Characters for players
export const characters = sqliteTable("characters", {
  id: text("id").primaryKey().default(generateUUID()),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  characterName: text("character_name").notNull(),
  race: text("race"),
  class: text("class"),
  level: integer("level").default(1),
  background: text("background"),
  alignment: text("alignment"),
  stats: text("stats", { mode: 'json' }).$type<{
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    [key: string]: unknown;
  }>(),
  skills: text("skills", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  spells: text("spells", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  currentHp: integer("current_hp").notNull().default(10),
  maxHp: integer("max_hp").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  initiativeModifier: integer("initiative_modifier").notNull().default(0),
  backstory: text("backstory"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
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
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(),
  subtype: text("subtype"),
  rarity: text("rarity").default("common"),
  cost: integer("cost"),
  weight: real("weight"),
  description: text("description").notNull(),
  properties: text("properties", { mode: 'json' }).$type<Record<string, unknown>>(),
  requiresAttunement: integer("requires_attunement", { mode: 'boolean' }).default(false),
  gameSystem: text("game_system").notNull().default("dnd"),
  source: text("source").default("SRD"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(currentTimestamp()),
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

// Spell school enum (SQLite uses text with runtime validation)
export const spellSchools = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
] as const;
export const spellSchoolSchema = z.enum(spellSchools);
export type SpellSchool = z.infer<typeof spellSchoolSchema>;

// Master spells table (D&D 5e SRD spells compendium)
export const spells = sqliteTable("spells", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(0),
  school: text("school").notNull(),
  castingTime: text("casting_time").notNull(),
  range: text("range").notNull(),
  components: text("components", { mode: 'json' }).$type<{
    verbal: boolean;
    somatic: boolean;
    material: string | null;
  }>().notNull(),
  duration: text("duration").notNull(),
  concentration: integer("concentration", { mode: 'boolean' }).notNull().default(false),
  ritual: integer("ritual", { mode: 'boolean' }).notNull().default(false),
  description: text("description").notNull(),
  higherLevels: text("higher_levels"),
  classes: text("classes", { mode: 'json' }).$type<string[]>().notNull().default(emptyJsonArray()),
  source: text("source").default("SRD"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(currentTimestamp()),
}, (table) => [
  index("idx_spells_name").on(table.name),
  index("idx_spells_level").on(table.level),
  index("idx_spells_school").on(table.school),
]);

export type Spell = typeof spells.$inferSelect;
export type InsertSpell = typeof spells.$inferInsert;

// Character inventory (references master items)
export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey().default(generateUUID()),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  equipped: integer("equipped", { mode: 'boolean' }).notNull().default(false),
  notes: text("notes"),
  attunementSlot: integer("attunement_slot", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
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
export const diceRolls = sqliteTable("dice_rolls", {
  id: text("id").primaryKey(),
  roomId: text("room_id"),
  playerId: text("player_id"),
  expression: text("expression").notNull(),
  rolls: text("rolls", { mode: 'json' }).$type<number[]>().notNull(),
  modifier: integer("modifier").notNull().default(0),
  total: integer("total").notNull(),
  purpose: text("purpose"),
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
});

export const insertDiceRollSchema = createInsertSchema(diceRolls).omit({ id: true });
export type InsertDiceRoll = z.infer<typeof insertDiceRollSchema>;
export type DiceRollRecord = typeof diceRolls.$inferSelect;

// Users table (for local username/password auth)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().default(generateUUID()),
  email: text("email").unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").unique(),
  profileImageUrl: text("profile_image_url"),
  customProfileImageUrl: text("custom_profile_image_url"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
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
export const unifiedCharacters = sqliteTable("unified_characters", {
  id: text("id").primaryKey().default(generateUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterName: text("character_name").notNull(),
  race: text("race"),
  class: text("class"),
  level: integer("level").notNull().default(1),
  background: text("background"),
  alignment: text("alignment"),
  stats: text("stats", { mode: 'json' }).$type<{
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    [key: string]: unknown;
  }>(),
  skills: text("skills", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  proficiencies: text("proficiencies", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  spells: text("spells", { mode: 'json' }).$type<string[]>().default(emptyJsonArray()),
  spellSlots: text("spell_slots", { mode: 'json' }).$type<{
    current: number[];  // [0]=cantrips(unused), [1]=1st level, [2]=2nd, ..., [9]=9th level
    max: number[];      // Maximum slots per level based on class/level
  }>().default(defaultSpellSlotsJson()),
  hitDice: text("hit_dice"),
  maxHp: integer("max_hp").notNull().default(10),
  currentHp: integer("current_hp").notNull().default(10),
  temporaryHp: integer("temporary_hp").notNull().default(0),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  initiativeModifier: integer("initiative_modifier").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  isAlive: integer("is_alive", { mode: 'boolean' }).notNull().default(true),
  backstory: text("backstory"),
  notes: text("notes"),
  gameSystem: text("game_system").notNull().default("dnd"),
  currentRoomCode: text("current_room_code"),
  levelChoices: text("level_choices", { mode: 'json' }).$type<Record<string, unknown>[]>().default(emptyJsonArray()),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
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
export const characterInventoryItems = sqliteTable("character_inventory_items", {
  id: text("id").primaryKey().default(generateUUID()),
  characterId: text("character_id")
    .notNull()
    .references(() => unifiedCharacters.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  equipped: integer("equipped", { mode: 'boolean' }).notNull().default(false),
  notes: text("notes"),
  attunementSlot: integer("attunement_slot", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(currentTimestamp()),
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
export type CharacterInventoryItemWithDetails = CharacterInventoryItem & { item: Item };

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
export const characterStatusEffects = sqliteTable("character_status_effects", {
  id: text("id").primaryKey().default(generateUUID()),
  characterId: text("character_id").notNull().references(() => unifiedCharacters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isPredefined: integer("is_predefined", { mode: 'boolean' }).notNull().default(true),
  duration: text("duration"),
  appliedByDm: integer("applied_by_dm", { mode: 'boolean' }).notNull().default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(currentTimestamp()),
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

// Level-based skill features (Expertise, Jack of All Trades, etc.)
export type SkillFeatureType = 
  | "expertise"           // Double proficiency bonus (Rogue, Bard)
  | "jack_of_all_trades"  // Half proficiency to non-proficient skills (Bard)
  | "remarkable_athlete"  // Half proficiency to STR/DEX/CON checks not already proficient (Champion Fighter)
  | "reliable_talent";    // Minimum 10 on proficient skill checks (Rogue 11)

export interface ClassLevelFeature {
  level: number;
  name: string;
  type: SkillFeatureType;
  description: string;
  skillChoices?: number;  // Number of skills to choose for expertise
  applicableTo?: "proficient" | "non_proficient" | "str_dex_con";
}

export const classSkillFeatures: Partial<Record<DndClass, ClassLevelFeature[]>> = {
  Rogue: [
    {
      level: 1,
      name: "Expertise",
      type: "expertise",
      description: "Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.",
      skillChoices: 2,
      applicableTo: "proficient",
    },
    {
      level: 6,
      name: "Expertise",
      type: "expertise",
      description: "Choose two more of your skill proficiencies to gain expertise.",
      skillChoices: 2,
      applicableTo: "proficient",
    },
    {
      level: 11,
      name: "Reliable Talent",
      type: "reliable_talent",
      description: "Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.",
      applicableTo: "proficient",
    },
  ],
  Bard: [
    {
      level: 2,
      name: "Jack of All Trades",
      type: "jack_of_all_trades",
      description: "You can add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus.",
      applicableTo: "non_proficient",
    },
    {
      level: 3,
      name: "Expertise",
      type: "expertise",
      description: "Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.",
      skillChoices: 2,
      applicableTo: "proficient",
    },
    {
      level: 10,
      name: "Expertise",
      type: "expertise",
      description: "Choose two more of your skill proficiencies to gain expertise.",
      skillChoices: 2,
      applicableTo: "proficient",
    },
  ],
  Ranger: [
    {
      level: 6,
      name: "Deft Explorer - Expertise",
      type: "expertise",
      description: "Choose two of your skill proficiencies to gain expertise (Tasha's Deft Explorer feature).",
      skillChoices: 2,
      applicableTo: "proficient",
    },
  ],
};

// Cleric Domain skill features (subclass-based)
export interface SubclassSkillFeature {
  subclass: string;
  parentClass: DndClass;
  level: number;
  name: string;
  type: SkillFeatureType | "bonus_proficiency";
  description: string;
  skills?: DndSkill[];
  skillChoices?: number;
}

export const subclassSkillFeatures: SubclassSkillFeature[] = [
  {
    subclass: "Knowledge Domain",
    parentClass: "Cleric",
    level: 1,
    name: "Blessings of Knowledge",
    type: "bonus_proficiency",
    description: "Choose two skills from Arcana, History, Nature, or Religion. Your proficiency bonus is doubled for any ability check you make with those skills.",
    skills: ["Arcana", "History", "Nature", "Religion"],
    skillChoices: 2,
  },
  {
    subclass: "Scout",
    parentClass: "Rogue",
    level: 3,
    name: "Survivalist",
    type: "expertise",
    description: "You gain proficiency in Nature and Survival, and your proficiency bonus is doubled for any ability check you make that uses either skill.",
    skills: ["Nature", "Survival"],
  },
  {
    subclass: "Champion",
    parentClass: "Fighter",
    level: 7,
    name: "Remarkable Athlete",
    type: "remarkable_athlete",
    description: "Add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that doesn't already use your proficiency bonus.",
  },
];

// Calculate skill bonus for a character
export function calculateSkillBonus(
  skill: DndSkill,
  abilityScore: number,
  level: number,
  isProficient: boolean,
  hasExpertise: boolean,
  hasJackOfAllTrades: boolean
): number {
  const abilityMod = getAbilityModifier(abilityScore);
  const profBonus = getProficiencyBonus(level);
  
  if (hasExpertise) {
    return abilityMod + (profBonus * 2);
  } else if (isProficient) {
    return abilityMod + profBonus;
  } else if (hasJackOfAllTrades) {
    return abilityMod + Math.floor(profBonus / 2);
  }
  return abilityMod;
}

// D&D 5e Race definitions
export const dndRaces = [
  "Human", "Elf", "Dwarf", "Halfling", "Dragonborn",
  "Gnome", "Half-Elf", "Half-Orc", "Tiefling"
] as const;
export type DndRace = typeof dndRaces[number];

// D&D 5e Subraces
export const dndSubraces: Record<DndRace, string[]> = {
  Human: ["Standard", "Variant"],
  Elf: ["High Elf", "Wood Elf", "Dark Elf (Drow)"],
  Dwarf: ["Hill Dwarf", "Mountain Dwarf"],
  Halfling: ["Lightfoot", "Stout"],
  Dragonborn: [],
  Gnome: ["Forest Gnome", "Rock Gnome"],
  "Half-Elf": [],
  "Half-Orc": [],
  Tiefling: [],
};

export interface SubraceDefinition {
  name: string;
  parentRace: DndRace;
  abilityScoreIncreases: Record<string, number>;
  traits: string[];
  skillProficiencies?: DndSkill[];
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  toolProficiencies?: string[];
  bonusSkillChoices?: { count: number; from: DndSkill[] | "any" };
}

export const subraceDefinitions: Record<string, SubraceDefinition> = {
  "High Elf": {
    name: "High Elf",
    parentRace: "Elf",
    abilityScoreIncreases: { intelligence: 1 },
    traits: ["Cantrip", "Extra Language"],
    weaponProficiencies: ["Longsword", "Shortsword", "Shortbow", "Longbow"],
  },
  "Wood Elf": {
    name: "Wood Elf",
    parentRace: "Elf",
    abilityScoreIncreases: { wisdom: 1 },
    traits: ["Fleet of Foot", "Mask of the Wild"],
    weaponProficiencies: ["Longsword", "Shortsword", "Shortbow", "Longbow"],
  },
  "Dark Elf (Drow)": {
    name: "Dark Elf (Drow)",
    parentRace: "Elf",
    abilityScoreIncreases: { charisma: 1 },
    traits: ["Superior Darkvision", "Sunlight Sensitivity", "Drow Magic"],
    weaponProficiencies: ["Rapier", "Shortsword", "Hand Crossbow"],
  },
  "Hill Dwarf": {
    name: "Hill Dwarf",
    parentRace: "Dwarf",
    abilityScoreIncreases: { wisdom: 1 },
    traits: ["Dwarven Toughness"],
  },
  "Mountain Dwarf": {
    name: "Mountain Dwarf",
    parentRace: "Dwarf",
    abilityScoreIncreases: { strength: 2 },
    traits: ["Dwarven Armor Training"],
    armorProficiencies: ["Light armor", "Medium armor"],
  },
  "Lightfoot": {
    name: "Lightfoot",
    parentRace: "Halfling",
    abilityScoreIncreases: { charisma: 1 },
    traits: ["Naturally Stealthy"],
  },
  "Stout": {
    name: "Stout",
    parentRace: "Halfling",
    abilityScoreIncreases: { constitution: 1 },
    traits: ["Stout Resilience"],
  },
  "Forest Gnome": {
    name: "Forest Gnome",
    parentRace: "Gnome",
    abilityScoreIncreases: { dexterity: 1 },
    traits: ["Natural Illusionist", "Speak with Small Beasts"],
  },
  "Rock Gnome": {
    name: "Rock Gnome",
    parentRace: "Gnome",
    abilityScoreIncreases: { constitution: 1 },
    traits: ["Artificer's Lore", "Tinker"],
    toolProficiencies: ["Tinker's tools"],
  },
  "Variant": {
    name: "Variant Human",
    parentRace: "Human",
    abilityScoreIncreases: {},
    traits: ["Feat", "Extra Skill"],
    bonusSkillChoices: { count: 1, from: "any" },
  },
  "Standard": {
    name: "Standard Human",
    parentRace: "Human",
    abilityScoreIncreases: {},
    traits: [],
  },
};

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
  skillProficiencies: DndSkill[];
  bonusSkillChoices?: {
    count: number;
    from: DndSkill[] | "any";
  };
  toolProficiencies?: string[];
  toolProficiencyChoice?: {
    count: number;
    from: string[];
  };
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
    skillProficiencies: [],
  },
  Elf: {
    name: "Elf",
    abilityScoreIncreases: { dexterity: 2 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance"],
    languages: ["Common", "Elvish"],
    darkvision: 60,
    skillProficiencies: ["Perception"],
  },
  Dwarf: {
    name: "Dwarf",
    abilityScoreIncreases: { constitution: 2 },
    speed: 25,
    size: "Medium",
    traits: ["Darkvision", "Dwarven Resilience", "Stonecunning", "Tool Proficiency"],
    languages: ["Common", "Dwarvish"],
    darkvision: 60,
    skillProficiencies: [],
    toolProficiencyChoice: { count: 1, from: ["Smith's tools", "Brewer's supplies", "Mason's tools"] },
  },
  Halfling: {
    name: "Halfling",
    abilityScoreIncreases: { dexterity: 2 },
    speed: 25,
    size: "Small",
    traits: ["Lucky", "Brave", "Halfling Nimbleness"],
    languages: ["Common", "Halfling"],
    darkvision: 0,
    skillProficiencies: [],
  },
  Dragonborn: {
    name: "Dragonborn",
    abilityScoreIncreases: { strength: 2, charisma: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
    languages: ["Common", "Draconic"],
    darkvision: 0,
    skillProficiencies: [],
  },
  Gnome: {
    name: "Gnome",
    abilityScoreIncreases: { intelligence: 2 },
    speed: 25,
    size: "Small",
    traits: ["Darkvision", "Gnome Cunning"],
    languages: ["Common", "Gnomish"],
    darkvision: 60,
    skillProficiencies: [],
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
    skillProficiencies: [],
    bonusSkillChoices: { count: 2, from: "any" },
  },
  "Half-Orc": {
    name: "Half-Orc",
    abilityScoreIncreases: { strength: 2, constitution: 1 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
    languages: ["Common", "Orc"],
    darkvision: 60,
    skillProficiencies: ["Intimidation"],
  },
  Tiefling: {
    name: "Tiefling",
    abilityScoreIncreases: { intelligence: 1, charisma: 2 },
    speed: 30,
    size: "Medium",
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
    languages: ["Common", "Infernal"],
    darkvision: 60,
    skillProficiencies: [],
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

// D&D 5e Spell Slot Progression by class type
// Full casters: Bard, Cleric, Druid, Sorcerer, Wizard
// Half casters: Paladin, Ranger (start at level 2)
// Third casters: (Eldritch Knight Fighter, Arcane Trickster Rogue - not implemented yet)
// Warlocks use Pact Magic (different system)

// Full caster spell slots by level (indices 0-9, where 0 is unused, 1-9 are spell levels)
const fullCasterSlots: Record<number, number[]> = {
  1:  [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
  5:  [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  6:  [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],
  7:  [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],
  8:  [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],
  9:  [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [0, 4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [0, 4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [0, 4, 3, 3, 3, 3, 2, 2, 1, 1],
};

// Half caster spell slots (Paladin, Ranger) - start getting slots at level 2
const halfCasterSlots: Record<number, number[]> = {
  1:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  4:  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  5:  [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],
  6:  [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],
  7:  [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
  8:  [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
  9:  [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  10: [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  11: [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],
  12: [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],
  13: [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],
  14: [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],
  15: [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],
  16: [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],
  17: [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],
  18: [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],
  19: [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],
  20: [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],
};

// Warlock Pact Magic slots (different system - always cast at highest level available)
const warlockSlots: Record<number, { slots: number; level: number }> = {
  1:  { slots: 1, level: 1 },
  2:  { slots: 2, level: 1 },
  3:  { slots: 2, level: 2 },
  4:  { slots: 2, level: 2 },
  5:  { slots: 2, level: 3 },
  6:  { slots: 2, level: 3 },
  7:  { slots: 2, level: 4 },
  8:  { slots: 2, level: 4 },
  9:  { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 },
};

// Get max spell slots for a class at a given level
export function getMaxSpellSlots(className: string, level: number): number[] {
  const normalizedClass = className.toLowerCase();
  const clampedLevel = Math.max(1, Math.min(20, level));
  
  // Full casters
  if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(normalizedClass)) {
    return fullCasterSlots[clampedLevel];
  }
  
  // Half casters
  if (["paladin", "ranger"].includes(normalizedClass)) {
    return halfCasterSlots[clampedLevel];
  }
  
  // Warlock (Pact Magic) - represented as slots at their pact level only
  if (normalizedClass === "warlock") {
    const pact = warlockSlots[clampedLevel];
    const slots = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    slots[pact.level] = pact.slots;
    return slots;
  }
  
  // Non-casters (Barbarian, Fighter, Monk, Rogue)
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

// Check if a class is a spellcaster
export function isSpellcaster(className: string): boolean {
  const normalizedClass = className.toLowerCase();
  return ["bard", "cleric", "druid", "sorcerer", "wizard", "warlock", "paladin", "ranger"].includes(normalizedClass);
}

// =============================================================================
// D&D 5e Cantrips Known by Class and Level
// =============================================================================

// Cantrips known progression by level for each class
const cantripsKnownByClass: Record<string, Record<number, number>> = {
  wizard: {
    1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 5,
    11: 5, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5, 19: 5, 20: 5
  },
  sorcerer: {
    1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 6,
    11: 6, 12: 6, 13: 6, 14: 6, 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6
  },
  bard: {
    1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
    11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4
  },
  cleric: {
    1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 5,
    11: 5, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5, 19: 5, 20: 5
  },
  druid: {
    1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
    11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4
  },
  warlock: {
    1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
    11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4
  },
};

// Get max cantrips known for a class at a given level
export function getMaxCantripsKnown(className: string, level: number): number {
  const normalizedClass = className.toLowerCase();
  const clampedLevel = Math.max(1, Math.min(20, level));
  
  const classCantrips = cantripsKnownByClass[normalizedClass];
  if (classCantrips) {
    return classCantrips[clampedLevel] || 0;
  }
  
  // Paladin and Ranger don't get cantrips
  return 0;
}

// =============================================================================
// D&D 5e Spells Known by Class and Level (for "known" spellcasters)
// =============================================================================

// Spells known progression for classes that learn a fixed number of spells
const spellsKnownByClass: Record<string, Record<number, number>> = {
  bard: {
    1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14,
    11: 15, 12: 15, 13: 16, 14: 18, 15: 19, 16: 19, 17: 20, 18: 22, 19: 22, 20: 22
  },
  sorcerer: {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
    11: 12, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15, 19: 15, 20: 15
  },
  warlock: {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10,
    11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14, 19: 15, 20: 15
  },
  ranger: {
    1: 0, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6,
    11: 7, 12: 7, 13: 8, 14: 8, 15: 9, 16: 9, 17: 10, 18: 10, 19: 11, 20: 11
  },
};

// Get max spells known for "known" caster classes
export function getMaxSpellsKnown(className: string, level: number): number | null {
  const normalizedClass = className.toLowerCase();
  const clampedLevel = Math.max(1, Math.min(20, level));
  
  const classSpells = spellsKnownByClass[normalizedClass];
  if (classSpells) {
    return classSpells[clampedLevel];
  }
  
  // Prepared casters and non-casters return null (they don't use "spells known")
  return null;
}

// =============================================================================
// D&D 5e Wizard Spellbook Size
// =============================================================================

// Wizards start with 6 spells in their spellbook and add 2 per level
export function getWizardSpellbookSize(level: number): number {
  const clampedLevel = Math.max(1, Math.min(20, level));
  // 6 spells at level 1, +2 for each level after
  return 6 + (clampedLevel - 1) * 2;
}

// =============================================================================
// D&D 5e Spells Prepared Calculation (for "prepared" spellcasters)
// =============================================================================

export type SpellcastingType = "known" | "prepared" | "spellbook" | "pact" | "none";

// Determine what type of spellcasting a class uses
export function getSpellcastingType(className: string): SpellcastingType {
  const normalizedClass = className.toLowerCase();
  
  if (normalizedClass === "wizard") return "spellbook";
  if (normalizedClass === "warlock") return "pact";
  if (["bard", "sorcerer", "ranger"].includes(normalizedClass)) return "known";
  if (["cleric", "druid", "paladin"].includes(normalizedClass)) return "prepared";
  
  return "none";
}

// Get the spellcasting ability for a class
export function getSpellcastingAbility(className: string): string | null {
  const normalizedClass = className.toLowerCase();
  
  switch (normalizedClass) {
    case "wizard": return "intelligence";
    case "cleric": case "druid": case "ranger": return "wisdom";
    case "bard": case "sorcerer": case "warlock": case "paladin": return "charisma";
    default: return null;
  }
}

// Calculate max prepared spells for prepared casters
// Cleric: Wisdom mod + cleric level (min 1)
// Druid: Wisdom mod + druid level (min 1)
// Paladin: Charisma mod + half paladin level, rounded down (min 1)
// Wizard: Intelligence mod + wizard level (min 1)
export function getMaxSpellsPrepared(
  className: string, 
  level: number, 
  abilityModifier: number
): number | null {
  const normalizedClass = className.toLowerCase();
  const clampedLevel = Math.max(1, Math.min(20, level));
  
  switch (normalizedClass) {
    case "cleric":
    case "druid":
    case "wizard":
      return Math.max(1, abilityModifier + clampedLevel);
    case "paladin":
      return Math.max(1, abilityModifier + Math.floor(clampedLevel / 2));
    default:
      // Known casters don't prepare spells
      return null;
  }
}

// =============================================================================
// Unified Spell Limit Info
// =============================================================================

export interface SpellLimitInfo {
  type: SpellcastingType;
  cantripsMax: number;
  spellsKnownMax: number | null;      // For known casters (Bard, Sorcerer, Warlock, Ranger)
  spellsPreparedMax: number | null;   // For prepared casters (Cleric, Druid, Paladin, Wizard)
  spellbookSize: number | null;       // For Wizard only
  spellcastingAbility: string | null;
  description: string;                // User-friendly explanation
}

export function getSpellLimitInfo(
  className: string,
  level: number,
  abilityModifier: number = 0
): SpellLimitInfo {
  const normalizedClass = className.toLowerCase();
  const type = getSpellcastingType(normalizedClass);
  const cantripsMax = getMaxCantripsKnown(normalizedClass, level);
  const spellsKnownMax = getMaxSpellsKnown(normalizedClass, level);
  const spellsPreparedMax = getMaxSpellsPrepared(normalizedClass, level, abilityModifier);
  const spellbookSize = normalizedClass === "wizard" ? getWizardSpellbookSize(level) : null;
  const spellcastingAbility = getSpellcastingAbility(normalizedClass);
  
  let description = "";
  
  switch (type) {
    case "spellbook":
      description = `Wizards record spells in a spellbook. You can have up to ${spellbookSize} spells in your spellbook. Each day, prepare ${spellsPreparedMax} spells from your spellbook to cast. You know ${cantripsMax} cantrips.`;
      break;
    case "known":
      if (normalizedClass === "ranger") {
        description = `Rangers learn spells as they level. You can know up to ${spellsKnownMax} spells. Rangers don't get cantrips.`;
      } else {
        description = `You learn a fixed number of spells. You can know up to ${spellsKnownMax} spells and ${cantripsMax} cantrips.`;
      }
      break;
    case "prepared":
      if (normalizedClass === "paladin") {
        description = `Paladins prepare spells from the full Paladin list. You can prepare up to ${spellsPreparedMax} spells (Charisma modifier + half your level). Paladins don't get cantrips.`;
      } else {
        description = `You can prepare any spell from the ${className} spell list. Prepare up to ${spellsPreparedMax} spells (${spellcastingAbility} modifier + your level). You know ${cantripsMax} cantrips.`;
      }
      break;
    case "pact":
      description = `Warlocks learn spells through their pact. You can know up to ${spellsKnownMax} spells and ${cantripsMax} cantrips. Your spell slots recover on short rest.`;
      break;
    default:
      description = "This class doesn't cast spells.";
  }
  
  return {
    type,
    cantripsMax,
    spellsKnownMax,
    spellsPreparedMax,
    spellbookSize,
    spellcastingAbility,
    description,
  };
}

// =============================================================================
// Skill Bonus Calculation Helper
// =============================================================================

export interface SkillBonus {
  skillName: DndSkill;
  ability: string;
  abilityModifier: number;
  isProficient: boolean;
  hasExpertise: boolean;
  totalBonus: number;
}

export interface SkillBonusOptions {
  stats: Record<string, number | unknown>;
  skills: string[];
  level: number;
  className?: string;
  expertise?: string[];
}

/**
 * Build skill bonuses for all D&D 5e skills based on character data.
 * Takes into account ability modifiers, proficiency, expertise, and class features.
 */
export function buildSkillStats(options: SkillBonusOptions): Record<DndSkill, SkillBonus> {
  const { stats, skills, level, className, expertise = [] } = options;
  const proficiencyBonus = getProficiencyBonus(level);
  
  const result = {} as Record<DndSkill, SkillBonus>;
  
  for (const skillName of dndSkills) {
    const ability = skillAbilityMap[skillName];
    const abilityScore = typeof stats[ability] === 'number' ? stats[ability] as number : 10;
    const abilityModifier = getAbilityModifier(abilityScore);
    const isProficient = skills.includes(skillName);
    const hasExpertise = expertise.includes(skillName);
    
    let totalBonus = abilityModifier;
    
    if (hasExpertise && isProficient) {
      totalBonus += proficiencyBonus * 2;
    } else if (isProficient) {
      totalBonus += proficiencyBonus;
    } else if (className?.toLowerCase() === 'bard' && level >= 2) {
      totalBonus += Math.floor(proficiencyBonus / 2);
    }
    
    result[skillName] = {
      skillName,
      ability,
      abilityModifier,
      isProficient,
      hasExpertise,
      totalBonus,
    };
  }
  
  return result;
}

/**
 * Get skill bonus for a single skill
 */
export function getSkillBonus(
  skillName: DndSkill,
  options: SkillBonusOptions
): SkillBonus {
  const allSkills = buildSkillStats(options);
  return allSkills[skillName];
}
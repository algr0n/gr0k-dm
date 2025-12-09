import { 
  type Room, type InsertRoom,
  type Player, type InsertPlayer,
  type DiceRollRecord, type InsertDiceRoll,
  type User, type UpsertUser, type InsertUser,
  type Character, type InsertCharacter,
  type InventoryItem, type InsertInventoryItem,
  type SavedCharacter, type InsertSavedCharacter, type UpdateUnifiedCharacter,
  type SavedInventoryItem, type InsertSavedInventoryItem,
  type CharacterStatusEffect, type InsertStatusEffect,
  rooms, players, diceRolls, users, characters, inventoryItems,
  savedCharacters, savedInventoryItems, characterStatusEffects,
  characterInventoryItems
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt, sql, count, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  items, Item,
  itemCategories, itemRarities,
  spells, type Spell
} from "@shared/schema";
import { ilike } from "drizzle-orm";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, updates: { username?: string; customProfileImageUrl?: string | null }): Promise<User | undefined>;

  // Rooms
  getRoom(id: string): Promise<Room | undefined>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getAllRooms(): Promise<Room[]>;
  getActiveRooms(): Promise<Room[]>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;

  // Players
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayersByRoom(roomId: string): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  deletePlayer(id: string): Promise<boolean>;
  deletePlayersByRoom(roomId: string): Promise<boolean>;

  // Characters (legacy room-bound characters)
  getCharacter(id: string): Promise<Character | undefined>;
  getCharactersByRoom(roomId: string): Promise<Character[]>;
  getCharacterByPlayer(playerId: string): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: string, updates: Partial<Character>): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<boolean>;
  deleteCharactersByRoom(roomId: string): Promise<boolean>;

  // Dice Rolls
  getDiceRollsByRoom(roomId: string): Promise<DiceRollRecord[]>;
  createDiceRoll(roll: InsertDiceRoll): Promise<DiceRollRecord>;
  deleteDiceRollsByRoom(roomId: string): Promise<boolean>;

  // Inventory (legacy)
  getInventoryByCharacter(characterId: string): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  deleteInventoryByCharacter(characterId: string): Promise<boolean>;
  deleteInventoryByRoom(roomId: string): Promise<boolean>;

  // Cleanup
  deleteRoomWithAllData(roomId: string): Promise<boolean>;
  getStaleInactiveRooms(hoursOld: number): Promise<Room[]>;
  updateRoomActivity(id: string): Promise<Room | undefined>;
  getPublicRooms(gameSystem?: string): Promise<Array<Room & { playerCount: number }>>;

  // Items
  getItem(id: string): Promise<Item | undefined>;
  getItemByName(name: string): Promise<Item | undefined>;
  getItems(category?: typeof itemCategories[number], rarity?: typeof itemRarities[number]): Promise<Item[]>;
  getAllItems(): Promise<Item[]>;
  searchItems(query: string): Promise<Item[]>;
  createItem(item: { id: string; name: string; category: typeof itemCategories[number]; type: string; description: string; rarity?: typeof itemRarities[number]; gameSystem?: string }): Promise<Item>;
  getInventoryWithDetails(characterId: string): Promise<(InventoryItem & { item: Item })[]>;
  addToInventory(insert: InsertInventoryItem): Promise<InventoryItem>;

  // Unified Characters (user-owned, can join rooms via currentRoomCode)
  getSavedCharactersByUser(userId: string): Promise<SavedCharacter[]>;
  getSavedCharacter(id: string): Promise<SavedCharacter | undefined>;
  createSavedCharacter(character: InsertSavedCharacter): Promise<SavedCharacter>;
  updateSavedCharacter(id: string, updates: Partial<SavedCharacter>): Promise<SavedCharacter | undefined>;
  deleteSavedCharacter(id: string): Promise<boolean>;
  
  // Unified Character Room Operations
  getCharactersByRoomCode(roomCode: string): Promise<SavedCharacter[]>;
  getCharacterByUserInRoom(userId: string, roomCode: string): Promise<SavedCharacter | undefined>;
  joinRoom(characterId: string, roomCode: string): Promise<SavedCharacter | undefined>;
  leaveRoom(characterId: string): Promise<SavedCharacter | undefined>;
  leaveAllCharactersFromRoom(roomCode: string): Promise<boolean>;

  // Saved Inventory (for unified characters)
  getSavedInventoryByCharacter(characterId: string): Promise<SavedInventoryItem[]>;
  getSavedInventoryWithDetails(characterId: string): Promise<(SavedInventoryItem & { item: Item })[]>;
  addToSavedInventory(insert: InsertSavedInventoryItem): Promise<SavedInventoryItem>;
  updateSavedInventoryItem(id: string, updates: Partial<SavedInventoryItem>): Promise<SavedInventoryItem | undefined>;
  deleteSavedInventoryItem(id: string): Promise<boolean>;

  // Status Effects (for unified characters)
  getStatusEffectsByCharacter(characterId: string): Promise<CharacterStatusEffect[]>;
  createStatusEffect(effect: InsertStatusEffect): Promise<CharacterStatusEffect>;
  deleteStatusEffect(id: string): Promise<boolean>;
  deleteStatusEffectsByCharacter(characterId: string): Promise<boolean>;

  // Spells
  getSpells(level?: number, school?: string, classFilter?: string): Promise<Spell[]>;
  getSpell(id: string): Promise<Spell | undefined>;
  searchSpells(query: string): Promise<Spell[]>;
}

class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return await db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await db.query.users.findFirst({ where: eq(users.username, username) });
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: userData.username,
        password: userData.password,
      })
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(id: string, updates: { username?: string; customProfileImageUrl?: string | null }): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return await db.query.rooms.findFirst({ where: eq(rooms.id, id) });
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return await db.query.rooms.findFirst({ where: eq(rooms.code, code) });
  }

  async getAllRooms(): Promise<Room[]> {
    return await db.select().from(rooms);
  }

  async getActiveRooms(): Promise<Room[]> {
    return await db.select().from(rooms)
      .where(eq(rooms.isActive, true))
      .orderBy(desc(rooms.lastActivityAt));
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    let code: string;
    do {
      code = generateRoomCode();
    } while (await this.getRoomByCode(code));

    const id = randomUUID();
    const result = await db.insert(rooms)
      .values({ ...room, id, code })
      .returning();
    return result[0];
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const result = await db.update(rooms)
      .set(updates)
      .where(eq(rooms.id, id))
      .returning();
    return result[0];
  }

  async deleteRoom(id: string): Promise<boolean> {
    await db.delete(rooms).where(eq(rooms.id, id));
    return true;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    return await db.query.players.findFirst({ where: eq(players.id, id) });
  }

  async getPlayersByRoom(roomId: string): Promise<Player[]> {
    return await db.select().from(players)
      .where(eq(players.roomId, roomId))
      .orderBy(players.joinedAt);
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const id = randomUUID();
    const result = await db.insert(players)
      .values({ ...player, id })
      .returning();
    return result[0];
  }

  async deletePlayer(id: string): Promise<boolean> {
    await db.delete(players).where(eq(players.id, id));
    return true;
  }

  async deletePlayersByRoom(roomId: string): Promise<boolean> {
    await db.delete(players).where(eq(players.roomId, roomId));
    return true;
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    return await db.query.characters.findFirst({ where: eq(characters.id, id) });
  }

  async getCharactersByRoom(roomId: string): Promise<Character[]> {
    return await db.select().from(characters)
      .where(eq(characters.roomId, roomId));
  }

  async getCharacterByPlayer(playerId: string): Promise<Character | undefined> {
    return await db.query.characters.findFirst({ where: eq(characters.playerId, playerId) });
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const result = await db.insert(characters)
      .values(character)
      .returning();
    return result[0];
  }

  async updateCharacter(id: string, updates: Partial<Character>): Promise<Character | undefined> {
    const result = await db.update(characters)
      .set(updates)
      .where(eq(characters.id, id))
      .returning();
    return result[0];
  }

  async deleteCharacter(id: string): Promise<boolean> {
    await db.delete(characters).where(eq(characters.id, id));
    return true;
  }

  async deleteCharactersByRoom(roomId: string): Promise<boolean> {
    await db.delete(characters).where(eq(characters.roomId, roomId));
    return true;
  }

  async getDiceRollsByRoom(roomId: string): Promise<DiceRollRecord[]> {
    return await db.select().from(diceRolls)
      .where(eq(diceRolls.roomId, roomId))
      .orderBy(desc(diceRolls.timestamp))
      .limit(50);
  }

  async createDiceRoll(roll: InsertDiceRoll): Promise<DiceRollRecord> {
    const id = randomUUID();
    const result = await db.insert(diceRolls)
      .values({ ...roll, id })
      .returning();
    return result[0];
  }

  async deleteDiceRollsByRoom(roomId: string): Promise<boolean> {
    await db.delete(diceRolls).where(eq(diceRolls.roomId, roomId));
    return true;
  }

  async getInventoryByCharacter(characterId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems)
      .where(eq(inventoryItems.characterId, characterId));
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const result = await db.insert(inventoryItems)
      .values(item)
      .returning();
    return result[0];
  }

  async deleteInventoryByCharacter(characterId: string): Promise<boolean> {
    await db.delete(inventoryItems).where(eq(inventoryItems.characterId, characterId));
    return true;
  }

  async deleteInventoryByRoom(roomId: string): Promise<boolean> {
    const chars = await this.getCharactersByRoom(roomId);
    for (const char of chars) {
      await this.deleteInventoryByCharacter(char.id);
    }
    return true;
  }

  async deleteRoomWithAllData(roomId: string): Promise<boolean> {
    // Get the room to find its code
    const room = await this.getRoom(roomId);
    if (room) {
      // Remove all characters from this room (set currentRoomCode to null)
      await this.leaveAllCharactersFromRoom(room.code);
    }
    await this.deleteInventoryByRoom(roomId);
    await this.deleteCharactersByRoom(roomId);
    await this.deleteDiceRollsByRoom(roomId);
    await this.deletePlayersByRoom(roomId);
    await this.deleteRoom(roomId);
    return true;
  }

  async getStaleInactiveRooms(hoursOld: number): Promise<Room[]> {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    return await db.select().from(rooms)
      .where(and(
        eq(rooms.isActive, false),
        lt(rooms.lastActivityAt, cutoffDate)
      ));
  }

  async updateRoomActivity(id: string): Promise<Room | undefined> {
    const result = await db.update(rooms)
      .set({ lastActivityAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return result[0];
  }

  async getPublicRooms(gameSystem?: string): Promise<Array<Room & { playerCount: number }>> {
    const baseConditions = [
      eq(rooms.isActive, true),
      eq(rooms.isPublic, true)
    ];

    if (gameSystem) {
      baseConditions.push(eq(rooms.gameSystem, gameSystem));
    }

    const publicRooms = await db.select().from(rooms)
      .where(and(...baseConditions))
      .orderBy(desc(rooms.lastActivityAt));

    const roomsWithCounts = await Promise.all(
      publicRooms.map(async (room) => {
        const playerList = await this.getPlayersByRoom(room.id);
        return {
          ...room,
          playerCount: playerList.length
        };
      })
    );

    return roomsWithCounts.filter(room => room.playerCount < room.maxPlayers);
  }

  async getItem(id: string): Promise<Item | undefined> {
    return await db.query.items.findFirst({ where: eq(items.id, id) });
  }

  async getItemByName(name: string): Promise<Item | undefined> {
    return await db.query.items.findFirst({ 
      where: ilike(items.name, name) 
    });
  }

  async getItems(
    category?: typeof itemCategories[number],
    rarity?: typeof itemRarities[number]
  ): Promise<Item[]> {
    return await db.select().from(items)
      .where(and(
        category ? eq(items.category, category) : undefined,
        rarity ? eq(items.rarity, rarity) : undefined
      ));
  }

  async getAllItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async searchItems(query: string): Promise<Item[]> {
    return await db.select().from(items)
      .where(ilike(items.name, `%${query}%`))
      .limit(50);
  }

  async createItem(item: { 
    id: string; 
    name: string; 
    category: typeof itemCategories[number]; 
    type: string; 
    description: string; 
    rarity?: typeof itemRarities[number];
    gameSystem?: string;
  }): Promise<Item> {
    const result = await db.insert(items)
      .values({
        id: item.id,
        name: item.name,
        category: item.category,
        type: item.type,
        description: item.description,
        rarity: item.rarity || "common",
        gameSystem: item.gameSystem || "dnd",
        source: "DM-Created",
      })
      .returning();
    return result[0];
  }

  async getInventoryWithDetails(characterId: string): Promise<(InventoryItem & { item: Item })[]> {
    return await db.query.inventoryItems.findMany({
      where: eq(inventoryItems.characterId, characterId),
      with: { item: true },
    });
  }

  async addToInventory(insert: InsertInventoryItem): Promise<InventoryItem> {
    const itemExists = await this.getItem(insert.itemId);
    if (!itemExists) {
      throw new Error(`Item ${insert.itemId} not found`);
    }

    const existing = await db.query.inventoryItems.findFirst({
      where: and(
        eq(inventoryItems.characterId, insert.characterId),
        eq(inventoryItems.itemId, insert.itemId)
      ),
    });

    if (existing) {
      return await db.update(inventoryItems)
        .set({ quantity: existing.quantity + (insert.quantity || 1) })
        .where(eq(inventoryItems.id, existing.id))
        .returning()
        .then(rows => rows[0]);
    }

    return await db.insert(inventoryItems)
      .values(insert)
      .returning()
      .then(rows => rows[0]);
  }

  // Unified Characters (user-owned)
  async getSavedCharactersByUser(userId: string): Promise<SavedCharacter[]> {
    return await db.select().from(savedCharacters)
      .where(eq(savedCharacters.userId, userId))
      .orderBy(desc(savedCharacters.updatedAt));
  }

  async getSavedCharacter(id: string): Promise<SavedCharacter | undefined> {
    return await db.query.savedCharacters.findFirst({ 
      where: eq(savedCharacters.id, id) 
    });
  }

  async createSavedCharacter(character: InsertSavedCharacter): Promise<SavedCharacter> {
    const result = await db.insert(savedCharacters)
      .values(character)
      .returning();
    return result[0];
  }

  async updateSavedCharacter(id: string, updates: Partial<SavedCharacter>): Promise<SavedCharacter | undefined> {
    const result = await db.update(savedCharacters)
      .set(updates)
      .where(eq(savedCharacters.id, id))
      .returning();
    return result[0];
  }

  async deleteSavedCharacter(id: string): Promise<boolean> {
    await db.delete(savedCharacters).where(eq(savedCharacters.id, id));
    return true;
  }

  // Unified Character Room Operations
  async getCharactersByRoomCode(roomCode: string): Promise<SavedCharacter[]> {
    return await db.select().from(savedCharacters)
      .where(eq(savedCharacters.currentRoomCode, roomCode))
      .orderBy(savedCharacters.updatedAt);
  }

  async getCharacterByUserInRoom(userId: string, roomCode: string): Promise<SavedCharacter | undefined> {
    return await db.query.savedCharacters.findFirst({
      where: and(
        eq(savedCharacters.userId, userId),
        eq(savedCharacters.currentRoomCode, roomCode)
      )
    });
  }

  async joinRoom(characterId: string, roomCode: string): Promise<SavedCharacter | undefined> {
    const result = await db.update(savedCharacters)
      .set({ currentRoomCode: roomCode })
      .where(eq(savedCharacters.id, characterId))
      .returning();
    return result[0];
  }

  async leaveRoom(characterId: string): Promise<SavedCharacter | undefined> {
    const result = await db.update(savedCharacters)
      .set({ currentRoomCode: null })
      .where(eq(savedCharacters.id, characterId))
      .returning();
    return result[0];
  }

  async leaveAllCharactersFromRoom(roomCode: string): Promise<boolean> {
    await db.update(savedCharacters)
      .set({ currentRoomCode: null })
      .where(eq(savedCharacters.currentRoomCode, roomCode));
    return true;
  }

  // Saved Inventory (uses characterId now, not savedCharacterId)
  async getSavedInventoryByCharacter(characterId: string): Promise<SavedInventoryItem[]> {
    return await db.select().from(savedInventoryItems)
      .where(eq(savedInventoryItems.characterId, characterId));
  }

  async getSavedInventoryWithDetails(characterId: string): Promise<(SavedInventoryItem & { item: Item })[]> {
    const results = await db.query.characterInventoryItems.findMany({
      where: eq(characterInventoryItems.characterId, characterId),
      with: { item: true },
    });
    return results;
  }

  async addToSavedInventory(insert: InsertSavedInventoryItem): Promise<SavedInventoryItem> {
    const existing = await db.query.characterInventoryItems.findFirst({
      where: and(
        eq(characterInventoryItems.characterId, insert.characterId),
        eq(characterInventoryItems.itemId, insert.itemId)
      ),
    });

    if (existing) {
      return await db.update(savedInventoryItems)
        .set({ quantity: existing.quantity + (insert.quantity || 1) })
        .where(eq(savedInventoryItems.id, existing.id))
        .returning()
        .then(rows => rows[0]);
    }

    return await db.insert(savedInventoryItems)
      .values(insert)
      .returning()
      .then(rows => rows[0]);
  }

  async updateSavedInventoryItem(id: string, updates: Partial<SavedInventoryItem>): Promise<SavedInventoryItem | undefined> {
    const result = await db.update(savedInventoryItems)
      .set(updates)
      .where(eq(savedInventoryItems.id, id))
      .returning();
    return result[0];
  }

  async deleteSavedInventoryItem(id: string): Promise<boolean> {
    await db.delete(savedInventoryItems).where(eq(savedInventoryItems.id, id));
    return true;
  }

  // Status Effects (uses characterId now, not roomCharacterId)
  async getStatusEffectsByCharacter(characterId: string): Promise<CharacterStatusEffect[]> {
    return await db.select().from(characterStatusEffects)
      .where(eq(characterStatusEffects.characterId, characterId))
      .orderBy(characterStatusEffects.createdAt);
  }

  async createStatusEffect(effect: InsertStatusEffect): Promise<CharacterStatusEffect> {
    const result = await db.insert(characterStatusEffects)
      .values(effect)
      .returning();
    return result[0];
  }

  async deleteStatusEffect(id: string): Promise<boolean> {
    await db.delete(characterStatusEffects).where(eq(characterStatusEffects.id, id));
    return true;
  }

  async deleteStatusEffectsByCharacter(characterId: string): Promise<boolean> {
    await db.delete(characterStatusEffects).where(eq(characterStatusEffects.characterId, characterId));
    return true;
  }

  // Spells
  async getSpells(level?: number, school?: string, classFilter?: string): Promise<Spell[]> {
    let query = db.select().from(spells);
    const conditions = [];
    
    if (level !== undefined) {
      conditions.push(eq(spells.level, level));
    }
    if (school) {
      conditions.push(eq(spells.school, school as any));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const results = await query.orderBy(spells.level, spells.name);
    
    // Filter by class in memory since it's an array column
    if (classFilter) {
      return results.filter(spell => spell.classes.includes(classFilter));
    }
    return results;
  }

  async getSpell(id: string): Promise<Spell | undefined> {
    return await db.query.spells.findFirst({ where: eq(spells.id, id) });
  }

  async searchSpells(query: string): Promise<Spell[]> {
    return await db.select().from(spells)
      .where(ilike(spells.name, `%${query}%`))
      .orderBy(spells.level, spells.name);
  }
}

export const storage = new DatabaseStorage();

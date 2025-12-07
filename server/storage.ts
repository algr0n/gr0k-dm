import { 
  type Room, type InsertRoom,
  type Player, type InsertPlayer,
  type DiceRollRecord, type InsertDiceRoll,
  type User, type UpsertUser,
  type Character, type InsertCharacter,
  type InventoryItem, type InsertInventoryItem,
  type SavedCharacter, type InsertSavedCharacter,
  type SavedInventoryItem, type InsertSavedInventoryItem,
  type RoomCharacter, type InsertRoomCharacter, type UpdateRoomCharacter,
  type CharacterStatusEffect, type InsertStatusEffect,
  rooms, players, diceRolls, users, characters, inventoryItems,
  savedCharacters, savedInventoryItems, roomCharacters, characterStatusEffects
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt, sql, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  items, Item,
  itemCategoryEnum, itemRarityEnum 
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

  // Characters
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

  // Inventory
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
  getItems(category?: typeof itemCategoryEnum.enumValues[number], rarity?: typeof itemRarityEnum.enumValues[number]): Promise<Item[]>;
  searchItems(query: string): Promise<Item[]>;
  getInventoryWithDetails(characterId: string): Promise<(InventoryItem & { item: Item })[]>;
  addToInventory(insert: InsertInventoryItem): Promise<InventoryItem>;

  // Saved Characters (user-owned)
  getSavedCharactersByUser(userId: string): Promise<SavedCharacter[]>;
  getSavedCharacter(id: string): Promise<SavedCharacter | undefined>;
  createSavedCharacter(character: InsertSavedCharacter): Promise<SavedCharacter>;
  updateSavedCharacter(id: string, updates: Partial<SavedCharacter>): Promise<SavedCharacter | undefined>;
  deleteSavedCharacter(id: string): Promise<boolean>;

  // Saved Inventory
  getSavedInventoryByCharacter(savedCharacterId: string): Promise<SavedInventoryItem[]>;
  addToSavedInventory(insert: InsertSavedInventoryItem): Promise<SavedInventoryItem>;
  updateSavedInventoryItem(id: string, updates: Partial<SavedInventoryItem>): Promise<SavedInventoryItem | undefined>;
  deleteSavedInventoryItem(id: string): Promise<boolean>;

  // Room Characters (character instances in game rooms)
  getRoomCharacter(id: string): Promise<RoomCharacter | undefined>;
  getRoomCharactersByRoom(roomId: string): Promise<RoomCharacter[]>;
  getRoomCharacterByUserInRoom(userId: string, roomId: string): Promise<RoomCharacter | undefined>;
  createRoomCharacter(character: InsertRoomCharacter): Promise<RoomCharacter>;
  updateRoomCharacter(id: string, updates: UpdateRoomCharacter): Promise<RoomCharacter | undefined>;
  deleteRoomCharacter(id: string): Promise<boolean>;
  deleteRoomCharactersByRoom(roomId: string): Promise<boolean>;

  // Status Effects
  getStatusEffectsByRoomCharacter(roomCharacterId: string): Promise<CharacterStatusEffect[]>;
  createStatusEffect(effect: InsertStatusEffect): Promise<CharacterStatusEffect>;
  deleteStatusEffect(id: string): Promise<boolean>;
  deleteStatusEffectsByRoomCharacter(roomCharacterId: string): Promise<boolean>;
}

class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return await db.query.users.findFirst({ where: eq(users.id, id) });
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

  async getItems(
    category?: typeof itemCategoryEnum.enumValues[number],
    rarity?: typeof itemRarityEnum.enumValues[number]
  ): Promise<Item[]> {
    return await db.select().from(items)
      .where(and(
        category ? eq(items.category, category) : undefined,
        rarity ? eq(items.rarity, rarity) : undefined
      ));
  }

  async searchItems(query: string): Promise<Item[]> {
    return await db.select().from(items)
      .where(ilike(items.name, `%${query}%`))
      .limit(50);  // Limit to prevent huge results
  }

  async getInventoryWithDetails(characterId: string): Promise<(InventoryItem & { item: Item })[]> {
    return await db.query.inventoryItems.findMany({
      where: eq(inventoryItems.characterId, characterId),
      with: { item: true },
    });
  }

  async addToInventory(insert: InsertInventoryItem): Promise<InventoryItem> {
    // Check if item exists
    const itemExists = await this.getItem(insert.itemId);
    if (!itemExists) {
      throw new Error(`Item ${insert.itemId} not found`);
    }

    // Upsert: If same item already in inventory, increment quantity
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

  // Saved Characters (user-owned)
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

  // Saved Inventory
  async getSavedInventoryByCharacter(savedCharacterId: string): Promise<SavedInventoryItem[]> {
    return await db.select().from(savedInventoryItems)
      .where(eq(savedInventoryItems.savedCharacterId, savedCharacterId));
  }

  async addToSavedInventory(insert: InsertSavedInventoryItem): Promise<SavedInventoryItem> {
    const existing = await db.query.savedInventoryItems.findFirst({
      where: and(
        eq(savedInventoryItems.savedCharacterId, insert.savedCharacterId),
        eq(savedInventoryItems.itemId, insert.itemId)
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

  // Room Characters (character instances in game rooms)
  async getRoomCharacter(id: string): Promise<RoomCharacter | undefined> {
    return await db.query.roomCharacters.findFirst({ where: eq(roomCharacters.id, id) });
  }

  async getRoomCharactersByRoom(roomId: string): Promise<RoomCharacter[]> {
    return await db.select().from(roomCharacters)
      .where(eq(roomCharacters.roomId, roomId))
      .orderBy(roomCharacters.joinedAt);
  }

  async getRoomCharacterByUserInRoom(userId: string, roomId: string): Promise<RoomCharacter | undefined> {
    return await db.query.roomCharacters.findFirst({
      where: and(
        eq(roomCharacters.userId, userId),
        eq(roomCharacters.roomId, roomId)
      )
    });
  }

  async createRoomCharacter(character: InsertRoomCharacter): Promise<RoomCharacter> {
    const result = await db.insert(roomCharacters)
      .values(character)
      .returning();
    return result[0];
  }

  async updateRoomCharacter(id: string, updates: UpdateRoomCharacter): Promise<RoomCharacter | undefined> {
    const result = await db.update(roomCharacters)
      .set(updates)
      .where(eq(roomCharacters.id, id))
      .returning();
    return result[0];
  }

  async deleteRoomCharacter(id: string): Promise<boolean> {
    await db.delete(roomCharacters).where(eq(roomCharacters.id, id));
    return true;
  }

  async deleteRoomCharactersByRoom(roomId: string): Promise<boolean> {
    await db.delete(roomCharacters).where(eq(roomCharacters.roomId, roomId));
    return true;
  }

  // Status Effects
  async getStatusEffectsByRoomCharacter(roomCharacterId: string): Promise<CharacterStatusEffect[]> {
    return await db.select().from(characterStatusEffects)
      .where(eq(characterStatusEffects.roomCharacterId, roomCharacterId))
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

  async deleteStatusEffectsByRoomCharacter(roomCharacterId: string): Promise<boolean> {
    await db.delete(characterStatusEffects).where(eq(characterStatusEffects.roomCharacterId, roomCharacterId));
    return true;
  }
}

export const storage = new DatabaseStorage();
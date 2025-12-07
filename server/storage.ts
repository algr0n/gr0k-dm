import { 
  type Room, type InsertRoom,
  type Player, type InsertPlayer,
  type DiceRollRecord, type InsertDiceRoll,
  type User, type UpsertUser,
  type Character, type InsertCharacter,
  type InventoryItem, type InsertInventoryItem,
  rooms, players, diceRolls, users, characters, inventoryItems
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt, sql, count } from "drizzle-orm";
import { randomUUID } from "crypto";

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
  
  // Dice Rolls
  getDiceRoll(id: string): Promise<DiceRollRecord | undefined>;
  getRecentDiceRolls(limit?: number): Promise<DiceRollRecord[]>;
  getDiceRollsByRoom(roomId: string, limit?: number): Promise<DiceRollRecord[]>;
  createDiceRoll(roll: InsertDiceRoll): Promise<DiceRollRecord>;
  
  // Characters
  getCharacter(id: string): Promise<Character | undefined>;
  getCharacterByPlayer(playerId: string, roomId: string): Promise<Character | undefined>;
  getCharactersByRoom(roomId: string): Promise<Character[]>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: string, updates: Partial<Character>): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<boolean>;
  
  // Inventory
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryByCharacter(characterId: string): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<boolean>;
  
  // Room Cleanup
  deleteCharactersByRoom(roomId: string): Promise<boolean>;
  deleteDiceRollsByRoom(roomId: string): Promise<boolean>;
  deleteInventoryByRoom(roomId: string): Promise<boolean>;
  deleteRoomWithAllData(roomId: string): Promise<boolean>;
  getStaleInactiveRooms(hoursOld: number): Promise<Room[]>;
  updateRoomActivity(id: string): Promise<Room | undefined>;
  
  // Public room browsing
  getPublicRooms(gameSystem?: string): Promise<Array<Room & { playerCount: number }>>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
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

  // Rooms
  async getRoom(id: string): Promise<Room | undefined> {
    const result = await db.select().from(rooms).where(eq(rooms.id, id));
    return result[0];
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const result = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase()));
    return result[0];
  }

  async getAllRooms(): Promise<Room[]> {
    return await db.select().from(rooms).orderBy(desc(rooms.createdAt));
  }

  async getActiveRooms(): Promise<Room[]> {
    const result = await db.select().from(rooms).where(eq(rooms.isActive, true)).orderBy(desc(rooms.createdAt));
    return result;
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = randomUUID();
    const code = insertRoom.code || generateRoomCode();
    const values = {
      id,
      code,
      name: insertRoom.name,
      gameSystem: insertRoom.gameSystem || "dnd",
      hostName: insertRoom.hostName,
      description: insertRoom.description ?? null,
      currentScene: insertRoom.currentScene ?? null,
      messageHistory: insertRoom.messageHistory ?? [],
      isActive: insertRoom.isActive ?? true,
      isPublic: insertRoom.isPublic ?? false,
      maxPlayers: insertRoom.maxPlayers ?? 8,
    };
    const result = await db.insert(rooms).values(values as any).returning();
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
    const result = await db.delete(rooms).where(eq(rooms.id, id)).returning();
    return result.length > 0;
  }

  // Players
  async getPlayer(id: string): Promise<Player | undefined> {
    const result = await db.select().from(players).where(eq(players.id, id));
    return result[0];
  }

  async getPlayersByRoom(roomId: string): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.roomId, roomId));
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = randomUUID();
    const values = {
      id,
      roomId: insertPlayer.roomId,
      name: insertPlayer.name,
      isHost: insertPlayer.isHost ?? false,
    };
    const result = await db.insert(players).values(values as any).returning();
    return result[0];
  }

  async deletePlayer(id: string): Promise<boolean> {
    const result = await db.delete(players).where(eq(players.id, id)).returning();
    return result.length > 0;
  }

  async deletePlayersByRoom(roomId: string): Promise<boolean> {
    await db.delete(players).where(eq(players.roomId, roomId));
    return true;
  }

  // Dice Rolls
  async getDiceRoll(id: string): Promise<DiceRollRecord | undefined> {
    const result = await db.select().from(diceRolls).where(eq(diceRolls.id, id));
    return result[0];
  }

  async getRecentDiceRolls(limit: number = 20): Promise<DiceRollRecord[]> {
    return await db.select().from(diceRolls)
      .orderBy(desc(diceRolls.timestamp))
      .limit(limit);
  }

  async getDiceRollsByRoom(roomId: string, limit: number = 20): Promise<DiceRollRecord[]> {
    return await db.select().from(diceRolls)
      .where(eq(diceRolls.roomId, roomId))
      .orderBy(desc(diceRolls.timestamp))
      .limit(limit);
  }

  async createDiceRoll(insertRoll: InsertDiceRoll): Promise<DiceRollRecord> {
    const id = randomUUID();
    const values = {
      id,
      expression: insertRoll.expression,
      rolls: insertRoll.rolls,
      total: insertRoll.total,
      roomId: insertRoll.roomId ?? null,
      playerId: insertRoll.playerId ?? null,
      modifier: insertRoll.modifier ?? 0,
      purpose: insertRoll.purpose ?? null,
      timestamp: insertRoll.timestamp ?? new Date(),
    };
    const result = await db.insert(diceRolls).values(values as any).returning();
    return result[0];
  }

  // Characters
  async getCharacter(id: string): Promise<Character | undefined> {
    const result = await db.select().from(characters).where(eq(characters.id, id));
    return result[0];
  }

  async getCharacterByPlayer(playerId: string, roomId: string): Promise<Character | undefined> {
    const result = await db.select().from(characters)
      .where(and(eq(characters.playerId, playerId), eq(characters.roomId, roomId)));
    return result[0];
  }

  async getCharactersByRoom(roomId: string): Promise<Character[]> {
    return await db.select().from(characters).where(eq(characters.roomId, roomId));
  }

  async createCharacter(insertChar: InsertCharacter): Promise<Character> {
    const id = randomUUID();
    const values = {
      id,
      playerId: insertChar.playerId,
      roomId: insertChar.roomId,
      name: insertChar.name,
      gameSystem: insertChar.gameSystem,
      level: insertChar.level ?? 1,
      currentHp: insertChar.currentHp ?? 10,
      maxHp: insertChar.maxHp ?? 10,
      stats: insertChar.stats ?? {},
      skills: insertChar.skills ?? [],
      spells: insertChar.spells ?? [],
      notes: insertChar.notes ?? null,
    };
    const result = await db.insert(characters).values(values as any).returning();
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
    const result = await db.delete(characters).where(eq(characters.id, id)).returning();
    return result.length > 0;
  }

  // Inventory
  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const result = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return result[0];
  }

  async getInventoryByCharacter(characterId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems)
      .where(eq(inventoryItems.characterId, characterId))
      .orderBy(desc(inventoryItems.createdAt));
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const values = {
      id,
      characterId: insertItem.characterId,
      name: insertItem.name,
      description: insertItem.description ?? null,
      quantity: insertItem.quantity ?? 1,
      grantedBy: insertItem.grantedBy ?? null,
    };
    const result = await db.insert(inventoryItems).values(values as any).returning();
    return result[0];
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | undefined> {
    const result = await db.update(inventoryItems)
      .set(updates)
      .where(eq(inventoryItems.id, id))
      .returning();
    return result[0];
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).returning();
    return result.length > 0;
  }

  // Room Cleanup Methods
  async deleteCharactersByRoom(roomId: string): Promise<boolean> {
    await db.delete(characters).where(eq(characters.roomId, roomId));
    return true;
  }

  async deleteDiceRollsByRoom(roomId: string): Promise<boolean> {
    await db.delete(diceRolls).where(eq(diceRolls.roomId, roomId));
    return true;
  }

  async deleteInventoryByRoom(roomId: string): Promise<boolean> {
    const roomCharacters = await this.getCharactersByRoom(roomId);
    for (const char of roomCharacters) {
      await db.delete(inventoryItems).where(eq(inventoryItems.characterId, char.id));
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
}

export const storage = new DatabaseStorage();

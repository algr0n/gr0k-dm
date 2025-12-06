import { 
  type Room, type InsertRoom,
  type Player, type InsertPlayer,
  type DiceRollRecord, type InsertDiceRoll,
  type User, type UpsertUser,
  rooms, players, diceRolls, users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
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
      gameSystem: insertRoom.gameSystem || "dnd5e",
      hostName: insertRoom.hostName,
      description: insertRoom.description ?? null,
      currentScene: insertRoom.currentScene ?? null,
      messageHistory: insertRoom.messageHistory ?? [],
      isActive: insertRoom.isActive ?? true,
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
}

export const storage = new DatabaseStorage();

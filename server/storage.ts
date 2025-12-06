import { 
  type Character, type InsertCharacter,
  type GameSession, type InsertGameSession,
  type DiceRollRecord, type InsertDiceRoll,
  type User, type InsertUser,
  characters, gameSessions, diceRolls, users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Characters
  getCharacter(id: string): Promise<Character | undefined>;
  getCharactersByDiscordUser(discordUserId: string): Promise<Character[]>;
  getCharactersByDiscordUsername(discordUsername: string): Promise<Character[]>;
  getActiveCharacterByDiscordUser(discordUserId: string): Promise<Character | undefined>;
  getAllCharacters(): Promise<Character[]>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: string, updates: Partial<Character>): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<boolean>;
  
  // Game Sessions
  getSession(id: string): Promise<GameSession | undefined>;
  getSessionByChannel(channelId: string): Promise<GameSession | undefined>;
  getAllSessions(): Promise<GameSession[]>;
  getActiveSessions(): Promise<GameSession[]>;
  createSession(session: InsertGameSession): Promise<GameSession>;
  updateSession(id: string, updates: Partial<GameSession>): Promise<GameSession | undefined>;
  deleteSession(id: string): Promise<boolean>;
  
  // Dice Rolls
  getDiceRoll(id: string): Promise<DiceRollRecord | undefined>;
  getRecentDiceRolls(limit?: number): Promise<DiceRollRecord[]>;
  createDiceRoll(roll: InsertDiceRoll): Promise<DiceRollRecord>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await db.insert(users).values({ ...insertUser, id }).returning();
    return result[0];
  }

  // Characters
  async getCharacter(id: string): Promise<Character | undefined> {
    const result = await db.select().from(characters).where(eq(characters.id, id));
    return result[0];
  }

  async getCharactersByDiscordUser(discordUserId: string): Promise<Character[]> {
    return await db.select().from(characters).where(eq(characters.discordUserId, discordUserId));
  }

  async getCharactersByDiscordUsername(discordUsername: string): Promise<Character[]> {
    return await db.select().from(characters).where(eq(characters.discordUsername, discordUsername));
  }

  async getActiveCharacterByDiscordUser(discordUserId: string): Promise<Character | undefined> {
    const result = await db.select().from(characters)
      .where(eq(characters.discordUserId, discordUserId));
    return result.find(c => c.isActive);
  }

  async getAllCharacters(): Promise<Character[]> {
    return await db.select().from(characters);
  }

  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const id = randomUUID();
    const values = {
      id,
      discordUserId: insertCharacter.discordUserId,
      discordUsername: insertCharacter.discordUsername,
      name: insertCharacter.name,
      race: insertCharacter.race,
      characterClass: insertCharacter.characterClass,
      stats: insertCharacter.stats,
      level: insertCharacter.level ?? 1,
      currentHp: insertCharacter.currentHp ?? 10,
      maxHp: insertCharacter.maxHp ?? 10,
      armorClass: insertCharacter.armorClass ?? 10,
      inventory: insertCharacter.inventory ?? [],
      isActive: insertCharacter.isActive ?? true,
      backstory: insertCharacter.backstory ?? null,
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

  // Game Sessions
  async getSession(id: string): Promise<GameSession | undefined> {
    const result = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
    return result[0];
  }

  async getSessionByChannel(channelId: string): Promise<GameSession | undefined> {
    const result = await db.select().from(gameSessions)
      .where(eq(gameSessions.discordChannelId, channelId));
    return result.find(s => s.isActive);
  }

  async getAllSessions(): Promise<GameSession[]> {
    return await db.select().from(gameSessions);
  }

  async getActiveSessions(): Promise<GameSession[]> {
    const result = await db.select().from(gameSessions);
    return result.filter(s => s.isActive);
  }

  async createSession(insertSession: InsertGameSession): Promise<GameSession> {
    const id = randomUUID();
    const values = {
      id,
      discordChannelId: insertSession.discordChannelId,
      name: insertSession.name,
      description: insertSession.description ?? null,
      currentScene: insertSession.currentScene ?? null,
      discordGuildId: insertSession.discordGuildId ?? null,
      messageHistory: insertSession.messageHistory ?? [],
      quests: insertSession.quests ?? [],
      isActive: insertSession.isActive ?? true,
    };
    const result = await db.insert(gameSessions).values(values as any).returning();
    return result[0];
  }

  async updateSession(id: string, updates: Partial<GameSession>): Promise<GameSession | undefined> {
    const result = await db.update(gameSessions)
      .set(updates)
      .where(eq(gameSessions.id, id))
      .returning();
    return result[0];
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(gameSessions).where(eq(gameSessions.id, id)).returning();
    return result.length > 0;
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

  async createDiceRoll(insertRoll: InsertDiceRoll): Promise<DiceRollRecord> {
    const id = randomUUID();
    const values = {
      id,
      expression: insertRoll.expression,
      rolls: insertRoll.rolls,
      total: insertRoll.total,
      sessionId: insertRoll.sessionId ?? null,
      characterId: insertRoll.characterId ?? null,
      modifier: insertRoll.modifier ?? 0,
      purpose: insertRoll.purpose ?? null,
      timestamp: insertRoll.timestamp ?? new Date(),
    };
    const result = await db.insert(diceRolls).values(values as any).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();

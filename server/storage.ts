import { 
  type Character, type InsertCharacter,
  type GameSession, type InsertGameSession,
  type DiceRollRecord, type InsertDiceRoll,
  type User, type InsertUser
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Characters
  getCharacter(id: string): Promise<Character | undefined>;
  getCharactersByDiscordUser(discordUserId: string): Promise<Character[]>;
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private characters: Map<string, Character>;
  private sessions: Map<string, GameSession>;
  private diceRolls: Map<string, DiceRollRecord>;

  constructor() {
    this.users = new Map();
    this.characters = new Map();
    this.sessions = new Map();
    this.diceRolls = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Characters
  async getCharacter(id: string): Promise<Character | undefined> {
    return this.characters.get(id);
  }

  async getCharactersByDiscordUser(discordUserId: string): Promise<Character[]> {
    return Array.from(this.characters.values()).filter(
      (char) => char.discordUserId === discordUserId
    );
  }

  async getActiveCharacterByDiscordUser(discordUserId: string): Promise<Character | undefined> {
    return Array.from(this.characters.values()).find(
      (char) => char.discordUserId === discordUserId && char.isActive
    );
  }

  async getAllCharacters(): Promise<Character[]> {
    return Array.from(this.characters.values());
  }

  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const id = randomUUID();
    const character: Character = {
      ...insertCharacter,
      id,
      level: insertCharacter.level ?? 1,
      currentHp: insertCharacter.currentHp ?? 10,
      maxHp: insertCharacter.maxHp ?? 10,
      armorClass: insertCharacter.armorClass ?? 10,
      inventory: insertCharacter.inventory ?? [],
      isActive: insertCharacter.isActive ?? true,
      backstory: insertCharacter.backstory ?? null,
    };
    this.characters.set(id, character);
    return character;
  }

  async updateCharacter(id: string, updates: Partial<Character>): Promise<Character | undefined> {
    const character = this.characters.get(id);
    if (!character) return undefined;
    const updated = { ...character, ...updates };
    this.characters.set(id, updated);
    return updated;
  }

  async deleteCharacter(id: string): Promise<boolean> {
    return this.characters.delete(id);
  }

  // Game Sessions
  async getSession(id: string): Promise<GameSession | undefined> {
    return this.sessions.get(id);
  }

  async getSessionByChannel(channelId: string): Promise<GameSession | undefined> {
    return Array.from(this.sessions.values()).find(
      (session) => session.discordChannelId === channelId && session.isActive
    );
  }

  async getAllSessions(): Promise<GameSession[]> {
    return Array.from(this.sessions.values());
  }

  async getActiveSessions(): Promise<GameSession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.isActive);
  }

  async createSession(insertSession: InsertGameSession): Promise<GameSession> {
    const id = randomUUID();
    const session: GameSession = {
      ...insertSession,
      id,
      description: insertSession.description ?? null,
      currentScene: insertSession.currentScene ?? null,
      discordGuildId: insertSession.discordGuildId ?? null,
      messageHistory: insertSession.messageHistory ?? [],
      quests: insertSession.quests ?? [],
      isActive: insertSession.isActive ?? true,
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: string, updates: Partial<GameSession>): Promise<GameSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  // Dice Rolls
  async getDiceRoll(id: string): Promise<DiceRollRecord | undefined> {
    return this.diceRolls.get(id);
  }

  async getRecentDiceRolls(limit: number = 20): Promise<DiceRollRecord[]> {
    const rolls = Array.from(this.diceRolls.values());
    return rolls
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createDiceRoll(insertRoll: InsertDiceRoll): Promise<DiceRollRecord> {
    const id = randomUUID();
    const roll: DiceRollRecord = {
      ...insertRoll,
      id,
      sessionId: insertRoll.sessionId ?? null,
      characterId: insertRoll.characterId ?? null,
      modifier: insertRoll.modifier ?? 0,
      purpose: insertRoll.purpose ?? null,
      timestamp: insertRoll.timestamp ?? new Date(),
    };
    this.diceRolls.set(id, roll);
    return roll;
  }
}

export const storage = new MemStorage();

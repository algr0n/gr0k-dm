// NOTE: This file defines the Storage interface surface that server code expects.
// Legacy room-bound "characters" and legacy inventory_items methods have been removed
// in favor of the unified characters model (unified_characters + character_inventory_items).
//
// If your concrete implementation was in this file, keep the implementation but
// ensure it implements the interface below. If the concrete implementation lives
// elsewhere (e.g., server/db/*) you can keep that and export the instance as `storage`.
//
// Below is the cleaned interface (remove legacy methods).

import type {
  Room,
  Player,
  DiceRollRecord,
  Item,
  SavedCharacter,
  InsertSavedCharacter,
  SavedInventoryItem,
  InsertSavedInventoryItem,
  CharacterInventoryItemWithDetails,
  User,
  InsertUser,
  Spell,
} from "@shared/schema";

export interface Storage {
  // Rooms
  createRoom(room: any): Promise<Room>;
  getRoom(id: string): Promise<Room | undefined>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;
  getPublicRooms(gameSystem?: string): Promise<Array<Room & { playerCount: number }>>;

  // Players
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayersByRoom(roomId: string): Promise<Player[]>;
  createPlayer(player: any): Promise<Player>;
  deletePlayer(id: string): Promise<boolean>;
  deletePlayersByRoom(roomId: string): Promise<boolean>;

  // Dice Rolls
  getDiceRollsByRoom(roomId: string): Promise<DiceRollRecord[]>;
  createDiceRoll(roll: any): Promise<DiceRollRecord>;
  deleteDiceRollsByRoom(roomId: string): Promise<boolean>;

  // Items
  getItem(id: string): Promise<Item | undefined>;
  getItemByName(name: string): Promise<Item | undefined>;
  getItems(category?: string, rarity?: string): Promise<Item[]>;
  getAllItems(): Promise<Item[]>;
  searchItems(query: string): Promise<Item[]>;
  createItem(item: {
    id: string;
    name: string;
    category: string;
    type: string;
    description: string;
    rarity?: string;
    cost?: number | null;
    weight?: number | null;
    properties?: Record<string, unknown>;
    requiresAttunement?: boolean;
    gameSystem?: string;
  }): Promise<Item>;

  // Unified Characters (user-owned, persistent)
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

  // Alternative / compatibility inventory API used by some parts of the server
  getInventoryWithDetails(characterId: string): Promise<(SavedInventoryItem & { item: Item })[]>;
  addToInventory(insert: InsertSavedInventoryItem): Promise<SavedInventoryItem>;
  addToSavedInventory(insert: { characterId: string; itemId: string; quantity?: number }): Promise<SavedInventoryItem>;
  updateSavedInventoryItem(id: string, updates: Partial<SavedInventoryItem>): Promise<SavedInventoryItem | undefined>;
  deleteSavedInventoryItem(id: string): Promise<boolean>;

  // Room/player utilities
  updateRoomActivity(id: string): Promise<Room | undefined>;
  deleteRoomWithAllData(roomId: string): Promise<boolean>;
  getStaleInactiveRooms(hoursOld: number): Promise<Room[]>;

  // Status effects
  createStatusEffect(effect: any): Promise<any>;
  getStatusEffectsByCharacter(characterId: string): Promise<any[]>;
  getCharacterStatusEffects(characterId: string): Promise<any[]>;
  deleteStatusEffect(id: string): Promise<boolean>;
  deleteStatusEffectsByCharacter(characterId: string): Promise<boolean>;
  addStatusEffect(effect: any): Promise<any>;
  removeStatusEffect(id: string): Promise<boolean>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Misc (spells)
  searchSpells(query: string): Promise<Spell[]>;
  getSpells(level?: number, school?: string, classFilter?: string): Promise<Spell[]>;
  getSpell(id: string): Promise<Spell | undefined>;

  // Story Tracking - Quest Objective Progress
  getQuestObjectivesByRoom(roomId: string): Promise<any[]>;
  getQuestObjectivesByQuest(questId: string): Promise<any[]>;
  createQuestObjective(objective: any): Promise<any>;
  updateQuestObjective(id: string, updates: any): Promise<any | undefined>;
  deleteQuestObjectivesByRoom(roomId: string): Promise<boolean>;

  // Story Tracking - Story Events
  getStoryEventsByRoom(roomId: string, options?: { limit?: number; eventType?: string; minImportance?: number }): Promise<any[]>;
  createStoryEvent(event: any): Promise<any>;
  deleteStoryEventsByRoom(roomId: string): Promise<boolean>;

  // Story Tracking - Session Summaries
  getSessionSummariesByRoom(roomId: string): Promise<any[]>;
  getLatestSessionSummary(roomId: string): Promise<any | undefined>;
  createSessionSummary(summary: any): Promise<any>;
  updateSessionSummary(id: string, updates: any): Promise<any | undefined>;
  deleteSessionSummariesByRoom(roomId: string): Promise<boolean>;

  // Token usage
  // getTokenUsage is implemented in grok.ts - exported separately

  // Any additional helpers the implementation exposes
  [key: string]: any;
}

// DatabaseStorage: Concrete implementation of the Storage interface using Drizzle ORM
import { db } from "./db";
import { randomUUID } from "crypto";
import { 
  rooms, players, diceRolls, items, spells,
  savedCharacters, characterInventoryItems, characterStatusEffects, users,
} from "@shared/schema";
import {
  questObjectiveProgress,
  storyEvents,
  sessionSummaries,
} from "@shared/adventure-schema";
// Type imports are already declared above; keep only the table imports (avoid duplicate type declarations).
import { eq, and, like, desc, sql, lt, gte } from "drizzle-orm";

class DatabaseStorage implements Storage {
  // ==============================================================================
  // Rooms
  // ==============================================================================
  async createRoom(room: any): Promise<Room> {
    const id = randomUUID();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const [created] = await db.insert(rooms).values({
      ...room,
      id,
      code,
    }).returning();
    return created;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return await db.query.rooms.findFirst({ where: eq(rooms.id, id) });
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return await db.query.rooms.findFirst({ where: eq(rooms.code, code) });
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const [updated] = await db.update(rooms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return updated;
  }

  async deleteRoom(id: string): Promise<boolean> {
    await db.delete(rooms).where(eq(rooms.id, id));
    return true;
  }

  async getPublicRooms(gameSystem?: string): Promise<Array<Room & { playerCount: number }>> {
    const query = db.select({
      room: rooms,
      playerCount: sql<number>`CAST(count(${players.id}) as INTEGER)`,
    })
      .from(rooms)
      .leftJoin(players, eq(rooms.id, players.roomId))
      .where(
        and(
          eq(rooms.isPublic, true),
          eq(rooms.isActive, true),
          gameSystem ? eq(rooms.gameSystem, gameSystem) : undefined
        )
      )
      .groupBy(rooms.id);
    
    const results = await query;
    // TODO: Remove debug logging once public rooms visibility is verified in production
    console.log('[getPublicRooms] Query results:', results.length, 'rooms found');
    return results.map(r => ({ ...r.room, playerCount: Number(r.playerCount) || 0 }));
  }

  async updateRoomActivity(id: string): Promise<Room | undefined> {
    return await this.updateRoom(id, { lastActivityAt: new Date() });
  }

  async deleteRoomWithAllData(roomId: string): Promise<boolean> {
    // Delete story tracking data (not cascade-deleted since no FK to rooms)
    await this.deleteQuestObjectivesByRoom(roomId);
    await this.deleteStoryEventsByRoom(roomId);
    await this.deleteSessionSummariesByRoom(roomId);
    
    // Cascade delete should handle related data with FKs
    await this.deleteRoom(roomId);
    return true;
  }

  async getStaleInactiveRooms(hoursOld: number): Promise<Room[]> {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    return await db.select().from(rooms)
      .where(
        and(
          eq(rooms.isActive, false),
          lt(rooms.lastActivityAt, cutoffDate)
        )
      );
  }

  // ==============================================================================
  // Players
  // ==============================================================================
  async getPlayer(id: string): Promise<Player | undefined> {
    return await db.query.players.findFirst({ where: eq(players.id, id) });
  }

  async getPlayersByRoom(roomId: string): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.roomId, roomId));
  }

  async createPlayer(player: any): Promise<Player> {
    const id = randomUUID();
    const [created] = await db.insert(players).values({ ...player, id }).returning();
    return created;
  }

  async deletePlayer(id: string): Promise<boolean> {
    await db.delete(players).where(eq(players.id, id));
    return true;
  }

  async deletePlayersByRoom(roomId: string): Promise<boolean> {
    await db.delete(players).where(eq(players.roomId, roomId));
    return true;
  }

  // ==============================================================================
  // Dice Rolls
  // ==============================================================================
  async getDiceRollsByRoom(roomId: string): Promise<DiceRollRecord[]> {
    return await db.select().from(diceRolls).where(eq(diceRolls.roomId, roomId));
  }

  async createDiceRoll(roll: any): Promise<DiceRollRecord> {
    const id = randomUUID();
    const [created] = await db.insert(diceRolls).values({ ...roll, id }).returning();
    return created;
  }

  async deleteDiceRollsByRoom(roomId: string): Promise<boolean> {
    await db.delete(diceRolls).where(eq(diceRolls.roomId, roomId));
    return true;
  }

  // ==============================================================================
  // Items
  // ==============================================================================
  async getItem(id: string): Promise<Item | undefined> {
    return await db.query.items.findFirst({ where: eq(items.id, id) });
  }

  async getItemByName(name: string): Promise<Item | undefined> {
    return await db.query.items.findFirst({ where: eq(items.name, name) });
  }

  async getItems(category?: string, rarity?: string): Promise<Item[]> {
    return await db.select().from(items).where(
      and(
        category ? eq(items.category, category) : undefined,
        rarity ? eq(items.rarity, rarity) : undefined
      )
    );
  }

  async getAllItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async searchItems(query: string): Promise<Item[]> {
    return await db.select().from(items)
      .where(like(items.name, `%${query}%`))
      .limit(50);
  }

  async createItem(item: {
    id: string;
    name: string;
    category: string;
    type: string;
    description: string;
    rarity?: string;
    cost?: number | null;
    weight?: number | null;
    properties?: Record<string, unknown>;
    requiresAttunement?: boolean;
    gameSystem?: string;
  }): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  // ==============================================================================
  // Saved Characters (Unified Characters)
  // ==============================================================================
  async getSavedCharactersByUser(userId: string): Promise<SavedCharacter[]> {
    return await db.select().from(savedCharacters)
      .where(eq(savedCharacters.userId, userId))
      .orderBy(desc(savedCharacters.updatedAt));
  }

  async getSavedCharacter(id: string): Promise<SavedCharacter | undefined> {
    return await db.query.savedCharacters.findFirst({ where: eq(savedCharacters.id, id) });
  }

  async createSavedCharacter(character: InsertSavedCharacter): Promise<SavedCharacter> {
    const id = randomUUID();
    const [created] = await db.insert(savedCharacters).values({ ...character, id }).returning();
    return created;
  }

  async updateSavedCharacter(id: string, updates: Partial<SavedCharacter>): Promise<SavedCharacter | undefined> {
    const [updated] = await db.update(savedCharacters)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedCharacters.id, id))
      .returning();
    return updated;
  }

  async deleteSavedCharacter(id: string): Promise<boolean> {
    await db.delete(savedCharacters).where(eq(savedCharacters.id, id));
    return true;
  }

  // ==============================================================================
  // Unified Character Room Operations
  // ==============================================================================
  async getCharactersByRoomCode(roomCode: string): Promise<SavedCharacter[]> {
    return await db.select().from(savedCharacters)
      .where(eq(savedCharacters.currentRoomCode, roomCode));
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
    return await this.updateSavedCharacter(characterId, { currentRoomCode: roomCode });
  }

  async leaveRoom(characterId: string): Promise<SavedCharacter | undefined> {
    return await this.updateSavedCharacter(characterId, { currentRoomCode: null });
  }

  async leaveAllCharactersFromRoom(roomCode: string): Promise<boolean> {
    await db.update(savedCharacters)
      .set({ currentRoomCode: null })
      .where(eq(savedCharacters.currentRoomCode, roomCode));
    return true;
  }

  // ==============================================================================
  // Saved Inventory
  // ==============================================================================
  async getSavedInventoryByCharacter(characterId: string): Promise<SavedInventoryItem[]> {
    return await db.select().from(characterInventoryItems)
      .where(eq(characterInventoryItems.characterId, characterId));
  }

  async getSavedInventoryWithDetails(characterId: string): Promise<(SavedInventoryItem & { item: Item })[]> {
    return await db.query.characterInventoryItems.findMany({
      where: eq(characterInventoryItems.characterId, characterId),
      with: { item: true }
    });
  }

  async getInventoryWithDetails(characterId: string): Promise<(SavedInventoryItem & { item: Item })[]> {
    return await this.getSavedInventoryWithDetails(characterId);
  }

  async addToInventory(insert: InsertSavedInventoryItem): Promise<SavedInventoryItem> {
    return await this.addToSavedInventory(insert);
  }

  async addToSavedInventory(insert: { characterId: string; itemId: string; quantity?: number }): Promise<SavedInventoryItem> {
    // Check if item already exists
    const existing = await db.query.characterInventoryItems.findFirst({
      where: and(
        eq(characterInventoryItems.characterId, insert.characterId),
        eq(characterInventoryItems.itemId, insert.itemId)
      )
    });

    if (existing) {
      // Update existing item quantity
      const [updated] = await db.update(characterInventoryItems)
        .set({ 
          quantity: existing.quantity + (insert.quantity || 1),
          updatedAt: new Date()
        })
        .where(eq(characterInventoryItems.id, existing.id))
        .returning();
      return updated;
    }

    // Create new inventory item
    const id = randomUUID();
    const [created] = await db.insert(characterInventoryItems).values({ ...insert, id }).returning();
    return created;
  }

  async updateSavedInventoryItem(id: string, updates: Partial<SavedInventoryItem>): Promise<SavedInventoryItem | undefined> {
    const [updated] = await db.update(characterInventoryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(characterInventoryItems.id, id))
      .returning();
    return updated;
  }

  async deleteSavedInventoryItem(id: string): Promise<boolean> {
    await db.delete(characterInventoryItems).where(eq(characterInventoryItems.id, id));
    return true;
  }

  // ==============================================================================
  // Status Effects
  // ==============================================================================
  async createStatusEffect(effect: any): Promise<any> {
    const id = randomUUID();
    const [created] = await db.insert(characterStatusEffects).values({ ...effect, id }).returning();
    return created;
  }

  async getStatusEffectsByCharacter(characterId: string): Promise<any[]> {
    return await db.select().from(characterStatusEffects)
      .where(eq(characterStatusEffects.characterId, characterId));
  }

  async getCharacterStatusEffects(characterId: string): Promise<any[]> {
    return await this.getStatusEffectsByCharacter(characterId);
  }

  async deleteStatusEffect(id: string): Promise<boolean> {
    await db.delete(characterStatusEffects).where(eq(characterStatusEffects.id, id));
    return true;
  }

  async deleteStatusEffectsByCharacter(characterId: string): Promise<boolean> {
    await db.delete(characterStatusEffects).where(eq(characterStatusEffects.characterId, characterId));
    return true;
  }

  async addStatusEffect(effect: any): Promise<any> {
    return await this.createStatusEffect(effect);
  }

  async removeStatusEffect(id: string): Promise<boolean> {
    return await this.deleteStatusEffect(id);
  }

  // ==============================================================================
  // Users
  // ==============================================================================
  async getUser(id: string): Promise<User | undefined> {
    return await db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await db.query.users.findFirst({ where: eq(users.username, username) });
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const [created] = await db.insert(users).values({ ...user, id }).returning();
    return created;
  }

  async updateUserProfile(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // ==============================================================================
  // Spells
  // ==============================================================================
  async searchSpells(query: string): Promise<Spell[]> {
    return await db.select().from(spells)
      .where(like(spells.name, `%${query}%`))
      .limit(50);
  }

  async getSpells(level?: number, school?: string, classFilter?: string): Promise<Spell[]> {
    let query = db.select().from(spells);
    
    const conditions = [];
    if (level !== undefined) {
      conditions.push(eq(spells.level, level));
    }
    if (school) {
      conditions.push(eq(spells.school, school));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query;

    // Filter by class if provided (classes stored as JSON array)
    if (classFilter) {
      return results.filter(spell => 
        spell.classes.some((c: string) => c.toLowerCase() === classFilter.toLowerCase())
      );
    }

    return results;
  }

  async getSpell(id: string): Promise<Spell | undefined> {
    return await db.query.spells.findFirst({ where: eq(spells.id, id) });
  }

  // ==============================================================================
  // Story Tracking - Quest Objective Progress
  // ==============================================================================
  async getQuestObjectivesByRoom(roomId: string): Promise<any[]> {
    return await db.select()
      .from(questObjectiveProgress)
      .where(eq(questObjectiveProgress.roomId, roomId))
      .orderBy(questObjectiveProgress.questId, questObjectiveProgress.objectiveIndex);
  }

  async getQuestObjectivesByQuest(questId: string): Promise<any[]> {
    return await db.select()
      .from(questObjectiveProgress)
      .where(eq(questObjectiveProgress.questId, questId))
      .orderBy(questObjectiveProgress.objectiveIndex);
  }

  async createQuestObjective(objective: any): Promise<any> {
    const [created] = await db.insert(questObjectiveProgress)
      .values(objective)
      .returning();
    return created;
  }

  async updateQuestObjective(id: string, updates: any): Promise<any | undefined> {
    const [updated] = await db.update(questObjectiveProgress)
      .set(updates)
      .where(eq(questObjectiveProgress.id, id))
      .returning();
    return updated;
  }

  async deleteQuestObjectivesByRoom(roomId: string): Promise<boolean> {
    await db.delete(questObjectiveProgress)
      .where(eq(questObjectiveProgress.roomId, roomId));
    return true;
  }

  // ==============================================================================
  // Story Tracking - Story Events
  // ==============================================================================
  async getStoryEventsByRoom(
    roomId: string,
    options?: { limit?: number; eventType?: string; minImportance?: number }
  ): Promise<any[]> {
    const { limit = 20, eventType, minImportance } = options || {};
    
    const conditions = [eq(storyEvents.roomId, roomId)];
    if (eventType) {
      conditions.push(eq(storyEvents.eventType, eventType));
    }
    if (minImportance !== undefined) {
      conditions.push(gte(storyEvents.importance, minImportance));
    }

    return await db.select()
      .from(storyEvents)
      .where(and(...conditions))
      .orderBy(desc(storyEvents.timestamp))
      .limit(limit);
  }

  async createStoryEvent(event: any): Promise<any> {
    const [created] = await db.insert(storyEvents)
      .values(event)
      .returning();
    return created;
  }

  async deleteStoryEventsByRoom(roomId: string): Promise<boolean> {
    await db.delete(storyEvents)
      .where(eq(storyEvents.roomId, roomId));
    return true;
  }

  // ==============================================================================
  // Story Tracking - Session Summaries
  // ==============================================================================
  async getSessionSummariesByRoom(roomId: string): Promise<any[]> {
    return await db.select()
      .from(sessionSummaries)
      .where(eq(sessionSummaries.roomId, roomId))
      .orderBy(sessionSummaries.sessionNumber);
  }

  async getLatestSessionSummary(roomId: string): Promise<any | undefined> {
    const results = await db.select()
      .from(sessionSummaries)
      .where(eq(sessionSummaries.roomId, roomId))
      .orderBy(desc(sessionSummaries.sessionNumber))
      .limit(1);
    return results.length > 0 ? results[0] : undefined;
  }

  async createSessionSummary(summary: any): Promise<any> {
    const [created] = await db.insert(sessionSummaries)
      .values(summary)
      .returning();
    return created;
  }

  async updateSessionSummary(id: string, updates: any): Promise<any | undefined> {
    const [updated] = await db.update(sessionSummaries)
      .set(updates)
      .where(eq(sessionSummaries.id, id))
      .returning();
    return updated;
  }

  async deleteSessionSummariesByRoom(roomId: string): Promise<boolean> {
    await db.delete(sessionSummaries)
      .where(eq(sessionSummaries.roomId, roomId));
    return true;
  }

  // ==============================================================================
  // Index signature for additional helpers
  // ==============================================================================
  [key: string]: any;
}

// Export a singleton instance
export const storage = new DatabaseStorage();

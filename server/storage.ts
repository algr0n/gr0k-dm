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
import { roomStatusEffects } from "@shared/schema";

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
  createRoomStatusEffect(effect: any): Promise<any>;
  getRoomStatusEffects(roomId: string): Promise<any[]>;
  deleteRoomStatusEffect(id: string): Promise<boolean>;
  addRoomStatusEffect(effect: any): Promise<any>;
  cleanupExpiredRoomStatusEffects(nowMs?: number): Promise<number>;

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
  getQuestObjectives(questId: string): Promise<any[]>;
  createQuestObjectiveProgress(data: any): Promise<any>;

  // Story Tracking - Quests
  getQuestsByRoom(roomId: string): Promise<any[]>;
  createQuest(quest: any): Promise<any>;
  updateQuest(id: string, updates: any): Promise<any | undefined>;
  deleteQuestsByRoom(roomId: string): Promise<boolean>;
  
  // Quest Acceptance
  acceptQuest(roomId: string, questId: string, acceptedBy?: string): Promise<any>;
  isQuestAccepted(roomId: string, questId: string): Promise<boolean>;
  getAcceptedQuestIds(roomId: string): Promise<string[]>;
  getAvailableQuestsForRoom(roomId: string): Promise<any[]>;
  getAdventureQuestById(questId: string): Promise<any | undefined>;

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

  // Dynamic NPCs & Locations (AI/DM-created persistent entities for a room)
  createDynamicNpc(npc: { roomId: string; name: string; role?: string; description?: string; personality?: string; statsBlock?: any; isQuestGiver?: boolean; reputation?: number }): Promise<any>;
  getDynamicNpcsByRoom(roomId: string): Promise<any[]>;
  updateDynamicNpc(id: string, updates: any): Promise<any | undefined>;
  updateNpcReputation(npcId: string, change: number): Promise<any | undefined>;
  incrementNpcQuestCompletion(npcId: string): Promise<any | undefined>;
  getReputationStatus(reputation: number): { status: string; role: string };
  createDynamicLocation(loc: { roomId: string; name: string; type?: string; description?: string; boxedText?: string; features?: string[]; connections?: string[] }): Promise<any>;
  getDynamicLocationsByRoom(roomId: string): Promise<any[]>;

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
  combatEncounters, combatEnvironmentFeatures, combatSpawns,
  npcStatCache, type NpcStatCacheEntry,
} from "@shared/schema";
import {
  questObjectiveProgress,
  storyEvents,
  sessionSummaries,
  dynamicNpcs,
  dynamicLocations,
  adventureQuests,
} from "@shared/adventure-schema";
// Type imports are already declared above; keep only the table imports (avoid duplicate type declarations).
import { eq, and, like, desc, sql, lt, gte, inArray } from "drizzle-orm";

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

  // Room-level status effects (environmental, object, or scene-level)
  async createRoomStatusEffect(effect: any): Promise<any> {
    const id = randomUUID();
    const [created] = await db.insert(roomStatusEffects).values({ ...effect, id }).returning();
    return created;
  }

  async getRoomStatusEffects(roomId: string): Promise<any[]> {
    return await db.select().from(roomStatusEffects).where(eq(roomStatusEffects.roomId, roomId));
  }

  async deleteRoomStatusEffect(id: string): Promise<boolean> {
    await db.delete(roomStatusEffects).where(eq(roomStatusEffects.id, id));
    return true;
  }

  async addRoomStatusEffect(effect: any): Promise<any> {
    return await this.createRoomStatusEffect(effect);
  }

  async cleanupExpiredRoomStatusEffects(nowMs = Date.now()): Promise<number> {
    const now = new Date(nowMs);
    const result = await db.delete(roomStatusEffects)
      .where(lt(roomStatusEffects.expiresAt, now))
      .returning({ id: roomStatusEffects.id });
    return result.length;
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
  // Dynamic NPCs & Locations
  // ==============================================================================
  async createDynamicNpc(npc: { roomId: string; name: string; role?: string; description?: string; personality?: string; statsBlock?: any; isQuestGiver?: boolean; reputation?: number }): Promise<any> {
    const id = randomUUID();
    const npcData = {
      ...npc,
      id,
      reputation: npc.reputation ?? 0, // Default to neutral
      questsCompleted: 0,
    };
    const [created] = await db.insert(dynamicNpcs).values(npcData).returning();
    return created;
  }

  async getDynamicNpcsByRoom(roomId: string): Promise<any[]> {
    return await db.select().from(dynamicNpcs).where(eq(dynamicNpcs.roomId, roomId)).orderBy(dynamicNpcs.createdAt);
  }

  async updateDynamicNpc(id: string, updates: any): Promise<any | undefined> {
    const [updated] = await db.update(dynamicNpcs).set(updates).where(eq(dynamicNpcs.id, id)).returning();
    return updated;
  }

  /**
   * Update NPC reputation (clamped between -100 and +100)
   * @param npcId The NPC ID
   * @param change Amount to change reputation by (positive or negative)
   * @returns Updated NPC record
   */
  async updateNpcReputation(npcId: string, change: number): Promise<any | undefined> {
    const [npc] = await db.select().from(dynamicNpcs).where(eq(dynamicNpcs.id, npcId)).limit(1);
    if (!npc) return undefined;

    const currentRep = (npc as any).reputation ?? 0;
    const newRep = Math.max(-100, Math.min(100, currentRep + change));
    
    return await this.updateDynamicNpc(npcId, { 
      reputation: newRep,
      lastInteraction: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Increment quest completion count for an NPC and boost reputation
   * @param npcId The NPC ID
   * @returns Updated NPC record
   */
  async incrementNpcQuestCompletion(npcId: string): Promise<any | undefined> {
    const [npc] = await db.select().from(dynamicNpcs).where(eq(dynamicNpcs.id, npcId)).limit(1);
    if (!npc) return undefined;

    const questCount = ((npc as any).questsCompleted ?? 0) + 1;
    const repBonus = 10 + (questCount * 2); // Increases with each quest
    
    return await this.updateDynamicNpc(npcId, {
      questsCompleted: questCount,
      reputation: Math.min(100, ((npc as any).reputation ?? 0) + repBonus),
      lastInteraction: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Get reputation status text for display
   * @param reputation Reputation value (-100 to +100)
   * @returns Status text and role suggestion
   */
  getReputationStatus(reputation: number): { status: string; role: string } {
    if (reputation >= 75) return { status: 'Trusted Ally', role: 'ally' };
    if (reputation >= 50) return { status: 'Friend', role: 'ally' };
    if (reputation >= 25) return { status: 'Friendly', role: 'neutral' };
    if (reputation >= -25) return { status: 'Neutral', role: 'neutral' };
    if (reputation >= -50) return { status: 'Unfriendly', role: 'enemy' };
    if (reputation >= -75) return { status: 'Hostile', role: 'enemy' };
    return { status: 'Enemy', role: 'enemy' };
  }

  // =====================
  // Combat encounter persistence
  // =====================
  async createCombatEncounter(encounter: { locationId?: string; roomId?: string; name: string; seed?: string; generatedBy?: string; metadata?: any }): Promise<any> {
    const id = randomUUID();
    const [created] = await db.insert(combatEncounters).values({ ...encounter, id }).returning();
    return created;
  }

  async getCombatEncounterByLocation(locationId: string): Promise<any | null> {
    const [enc] = await db.select().from(combatEncounters).where(eq(combatEncounters.locationId, locationId)).limit(1);
    return enc || null;
  }

  async getCombatEncounterById(encounterId: string): Promise<any | null> {
    const [enc] = await db.select().from(combatEncounters).where(eq(combatEncounters.id, encounterId)).limit(1);
    return enc || null;
  }

  async addEnvironmentFeatures(encounterId: string, features: Array<any>): Promise<any[]> {
    const created: any[] = [];
    for (const f of features) {
      const id = randomUUID();
      const [row] = await db.insert(combatEnvironmentFeatures).values({ ...f, id, encounterId }).returning();
      created.push(row);
    }
    return created;
  }

  async addCombatSpawns(encounterId: string, spawns: Array<any>): Promise<any[]> {
    const created: any[] = [];
    for (const s of spawns) {
      const id = randomUUID();
      const [row] = await db.insert(combatSpawns).values({ ...s, id, encounterId }).returning();
      created.push(row);
    }
    return created;
  }

  async updateCombatEncounter(encounterId: string, updates: any): Promise<any | undefined> {
    const [updated] = await db.update(combatEncounters).set(updates).where(eq(combatEncounters.id, encounterId)).returning();
    return updated;
  }

  async getEnvironmentFeaturesByEncounter(encounterId: string): Promise<any[]> {
    return await db.select().from(combatEnvironmentFeatures).where(eq(combatEnvironmentFeatures.encounterId, encounterId)).orderBy(combatEnvironmentFeatures.createdAt);
  }

  async getCombatSpawnsByEncounter(encounterId: string): Promise<any[]> {
    return await db.select().from(combatSpawns).where(eq(combatSpawns.encounterId, encounterId)).orderBy(combatSpawns.createdAt);
  }

  async createDynamicLocation(loc: { roomId: string; name: string; type?: string; description?: string; boxedText?: string; features?: string[]; connections?: string[] }): Promise<any> {
    const id = randomUUID();
    const [created] = await db.insert(dynamicLocations).values({ ...loc, id }).returning();
    return created;
  }

  async getDynamicLocationsByRoom(roomId: string): Promise<any[]> {
    return await db.select().from(dynamicLocations).where(eq(dynamicLocations.roomId, roomId)).orderBy(dynamicLocations.createdAt);
  }

  // ==============================================================================
  // Quests - AI-created or predefined quest management
  // ==============================================================================
  async getQuestsByRoom(roomId: string): Promise<any[]> {
    // ONLY return accepted quests - players must accept quests first
    const acceptedIds = await this.getAcceptedQuestIds(roomId);
    
    if (acceptedIds.length === 0) {
      return [];
    }
    
    // Fetch all accepted quests
    const quests = await db
      .select()
      .from(adventureQuests)
      .where(inArray(adventureQuests.id, acceptedIds))
      .orderBy(adventureQuests.createdAt);
    
    return quests;
  }

  async createQuest(quest: any): Promise<any> {
    const id = randomUUID();
    const [created] = await db.insert(adventureQuests).values({ ...quest, id }).returning();
    return created;
  }

  async updateQuest(id: string, updates: any): Promise<any | undefined> {
    const [updated] = await db.update(adventureQuests).set(updates).where(eq(adventureQuests.id, id)).returning();
    return updated;
  }

  async deleteQuestsByRoom(roomId: string): Promise<boolean> {
    await db.delete(adventureQuests).where(eq(adventureQuests.roomId, roomId));
    return true;
  }

  async acceptQuest(roomId: string, questId: string, acceptedBy?: string): Promise<any> {
    const { acceptedQuests } = await import('@shared/adventure-schema');
    const [accepted] = await db.insert(acceptedQuests).values({
      roomId,
      questId,
      acceptedBy,
    }).returning();
    return accepted;
  }

  async isQuestAccepted(roomId: string, questId: string): Promise<boolean> {
    const { acceptedQuests } = await import('@shared/adventure-schema');
    const { and } = await import('drizzle-orm');
    const result = await db.select().from(acceptedQuests)
      .where(and(eq(acceptedQuests.roomId, roomId), eq(acceptedQuests.questId, questId)))
      .limit(1);
    return result.length > 0;
  }

  async getAcceptedQuestIds(roomId: string): Promise<string[]> {
    const { acceptedQuests } = await import('@shared/adventure-schema');
    const result = await db.select({ questId: acceptedQuests.questId })
      .from(acceptedQuests)
      .where(eq(acceptedQuests.roomId, roomId));
    return result.map(r => r.questId);
  }

  async getAvailableQuestsForRoom(roomId: string): Promise<any[]> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    
    if (!room) {
      return [];
    }
    
    // ONLY return dynamic quests that were created for this room
    // Pre-made adventure quests should be offered by the AI DM at appropriate narrative moments
    const dynamicQuests = await db
      .select()
      .from(adventureQuests)
      .where(eq(adventureQuests.roomId, roomId))
      .orderBy(adventureQuests.createdAt);
    
    // Get accepted quest IDs
    const acceptedIds = await this.getAcceptedQuestIds(roomId);
    
    // Filter out accepted quests
    return dynamicQuests.filter(q => !acceptedIds.includes(q.id));
  }

  // Get a specific adventure quest by ID (for AI to offer)
  async getAdventureQuestById(questId: string): Promise<any | undefined> {
    const [quest] = await db
      .select()
      .from(adventureQuests)
      .where(eq(adventureQuests.id, questId))
      .limit(1);
    return quest;
  }

  async getQuestObjectives(questId: string): Promise<any[]> {
    return await db.select().from(questObjectiveProgress).where(eq(questObjectiveProgress.questId, questId)).orderBy(questObjectiveProgress.objectiveIndex);
  }

  async createQuestObjectiveProgress(data: any): Promise<any> {
    const id = randomUUID();
    const [created] = await db.insert(questObjectiveProgress).values({ ...data, id }).returning();
    return created;
  }

  // ==============================================================================
  // Global NPC Stat Cache - reusable NPC stat blocks
  // ==============================================================================
  
  /**
   * Look up an NPC stat block from the global cache
   * @param name The NPC name to look up (case-insensitive)
   * @returns The cached stat block or undefined if not found
   */
  async getNpcFromCache(name: string): Promise<NpcStatCacheEntry | undefined> {
    const normalizedName = name.toLowerCase().trim();
    const [entry] = await db
      .select()
      .from(npcStatCache)
      .where(eq(npcStatCache.name, normalizedName))
      .limit(1);
    return entry;
  }

  /**
   * Save an NPC stat block to the global cache for future reuse
   * @param npc The NPC stat block to cache
   * @returns The created cache entry
   */
  async saveNpcToCache(npc: {
    name: string;
    displayName: string;
    size?: string;
    type?: string;
    alignment?: string;
    ac: number;
    hp: number;
    speed?: string;
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    cr?: string;
    xp?: number;
    traits?: { name: string; description: string }[];
    actions?: { name: string; description: string }[];
    reactions?: { name: string; description: string }[];
    source?: string;
  }): Promise<NpcStatCacheEntry> {
    const id = randomUUID();
    const normalizedName = npc.name.toLowerCase().trim();
    
    // Check if already exists
    const existing = await this.getNpcFromCache(normalizedName);
    if (existing) {
      return existing;
    }
    
    const [created] = await db.insert(npcStatCache).values({
      id,
      name: normalizedName,
      displayName: npc.displayName || npc.name,
      size: npc.size || 'Medium',
      type: npc.type || 'humanoid',
      alignment: npc.alignment,
      ac: npc.ac,
      hp: npc.hp,
      speed: npc.speed || '30 ft.',
      str: npc.str ?? 10,
      dex: npc.dex ?? 10,
      con: npc.con ?? 10,
      int: npc.int ?? 10,
      wis: npc.wis ?? 10,
      cha: npc.cha ?? 10,
      cr: npc.cr || '0',
      xp: npc.xp ?? 10,
      traits: npc.traits || [],
      actions: npc.actions || [],
      reactions: npc.reactions,
      source: npc.source || 'ai',
    }).returning();
    return created;
  }

  /**
   * Search the NPC cache with fuzzy matching
   * @param searchTerm The search term (partial name match)
   * @returns Matching NPC entries
   */
  async searchNpcCache(searchTerm: string): Promise<NpcStatCacheEntry[]> {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    return await db
      .select()
      .from(npcStatCache)
      .where(like(npcStatCache.name, `%${normalizedTerm}%`))
      .limit(10);
  }

  // ==============================================================================
  // Index signature for additional helpers
  // ==============================================================================
  [key: string]: any;
}

// Export a singleton instance
export const storage = new DatabaseStorage();

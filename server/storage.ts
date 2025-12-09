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
  InsertInventoryItem,
  CharacterInventoryItemWithDetails,
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
  addToInventory(insert: InsertInventoryItem): Promise<SavedInventoryItem>;
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
  getUser(id: string): Promise<any | undefined>;
  updateUserProfile(id: string, updates: Partial<any>): Promise<any | undefined>;

  // Misc
  searchSpells(query: string): Promise<any[]>;
  getSpells(level?: number, school?: string, classFilter?: string): Promise<any[]>;
  getSpell(id: string): Promise<any | undefined>;

  // Token usage
  // getTokenUsage is implemented in grok.ts - exported separately

  // Any additional helpers the implementation exposes
  [key: string]: any;
}

// If this file contained an implementation, ensure it matches the Storage interface.
// If the concrete implementation lives in another module, export it as `storage` from there.
// To keep build-time type checking consistent, we declare an exported storage value here.
// Replace the following `declare` with a real implementation if you move this interface only.
declare const storage: Storage;
export { storage };

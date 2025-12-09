import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { parseDiceExpression } from "./dice";
import { generateDMResponse, generateBatchedDMResponse, generateStartingScene, generateCombatDMTurn, type CharacterInfo, type BatchedMessage, type DroppedItemInfo, getTokenUsage } from "./grok";
import { insertRoomSchema, insertCharacterSchema, insertInventoryItemSchema, insertSavedCharacterSchema, updateUserProfileSchema, type Message, type Character, type InventoryItem, type InsertInventoryItem, itemCategories, itemRarities, type SavedCharacter, getLevelFromXP, calculateLevelUpHP, getAbilityModifier, classDefinitions, type DndClass } from "@shared/schema";
import { setupAuth, isAuthenticated, getSession } from "./auth";
import passport from "passport";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  playerName?: string;
}

const roomConnections = new Map<string, Set<WebSocket>>();

// Message batching queue per room
interface QueuedMessage {
  playerName: string;
  content: string;
  type: "chat" | "action";
  diceResult?: { expression: string; total: number; rolls: number[] };
  timestamp: number;
}

const messageQueue = new Map<string, QueuedMessage[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();
const BATCH_DELAY_MS = 1500; // 1.5 second debounce window
const MAX_BATCH_SIZE = 5;

interface InitiativeEntry {
  playerId: string;
  playerName: string;
  characterName: string;
  roll: number;
  modifier: number;
  total: number;
}

interface CombatState {
  isActive: boolean;
  currentTurnIndex: number;
  initiatives: InitiativeEntry[];
}

const roomCombatState = new Map<string, CombatState>();

// Track dropped items per room (items on the ground that players can pick up)
interface DroppedItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  location: string; // e.g., "on the goblin's body"
}

const roomDroppedItems = new Map<string, DroppedItem[]>();

// ============================================================================
// DM Response Parsing - Extract game actions from AI response tags
// ============================================================================

interface ParsedGameAction {
  type: 'hp_change' | 'item_add' | 'item_remove' | 'gold_change' | 'combat_start' | 'combat_end' | 'death_save' | 'stable' | 'dead' | 'status_add' | 'status_remove';
  playerName?: string;
  characterName?: string;
  currentHp?: number;
  maxHp?: number;
  itemName?: string;
  quantity?: number;
  goldAmount?: number;
  successes?: number;
  failures?: number;
  statusName?: string;
}

function parseDMResponseTags(response: string): ParsedGameAction[] {
  const actions: ParsedGameAction[] = [];
  
  // Parse HP changes: [HP: PlayerName | CurrentHP/MaxHP]
  const hpPattern = /\[HP:\s*([^|]+?)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
  let match;
  while ((match = hpPattern.exec(response)) !== null) {
    actions.push({
      type: 'hp_change',
      playerName: match[1].trim(),
      currentHp: parseInt(match[2], 10),
      maxHp: parseInt(match[3], 10),
    });
  }
  
  // Parse item additions: [ITEM: PlayerName | ItemName | Quantity]
  const itemAddPattern = /\[ITEM:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\]/gi;
  while ((match = itemAddPattern.exec(response)) !== null) {
    actions.push({
      type: 'item_add',
      playerName: match[1].trim(),
      itemName: match[2].trim(),
      quantity: parseInt(match[3], 10),
    });
  }
  
  // Parse item removals: [REMOVE_ITEM: PlayerName | ItemName | Quantity]
  const itemRemovePattern = /\[REMOVE_ITEM:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\]/gi;
  while ((match = itemRemovePattern.exec(response)) !== null) {
    actions.push({
      type: 'item_remove',
      playerName: match[1].trim(),
      itemName: match[2].trim(),
      quantity: parseInt(match[3], 10),
    });
  }
  
  // Parse combat state changes
  if (/\[COMBAT_START\]/i.test(response)) {
    actions.push({ type: 'combat_start' });
  }
  if (/\[COMBAT_END\]/i.test(response)) {
    actions.push({ type: 'combat_end' });
  }
  
  // Parse death saving throws: [DEATH_SAVES: PlayerName | Successes/Failures]
  const deathSavePattern = /\[DEATH_SAVES:\s*([^|]+?)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
  while ((match = deathSavePattern.exec(response)) !== null) {
    actions.push({
      type: 'death_save',
      playerName: match[1].trim(),
      successes: parseInt(match[2], 10),
      failures: parseInt(match[3], 10),
    });
  }
  
  // Parse stabilized: [STABLE: PlayerName]
  const stablePattern = /\[STABLE:\s*([^\]]+?)\s*\]/gi;
  while ((match = stablePattern.exec(response)) !== null) {
    actions.push({
      type: 'stable',
      playerName: match[1].trim(),
    });
  }
  
  // Parse death: [DEAD: PlayerName]
  const deadPattern = /\[DEAD:\s*([^\]]+?)\s*\]/gi;
  while ((match = deadPattern.exec(response)) !== null) {
    actions.push({
      type: 'dead',
      playerName: match[1].trim(),
    });
  }
  
  // Parse status effect additions: [STATUS: PlayerName | EffectName]
  const statusAddPattern = /\[STATUS:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/gi;
  while ((match = statusAddPattern.exec(response)) !== null) {
    actions.push({
      type: 'status_add',
      playerName: match[1].trim(),
      statusName: match[2].trim(),
    });
  }
  
  // Parse status effect removals: [REMOVE_STATUS: PlayerName | EffectName]
  const statusRemovePattern = /\[REMOVE_STATUS:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/gi;
  while ((match = statusRemovePattern.exec(response)) !== null) {
    actions.push({
      type: 'status_remove',
      playerName: match[1].trim(),
      statusName: match[2].trim(),
    });
  }
  
  return actions;
}

// ============================================================================
// Intelligent Natural Language Item/Gold Detection
// ============================================================================

interface DetectedItem {
  itemName: string;
  quantity: number;
}

interface DetectedGold {
  amount: number;
}

// Detect gold/GP mentions in natural language
function detectGoldMentions(response: string): DetectedGold[] {
  const goldResults: DetectedGold[] = [];
  
  // Patterns for gold detection: "10 gp", "10 gold", "10 gold pieces", "receives 50 gold"
  const goldPatterns = [
    /(\d+)\s*(?:gp|gold\s*pieces?|gold)/gi,
    /receives?\s+(\d+)\s*(?:gp|gold)/gi,
    /gains?\s+(\d+)\s*(?:gp|gold)/gi,
    /finds?\s+(\d+)\s*(?:gp|gold)/gi,
    /(?:has|have)\s+(\d+)\s*(?:gp|gold)/gi,
  ];
  
  const seenAmounts = new Set<number>();
  
  for (const pattern of goldPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const amount = parseInt(match[1], 10);
      if (amount > 0 && !seenAmounts.has(amount)) {
        seenAmounts.add(amount);
        goldResults.push({ amount });
      }
    }
  }
  
  return goldResults;
}

// Detect item mentions using fuzzy matching against the items database
// Acquisition verbs allow adding items even if already owned (for stacking)
// Descriptive/possession verbs only add NEW items not already in inventory
async function detectItemMentions(
  response: string,
  characterName: string,
  existingItemNames: Set<string>
): Promise<DetectedItem[]> {
  const detectedItems: DetectedItem[] = [];
  
  // Get all items from database for matching
  const allItems = await storage.getAllItems();
  if (!allItems || allItems.length === 0) return detectedItems;
  
  // Build item name lookup (lowercase -> original name)
  const itemNameMap = new Map<string, string>();
  for (const item of allItems) {
    itemNameMap.set(item.name.toLowerCase(), item.name);
  }
  
  // ACQUISITION verbs - unambiguous gain verbs that allow stacking existing items
  // Only includes verbs that clearly indicate NEW item acquisition
  const acquisitionPhrases = [
    'receives?',
    'gains?',
    'picks? up',
    'finds?',
    'obtains?',
    'acquires?',
    'collects?',
    'loots?',
    'is awarded',
    'adds? to (?:inventory|pack)',
    '(?:picks? up |receives? |finds? |gains? )another',
  ];
  
  // DESCRIPTIVE verbs - only add items if NOT already owned
  // Includes ambiguous verbs that could be descriptions of possession
  const descriptivePhrases = [
    'has',
    'have',
    'carrying',
    'carries',
    'holds?',
    'possesses?',
    'takes?',
    'grabs?',
    'gets?',
    'gives?',
    'in (?:your|their|his|her) (?:pack|inventory|bag|backpack|pouch)',
  ];
  
  const acquisitionPattern = new RegExp(
    `(?:${acquisitionPhrases.join('|')})\\s+(?:a\\s+|an\\s+|the\\s+|\\d+\\s*x?\\s*)?([a-zA-Z][a-zA-Z\\s'-]+?)(?:\\s*\\(|\\s*,|\\s*\\.|\\s*!|\\s*and\\s|$)`,
    'gi'
  );
  
  const descriptivePattern = new RegExp(
    `(?:${descriptivePhrases.join('|')})\\s+(?:a\\s+|an\\s+|the\\s+|\\d+\\s*x?\\s*)?([a-zA-Z][a-zA-Z\\s'-]+?)(?:\\s*\\(|\\s*,|\\s*\\.|\\s*!|\\s*and\\s|$)`,
    'gi'
  );
  
  // Quantity patterns like "2x healing potion" or "3 healing potions" - always allow
  const quantityPattern = /(\d+)\s*x?\s+([a-zA-Z][a-zA-Z\s'-]+?)(?:\s*\(|\s*,|\s*\.|\s*!|\s*and\s|$)/gi;
  
  const seenItems = new Set<string>();
  
  // Helper to match and add items
  const matchItem = (potentialItemName: string, quantity: number, allowExisting: boolean): boolean => {
    const lowerPotential = potentialItemName.toLowerCase();
    
    // Skip if it's gold (handled separately)
    if (lowerPotential.includes('gold') || lowerPotential.includes(' gp')) return false;
    
    // Try exact match first
    if (itemNameMap.has(lowerPotential)) {
      const originalName = itemNameMap.get(lowerPotential)!;
      if (!seenItems.has(originalName)) {
        if (allowExisting || !existingItemNames.has(originalName.toLowerCase())) {
          seenItems.add(originalName);
          detectedItems.push({ itemName: originalName, quantity });
          return true;
        }
      }
      return false;
    }
    
    // Try partial match
    for (const [lowerName, originalName] of itemNameMap.entries()) {
      const words = lowerPotential.split(/\s+/);
      const itemWords = lowerName.split(/\s+/);
      
      // Check if main words match (e.g., "holy symbol" matches "holy symbol")
      const mainWordMatch = words.some(w => 
        itemWords.some(iw => iw === w && w.length > 3)
      );
      
      if (mainWordMatch && !seenItems.has(originalName)) {
        if (allowExisting || !existingItemNames.has(originalName.toLowerCase())) {
          seenItems.add(originalName);
          detectedItems.push({ itemName: originalName, quantity });
          return true;
        }
      }
    }
    return false;
  };
  
  // Check quantity patterns - these always allow stacking
  let match;
  while ((match = quantityPattern.exec(response)) !== null) {
    const quantity = parseInt(match[1], 10);
    const potentialItemName = match[2].trim();
    matchItem(potentialItemName, quantity, true);
  }
  
  // Check acquisition verbs - allow stacking (already-owned items)
  while ((match = acquisitionPattern.exec(response)) !== null) {
    const potentialItemName = match[1].trim();
    matchItem(potentialItemName, 1, true);
  }
  
  // Check descriptive verbs - only add NEW items
  while ((match = descriptivePattern.exec(response)) !== null) {
    const potentialItemName = match[1].trim();
    matchItem(potentialItemName, 1, false);
  }
  
  return detectedItems;
}

// Parse natural language in DM response for items and gold
async function parseNaturalLanguageItems(
  response: string,
  characterName: string,
  existingInventory: string[]
): Promise<ParsedGameAction[]> {
  const actions: ParsedGameAction[] = [];
  const existingItemNames = new Set(existingInventory.map(n => n.toLowerCase()));
  
  // Detect gold mentions
  const goldMentions = detectGoldMentions(response);
  for (const gold of goldMentions) {
    actions.push({
      type: 'gold_change',
      playerName: characterName,
      goldAmount: gold.amount,
    });
  }
  
  // Detect item mentions - acquisition verbs allow stacking, descriptive only add new
  const itemMentions = await detectItemMentions(response, characterName, existingItemNames);
  for (const item of itemMentions) {
    actions.push({
      type: 'item_add',
      playerName: characterName,
      itemName: item.itemName,
      quantity: item.quantity,
    });
  }
  
  return actions;
}

async function executeGameActions(
  actions: ParsedGameAction[],
  roomCode: string,
  broadcastFn: (roomCode: string, message: any) => void
): Promise<void> {
  const characters = await storage.getCharactersByRoomCode(roomCode);
  const room = await storage.getRoomByCode(roomCode);
  if (!room) return;
  
  const players = await storage.getPlayersByRoom(room.id);
  
  for (const action of actions) {
    try {
      // Find character by player name (case insensitive match)
      const findCharacter = (playerName: string) => {
        // Try to match by player name first
        const player = players.find(p => 
          p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (player) {
          return characters.find(c => c.userId === player.userId);
        }
        // Fallback: match by character name
        return characters.find(c => 
          c.characterName.toLowerCase() === playerName.toLowerCase()
        );
      };
      
      switch (action.type) {
        case 'hp_change': {
          if (!action.playerName || action.currentHp === undefined) break;
          const char = findCharacter(action.playerName);
          if (char) {
            await storage.updateSavedCharacter(char.id, {
              currentHp: action.currentHp,
              maxHp: action.maxHp ?? char.maxHp,
            });
            broadcastFn(roomCode, {
              type: 'character_update',
              characterId: char.id,
              updates: { currentHp: action.currentHp, maxHp: action.maxHp ?? char.maxHp },
            });
            console.log(`[DM Action] Updated HP for ${action.playerName}: ${action.currentHp}/${action.maxHp}`);
          }
          break;
        }
        
        case 'combat_start': {
          let combatState = roomCombatState.get(roomCode);
          if (!combatState) {
            combatState = { isActive: true, currentTurnIndex: 0, initiatives: [] };
          } else {
            combatState.isActive = true;
          }
          roomCombatState.set(roomCode, combatState);
          broadcastFn(roomCode, { type: 'combat_update', combat: combatState });
          console.log(`[DM Action] Combat started in room ${roomCode}`);
          break;
        }
        
        case 'combat_end': {
          const combatState = roomCombatState.get(roomCode);
          if (combatState) {
            combatState.isActive = false;
            combatState.initiatives = [];
            combatState.currentTurnIndex = 0;
            roomCombatState.set(roomCode, combatState);
            broadcastFn(roomCode, { type: 'combat_update', combat: combatState });
          }
          console.log(`[DM Action] Combat ended in room ${roomCode}`);
          break;
        }
        
        case 'dead': {
          if (!action.playerName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            await storage.updateSavedCharacter(char.id, {
              isAlive: false,
              currentHp: 0,
            });
            broadcastFn(roomCode, {
              type: 'character_update',
              characterId: char.id,
              updates: { isAlive: false, currentHp: 0 },
            });
            console.log(`[DM Action] Character ${action.playerName} has died`);
          }
          break;
        }
        
        case 'status_add': {
          if (!action.playerName || !action.statusName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            await storage.addStatusEffect({
              characterId: char.id,
              name: action.statusName,
              isPredefined: true,
              appliedByDm: true,
            });
            broadcastFn(roomCode, {
              type: 'status_effect_added',
              characterId: char.id,
              statusName: action.statusName,
            });
            console.log(`[DM Action] Added status "${action.statusName}" to ${action.playerName}`);
          }
          break;
        }
        
        case 'status_remove': {
          if (!action.playerName || !action.statusName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            const effects = await storage.getCharacterStatusEffects(char.id);
            const effect = effects.find(e => 
              e.name.toLowerCase() === action.statusName!.toLowerCase()
            );
            if (effect) {
              await storage.removeStatusEffect(effect.id);
              broadcastFn(roomCode, {
                type: 'status_effect_removed',
                characterId: char.id,
                statusName: action.statusName,
              });
              console.log(`[DM Action] Removed status "${action.statusName}" from ${action.playerName}`);
            }
          }
          break;
        }
        
        case 'gold_change': {
          if (!action.playerName || action.goldAmount === undefined) break;
          const char = findCharacter(action.playerName);
          if (char) {
            const newGold = (char.gold || 0) + action.goldAmount;
            await storage.updateSavedCharacter(char.id, { gold: newGold });
            broadcastFn(roomCode, {
              type: 'character_update',
              characterId: char.id,
              updates: { gold: newGold },
            });
            console.log(`[DM Action] Updated gold for ${action.playerName}: +${action.goldAmount} (total: ${newGold})`);
          }
          break;
        }
        
        case 'item_add': {
          if (!action.playerName || !action.itemName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Normalize item name: trim and collapse whitespace
            const normalizedName = action.itemName!.trim().replace(/\s+/g, ' ');
            
            // Efficient lookup by name (case-insensitive)
            let item = await storage.getItemByName(normalizedName);
            
            // If item doesn't exist, create it as a custom DM-created item
            if (!item) {
              // Create a slug from the normalized name, fallback to UUID if empty
              const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              const itemId = slug ? `custom-${slug}` : `custom-${randomUUID().slice(0, 8)}`;
              
              // Check if this custom item already exists (in case of race condition or prior creation)
              item = await storage.getItem(itemId);
              
              if (!item) {
                try {
                  item = await storage.createItem({
                    id: itemId,
                    name: normalizedName,
                    category: "other",
                    type: "Custom Item",
                    description: `A custom item created by the Dungeon Master: ${normalizedName}`,
                    rarity: "uncommon",
                    gameSystem: room?.gameSystem || "dnd",
                  });
                  console.log(`[DM Action] Created custom item "${normalizedName}" in database`);
                } catch (createError) {
                  console.error(`[DM Action] Failed to create custom item "${normalizedName}":`, createError);
                  break;
                }
              }
            }
            
            if (item) {
              await storage.addToSavedInventory({
                characterId: char.id,
                itemId: item.id,
                quantity: action.quantity || 1,
              });
              broadcastFn(roomCode, {
                type: 'inventory_update',
                characterId: char.id,
                action: 'add',
                itemName: item.name,
                quantity: action.quantity || 1,
              });
              console.log(`[DM Action] Added ${action.quantity || 1}x "${item.name}" to ${action.playerName}`);
            }
          }
          break;
        }
        
        case 'item_remove': {
          if (!action.playerName || !action.itemName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Get character's inventory and find the item
            const inventory = await storage.getSavedInventoryWithDetails(char.id);
            const invItem = inventory.find(i => 
              i.item.name.toLowerCase() === action.itemName!.toLowerCase()
            );
            if (invItem) {
              const removeQty = action.quantity || 1;
              if (invItem.quantity <= removeQty) {
                // Remove entirely
                await storage.deleteSavedInventoryItem(invItem.id);
              } else {
                // Decrease quantity
                await storage.updateSavedInventoryItem(invItem.id, {
                  quantity: invItem.quantity - removeQty,
                });
              }
              broadcastFn(roomCode, {
                type: 'inventory_update',
                characterId: char.id,
                action: 'remove',
                itemName: action.itemName,
                quantity: removeQty,
              });
              console.log(`[DM Action] Removed ${removeQty}x "${action.itemName}" from ${action.playerName}`);
            } else {
              console.log(`[DM Action] Item "${action.itemName}" not in ${action.playerName}'s inventory`);
            }
          }
          break;
        }
        
        case 'death_save': {
          if (!action.playerName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Broadcast death save status update
            broadcastFn(roomCode, {
              type: 'death_save_update',
              characterId: char.id,
              playerName: action.playerName,
              successes: action.successes || 0,
              failures: action.failures || 0,
            });
            console.log(`[DM Action] Death saves for ${action.playerName}: ${action.successes}/${action.failures}`);
          }
          break;
        }
        
        case 'stable': {
          if (!action.playerName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Character stabilizes at 0 HP, alive but unconscious
            await storage.updateSavedCharacter(char.id, {
              currentHp: 0,
              isAlive: true,
            });
            broadcastFn(roomCode, {
              type: 'character_update',
              characterId: char.id,
              updates: { currentHp: 0, isAlive: true, isStable: true },
            });
            console.log(`[DM Action] ${action.playerName} has stabilized at 0 HP`);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`[DM Action] Error executing action ${action.type}:`, error);
    }
  }
}

// Starting items by D&D class
const dndStartingItems: Record<string, string[]> = {
  fighter: ["longsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  wizard: ["quarterstaff", "dagger", "backpack", "component-pouch", "rations-1-day", "waterskin", "torch"],
  rogue: ["shortsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  cleric: ["mace", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch", "holy-symbol"],
  ranger: ["longbow", "shortsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  paladin: ["longsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  barbarian: ["greataxe", "handaxe", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  bard: ["rapier", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  druid: ["quarterstaff", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  monk: ["quarterstaff", "dart", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  sorcerer: ["dagger", "backpack", "component-pouch", "rations-1-day", "waterskin", "torch"],
  warlock: ["dagger", "backpack", "component-pouch", "rations-1-day", "waterskin", "torch"],
  default: ["dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
};

// Helper function to grant starting items to a saved character (permanent inventory)
async function grantStartingItems(
  savedCharacterId: string,
  gameSystem: string,
  characterClass: string | null | undefined
): Promise<void> {
  if (gameSystem === "dnd") {
    const classKey = (characterClass || "default").toLowerCase();
    const itemIds = dndStartingItems[classKey] || dndStartingItems.default;
    
    for (const itemId of itemIds) {
      try {
        await storage.addToSavedInventory({
          characterId: savedCharacterId,
          itemId,
          quantity: itemId === "rations-1-day" ? 5 : itemId === "torch" ? 5 : 1,
        });
      } catch (error) {
        console.error(`Failed to add starting item ${itemId}:`, error);
      }
    }
  }
  // Cyberpunk items would go here when added to the items table
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ noServer: true });
  const sessionMiddleware = getSession();

  // Handle WebSocket upgrade manually to avoid conflicts with Vite HMR
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url?.split("?")[0];
    
    // Skip Vite HMR connections
    if (pathname === "/vite-hmr") {
      return; // Let Vite handle this
    }
    
    // Create mock request/response for session parsing
    const mockReq = request as any;
    const mockRes = { 
      setHeader: () => {}, 
      end: () => {},
      getHeader: () => undefined 
    } as any;
    
    // Parse session to get authenticated user
    sessionMiddleware(mockReq, mockRes, () => {
      passport.initialize()(mockReq, mockRes, () => {
        passport.session()(mockReq, mockRes, async () => {
          const user = mockReq.user as Express.User | undefined;
          
          // Reject unauthenticated connections
          if (!user?.id) {
            console.log("[WebSocket] Rejecting unauthenticated connection");
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
          
          const userId = user.id;
          const playerName = user.username || user.email || "Player";
          
          // Verify user is a member of the room by userId
          const urlParams = new URLSearchParams(request.url?.split("?")[1]);
          const roomCode = urlParams.get("room") || urlParams.get("roomCode");
          
          if (roomCode) {
            const room = await storage.getRoomByCode(roomCode);
            if (room) {
              const players = await storage.getPlayersByRoom(room.id);
              const isRoomMember = players.some(p => p.userId === userId);
              if (!isRoomMember) {
                console.log("[WebSocket] User not a member of room:", roomCode, userId);
                socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.destroy();
                return;
              }
            }
          }
          
          wss.handleUpgrade(request, socket, head, (ws) => {
            (ws as AuthenticatedWebSocket).userId = userId;
            (ws as AuthenticatedWebSocket).playerName = playerName;
            wss.emit("connection", ws, request);
          });
        });
      });
    });
  });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    const urlParams = new URLSearchParams(req.url?.split("?")[1]);
    const roomCode = urlParams.get("room") || urlParams.get("roomCode");

    if (!roomCode) {
      ws.close(1008, "Room code required");
      return;
    }

    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, new Set());
    }
    roomConnections.get(roomCode)!.add(ws);

    const playerName = ws.playerName || "Anonymous";

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "chat" || message.type === "action") {
          // Queue the message for batch processing
          await queueMessage(roomCode, {
            type: message.type,
            playerName: playerName,
            content: message.content,
            timestamp: Date.now(),
          });
        } else if (message.type === "get_combat_state") {
          // Send current combat state
          const combatState = roomCombatState.get(roomCode);
          if (combatState) {
            ws.send(JSON.stringify({ type: "combat_update", combat: combatState }));
          }
        }
      } catch (error) {
        console.error("[WebSocket] Message parsing error:", error);
      }
    });

    ws.on("close", () => {
      roomConnections.get(roomCode)?.delete(ws);
      if (roomConnections.get(roomCode)?.size === 0) {
        roomConnections.delete(roomCode);
        messageQueue.delete(roomCode);
        roomCombatState.delete(roomCode);
        roomDroppedItems.delete(roomCode);
      }
    });
  });

  function broadcastToRoom(roomCode: string, message: any) {
    const connections = roomConnections.get(roomCode);
    if (connections) {
      const payload = JSON.stringify(message);
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  async function queueMessage(roomCode: string, msg: QueuedMessage) {
    if (!messageQueue.has(roomCode)) {
      messageQueue.set(roomCode, []);
    }
    messageQueue.get(roomCode)!.push(msg);

    // Broadcast individual message immediately for real-time feel
    broadcastToRoom(roomCode, {
      type: msg.type,
      playerName: msg.playerName,
      content: msg.content,
      timestamp: msg.timestamp,
      diceResult: msg.diceResult,
    });

    if (batchTimers.has(roomCode)) {
      clearTimeout(batchTimers.get(roomCode)!);
    }

    batchTimers.set(
      roomCode,
      setTimeout(() => processBatch(roomCode), BATCH_DELAY_MS)
    );
  }

  async function processBatch(roomCode: string) {
    const queue = messageQueue.get(roomCode);
    if (!queue || queue.length === 0) return;

    // Take up to MAX_BATCH_SIZE messages
    const batch = queue.splice(0, Math.min(MAX_BATCH_SIZE, queue.length));
    messageQueue.set(roomCode, queue); // Update queue

    const room = await storage.getRoomByCode(roomCode);
    if (!room) return;

    // Get characters for context - use savedCharacters table via roomCode
    const characters = await storage.getCharactersByRoomCode(roomCode);
    const players = await storage.getPlayersByRoom(room.id);
    
    // Build character info with player names and inventory
    const characterInfos: CharacterInfo[] = await Promise.all(
      characters.map(async (char) => {
        // Try to find player name from players list or user record
        let playerName = "Unknown Player";
        const player = players.find(p => p.userId === char.userId);
        if (player) {
          playerName = player.name;
        } else if (char.userId) {
          const user = await storage.getUser(char.userId);
          if (user) {
            playerName = user.username || user.email || "Player";
          }
        }
        
        // Fetch character's inventory
        const inventory = await storage.getSavedInventoryWithDetails(char.id);
        const inventoryItems = inventory.map(i => {
          const name = i.item?.name || 'unknown item';
          return i.quantity > 1 ? `${name} x${i.quantity}` : name;
        });
        
        return {
          playerName,
          characterName: char.characterName,
          stats: {
            race: char.race || "unknown",
            class: char.class || "unknown",
            level: char.level,
            currentHp: char.currentHp,
            maxHp: char.maxHp,
            ac: char.ac,
            initiativeModifier: char.initiativeModifier,
            skills: char.skills,
            spells: char.spells,
            ...(char.stats as Record<string, unknown> || {}),
          },
          notes: char.backstory || "",
          inventory: inventoryItems,
        };
      })
    );

    // Prepare batched messages
    const batchedMessages: BatchedMessage[] = batch.map((msg) => ({
      playerName: msg.playerName,
      content: msg.content,
      type: msg.type,
      diceResult: msg.diceResult,
    }));

    try {
      // Generate batched DM response
      const dmResponse = await generateBatchedDMResponse(
        batchedMessages,
        room,
        undefined, // playerCount
        characterInfos
      );

      // Send DM response
      const dmMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "DM",
        content: dmResponse,
        type: "dm",
        timestamp: Date.now().toString(),
      };

      broadcastToRoom(roomCode, dmMessage);

      // Parse and execute game actions from DM response tags
      const gameActions = parseDMResponseTags(dmResponse);
      
      // Add natural language item/gold detection only for single-player batches
      // This avoids cross-applying items to all characters in multi-player scenarios
      if (batch.length === 1) {
        const msg = batch[0];
        const player = players.find(p => p.name === msg.playerName);
        if (player) {
          const character = characters.find(c => c.userId === player.userId);
          if (character) {
            const inventory = await storage.getSavedInventoryWithDetails(character.id);
            const inventoryNames = inventory.map(i => i.item?.name || '');
            const nlActions = await parseNaturalLanguageItems(dmResponse, character.characterName, inventoryNames);
            if (nlActions.length > 0) {
              console.log(`[NL Detection] Found ${nlActions.length} natural language items/gold for ${character.characterName}`);
              gameActions.push(...nlActions);
            }
          }
        }
      }
      
      if (gameActions.length > 0) {
        console.log(`[DM Response] Found ${gameActions.length} game actions to execute`);
        await executeGameActions(gameActions, roomCode, broadcastToRoom);
      }

      // Update room history
      const updatedHistory = [
        ...room.messageHistory,
        ...batch.map((msg) => ({
          id: randomUUID(),
          roomId: room.id,
          playerName: msg.playerName,
          content: msg.content,
          type: msg.type,
          timestamp: msg.timestamp.toString(),
          diceResult: msg.diceResult,
        })),
        dmMessage,
      ];

      await storage.updateRoom(room.id, {
        messageHistory: updatedHistory,
        lastActivityAt: new Date(),
      });

      console.log(`Processed batch of ${batch.length} messages for room ${roomCode}`);
    } catch (error) {
      console.error(`Batch processing error for room ${roomCode}:`, error);
      broadcastToRoom(roomCode, {
        type: "system",
        content: "The DM is pondering... please try again.",
      });
    }
  }

  // Auth setup - uses Replit Auth
  await setupAuth(app);

  // Auth routes - get current user
  app.get("/api/auth/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile update route
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const parseResult = updateUserProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid profile data", details: parseResult.error.flatten() });
      }
      
      const { username, customProfileImageUrl } = parseResult.data;
      
      const updates: { username?: string; customProfileImageUrl?: string | null } = {};
      if (username !== undefined) {
        updates.username = username;
      }
      if (customProfileImageUrl !== undefined) {
        updates.customProfileImageUrl = customProfileImageUrl;
      }
      
      const user = await storage.updateUserProfile(userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Profile image upload URL
  app.post("/api/profile/upload-url", isAuthenticated, async (req, res) => {
    try {
      if (!process.env.PRIVATE_OBJECT_DIR) {
        return res.status(503).json({ 
          error: "Image uploads not configured",
          message: "Profile picture uploads are not available. Object storage needs to be set up."
        });
      }
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Profile image update (after upload completes)
  app.put("/api/profile/image", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageUrl,
        {
          owner: userId,
          visibility: "public",
        }
      );

      const user = await storage.updateUserProfile(userId, { customProfileImageUrl: objectPath });
      res.json({ objectPath, user });
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ error: "Failed to update profile image" });
    }
  });

  // Serve uploaded objects
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      const { ObjectNotFoundError } = await import("./objectStorage");
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Saved characters routes (requires authentication)
  app.get("/api/saved-characters", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const characters = await storage.getSavedCharactersByUser(userId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching saved characters:", error);
      res.status(500).json({ error: "Failed to fetch saved characters" });
    }
  });

  app.post("/api/saved-characters", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const parsed = insertSavedCharacterSchema.parse({ ...req.body, userId });
      const character = await storage.createSavedCharacter(parsed);
      
      // Grant starting items to the saved character based on game system and class
      await grantStartingItems(character.id, character.gameSystem, character.class);
      
      res.json(character);
    } catch (error) {
      console.error("Error creating saved character:", error);
      res.status(400).json({ error: "Invalid character data" });
    }
  });

  app.get("/api/saved-characters/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const character = await storage.getSavedCharacter(id);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch character" });
    }
  });

  app.patch("/api/saved-characters/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const existing = await storage.getSavedCharacter(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      
      // Check if XP update triggers a level up
      let updates = { ...req.body };
      let leveledUp = false;
      let oldLevel = existing.level;
      let newLevel = oldLevel;
      
      if (updates.xp !== undefined && updates.xp !== existing.xp) {
        newLevel = getLevelFromXP(updates.xp);
        
        if (newLevel > oldLevel) {
          leveledUp = true;
          updates.level = newLevel;
          
          // Calculate HP increase for each level gained
          if (existing.class && classDefinitions[existing.class as DndClass]) {
            const conMod = existing.stats?.constitution 
              ? getAbilityModifier(existing.stats.constitution as number) 
              : 0;
            
            let hpGain = 0;
            for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
              hpGain += calculateLevelUpHP(existing.class as DndClass, conMod);
            }
            
            updates.maxHp = (existing.maxHp || 10) + hpGain;
            updates.currentHp = Math.min(
              (updates.currentHp ?? existing.currentHp) + hpGain,
              updates.maxHp
            );
          }
        }
      }
      
      const character = await storage.updateSavedCharacter(id, updates);
      res.json({ 
        ...character, 
        leveledUp, 
        previousLevel: leveledUp ? oldLevel : undefined,
        newLevel: leveledUp ? newLevel : undefined 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // Award XP to a character with automatic level-up handling (DM can award to any character in their room)
  app.post("/api/saved-characters/:id/award-xp", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { xpAmount } = req.body;
      const userId = req.user!.id;
      
      if (typeof xpAmount !== "number" || xpAmount < 0) {
        return res.status(400).json({ error: "xpAmount must be a positive number" });
      }
      
      const existing = await storage.getSavedCharacter(id);
      if (!existing) {
        return res.status(404).json({ error: "Character not found" });
      }
      
      // Allow if user owns the character OR if they are the DM of the room the character is in
      const isOwner = existing.userId === userId;
      let isDM = false;
      
      if (existing.currentRoomCode) {
        const room = await storage.getRoomByCode(existing.currentRoomCode);
        if (room) {
          // Check if the current user is the room host by looking up their username
          const currentUser = await storage.getUser(userId);
          if (currentUser && room.hostName === (currentUser.username || currentUser.email)) {
            isDM = true;
          }
        }
      }
      
      if (!isOwner && !isDM) {
        return res.status(403).json({ error: "Only the character owner or room DM can award XP" });
      }
      
      const oldXp = existing.xp || 0;
      const newXp = oldXp + xpAmount;
      const oldLevel = existing.level;
      const newLevel = getLevelFromXP(newXp);
      const leveledUp = newLevel > oldLevel;
      
      let updates: Record<string, unknown> = { xp: newXp };
      
      if (leveledUp) {
        updates.level = newLevel;
        
        // Calculate HP increase for each level gained
        if (existing.class && classDefinitions[existing.class as DndClass]) {
          const conMod = existing.stats?.constitution 
            ? getAbilityModifier(existing.stats.constitution as number) 
            : 0;
          
          let hpGain = 0;
          for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
            hpGain += calculateLevelUpHP(existing.class as DndClass, conMod);
          }
          
          updates.maxHp = (existing.maxHp || 10) + hpGain;
          updates.currentHp = existing.currentHp + hpGain;
        }
      }
      
      const character = await storage.updateSavedCharacter(id, updates);
      res.json({
        ...character,
        xpAwarded: xpAmount,
        leveledUp,
        previousLevel: leveledUp ? oldLevel : undefined,
        levelsGained: leveledUp ? newLevel - oldLevel : 0,
      });
    } catch (error) {
      console.error("Error awarding XP:", error);
      res.status(500).json({ error: "Failed to award XP" });
    }
  });

  app.delete("/api/saved-characters/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const existing = await storage.getSavedCharacter(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      await storage.deleteSavedCharacter(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete character" });
    }
  });

  // Saved character inventory routes
  app.get("/api/saved-characters/:id/inventory", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const character = await storage.getSavedCharacter(id);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      const inventory = await storage.getSavedInventoryWithDetails(id);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.post("/api/saved-characters/:id/inventory", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { itemId, itemName, quantity = 1 } = req.body;
      
      const character = await storage.getSavedCharacter(id);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      
      // Support adding by item ID or by searching item name
      let resolvedItemId = itemId;
      if (!resolvedItemId && itemName) {
        const items = await storage.searchItems(itemName);
        if (items.length === 0) {
          return res.status(404).json({ error: "Item not found" });
        }
        resolvedItemId = items[0].id;
      }
      
      if (!resolvedItemId) {
        return res.status(400).json({ error: "itemId or itemName required" });
      }
      
      const inventoryItem = await storage.addToSavedInventory({
        characterId: id,
        itemId: resolvedItemId,
        quantity,
      });
      res.json(inventoryItem);
    } catch (error) {
      console.error("Error adding to inventory:", error);
      res.status(500).json({ error: "Failed to add item to inventory" });
    }
  });

  app.delete("/api/saved-characters/:id/inventory/:inventoryItemId", isAuthenticated, async (req, res) => {
    try {
      const { id, inventoryItemId } = req.params;
      const userId = req.user!.id;
      
      const character = await storage.getSavedCharacter(id);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      
      await storage.deleteSavedInventoryItem(inventoryItemId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // Room creation
  app.post("/api/rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Host";
      
      const parsed = insertRoomSchema.parse({ ...req.body, hostName: playerName });
      const room = await storage.createRoom(parsed);
      
      // Create host player
      const hostPlayer = await storage.createPlayer({
        roomId: room.id,
        userId: userId,
        name: playerName,
        isHost: true,
      });
      
      res.json({ ...room, hostPlayer });
    } catch (error) {
      res.status(400).json({ error: "Invalid room data" });
    }
  });

  // Join room
  app.post("/api/rooms/:code/join", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId } = req.body;
      
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      const existingPlayers = await storage.getPlayersByRoom(room.id);
      if (existingPlayers.length >= room.maxPlayers) {
        return res.status(400).json({ error: "Room is full" });
      }

      const existingPlayer = existingPlayers.find((p) => p.userId === userId);
      if (existingPlayer) {
        return res.status(400).json({ error: "You have already joined this room" });
      }

      const player = await storage.createPlayer({
        roomId: room.id,
        userId: userId,
        name: playerName,
        isHost: existingPlayers.length === 0,
      });

      // If savedCharacterId provided, join the character to the room
      let roomCharacter: SavedCharacter | null = null;
      if (savedCharacterId) {
        const savedCharacter = await storage.getSavedCharacter(savedCharacterId);
        if (!savedCharacter) {
          return res.status(404).json({ error: "Character not found" });
        }
        
        // Validate ownership
        if (savedCharacter.userId !== userId) {
          return res.status(403).json({ error: "You do not own this character" });
        }
        
        // Validate game system match
        if (savedCharacter.gameSystem !== room.gameSystem) {
          return res.status(400).json({ error: "Character game system does not match room" });
        }
        
        // Check if character is already in a room
        if (savedCharacter.currentRoomCode && savedCharacter.currentRoomCode !== code) {
          return res.status(400).json({ error: "Character is already in another room" });
        }
        
        // Join the character to the room
        roomCharacter = await storage.joinRoom(savedCharacterId, code) || null;
      }

      await storage.updateRoomActivity(room.id);

      broadcastToRoom(code, {
        type: "system",
        content: `${playerName} has joined the adventure!`,
      });

      res.json({ room, player, roomCharacter });
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({ error: "Failed to join room" });
    }
  });

  // Join room with character (for host after room creation)
  app.post("/api/rooms/:code/join-with-character", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId } = req.body;
      
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      if (!savedCharacterId) {
        return res.status(400).json({ error: "savedCharacterId is required" });
      }

      const savedCharacter = await storage.getSavedCharacter(savedCharacterId);
      if (!savedCharacter) {
        return res.status(404).json({ error: "Saved character not found" });
      }
      
      // Validate ownership
      if (savedCharacter.userId !== userId) {
        return res.status(403).json({ error: "You do not own this character" });
      }
      
      // Validate game system match
      if (savedCharacter.gameSystem !== room.gameSystem) {
        return res.status(400).json({ error: "Character game system does not match room" });
      }

      // Check if character is already in a room
      if (savedCharacter.currentRoomCode && savedCharacter.currentRoomCode !== code) {
        return res.status(400).json({ error: "Character is already in another room" });
      }
      
      // Join the character to the room
      const roomCharacter = await storage.joinRoom(savedCharacterId, code);

      res.json({ roomCharacter, savedCharacter: roomCharacter });
    } catch (error) {
      console.error("Error joining room with character:", error);
      res.status(500).json({ error: "Failed to join room with character" });
    }
  });

  // Switch to a new character when current one is dead
  app.post("/api/rooms/:code/switch-character", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId } = req.body;
      const userId = req.user!.id;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      // Get current character in this room
      const currentCharacter = await storage.getCharacterByUserInRoom(userId, code);
      if (!currentCharacter) {
        return res.status(404).json({ error: "No current character in this room" });
      }

      // Only allow switching if character is dead
      if (currentCharacter.isAlive) {
        return res.status(400).json({ error: "Cannot switch character while current character is alive" });
      }

      // Validate the new character
      const newCharacter = await storage.getSavedCharacter(savedCharacterId);
      if (!newCharacter) {
        return res.status(404).json({ error: "Saved character not found" });
      }

      if (newCharacter.userId !== userId) {
        return res.status(403).json({ error: "You do not own this character" });
      }

      if (newCharacter.gameSystem !== room.gameSystem) {
        return res.status(400).json({ error: "Character game system does not match room" });
      }

      // Leave the old character from room and clear its status effects
      await storage.deleteStatusEffectsByCharacter(currentCharacter.id);
      await storage.leaveRoom(currentCharacter.id);

      // Join new character to room
      const roomCharacter = await storage.joinRoom(savedCharacterId, code);

      res.json({ roomCharacter, savedCharacter: roomCharacter });
    } catch (error) {
      console.error("Error switching character:", error);
      res.status(500).json({ error: "Failed to switch character" });
    }
  });

  // Get current player's character in this room
  app.get("/api/rooms/:code/my-character", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.user!.id;

      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const character = await storage.getCharacterByUserInRoom(userId, code);
      if (!character) {
        return res.status(404).json({ error: "No character in this room" });
      }

      const statusEffects = await storage.getStatusEffectsByCharacter(character.id);

      // Return unified response format
      res.json({
        roomCharacter: character,
        savedCharacter: character,
        statusEffects,
      });
    } catch (error) {
      console.error("Error fetching my character:", error);
      res.status(500).json({ error: "Failed to fetch character" });
    }
  });

  // Get all characters in a room (for DM and player views)
  app.get("/api/rooms/:code/room-characters", async (req, res) => {
    try {
      const { code } = req.params;
      
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const characters = await storage.getCharactersByRoomCode(code);
      
      // Return unified format with status effects and player name
      const charactersWithData = await Promise.all(
        characters.map(async (char) => {
          const statusEffects = await storage.getStatusEffectsByCharacter(char.id);
          // Look up player name from user
          let playerName = "Unknown Player";
          if (char.userId) {
            const user = await storage.getUser(char.userId);
            if (user) {
              playerName = user.username || user.email || "Unknown Player";
            }
          }
          return {
            roomCharacter: { ...char, playerName },
            savedCharacter: char,
            statusEffects,
            playerName,
          };
        })
      );

      res.json(charactersWithData);
    } catch (error) {
      console.error("Error fetching room characters:", error);
      res.status(500).json({ error: "Failed to fetch room characters" });
    }
  });

  // Get room info
  app.get("/api/rooms/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const players = await storage.getPlayersByRoom(room.id);
      // Use savedCharacters table via roomCode for correct character data
      const characters = await storage.getCharactersByRoomCode(code);

      // Return room data merged with players and characters for frontend compatibility
      res.json({ ...room, players, characters });
    } catch (error) {
      console.error("Error getting room info:", error);
      res.status(500).json({ error: "Failed to get room info" });
    }
  });

  // Update room
  app.patch("/api/rooms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const room = await storage.updateRoom(id, updates);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  // Leave room (player leaves with their character)
  app.post("/api/rooms/:code/leave", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.user!.id;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";
      
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      // Find the player record
      const players = await storage.getPlayersByRoom(room.id);
      const player = players.find(p => p.userId === userId);
      
      if (!player) {
        return res.status(404).json({ error: "You are not in this room" });
      }
      
      // Find and remove the character from the room
      const character = await storage.getCharacterByUserInRoom(userId, code);
      if (character) {
        await storage.leaveRoom(character.id);
      }
      
      // Delete the player record
      await storage.deletePlayer(player.id);
      
      // Broadcast leave message
      broadcastToRoom(code, {
        type: "system",
        content: `${playerName} has left the adventure.`,
      });
      
      await storage.updateRoomActivity(room.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving room:", error);
      res.status(500).json({ error: "Failed to leave room" });
    }
  });

  // End room
  app.post("/api/rooms/:code/end", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.user!.id;
      
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      // Verify the user is the host by checking their player record's isHost flag
      const players = await storage.getPlayersByRoom(room.id);
      const userPlayer = players.find(p => p.userId === userId);
      
      if (!userPlayer || !userPlayer.isHost) {
        return res.status(403).json({ error: "Only the host can end the room" });
      }

      // Clear all characters from the room (set currentRoomCode to null)
      await storage.leaveAllCharactersFromRoom(code);
      
      await storage.updateRoom(room.id, { isActive: false });

      broadcastToRoom(code, {
        type: "system",
        content: "The adventure has ended. Thanks for playing!",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error ending room:", error);
      res.status(500).json({ error: "Failed to end room" });
    }
  });

  // Get public rooms
  app.get("/api/rooms/public", async (req, res) => {
    try {
      const { gameSystem } = req.query;
      const rooms = await storage.getPublicRooms(gameSystem as string | undefined);
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: "Failed to get public rooms" });
    }
  });

  // Character creation
  app.post("/api/characters", async (req, res) => {
    try {
      const parsed = insertCharacterSchema.parse(req.body);
      const character = await storage.createCharacter(parsed);
      res.json(character);
    } catch (error) {
      res.status(400).json({ error: "Invalid character data" });
    }
  });

  // Update character
  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const character = await storage.updateCharacter(id, updates);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // Inventory management
  app.post("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { characterId } = req.params;
      const parsed = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem({ ...parsed, characterId });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid inventory item" });
    }
  });

  // Handle player messages via HTTP (fallback or for non-WS clients)
  app.post("/api/rooms/:code/messages", async (req, res) => {
    try {
      const { code } = req.params;
      const { playerName, content } = req.body;

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      // Check for dice roll
      let diceResult;
      if (content.startsWith("/roll ")) {
        const expression = content.slice(6).trim();
        diceResult = parseDiceExpression(expression);
        if (diceResult) {
          await storage.createDiceRoll({
            roomId: room.id,
            playerId: "", // TODO: Add playerId if available
            expression: diceResult.expression,
            rolls: diceResult.rolls,
            modifier: diceResult.modifier,
            total: diceResult.total,
            purpose: "player roll",
          });
        }
      }

      const msgType = diceResult ? "roll" : content.startsWith("/me ") ? "action" : "chat";
      const msgContent = msgType === "action" ? content.slice(4) : content;

      // Queue for batching
      await queueMessage(code, {
        playerName,
        content: msgContent,
        type: msgType,
        diceResult,
        timestamp: Date.now(),
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Combat management
  app.post("/api/rooms/:code/combat/start", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ error: "Room not found" });

      const players = await storage.getPlayersByRoom(room.id);
      // Use savedCharacters table via roomCode for correct character data
      const characters = await storage.getCharactersByRoomCode(code);

      const initiatives: InitiativeEntry[] = [];
      for (const char of characters) {
        // Match character via userId since savedCharacters uses userId, not playerId
        const player = players.find((p) => p.userId === char.userId);
        if (!player) continue;

        // Simulate initiative roll: d20 + modifier
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + char.initiativeModifier;

        initiatives.push({
          playerId: player.id,
          playerName: player.name,
          characterName: char.characterName,
          roll,
          modifier: char.initiativeModifier,
          total,
        });
      }

      // Sort by total descending
      initiatives.sort((a, b) => b.total - a.total);

      roomCombatState.set(code, {
        isActive: true,
        currentTurnIndex: 0,
        initiatives,
      });

      // Broadcast initiative order
      broadcastToRoom(code, {
        type: "system",
        content: "Combat begins! Initiative order:",
        initiatives: initiatives.map((entry) => `${entry.characterName} (${entry.total})`),
      });

      // Generate starting combat scene if needed
      const startingScene = await generateStartingScene(room.gameSystem, room.name);
      broadcastToRoom(code, {
        type: "dm",
        content: startingScene,
      });

      res.json({ success: true, initiatives });
    } catch (error) {
      res.status(500).json({ error: "Failed to start combat" });
    }
  });

  app.post("/api/rooms/:code/combat/turn", async (req, res) => {
    try {
      const { code } = req.params;
      const state = roomCombatState.get(code);
      if (!state || !state.isActive) {
        return res.status(400).json({ error: "No active combat" });
      }

      const current = state.initiatives[state.currentTurnIndex];
      broadcastToRoom(code, {
        type: "system",
        content: `It's ${current.characterName}'s (${current.playerName}) turn!`,
      });

      // If it's an enemy turn (assuming enemies are after players), generate AI turn
      if (state.currentTurnIndex >= state.initiatives.length / 2) { // Simple heuristic
        const room = await storage.getRoomByCode(code);
        if (room) {
          const enemyActions = await generateCombatDMTurn(room);
          broadcastToRoom(code, {
            type: "dm",
            content: enemyActions,
          });
        }
      }

      // Advance turn
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.initiatives.length;

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process turn" });
    }
  });

  // Dropped items interaction
  app.post("/api/rooms/:code/items/drop", async (req, res) => {
    try {
      const { code } = req.params;
      const { item }: { item: DroppedItemInfo } = req.body;

      if (!roomDroppedItems.has(code)) {
        roomDroppedItems.set(code, []);
      }

      const droppedId = randomUUID();
      roomDroppedItems.get(code)!.push({ ...item, id: droppedId });

      broadcastToRoom(code, {
        type: "system",
        content: `An item has been dropped: ${item.name} (${item.quantity}) at ${item.location}`,
      });

      res.json({ success: true, droppedId });
    } catch (error) {
      res.status(500).json({ error: "Failed to drop item" });
    }
  });

  app.post("/api/rooms/:code/items/pickup", async (req, res) => {
    try {
      const { code } = req.params;
      const { droppedId, characterId } = req.body;

      const droppedList = roomDroppedItems.get(code);
      if (!droppedList) return res.status(404).json({ error: "No dropped items" });

      const itemIndex = droppedList.findIndex((i) => i.id === droppedId);
      if (itemIndex === -1) return res.status(404).json({ error: "Item not found" });

      const item = droppedList[itemIndex];
      droppedList.splice(itemIndex, 1);

      // Add to character inventory
      await storage.addToInventory({
        characterId,
        itemId: item.name.toLowerCase().replace(/\s/g, "-"), // Approximate ID
        quantity: item.quantity,
      });

      broadcastToRoom(code, {
        type: "system",
        content: `Item picked up: ${item.name} (${item.quantity})`,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to pickup item" });
    }
  });

  // Token usage stats (for admin/debug)
  app.get("/api/stats/token-usage/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const usage = getTokenUsage(roomId);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to get token usage" });
    }
  });

  // Generate PDF adventure log
  app.get("/api/rooms/:code/export-pdf", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ error: "Room not found" });

      const PDFDocument = require("pdfkit");
      const pdfDoc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
      });

      // Title page
      pdfDoc.fontSize(28).text(room.name, { align: "center" });
      pdfDoc.fontSize(16).text(`Game System: ${room.gameSystem.toUpperCase()}`, { align: "center" });
      pdfDoc.fontSize(14).text(`Hosted by: ${room.hostName}`, { align: "center" });
      pdfDoc.moveDown(2);

      // Adventure log
      pdfDoc.fontSize(20).text("Adventure Log");
      pdfDoc.moveDown();

      for (const msg of room.messageHistory) {
        const color = msg.type === "dm" ? "rgb(0.2, 0.5, 0.8)" : "rgb(0.1, 0.1, 0.1)";
        pdfDoc.fontSize(12).fillColor(color).text(`${msg.playerName}: ${msg.content}`);
        if (msg.diceResult) {
          pdfDoc.fillColor("rgb(0.5, 0.5, 0.5)").text(`[Roll: ${msg.diceResult.total}]`);
        }
        pdfDoc.moveDown(0.5);
      }

      // Characters section - use savedCharacters table via roomCode
      const characters = await storage.getCharactersByRoomCode(code);
      pdfDoc.addPage().fontSize(20).fillColor("black").text("Characters");
      for (const char of characters) {
        pdfDoc.fontSize(14).text(char.characterName);
        pdfDoc.fontSize(12).text(`Race: ${char.race} | Class: ${char.class} | Level: ${char.level}`);
        pdfDoc.moveDown();
      }

      const pdfBytes = await pdfDoc.save();

      const filename = `${room.name.replace(/[^a-zA-Z0-9]/g, '_')}_adventure_${room.code}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));

    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // DM Controls API - Update character stats (unified character model)
  app.patch("/api/room-characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { hostName, roomCode, ...updates } = req.body;

      // Verify the room exists and requester is host
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the DM can modify character stats" });
      }

      const character = await storage.getSavedCharacter(id);
      if (!character || character.currentRoomCode !== roomCode) {
        return res.status(404).json({ error: "Character not found in this room" });
      }

      const updatedCharacter = await storage.updateSavedCharacter(id, updates);
      
      // Broadcast update to room with full character data for UI sync
      broadcastToRoom(roomCode, {
        type: "character_update",
        characterId: id,
        playerId: character.userId,
        currentHp: updatedCharacter?.currentHp ?? character.currentHp,
        maxHp: updatedCharacter?.maxHp ?? character.maxHp,
        updates,
      });

      res.json(updatedCharacter);
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // DM Controls API - Add status effect (unified character model)
  app.post("/api/room-characters/:id/status-effects", async (req, res) => {
    try {
      const { id } = req.params;
      const { hostName, roomCode, name, description, duration, isPredefined = true } = req.body;

      // Verify the room exists and requester is host
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the DM can apply status effects" });
      }

      const character = await storage.getSavedCharacter(id);
      if (!character || character.currentRoomCode !== roomCode) {
        return res.status(404).json({ error: "Character not found in this room" });
      }

      const effect = await storage.createStatusEffect({
        characterId: id,
        name,
        description,
        duration,
        isPredefined,
        appliedByDm: true,
      });

      // Broadcast update to room
      broadcastToRoom(roomCode, {
        type: "status_effect_added",
        characterId: id,
        effect,
      });

      res.json(effect);
    } catch (error) {
      console.error("Error adding status effect:", error);
      res.status(500).json({ error: "Failed to add status effect" });
    }
  });

  // DM Controls API - Remove status effect
  app.delete("/api/status-effects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { hostName, roomCode } = req.body;

      // Verify the room exists and requester is host
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the DM can remove status effects" });
      }

      await storage.deleteStatusEffect(id);

      // Broadcast update to room
      broadcastToRoom(roomCode, {
        type: "status_effect_removed",
        effectId: id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing status effect:", error);
      res.status(500).json({ error: "Failed to remove status effect" });
    }
  });

  // Periodic cleanup job: Delete stale inactive rooms (older than 24 hours)
  const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
  const STALE_ROOM_HOURS = 24; // Delete rooms inactive for 24+ hours

  async function cleanupStaleRooms() {
    try {
      const staleRooms = await storage.getStaleInactiveRooms(STALE_ROOM_HOURS);
      for (const room of staleRooms) {
        console.log(`Cleaning up stale room: ${room.code} (inactive since ${room.lastActivityAt})`);
        await storage.deleteRoomWithAllData(room.id);
        roomConnections.delete(room.code);
      }
      if (staleRooms.length > 0) {
        console.log(`Cleaned up ${staleRooms.length} stale room(s)`);
      }
    } catch (error) {
      console.error("Stale room cleanup error:", error);
    }
  }

  // Run cleanup on startup and then periodically
  cleanupStaleRooms();
  setInterval(cleanupStaleRooms, CLEANUP_INTERVAL_MS);

  // Items API
  app.get("/api/items", async (req, res) => {
    try {
      const { search, category, rarity } = req.query as { 
        search?: string; 
        category?: typeof itemCategoryEnum.enumValues[number]; 
        rarity?: typeof itemRarityEnum.enumValues[number]; 
      };

      let result;
      if (search) {
        result = await storage.searchItems(search);
      } else {
        result = await storage.getItems(category, rarity);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getItem(id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Spells API
  app.get("/api/spells", async (req, res) => {
    try {
      const { search, level, school, class: classFilter } = req.query as {
        search?: string;
        level?: string;
        school?: string;
        class?: string;
      };

      let result;
      if (search) {
        result = await storage.searchSpells(search);
      } else {
        result = await storage.getSpells(
          level !== undefined ? parseInt(level) : undefined,
          school,
          classFilter
        );
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching spells:", error);
      res.status(500).json({ error: "Failed to fetch spells" });
    }
  });

  app.get("/api/spells/:id", async (req, res) => {
    try {
      const spell = await storage.getSpell(req.params.id);
      if (!spell) {
        return res.status(404).json({ error: "Spell not found" });
      }
      res.json(spell);
    } catch (error) {
      console.error("Error fetching spell:", error);
      res.status(500).json({ error: "Failed to fetch spell" });
    }
  });

  // Character Inventory API
  app.get("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { characterId } = req.params;
      const inventory = await storage.getInventoryWithDetails(characterId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { characterId } = req.params;
      const { itemId, quantity = 1, equipped = false, notes, attunementSlot = false } = req.body;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const insert: InsertInventoryItem = {
        characterId,
        itemId,
        quantity,
        equipped,
        notes,
        attunementSlot,
      };

      const added = await storage.addToInventory(insert);
      res.json(added);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return httpServer;
}
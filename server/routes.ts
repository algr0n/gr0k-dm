import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import * as storageModule from './storage';

// Allow using a mock storage implementation when running integration tests locally.
// Set environment variable `USE_MOCK_STORAGE=1` to load `./storage.mock` if present.
let storage: any = (storageModule as any).storage ?? storageModule;

if (process.env.USE_MOCK_STORAGE === '1') {
  console.log('[Routes] Mock storage mode enabled');
  // Mock storage will be loaded dynamically when needed
  // This allows tests to import this file without side effects
}
import { db } from "./db";
import { client as libsqlClient } from "./db";
import { parseDiceExpression } from "./dice";
import { calculateDndMaxHp, applyDndRaceBonuses, parseHitDiceString, type HitDiceInfo } from "@shared/race-class-bonuses";
import {
  openai,
  generateDMResponse,
  generateBatchedDMResponse,
  generateStartingScene,
  generateCombatDMTurn,
  type CharacterInfo,
  type BatchedMessage,
  type DroppedItemInfo,
  type AdventureContext,
  getTokenUsage,
} from "./grok";
import { rollInitiativesForCombat, createCombatState, resolveAttack, addHold, processTrigger, advanceTurn, updateThreat, applyMoveAction, decideMonsterActions, type CombatState as FullCombatState } from "./combat";
import {
  insertRoomSchema,
  insertSavedCharacterSchema,
  updateUserProfileSchema,
  type Message,
  type SavedCharacter,
  type InsertSavedInventoryItem,
  rooms,
  players,
  users,
  roomAdventureProgress,
  getLevelFromXP,
  classDefinitions,
  getAbilityModifier,
  calculateLevelUpHP,
  getMaxSpellSlots,
  isSpellcaster,
  getMaxCantripsKnown,
  getMaxSpellsKnown,
  classSkillFeatures,
  subclassSkillFeatures,
  type DndClass,
} from "@shared/schema";
import { getMonsterByName } from "./db/bestiary";
import {
  adventures,
  adventureChapters,
  adventureLocations,
  adventureNpcs,
  adventureQuests,
  questObjectiveProgress,
} from "@shared/adventure-schema";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { setupAuth, isAuthenticated, getSession } from "./auth";
import passport from "passport";
import { createItemFromReward } from "./utils/item-creation";

// ============================================================================
// Adventure Context Helper
// ============================================================================
async function fetchAdventureContext(
  roomId: string,
  adventureId: string
): Promise<AdventureContext | undefined> {
  try {
    // Get adventure name
    const adventure = await db
      .select({ name: adventures.name })
      .from(adventures)
      .where(eq(adventures.id, adventureId))
      .limit(1);

    if (!adventure || adventure.length === 0) {
      return undefined;
    }

    // Get room progress
    const progress = await db
      .select()
      .from(roomAdventureProgress)
      .where(eq(roomAdventureProgress.roomId, roomId))
      .limit(1);

    if (!progress || progress.length === 0) {
      return undefined;
    }

    const adventureProgress = progress[0];

    // Get current chapter
    let currentChapter;
    if (adventureProgress.currentChapterId) {
      const chapters = await db
        .select()
        .from(adventureChapters)
        .where(eq(adventureChapters.id, adventureProgress.currentChapterId))
        .limit(1);
      if (chapters.length > 0) {
        currentChapter = chapters[0];
      }
    }

    // Get current location
    let currentLocation;
    if (adventureProgress.currentLocationId) {
      const locations = await db
        .select()
        .from(adventureLocations)
        .where(eq(adventureLocations.id, adventureProgress.currentLocationId))
        .limit(1);
      if (locations.length > 0) {
        currentLocation = locations[0];
      }
    }

    // Get active quests
    const activeQuestIds = adventureProgress.activeQuestIds as string[] || [];
    let activeQuests;
    if (activeQuestIds.length > 0) {
      activeQuests = await db
        .select()
        .from(adventureQuests)
        .where(inArray(adventureQuests.id, activeQuestIds));
    }

    // Get NPCs in current location (or all from adventure if no location)
    let availableNpcs;
    if (adventureProgress.currentLocationId) {
      availableNpcs = await db
        .select()
        .from(adventureNpcs)
        .where(eq(adventureNpcs.locationId, adventureProgress.currentLocationId));
    } else {
      // No specific location - get all NPCs from the adventure (limited to 10 most relevant)
      availableNpcs = await db
        .select()
        .from(adventureNpcs)
        .where(eq(adventureNpcs.adventureId, adventureId))
        .limit(10);
    }

    return {
      adventureName: adventure[0].name,
      currentChapter,
      currentLocation,
      activeQuests,
      availableNpcs,
      metNpcIds: adventureProgress.metNpcIds as string[] || [],
      discoveredLocationIds: adventureProgress.discoveredLocationIds as string[] || [],
    };
  } catch (error) {
    console.error('[Adventure Context] Error fetching context:', error);
    return undefined;
  }
}

// ============================================================================
// Story Context Helper - Fetch from cache or database
// ============================================================================
async function fetchStoryContext(
  roomId: string,
  adventureId?: string
): Promise<import('@shared/adventure-schema').StoryContext | undefined> {
  try {
    const { storyCache } = await import('./cache/story-cache');
    
    // Check cache first
    const cached = storyCache.get(roomId);
    if (cached) {
      console.log(`[Story Context] Cache hit for room ${roomId}`);
      return cached;
    }

    console.log(`[Story Context] Cache miss for room ${roomId}, fetching from DB`);

    // Fetch from database
    const storyEvents = await storage.getStoryEventsByRoom(roomId, { limit: 10, minImportance: 2 });
    const sessionSummary = await storage.getLatestSessionSummary(roomId);
    
    // Fetch quest progress (both adventure quests and dynamic quests)
    let questProgress: import('@shared/adventure-schema').QuestWithProgress[] = [];
    
    // Get all quest objectives for this room
    const objectives = await storage.getQuestObjectivesByRoom(roomId);
    
    // Get quest details and group objectives
    const { adventureQuests } = await import('@shared/adventure-schema');
    const questIds = [...new Set(objectives.map((o: any) => o.questId))] as string[];
    
    if (questIds.length > 0) {
      const quests = await db
        .select()
        .from(adventureQuests)
        .where(inArray(adventureQuests.id, questIds));
      
      questProgress = quests.map(quest => {
        const questObjectives = objectives.filter((o: any) => o.questId === quest.id);
        const completed = questObjectives.filter((o: any) => o.isCompleted).length;
        const total = questObjectives.length;
        return {
          quest,
          objectives: questObjectives,
          completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });
    } else {
      // Also check for quests directly associated with the room (dynamic quests)
      const roomQuests = await storage.getQuestsByRoom(roomId);
      if (roomQuests.length > 0) {
        questProgress = await Promise.all(
          roomQuests.map(async (quest: any) => {
            const questObjectives = await storage.getQuestObjectives(quest.id);
            const completed = questObjectives.filter((o: any) => o.isCompleted).length;
            const total = questObjectives.length;
            return {
              quest,
              objectives: questObjectives,
              completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
          })
        );
      }
    }

    const context = {
      questProgress,
      storyEvents,
      sessionSummary,
    };

    // Cache the result
    storyCache.set(roomId, context);

    return context;
  } catch (error) {
    console.error('[Story Context] Error fetching context:', error);
    return undefined;
  }
}

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
  diceResult?: { expression: string; total: number; rolls: number[]; modifier: number };
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
// Full combat state with richer per-combatant data (used by new action endpoints)
const roomFullCombatState = new Map<string, any>();

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
  type:
    | "hp_change"
    | "item_add"
    | "item_remove"
    | "gold_change"
    | "currency_change"
    | "xp_award"
    | "monster_defeated"
    | "combat_start"
    | "combat_end"
    | "death_save"
    | "stable"
    | "dead"
    | "status_add"
    | "status_remove"
    | "npc_add"
    | "location_add"
    | "quest_add"
    | "quest_update";
  playerName?: string;
  characterName?: string;
  currentHp?: number;
  maxHp?: number;
  itemName?: string;
  quantity?: number;
  customProperties?: string; // NEW: JSON string with item stats or NPC/location props
  goldAmount?: number;
  currency?: { cp: number; sp: number; gp: number };
  successes?: number;
  failures?: number;
  statusName?: string;
  // npc/location specific
  npcName?: string;
  npcRole?: string;
  locationName?: string;
  locationType?: string;
  // quest specific
  questTitle?: string;
  questGiver?: string;
  questStatus?: string;
  questDescription?: string;
  questObjectives?: string[];
  questRewards?: Record<string, any>;
  questUrgency?: string;
  questId?: string; // For quest updates
  // XP award
  xpAmount?: number;
  // Monster defeat
  monsterName?: string;
  participants?: string; // comma-separated participant names
}

function parseDMResponseTags(response: string): ParsedGameAction[] {
  const actions: ParsedGameAction[] = [];

  // Parse HP changes: [HP: PlayerName | CurrentHP/MaxHP]
  const hpPattern = /\[HP:\s*([^|]+?)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
  let match;
  while ((match = hpPattern.exec(response)) !== null) {
    actions.push({
      type: "hp_change",
      playerName: match[1].trim(),
      currentHp: parseInt(match[2], 10),
      maxHp: parseInt(match[3], 10),
    });
  }

  // Parse item additions with optional JSON properties: 
  // [ITEM: PlayerName | ItemName | Quantity] OR
  // [ITEM: PlayerName | ItemName | Quantity | {"weight":3,"cost":500,...}]
  const itemAddPattern = /\[ITEM:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)(?:\s*\|\s*(\{[^\]]+\}))?\s*\]/gi;
  while ((match = itemAddPattern.exec(response)) !== null) {
    actions.push({
      type: "item_add",
      playerName: match[1].trim(),
      itemName: match[2].trim(),
      quantity: parseInt(match[3], 10),
      customProperties: match[4] ? match[4].trim() : undefined,
    });
  }

  // Parse item removals: [REMOVE_ITEM: PlayerName | ItemName | Quantity]
  const itemRemovePattern = /\[REMOVE_ITEM:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\]/gi;
  while ((match = itemRemovePattern.exec(response)) !== null) {
    actions.push({
      type: "item_remove",
      playerName: match[1].trim(),
      itemName: match[2].trim(),
      quantity: parseInt(match[3], 10),
    });
  }

  // Parse currency/gold: [GOLD: PlayerName | Amount]
  // Amount can be: "50 cp", "10 sp", "5 gp", or just "50" (defaults to gp)
  const goldPattern = /\[GOLD:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/gi;
  while ((match = goldPattern.exec(response)) !== null) {
    const playerName = match[1].trim();
    const amountStr = match[2].trim().toLowerCase();
    
    // Parse the amount string
    const currency = { cp: 0, sp: 0, gp: 0 };
    
    if (amountStr.includes('cp') || amountStr.includes('copper')) {
      const amount = parseInt(amountStr.match(/(\d+)/)?.[1] || '0', 10);
      currency.cp = amount;
    } else if (amountStr.includes('sp') || amountStr.includes('silver')) {
      const amount = parseInt(amountStr.match(/(\d+)/)?.[1] || '0', 10);
      currency.sp = amount;
    } else {
      // Default to gold pieces
      const amount = parseInt(amountStr.match(/(\d+)/)?.[1] || '0', 10);
      currency.gp = amount;
    }
    
    // Apply automatic conversion
    const converted = convertCurrency(currency);
    
    actions.push({
      type: "currency_change",
      playerName,
      currency: converted,
    });
  }

  // Parse XP awards: [XP: PlayerName | Amount] or [XP: all | Amount]
  const xpPattern = /\[XP:\s*([^|]+?)\s*\|\s*(\d+)\s*\]/gi;
  while ((match = xpPattern.exec(response)) !== null) {
    actions.push({
      type: "xp_award",
      playerName: match[1].trim(),
      xpAmount: parseInt(match[2], 10),
    });
  }

  // Parse monster defeated tags:
  // [MONSTER_DEFEATED: Name] OR
  // [MONSTER_DEFEATED: Name | XP: 250] OR
  // [MONSTER_DEFEATED: Name | participants: Alice,Bob] OR
  // [MONSTER_DEFEATED: Name | XP: 250 | participants: Alice,Bob]
  const monsterDefeatPattern = /\[MONSTER_DEFEATED:\s*([^|\]]+?)\s*(?:\|\s*XP:\s*(\d+)\s*)?(?:\|\s*participants:\s*([^\]]+?)\s*)?\]/gi;
  while ((match = monsterDefeatPattern.exec(response)) !== null) {
    actions.push({
      type: "monster_defeated",
      monsterName: match[1].trim(),
      xpAmount: match[2] ? parseInt(match[2], 10) : undefined,
      participants: match[3] ? match[3].trim() : undefined,
    } as ParsedGameAction);
  }

  // Parse combat state changes
  if (/\[COMBAT_START\]/i.test(response)) {
    actions.push({ type: "combat_start" });
  }
  if (/\[COMBAT_END\]/i.test(response)) {
    actions.push({ type: "combat_end" });
  }

  // Parse death saving throws: [DEATH_SAVES: PlayerName | Successes/Failures]
  const deathSavePattern = /\[DEATH_SAVES:\s*([^|]+?)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
  while ((match = deathSavePattern.exec(response)) !== null) {
    actions.push({
      type: "death_save",
      playerName: match[1].trim(),
      successes: parseInt(match[2], 10),
      failures: parseInt(match[3], 10),
    });
  }

  // Parse stabilized: [STABLE: PlayerName]
  const stablePattern = /\[STABLE:\s*([^\]]+?)\s*\]/gi;
  while ((match = stablePattern.exec(response)) !== null) {
    actions.push({
      type: "stable",
      playerName: match[1].trim(),
    });
  }

  // Parse death: [DEAD: PlayerName]
  const deadPattern = /\[DEAD:\s*([^\]]+?)\s*\]/gi;
  while ((match = deadPattern.exec(response)) !== null) {
    actions.push({
      type: "dead",
      playerName: match[1].trim(),
    });
  }

  // Parse status effect additions: [STATUS: PlayerName | EffectName]
  const statusAddPattern = /\[STATUS:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/gi;
  while ((match = statusAddPattern.exec(response)) !== null) {
    actions.push({
      type: "status_add",
      playerName: match[1].trim(),
      statusName: match[2].trim(),
    });
  }

  // Parse status effect removals: [REMOVE_STATUS: PlayerName | EffectName]
  const statusRemovePattern = /\[REMOVE_STATUS:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/gi;
  while ((match = statusRemovePattern.exec(response)) !== null) {
    actions.push({
      type: "status_remove",
      playerName: match[1].trim(),
      statusName: match[2].trim(),
    });
  }

  // Parse NPC creation tags:
  // [NPC: Name] or [NPC: Name | Role] or [NPC: Name | Role | {"personality":"...","description":"..."}]
  const npcPattern = /\[NPC:\s*([^|\]\n]+?)\s*(?:\|\s*([^|\]\n]+?))?\s*(?:\|\s*(\{[^\]]+\}))?\s*\]/gi;
  while ((match = npcPattern.exec(response)) !== null) {
    actions.push({
      type: "npc_add",
      npcName: match[1].trim(),
      npcRole: match[2] ? match[2].trim() : undefined,
      customProperties: match[3] ? match[3].trim() : undefined,
    });
  }

  // Parse LOCATION creation tags:
  // [LOCATION: Name] or [LOCATION: Name | Type] or [LOCATION: Name | Type | {"description":"..."}]
  const locationPattern = /\[LOCATION:\s*([^|\]\n]+?)\s*(?:\|\s*([^|\]\n]+?))?\s*(?:\|\s*(\{[^\]]+\}))?\s*\]/gi;
  while ((match = locationPattern.exec(response)) !== null) {
    actions.push({
      type: "location_add",
      locationName: match[1].trim(),
      locationType: match[2] ? match[2].trim() : undefined,
      customProperties: match[3] ? match[3].trim() : undefined,
    });
  }

  // Parse QUEST creation tags:
  // [QUEST: Title | QuestGiver | Status | {"description":"...","objectives":[...],"rewards":{...},"urgency":"high"}]
  // Minimum: [QUEST: Title]
  // More robust pattern that handles nested brackets and complex JSON
  const questPattern = /\[QUEST:\s*([^|\]]+?)\s*(?:\|\s*([^|\]]+?))?\s*(?:\|\s*([^|\]]+?))?\s*(?:\|\s*(\{[\s\S]+?\}))?\s*\]/gi;
  while ((match = questPattern.exec(response)) !== null) {
    console.log('[Quest Parsing] Found QUEST tag:', match[0].substring(0, 100) + '...');
    const questData: ParsedGameAction = {
      type: "quest_add",
      questTitle: match[1].trim(),
      questGiver: match[2] ? match[2].trim() : undefined,
      questStatus: match[3] ? match[3].trim() : "active",
    };
    
    // Parse JSON properties if present
    if (match[4]) {
      console.log('[Quest Parsing] Parsing JSON properties:', match[4]);
      try {
        const props = JSON.parse(match[4]);
        if (props.description) questData.questDescription = props.description;
        if (props.objectives) questData.questObjectives = props.objectives;
        if (props.rewards) questData.questRewards = props.rewards;
        if (props.urgency) questData.questUrgency = props.urgency;
        console.log('[Quest Parsing] Parsed quest data:', questData);
      } catch (e) {
        console.error("[Quest Parsing] Failed to parse quest properties:", e, "JSON:", match[4]);
      }
    } else {
      console.log('[Quest Parsing] No JSON properties found');
    }
    
    actions.push(questData);
    console.log('[Quest Parsing] Added quest action to execute');
  }

  // Parse QUEST status updates:
  // [QUEST_UPDATE: QuestId | Status] or [QUEST_UPDATE: QuestTitle | Status]
  const questUpdatePattern = /\[QUEST_UPDATE:\s*([^|\]\n]+?)\s*\|\s*([^|\]\n]+?)\s*\]/gi;
  while ((match = questUpdatePattern.exec(response)) !== null) {
    actions.push({
      type: "quest_update",
      questId: match[1].trim(), // Can be ID or title
      questStatus: match[2].trim(),
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

interface DetectedCurrency {
  cp: number;  // Copper pieces
  sp: number;  // Silver pieces
  gp: number;  // Gold pieces
}

// D&D 5e currency conversion rates
const CP_TO_SP_RATE = 100;
const SP_TO_GP_RATE = 100;

// Detect currency mentions in natural language (copper, silver, gold)
function detectCurrencyMentions(response: string): DetectedCurrency {
  const currency: DetectedCurrency = { cp: 0, sp: 0, gp: 0 };

  // Patterns for currency detection
  const cpPatterns = [
    /(\d+)\s*(?:cp|copper\s*pieces?|copper)/gi,
    /receives?\s+(\d+)\s*(?:cp|copper)/gi,
    /gains?\s+(\d+)\s*(?:cp|copper)/gi,
    /finds?\s+(\d+)\s*(?:cp|copper)/gi,
  ];

  const spPatterns = [
    /(\d+)\s*(?:sp|silver\s*pieces?|silver)/gi,
    /receives?\s+(\d+)\s*(?:sp|silver)/gi,
    /gains?\s+(\d+)\s*(?:sp|silver)/gi,
    /finds?\s+(\d+)\s*(?:sp|silver)/gi,
  ];

  const gpPatterns = [
    /(\d+)\s*(?:gp|gold\s*pieces?|gold)/gi,
    /receives?\s+(\d+)\s*(?:gp|gold)/gi,
    /gains?\s+(\d+)\s*(?:gp|gold)/gi,
    /finds?\s+(\d+)\s*(?:gp|gold)/gi,
    /(?:has|have)\s+(\d+)\s*(?:gp|gold)/gi,
  ];

  // Extract copper
  for (const pattern of cpPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const amount = parseInt(match[1], 10);
      if (amount > 0) {
        currency.cp += amount;
      }
    }
  }

  // Extract silver
  for (const pattern of spPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const amount = parseInt(match[1], 10);
      if (amount > 0) {
        currency.sp += amount;
      }
    }
  }

  // Extract gold
  for (const pattern of gpPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const amount = parseInt(match[1], 10);
      if (amount > 0) {
        currency.gp += amount;
      }
    }
  }

  return currency;
}

// Convert currency automatically: 100 cp → 1 sp, 100 sp → 1 gp
function convertCurrency(currency: DetectedCurrency): DetectedCurrency {
  const result = { ...currency };
  
  // Convert copper to silver
  if (result.cp >= CP_TO_SP_RATE) {
    result.sp += Math.floor(result.cp / CP_TO_SP_RATE);
    result.cp = result.cp % CP_TO_SP_RATE;
  }
  
  // Convert silver to gold
  if (result.sp >= SP_TO_GP_RATE) {
    result.gp += Math.floor(result.sp / SP_TO_GP_RATE);
    result.sp = result.sp % SP_TO_GP_RATE;
  }
  
  return result;
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
    "receives?",
    "gains?",
    "picks? up",
    "finds?",
    "obtains?",
    "acquires?",
    "collects?",
    "loots?",
    "is awarded",
    "adds? to (?:inventory|pack)",
    "(?:picks? up |receives? |finds? |gains? )another",
  ];

  // DESCRIPTIVE verbs - only add NEW items if NOT already owned
  // Includes ambiguous verbs that could be descriptions of possession
  const descriptivePhrases = [
    "has",
    "have",
    "carrying",
    "carries",
    "holds?",
    "possesses?",
    "takes?",
    "grabs?",
    "gets?",
    "gives?",
    "in (?:your|their|his|her) (?:pack|inventory|bag|backpack|pouch)",
  ];

  const acquisitionPattern = new RegExp(
    `(?:${acquisitionPhrases.join(
      "|"
    )})\\s+(?:a\\s+|an\\s+|the\\s+|\\d+\\s*x?\\s*)?([a-zA-Z][a-zA-Z\\s'-]+?)(?:\\s*\\(|\\s*,|\\s*\\.|\\s*!|\\s*and\\s|$)`,
    "gi"
  );

  const descriptivePattern = new RegExp(
    `(?:${descriptivePhrases.join(
      "|"
    )})\\s+(?:a\\s+|an\\s+|the\\s+|\\d+\\s*x?\\s*)?([a-zA-Z][a-zA-Z\\s'-]+?)(?:\\s*\\(|\\s*,|\\s*\\.|\\s*!|\\s*and\\s|$)`,
    "gi"
  );

  // Quantity patterns like "2x healing potion" or "3 healing potions" - always allow
  const quantityPattern = /(\d+)\s*x?\s+([a-zA-Z][a-zA-Z\s'-]+?)(?:\s*\(|\s*,|\s*\.|\s*!|\s*and\s|$)/gi;

  const seenItems = new Set<string>();

  // Helper to match and add items
  const matchItem = (potentialItemName: string, quantity: number, allowExisting: boolean): boolean => {
    const lowerPotential = potentialItemName.toLowerCase();

    // Skip if it's currency (handled separately)
    if (
      lowerPotential.includes("gold") || 
      lowerPotential.includes(" gp") ||
      lowerPotential.includes("silver") ||
      lowerPotential.includes(" sp") ||
      lowerPotential.includes("copper") ||
      lowerPotential.includes(" cp") ||
      lowerPotential.includes("eddies") ||
      lowerPotential.includes("eurodollar")
    ) {
      return false;
    }

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
      const mainWordMatch = words.some((w) => itemWords.some((iw) => iw === w && w.length > 3));

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
  const existingItemNames = new Set(existingInventory.map((n) => n.toLowerCase()));

  // Detect currency mentions (copper, silver, gold)
  // Skip currency auto-grants if this DM message contains a [QUEST:...] tag.
  // Quest offers should not immediately award currency; rewards are granted on completion.
  if (!/\[QUEST:/i.test(response)) {
    const currencyMentions = detectCurrencyMentions(response);
    if (currencyMentions.cp > 0 || currencyMentions.sp > 0 || currencyMentions.gp > 0) {
      // Apply automatic currency conversion
      const converted = convertCurrency(currencyMentions);
      actions.push({
        type: "currency_change",
        playerName: characterName,
        currency: converted,
      });
    }
  } else {
    console.log('[NL Detection] Skipping currency auto-grant because message contains QUEST tag');
  }

  // Detect item mentions - acquisition verbs allow stacking, descriptive only add new
  const itemMentions = await detectItemMentions(response, characterName, existingItemNames);
  for (const item of itemMentions) {
    actions.push({
      type: "item_add",
      playerName: characterName,
      itemName: item.itemName,
      quantity: item.quantity,
    });
  }

  return actions;
}

// Helper: award XP to a character (no broadcasting here). Returns same result object.
async function awardXpToCharacter(characterId: string, xpAmount: number, roomCode?: string) {
  // Award XP helper entry log (kept minimal for test visibility)
  const existing = await storage.getSavedCharacter(characterId);
  if (!existing) {
    throw new Error("Character not found");
  }

  const oldXp = existing.xp || 0;
  const newXp = oldXp + xpAmount;
  const oldLevel = existing.level || 1;
  const newLevel = getLevelFromXP(newXp);
  const leveledUp = newLevel > oldLevel;

  let updates: any = { xp: newXp };

  let levelsGained = 0;
  let totalHpGain = 0;

  if (leveledUp) {
    levelsGained = newLevel - oldLevel;
    updates.level = newLevel;

    if (existing.class && classDefinitions[existing.class as DndClass]) {
      const conMod = existing.stats?.constitution ? getAbilityModifier(existing.stats.constitution as number) : 0;
      let hpGain = 0;
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        hpGain += calculateLevelUpHP(existing.class as DndClass, conMod);
      }
      totalHpGain = hpGain;
      updates.maxHp = (existing.maxHp || 10) + hpGain;
      updates.currentHp = Math.min((updates.currentHp ?? existing.currentHp) + hpGain, updates.maxHp);

      // Update hit dice to reflect new total (e.g., "3d10")
      try {
        const classDef = classDefinitions[existing.class as DndClass];
        if (classDef && classDef.hitDie) {
          updates.hitDice = `${newLevel}d${classDef.hitDie}`;
        }
      } catch (err) {
        console.error('Failed to set hitDice on level up:', err);
      }
    }

    if (existing.class && isSpellcaster(existing.class as string)) {
      try {
        const newMaxSlots = getMaxSpellSlots(existing.class as string, newLevel);
        updates.spellSlots = { max: newMaxSlots, current: newMaxSlots };
      } catch (err) {
        console.error("Failed to compute spell slots on level up:", err);
      }
    }

    try {
      const existingChoices = (existing.levelChoices as Record<string, unknown>[]) || [];
      const newChoices: Record<string, unknown>[] = [];
      const ASI_LEVELS = [4, 8, 12, 16, 19];
      const FIGHTER_EXTRA_ASI = [6, 14];

      // ASI/Feat choices
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        if (ASI_LEVELS.includes(lvl)) newChoices.push({ level: lvl, feature: 'ASI', applied: false });
        if ((existing.class === 'Fighter' || existing.class === 'fighter') && FIGHTER_EXTRA_ASI.includes(lvl)) {
          newChoices.push({ level: lvl, feature: 'Fighter ASI', applied: false });
        }
      }

      // Class-level skill features (e.g., Rogue/Bard expertise)
      const classFeatures = classSkillFeatures[existing.class as DndClass] || [];
      for (const feat of classFeatures) {
        if (feat.level > oldLevel && feat.level <= newLevel) {
          newChoices.push({ level: feat.level, feature: feat.name, applied: false, type: 'class_feature' });
        }
      }

      // Subclass-level skill features (e.g., Cleric Domain, Scout Ranger)
      const subclassFeatures = subclassSkillFeatures.filter(sf => sf.parentClass === (existing.class as DndClass));
      for (const sf of subclassFeatures) {
        if (sf.level > oldLevel && sf.level <= newLevel) {
          newChoices.push({ level: sf.level, feature: sf.name, applied: false, type: 'subclass_feature' });
        }
      }

      // Spell-related choices: cantrips and spells known for "known" caster classes
      if (existing.class) {
        const normalizedClass = (existing.class as string).toLowerCase();
        for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
          // Cantrips
          try {
            const prevCantrips = getMaxCantripsKnown(normalizedClass, lvl - 1);
            const newCantrips = getMaxCantripsKnown(normalizedClass, lvl);
            if (newCantrips > prevCantrips) {
              newChoices.push({ level: lvl, feature: 'Cantrips', count: newCantrips - prevCantrips, applied: false });
            }
          } catch (err) {
            // ignore if not applicable
          }

          // Spells known (for 'known' classes)
          try {
            const prevSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl - 1) ?? 0;
            const newSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl) ?? 0;
            if (newSpellsKnown > prevSpellsKnown) {
              newChoices.push({ level: lvl, feature: 'Spells Known', count: newSpellsKnown - prevSpellsKnown, applied: false });
            }
          } catch (err) {
            // ignore
          }
        }
      }

      if (newChoices.length > 0) updates.levelChoices = [...existingChoices, ...newChoices];
    } catch (err) {
      console.error('Failed to populate levelChoices on level up:', err);
    }
  }

  const updated = await storage.updateSavedCharacter(characterId, updates);

  return {
    character: updated,
    xpAwarded: xpAmount,
    leveledUp,
    previousLevel: oldLevel,
    levelsGained,
    totalHpGain,
  };
}

// Export parsing and action helpers for integration testing and tooling
export { parseDMResponseTags, executeGameActions, awardXpToCharacter };

// Test helper to access internal storage instance used by routes
export function _test_getInternalStorage() {
  return storage;
}



async function executeGameActions(
  actions: ParsedGameAction[],
  roomCode: string,
  broadcastFn: (roomCode: string, message: any) => void
): Promise<void> {
  // Collapse multiple currency_change actions for the same player into a single consolidated action
  const consolidatedActions: ParsedGameAction[] = [];
  const currencyBuckets: Record<string, { cp: number; sp: number; gp: number }> = {};

  for (const a of actions) {
    if (a.type === 'currency_change' && a.playerName) {
      const key = a.playerName.toLowerCase();
      currencyBuckets[key] = currencyBuckets[key] || { cp: 0, sp: 0, gp: 0 };
      currencyBuckets[key].cp += (a.currency?.cp || 0);
      currencyBuckets[key].sp += (a.currency?.sp || 0);
      currencyBuckets[key].gp += (a.currency?.gp || 0);
    } else {
      consolidatedActions.push(a);
    }
  }

  // Push consolidated currency actions back into action list
  for (const player of Object.keys(currencyBuckets)) {
    consolidatedActions.push({
      type: 'currency_change',
      playerName: player,
      currency: currencyBuckets[player],
    } as ParsedGameAction);
  }

  // Replace actions with consolidatedActions so the rest of the logic processes deduped currency changes
  actions = consolidatedActions;

  const characters = await storage.getCharactersByRoomCode(roomCode);
  const room = await storage.getRoomByCode(roomCode);
  if (!room) return;

  const players = await storage.getPlayersByRoom(room.id);
  // Debug: room and participants (kept minimal)

  for (const action of actions) {
    try {
      // Find character by player name (case insensitive match)
      const findCharacter = (playerName: string) => {
        // Try to match by player name first
        const player = players.find((p: any) => p.name.toLowerCase() === playerName.toLowerCase());
        if (player) {
          return characters.find((c: any) => c.userId === player.userId);
        }
        // Fallback: match by character name
        return characters.find((c: any) => c.characterName.toLowerCase() === playerName.toLowerCase());
      };

      switch (action.type) {
        case "hp_change": {
          if (!action.playerName || action.currentHp === undefined) break;
          const char = findCharacter(action.playerName);
          if (char) {
            await storage.updateSavedCharacter(char.id, {
              currentHp: action.currentHp,
              maxHp: action.maxHp ?? char.maxHp,
            });
            broadcastFn(roomCode, {
              type: "character_update",
              characterId: char.id,
              updates: { currentHp: action.currentHp, maxHp: action.maxHp ?? char.maxHp },
            });
            console.log(`[DM Action] Updated HP for ${action.playerName}: ${action.currentHp}/${action.maxHp}`);
          }
          break;
        }

        case "combat_start": {
          let combatState = roomCombatState.get(roomCode);
          if (!combatState) {
            combatState = { isActive: true, currentTurnIndex: 0, initiatives: [] };
          } else {
            combatState.isActive = true;
          }
          roomCombatState.set(roomCode, combatState);
          broadcastFn(roomCode, { type: "combat_update", combat: combatState });
          console.log(`[DM Action] Combat started in room ${roomCode}`);
          break;
        }

        case "combat_end": {
          const combatState = roomCombatState.get(roomCode);
          if (combatState) {
            combatState.isActive = false;
            combatState.initiatives = [];
            combatState.currentTurnIndex = 0;
            roomCombatState.set(roomCode, combatState);
            broadcastFn(roomCode, { type: "combat_update", combat: combatState });
          }
          console.log(`[DM Action] Combat ended in room ${roomCode}`);
          break;
        }

        case "dead": {
          if (!action.playerName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            await storage.updateSavedCharacter(char.id, {
              isAlive: false,
              currentHp: 0,
            });
            broadcastFn(roomCode, {
              type: "character_update",
              characterId: char.id,
              updates: { isAlive: false, currentHp: 0 },
            });
            console.log(`[DM Action] Character ${action.playerName} has died`);
          }
          break;
        }

        case "status_add": {
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
              type: "status_effect_added",
              characterId: char.id,
              statusName: action.statusName,
            });
            console.log(`[DM Action] Added status "${action.statusName}" to ${action.playerName}`);
          }
          break;
        }

        case "status_remove": {
          if (!action.playerName || !action.statusName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            const effects = await storage.getCharacterStatusEffects(char.id);
            const effect = effects.find((e: any) => e.name.toLowerCase() === action.statusName!.toLowerCase());
            if (effect) {
              await storage.removeStatusEffect(effect.id);
              broadcastFn(roomCode, {
                type: "status_effect_removed",
                characterId: char.id,
                statusName: action.statusName,
              });
              console.log(`[DM Action] Removed status "${action.statusName}" from ${action.playerName}`);
            }
          }
          break;
        }

        case "gold_change": {
          if (!action.playerName || action.goldAmount === undefined) break;
          const char = findCharacter(action.playerName);
          if (char) {
            const newGold = (char.gold || 0) + action.goldAmount;
            await storage.updateSavedCharacter(char.id, { gold: newGold });
            broadcastFn(roomCode, {
              type: "character_update",
              characterId: char.id,
              updates: { gold: newGold },
            });
            console.log(`[DM Action] Updated gold for ${action.playerName}: +${action.goldAmount} (total: ${newGold})`);
          }
          break;
        }

        case "currency_change": {
          if (!action.playerName || !action.currency) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Get current currency or initialize with defaults
            const currentCurrency = char.currency || { cp: 0, sp: 0, gp: 0 };
            
            // Add new currency amounts
            const newCurrency = {
              cp: (currentCurrency.cp || 0) + (action.currency.cp || 0),
              sp: (currentCurrency.sp || 0) + (action.currency.sp || 0),
              gp: (currentCurrency.gp || 0) + (action.currency.gp || 0),
            };
            
            // Apply automatic conversion
            const convertedCurrency = convertCurrency(newCurrency);
            
            // Update character with new currency and sync legacy gold (gp) for UI compatibility
            const updates: any = { currency: convertedCurrency, gold: convertedCurrency.gp };
            await storage.updateSavedCharacter(char.id, updates);
            
            // Broadcast character update so clients will refresh
            broadcastFn(roomCode, {
              type: "character_update",
              characterId: char.id,
              updates,
            });

            // Also send a system message to the room so players see the currency change in chat
            broadcastFn(roomCode, {
              type: "system",
              content: `[CURRENCY] ${action.playerName} receives: ${convertedCurrency.gp} gp, ${convertedCurrency.sp} sp, ${convertedCurrency.cp} cp`,
            });
            
            console.log(`[DM Action] Updated currency for ${action.playerName}: +${action.currency.cp}cp +${action.currency.sp}sp +${action.currency.gp}gp (total: ${convertedCurrency.cp}cp ${convertedCurrency.sp}sp ${convertedCurrency.gp}gp)`);
          }
          break;
        }

        case "xp_award": {
          console.log('[DM Action] xp_award received:', action);
          if (!action.xpAmount) break;
          // Award to all characters in room
            if (action.playerName && action.playerName.toLowerCase() === 'all') {
            for (const c of characters) {
              try {
                const result = await awardXpToCharacter(c.id, action.xpAmount, roomCode);
                console.log(`[DM Action] Awarded ${action.xpAmount} XP to ${c.characterName} (leveledUp=${result.leveledUp})`);
                const newLevel = result?.character?.level;
                broadcastFn(roomCode, { type: 'character_update', characterId: c.id, updates: { xp: (c.xp || 0) + action.xpAmount, ...(newLevel ? { level: newLevel } : {}) } });
                if (result?.leveledUp) {
                  broadcastFn(roomCode, { type: 'level_up', characterId: c.id, previousLevel: result.previousLevel, newLevel, levelsGained: result.levelsGained, totalHpGain: result.totalHpGain, spellSlots: result?.character?.spellSlots, newLevelChoices: result?.character?.levelChoices });
                }
              } catch (err) {
                console.error(`[DM Action] Failed to award XP to ${c.characterName}:`, err);
              }
            }
          } else if (action.playerName) {
            const char = findCharacter(action.playerName);
            if (char) {
              try {
                const result = await awardXpToCharacter(char.id, action.xpAmount, roomCode);
                console.log(`[DM Action] Awarded ${action.xpAmount} XP to ${action.playerName} (leveledUp=${result.leveledUp})`);
                const newLevel = result?.character?.level;
                broadcastFn(roomCode, { type: 'character_update', characterId: char.id, updates: { xp: (char.xp || 0) + action.xpAmount, ...(newLevel ? { level: newLevel } : {}) } });
                if (result?.leveledUp) {
                  broadcastFn(roomCode, { type: 'level_up', characterId: char.id, previousLevel: result.previousLevel, newLevel, levelsGained: result.levelsGained, totalHpGain: result.totalHpGain, spellSlots: result?.character?.spellSlots, newLevelChoices: result?.character?.levelChoices });
                }
              } catch (err) {
                console.error(`[DM Action] Failed to award XP to ${action.playerName}:`, err);
              }
            }
          }
          break;
        }

        case "monster_defeated": {
          if (!action.monsterName) break;
          try {
            // Determine total XP: explicit or from bestiary
            let xpTotal: number | undefined = action.xpAmount;
            if (!xpTotal) {
              try {
                const monster = await getMonsterByName(libsqlClient, action.monsterName);
                xpTotal = monster?.xp ?? undefined;
              } catch (err) {
                console.error('[DM Action] Failed to lookup monster XP:', err);
              }
            }

            if (!xpTotal || xpTotal <= 0) {
              console.log(`[DM Action] No XP available for monster "${action.monsterName}", skipping XP distribution`);
              break;
            }

            // Determine participants: explicit list, combat participants, or all characters in room
            let participantChars: any[] = [];
            if (action.participants) {
              const names = action.participants.split(',').map(s => s.trim()).filter(Boolean);
              for (const n of names) {
                let c = characters.find((ch: any) => (ch.characterName || '').toLowerCase() === n.toLowerCase());
                if (!c) {
                  const playerMatch = players.find((p: any) => (p.name || '').toLowerCase() === n.toLowerCase());
                  if (playerMatch) {
                    c = characters.find((ch: any) => ch.userId === playerMatch.userId);
                  }
                }
                if (c) participantChars.push(c);
              }
            }

            // If none found via explicit participants, use combat state initiatives
            if (participantChars.length === 0) {
              const combat = roomCombatState.get(roomCode);
              if (combat && combat.initiatives && combat.initiatives.length > 0) {
                // Use unique character names from initiatives
                const names = [...new Set(combat.initiatives.map(i => i.characterName))].filter(Boolean) as string[];
                for (const n of names) {
                  const c = characters.find((ch: any) => (ch.characterName || '').toLowerCase() === n.toLowerCase());
                  if (c) participantChars.push(c);
                }
              }
            }

            // Fallback: all characters in the room
            if (participantChars.length === 0) {
              participantChars = [...characters];
            }

            if (participantChars.length === 0) break;

            // Split XP evenly among participants (integer division), distribute remainder to first participants
            const per = Math.floor(xpTotal / participantChars.length);
            let remainder = xpTotal - per * participantChars.length;

            for (const c of participantChars) {
              const amount = per + (remainder > 0 ? 1 : 0);
              if (remainder > 0) remainder--;
              try {
                const result = await awardXpToCharacter(c.id, amount, roomCode);
                console.log(`[DM Action] Awarded ${amount} XP to ${c.characterName} for defeating ${action.monsterName} (leveledUp=${result.leveledUp})`);
                const newLevel = result?.character?.level;
                broadcastFn(roomCode, { type: 'character_update', characterId: c.id, updates: { xp: (c.xp || 0) + amount, ...(newLevel ? { level: newLevel } : {}) } });
                if (result?.leveledUp) {
                  broadcastFn(roomCode, { type: 'level_up', characterId: c.id, previousLevel: result.previousLevel, newLevel, levelsGained: result.levelsGained, totalHpGain: result.totalHpGain, spellSlots: result?.character?.spellSlots, newLevelChoices: result?.character?.levelChoices });
                }
              } catch (err) {
                console.error(`[DM Action] Failed to award XP to ${c.characterName}:`, err);
              }
            }
          } catch (err) {
            console.error('[DM Action] Error processing monster_defeated:', err);
          }
          break;
        }

        case "item_add": {
          if (!action.playerName || !action.itemName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Normalize item name: trim and collapse whitespace
            const normalizedName = action.itemName!.trim().replace(/\s+/g, " ");

            // Efficient lookup by name (case-insensitive)
            let item = await storage.getItemByName(normalizedName);

            // If item doesn't exist, create it as a custom DM-created item
            if (!item) {
              // Parse custom properties if provided
              let customProps: any = {};
              if (action.customProperties) {
                try {
                  customProps = JSON.parse(action.customProperties);
                  console.log(`[DM Action] Creating custom item with properties:`, customProps);
                } catch (error) {
                  console.error(`[DM Action] Failed to parse custom properties for "${normalizedName}":`, error);
                }
              }

              // If no custom properties provided, use AI-powered item creation
              if (!action.customProperties || Object.keys(customProps).length === 0) {
                try {
                  console.log(`[Item Add] Item "${normalizedName}" not found, creating with AI...`);
                  item = await createItemFromReward(normalizedName, {
                    gameSystem: room?.gameSystem || 'dnd'
                  });
                  console.log(`[Item Add] Created AI-powered item: ${item.name} (${item.id})`);
                } catch (aiError) {
                  console.error(`[Item Add] Failed to create AI-powered item "${normalizedName}":`, aiError);
                  break;
                }
              } else {
                // Use manual item creation with custom properties
                // Create a slug from the normalized name, fallback to UUID if empty
                const slug = normalizedName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "");
                const itemId = slug ? `custom-${slug}` : `custom-${randomUUID().slice(0, 8)}`;

                // Check if this custom item already exists (in case of race condition or prior creation)
                item = await storage.getItem(itemId);

                if (!item) {
                  try {
                    // Build item properties with AI-generated stats or defaults
                    const itemProperties: any = {};
                    
                    // Weapon damage mapping for common weapon types
                    const weaponDamageMap: Record<string, string> = {
                      'dagger': '1d4',
                      'dart': '1d4',
                      'shortsword': '1d6',
                      'scimitar': '1d6',
                      'spear': '1d6',
                      'trident': '1d6',
                      'mace': '1d6',
                      'club': '1d6',
                      'staff': '1d6',
                      'quarterstaff': '1d6',
                      'handaxe': '1d6',
                      'light hammer': '1d6',
                      'longsword': '1d8',
                      'battleaxe': '1d8',
                      'warhammer': '1d8',
                      'greatsword': '2d6',
                      'greataxe': '2d6',
                      'maul': '2d6',
                      'pike': '2d6',
                    };
                    
                    // Determine default damage for weapons based on type
                    const getDefaultDamage = (category: string, type: string): string | null => {
                      if (category !== "weapon") return null;
                      const lowerType = type.toLowerCase();
                      
                      // Check for exact or partial match in weapon damage map
                      for (const [weaponType, damage] of Object.entries(weaponDamageMap)) {
                        if (lowerType.includes(weaponType)) {
                          return damage;
                        }
                      }
                      
                      return "1d6"; // Default weapon damage
                    };
                    
                    // Add damage properties if provided, or set defaults for weapons
                    if (customProps.damage) {
                      itemProperties.damage = {
                        damage_dice: customProps.damage,
                        damage_type: { name: customProps.damageType || "slashing" }
                      };
                    } else if (customProps.category === "weapon") {
                      const defaultDamage = getDefaultDamage(customProps.category, customProps.type || normalizedName);
                      if (defaultDamage) {
                        itemProperties.damage = {
                          damage_dice: defaultDamage,
                          damage_type: { name: customProps.damageType || "slashing" }
                        };
                      }
                    }
                    
                    // Add armor class if provided
                    if (customProps.armorClass !== undefined) {
                      itemProperties.armor_class = {
                        base: customProps.armorClass,
                        dex_bonus: customProps.dexBonus || false,
                        max_bonus: customProps.maxBonus
                      };
                    }
                    
                    // Add any other custom properties
                    Object.assign(itemProperties, customProps.properties || {});

                    // Set sensible defaults for weight and cost
                    const defaultWeight = customProps.weight ?? 0.1;
                    const defaultCost = customProps.cost ?? 1;

                    item = await storage.createItem({
                      id: itemId,
                      name: normalizedName,
                      category: customProps.category || "other",
                      type: customProps.type || "Custom Item",
                      description: customProps.description || `A custom item created by the Dungeon Master: ${normalizedName}`,
                      rarity: customProps.rarity || "uncommon",
                      cost: defaultCost,
                      weight: defaultWeight,
                      properties: itemProperties,
                      requiresAttunement: customProps.requiresAttunement || false,
                      gameSystem: room?.gameSystem || "dnd",
                    });
                    console.log(`[DM Action] Created custom item "${normalizedName}" in database with full stats`);
                  } catch (createError) {
                    console.error(`[DM Action] Failed to create custom item "${normalizedName}":`, createError);
                    break;
                  }
                }
              }
            }

            if (item) {
              // Check if item already exists in inventory to prevent duplicates
              const inventory = await storage.getSavedInventoryWithDetails(char.id);
              const existingInvItem = inventory.find((i: any) => i.itemId === item.id);
              
              let finalQuantity: number;
              if (existingInvItem) {
                // Item exists - increment quantity instead of adding duplicate
                finalQuantity = existingInvItem.quantity + (action.quantity || 1);
                await storage.updateSavedInventoryItem(existingInvItem.id, {
                  quantity: finalQuantity
                });
                console.log(`[DM Action] Incremented existing item "${item.name}" for ${action.playerName} (now ${finalQuantity}x)`);
              } else {
                // Item doesn't exist - add new
                finalQuantity = action.quantity || 1;
                await storage.addToSavedInventory({
                  characterId: char.id,
                  itemId: item.id,
                  quantity: finalQuantity,
                });
                console.log(`[DM Action] Added new item "${item.name}" to ${action.playerName} (${finalQuantity}x)`);
              }
              
              broadcastFn(roomCode, {
                type: "inventory_update",
                characterId: char.id,
                action: "add",
                itemName: item.name,
                quantity: finalQuantity,
              });
            }
          }
          break;
        }

        case "item_remove": {
          if (!action.playerName || !action.itemName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Get character's inventory and find the item
            const inventory = await storage.getSavedInventoryWithDetails(char.id);
            const invItem = inventory.find((i: any) => i.item.name.toLowerCase() === action.itemName!.toLowerCase());
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
                type: "inventory_update",
                characterId: char.id,
                action: "remove",
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

        case "npc_add": {
          if (!action.npcName) break;
          try {
            const props = action.customProperties ? JSON.parse(action.customProperties) : {};
            const npcRecord = await storage.createDynamicNpc({
              roomId: room.id,
              name: action.npcName,
              role: action.npcRole,
              description: props.description || props.desc || undefined,
              personality: props.personality || undefined,
              statsBlock: props.stats || props.statsBlock || undefined,
            });

            // Create a story event and broadcast
            const event = await storage.createStoryEvent({
              roomId: room.id,
              eventType: 'npc_created',
              title: `New NPC: ${npcRecord.name}`,
              summary: `${npcRecord.name} (${npcRecord.role || 'NPC'}) has been introduced by the DM.`,
              participants: [],
              relatedNpcId: npcRecord.id,
              importance: 2,
            });

            broadcastFn(roomCode, { type: 'story_event_created', event });
            console.log(`[DM Action] Created dynamic NPC '${npcRecord.name}' (id=${npcRecord.id}) in room ${roomCode}`);
          } catch (err) {
            console.error('[DM Action] Failed to create dynamic NPC:', err);
          }
          break;
        }

        case "location_add": {
          if (!action.locationName) break;
          try {
            const props = action.customProperties ? JSON.parse(action.customProperties) : {};
            const locRecord = await storage.createDynamicLocation({
              roomId: room.id,
              name: action.locationName,
              type: action.locationType || props.type || 'other',
              description: props.description || props.desc || undefined,
              boxedText: props.boxedText || props.boxed_text || undefined,
              features: props.features || undefined,
              connections: props.connections || undefined,
            });

            const event = await storage.createStoryEvent({
              roomId: room.id,
              eventType: 'location_created',
              title: `Location discovered: ${locRecord.name}`,
              summary: `${locRecord.name} has been discovered and added to the adventure.`,
              participants: [],
              relatedLocationId: locRecord.id,
              importance: 2,
            });

            broadcastFn(roomCode, { type: 'story_event_created', event });
            console.log(`[DM Action] Created dynamic location '${locRecord.name}' (id=${locRecord.id}) in room ${roomCode}`);
          } catch (err) {
            console.error('[DM Action] Failed to create dynamic location:', err);
          }
          break;
        }

        case "death_save": {
          if (!action.playerName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Broadcast death save status update
            broadcastFn(roomCode, {
              type: "death_save_update",
              characterId: char.id,
              playerName: action.playerName,
              successes: action.successes || 0,
              failures: action.failures || 0,
            });
            console.log(`[DM Action] Death saves for ${action.playerName}: ${action.successes}/${action.failures}`);
          }
          break;
        }

        case "stable": {
          if (!action.playerName) break;
          const char = findCharacter(action.playerName);
          if (char) {
            // Character stabilizes at 0 HP, alive but unconscious
            await storage.updateSavedCharacter(char.id, {
              currentHp: 0,
              isAlive: true,
            });
            broadcastFn(roomCode, {
              type: "character_update",
              characterId: char.id,
              updates: { currentHp: 0, isAlive: true, isStable: true },
            });
            console.log(`[DM Action] ${action.playerName} has stabilized at 0 HP`);
          }
          break;
        }

        case "quest_add": {
          if (!action.questTitle) break;
          try {
            // Find quest giver NPC if specified
            let dynamicQuestGiverId: string | null = null;
            if (action.questGiver) {
              const npcs = await storage.getDynamicNpcsByRoom(room.id);
              const questGiverNpc = npcs.find(
                (npc: any) => npc.name.toLowerCase() === action.questGiver!.toLowerCase()
              );
              if (questGiverNpc) {
                dynamicQuestGiverId = questGiverNpc.id;
                // Mark NPC as quest giver
                await storage.updateDynamicNpc(questGiverNpc.id, { isQuestGiver: true });
              }
            }

            // Create the quest
            const questRecord = await storage.createQuest({
              roomId: room.id,
              name: action.questTitle,
              description: action.questDescription || `Quest: ${action.questTitle}`,
              objectives: action.questObjectives || [],
              rewards: action.questRewards || undefined,
              isDynamic: true,
              status: (action.questStatus || 'active') as 'active' | 'in_progress' | 'completed' | 'failed',
              urgency: action.questUrgency || undefined,
              questGiver: action.questGiver || undefined,
              dynamicQuestGiverId,
            });

            // Create objective progress entries
            const objectives = action.questObjectives || [];
            for (let i = 0; i < objectives.length; i++) {
              await storage.createQuestObjectiveProgress({
                roomId: room.id,
                questId: questRecord.id,
                objectiveIndex: i,
                objectiveText: objectives[i],
                isCompleted: false,
              });
            }

            // Create story event
            const event = await storage.createStoryEvent({
              roomId: room.id,
              eventType: 'quest_start',
              title: `New Quest: ${questRecord.name}`,
              summary: questRecord.description,
              participants: [],
              relatedQuestId: questRecord.id,
              relatedNpcId: dynamicQuestGiverId || undefined,
              importance: action.questUrgency === 'critical' ? 5 : action.questUrgency === 'high' ? 4 : 3,
            });

            broadcastFn(roomCode, { type: 'story_event_created', event });
            broadcastFn(roomCode, { type: 'quest_created', quest: questRecord });
            console.log(`[DM Action] Created dynamic quest '${questRecord.name}' (id=${questRecord.id}) in room ${roomCode}`);
          } catch (err) {
            console.error('[DM Action] Failed to create quest:', err);
          }
          break;
        }

        case "quest_update": {
          if (!action.questId || !action.questStatus) break;
          try {
            // Try to find quest by ID or by title
            const quests = await storage.getQuestsByRoom(room.id);
            const quest = quests.find(
              (q: any) => q.id === action.questId || q.name.toLowerCase() === action.questId!.toLowerCase()
            );

            if (quest) {
              await storage.updateQuest(quest.id, {
                status: action.questStatus as 'active' | 'in_progress' | 'completed' | 'failed'
              });

              // If completed, update all objectives and distribute rewards
              if (action.questStatus === 'completed') {
                const objectives = await storage.getQuestObjectives(quest.id);
                for (const obj of objectives) {
                  if (!obj.isCompleted) {
                    await storage.updateQuestObjective(obj.id, {
                      isCompleted: true,
                      completedAt: new Date(),
                    });
                  }
                }

                // Distribute quest rewards to all characters in the room
                if (quest.rewards) {
                  const roomCharacters = await storage.getCharactersByRoomCode(roomCode);
                  console.log(`[Quest Reward] Distributing rewards for quest "${quest.name}" to ${roomCharacters.length} character(s)`);
                  
                  // Pre-create all unique items first to avoid race conditions
                  // This ensures items exist before distributing to multiple characters
                  if (quest.rewards.items && quest.rewards.items.length > 0) {
                    const uniqueItems = [...new Set(quest.rewards.items)];
                    for (const itemIdentifier of uniqueItems) {
                      try {
                            const idStr = String(itemIdentifier);
                            let item = await storage.getItem(idStr);
                            if (!item) {
                              item = await storage.getItemByName(idStr);
                            }
                        if (!item) {
                          console.log(`[Quest Reward] Pre-creating item "${itemIdentifier}"...`);
                          item = await createItemFromReward(idStr, {
                            questDescription: quest.description,
                            gameSystem: room.gameSystem || 'dnd'
                          });
                          console.log(`[Quest Reward] Pre-created item: ${item.name} (${item.id})`);
                        }
                      } catch (itemErr) {
                        console.error(`[Quest Reward] Failed to pre-create item "${itemIdentifier}":`, itemErr);
                      }
                    }
                  }
                  
                  // Process characters in parallel using Promise.allSettled for better performance
                  // Each character's rewards are independent, so failures won't affect others
                  const rewardPromises = roomCharacters.map(async (char: any) => {
                    try {
                      // Award gold
                      if (quest.rewards.gold && quest.rewards.gold > 0) {
                        const currentCurrency = char.currency || { cp: 0, sp: 0, gp: 0 };
                        await storage.updateSavedCharacter(char.id, {
                          currency: {
                            ...currentCurrency,
                            gp: currentCurrency.gp + quest.rewards.gold
                          }
                        });
                        console.log(`[Quest Reward] Gave ${quest.rewards.gold} gp to ${char.characterName}`);
                        // Notify clients about character currency update
                        broadcastFn(roomCode, {
                          type: 'character_update',
                          characterId: char.id,
                          updates: { currency: { ...currentCurrency, gp: currentCurrency.gp + quest.rewards.gold } }
                        });
                      }

                      // Award XP (use centralized helper to handle level-ups and broadcasts)
                                if (quest.rewards.xp && quest.rewards.xp > 0) {
                                  try {
                                    const awardResult = await awardXpToCharacter(char.id, quest.rewards.xp, roomCode);
                                    console.log(`[Quest Reward] Gave ${quest.rewards.xp} xp to ${char.characterName} (leveledUp=${awardResult.leveledUp})`);
                                    const newLevelQ = awardResult?.character?.level;
                                    broadcastFn(roomCode, {
                                      type: 'character_update',
                                      characterId: char.id,
                                      updates: { xp: (char.xp || 0) + quest.rewards.xp, ...(newLevelQ ? { level: newLevelQ } : {}) }
                                    });
                                    if (awardResult?.leveledUp) {
                                      broadcastFn(roomCode, {
                                        type: 'level_up',
                                        characterId: char.id,
                                        previousLevel: awardResult.previousLevel,
                                        newLevel: newLevelQ,
                                        levelsGained: awardResult.levelsGained,
                                        totalHpGain: awardResult.totalHpGain,
                                        spellSlots: awardResult?.character?.spellSlots,
                                        newLevelChoices: awardResult?.character?.levelChoices,
                                      });
                                    }
                                  } catch (xpErr) {
                                    console.error(`[Quest Reward] Failed to award XP to ${char.characterName}:`, xpErr);
                                  }
                                }

                      // Award items (they should already exist from pre-creation)
                      if (quest.rewards.items && quest.rewards.items.length > 0) {
                        for (const itemIdentifier of quest.rewards.items) {
                          try {
                            // Items should exist from pre-creation, but double-check
                              const idStr = String(itemIdentifier);
                              let item = await storage.getItem(idStr);
                              if (!item) {
                                item = await storage.getItemByName(idStr);
                              }
                            
                            if (!item) {
                              console.error(`[Quest Reward] Item "${itemIdentifier}" missing after pre-creation`);
                              continue;
                            }

                            // Add to character inventory
                            await storage.addToSavedInventory({
                              characterId: char.id,
                              itemId: item.id,
                              quantity: 1
                            });
                            console.log(`[Quest Reward] Gave ${item.name} to ${char.characterName}`);
                            // Notify clients about inventory change
                            broadcastFn(roomCode, {
                              type: 'inventory_update',
                              characterId: char.id,
                              action: 'add',
                              itemId: item.id,
                              itemName: item.name,
                              quantity: 1
                            });
                          } catch (itemErr) {
                            console.error(`[Quest Reward] Failed to award item "${itemIdentifier}" to ${char.characterName}:`, itemErr);
                            // Continue with other items
                          }
                        }
                      }
                    } catch (charErr) {
                      console.error(`[Quest Reward] Failed to distribute rewards to ${char.characterName}:`, charErr);
                      throw charErr; // Re-throw so Promise.allSettled captures it
                    }
                  });

                  // Wait for all reward distributions to complete
                  const results = await Promise.allSettled(rewardPromises);
                  
                  // Count successes and failures in a single pass
                  const { successful, failed } = results.reduce(
                    (acc, r) => {
                      if (r.status === 'fulfilled') acc.successful++;
                      else acc.failed++;
                      return acc;
                    },
                    { successful: 0, failed: 0 }
                  );
                  
                  console.log(`[Quest Complete] Distributed rewards: ${successful} successful, ${failed} failed`);
                }

                // Create completion event
                const event = await storage.createStoryEvent({
                  roomId: room.id,
                  eventType: 'quest_complete',
                  title: `Quest Completed: ${quest.name}`,
                  summary: `The quest "${quest.name}" has been completed!`,
                  participants: characters.map((c: any) => c.characterName),
                  relatedQuestId: quest.id,
                  importance: 4,
                });

                broadcastFn(roomCode, { type: 'story_event_created', event });
              }

              broadcastFn(roomCode, { type: 'quest_updated', questId: quest.id, status: action.questStatus });
              console.log(`[DM Action] Updated quest '${quest.name}' status to ${action.questStatus}`);
            }
          } catch (err) {
            console.error('[DM Action] Failed to update quest:', err);
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
async function grantStartingItems(savedCharacterId: string, gameSystem: string, characterClass: string | null | undefined): Promise<void> {
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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
      getHeader: () => undefined,
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
          const roomId = urlParams.get("roomId");
          const roomCode = urlParams.get("room") || urlParams.get("roomCode");

          // Support both roomId and roomCode parameters
          let room;
          if (roomId) {
            room = await storage.getRoom(roomId);
          } else if (roomCode) {
            room = await storage.getRoomByCode(roomCode);
          }

          if (room) {
            const players = await storage.getPlayersByRoom(room.id);
            const isRoomMember = players.some((p: any) => p.userId === userId);
            if (!isRoomMember) {
              console.log("[WebSocket] User not a member of room:", roomId || roomCode, userId);
              socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
              socket.destroy();
              return;
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

  // In-memory suggestion store for NL->Action confirm flow
  const suggestionStore: Map<string, { roomCode: string; userId: string | undefined; playerName: string; action: any; originalText: string; createdAt: number }> = new Map()
  const SUGGESTION_THRESHOLD = 0.6
  const AUTO_ACCEPT_THRESHOLD = 0.8

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    const urlParams = new URLSearchParams(req.url?.split("?")[1]);
    const roomId = urlParams.get("roomId");
    let roomCode = urlParams.get("room") || urlParams.get("roomCode");

    // If roomId is provided, look up the room code
    if (roomId && !roomCode) {
      storage.getRoom(roomId).then((room: any) => {
        if (room && room.code) {
          const code = room.code;
          roomCode = code;
          initializeConnection(code);
        } else {
          ws.close(1008, "Room not found");
        }
      }).catch((error: any) => {
        console.error("[WebSocket] Error fetching room:", error);
        ws.close(1008, "Error fetching room");
      });
      return;
    }

    if (!roomCode) {
      ws.close(1008, "Room code or ID required");
      return;
    }

    initializeConnection(roomCode);

    function initializeConnection(code: string) {
      if (!roomConnections.has(code)) {
        roomConnections.set(code, new Set());
      }
      roomConnections.get(code)!.add(ws);

      const playerName = ws.playerName || "Anonymous";

      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());

          // If chat, consider generating an action suggestion for the originator
          if (message.type === 'chat' && typeof message.content === 'string') {
            try {
              const { parseNaturalLanguageToAction } = await import('./utils/nl-parser')
              const parsed = parseNaturalLanguageToAction(message.content)
              if (parsed && parsed.confidence >= SUGGESTION_THRESHOLD && parsed.confidence < AUTO_ACCEPT_THRESHOLD) {
                const suggestionId = randomUUID()
                suggestionStore.set(suggestionId, { roomCode: code, userId: ws.userId, playerName, action: parsed, originalText: message.content, createdAt: Date.now() })
                // Send suggestion only to originating socket
                ws.send(JSON.stringify({ type: 'action_suggestion', suggestionId, actions: [parsed], confidence: parsed.confidence, originalText: message.content }))
              }
            } catch (err) {
              console.error('[Suggestion] NL parse error:', err)
            }
          }

          if (message.type === "chat" || message.type === "action") {
            // Queue the message for batch processing
            await queueMessage(code, {
              type: message.type,
              playerName: playerName,
              content: message.content,
              timestamp: Date.now(),
            });
          } else if (message.type === "get_combat_state") {
            // Send current combat state
            const combatState = roomCombatState.get(code);
            if (combatState) {
              ws.send(JSON.stringify({ type: "combat_update", combat: combatState }));
            }
          }
        } catch (error) {
          console.error("[WebSocket] Message parsing error:", error);
        }
      });

      ws.on("close", () => {
        roomConnections.get(code)?.delete(ws);
        if (roomConnections.get(code)?.size === 0) {
          roomConnections.delete(code);
          messageQueue.delete(code);
          roomCombatState.delete(code);
          roomDroppedItems.delete(code);
        }
      });
    }
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

    batchTimers.set(roomCode, setTimeout(() => processBatch(roomCode), BATCH_DELAY_MS));
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
      characters.map(async (char: any) => {
        // Try to find player name from players list or user record
        let playerName = "Unknown Player";
        const player = players.find((p: any) => p.userId === char.userId);
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
        const inventoryItems = inventory.map((i: any) => {
          const name = i.item?.name || "unknown item";
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
      // Fetch adventure context if room has an adventure
      let adventureContext;
      if (room.adventureId) {
        adventureContext = await fetchAdventureContext(room.id, room.adventureId);
      }

      // Fetch story context (quest progress, story events, session summary)
      const storyContext = await fetchStoryContext(room.id, room.adventureId || undefined);

      // Generate batched DM response with adventure context
      const dmResponse = await generateBatchedDMResponse(
        openai,
        batchedMessages, 
        room, 
        undefined, 
        characterInfos, 
        undefined,
        adventureContext,
        (db as any).$client,
        storyContext
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
        const player = players.find((p: any) => p.name === msg.playerName);
        if (player) {
          const character = characters.find((c: any) => c.userId === player.userId);
          if (character) {
            const inventory = await storage.getSavedInventoryWithDetails(character.id);
            const inventoryNames = inventory.map((i: any) => i.item?.name || "");
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

      // Detect and log story events from DM response
      try {
        const { detectAndLogStoryEvents } = await import('./utils/story-detection');
        const result = await detectAndLogStoryEvents(dmResponse, room.id, adventureContext, room.gameSystem);
        if (result.eventIds.length > 0) {
          console.log(`[Story Detection] Logged ${result.eventIds.length} story events for room ${roomCode}`);
          // Invalidate story cache since new events were created
          const { storyCache } = await import('./cache/story-cache');
          storyCache.invalidate(room.id);
        }
        if (result.questId) {
          console.log(`[Quest Detection] Created dynamic quest (ID: ${result.questId}) for room ${roomCode}`);
          // Invalidate story cache to include new quest
          const { storyCache } = await import('./cache/story-cache');
          storyCache.invalidate(room.id);
        }
      } catch (error) {
        console.error('[Story Detection] Error detecting story events:', error);
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

  // Health check endpoints - return JSON to prevent HTML responses
  app.get("/health", (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

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
          message: "Profile picture uploads are not available. Object storage needs to be set up.",
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
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(imageUrl, {
        owner: userId,
        visibility: "public",
      });

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
      // Enrich with parsed hit dice for the UI
      const enriched = characters.map((c: any) => ({
        ...c,
        hitDiceParsed: parseHitDiceString(c.hitDice || null, c.level, c.class),
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching saved characters:", error);
      res.status(500).json({ error: "Failed to fetch saved characters" });
    }
  });

  app.post("/api/saved-characters", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const parsedInput = insertSavedCharacterSchema.parse({ ...req.body, userId });

      // Ensure hitDice is set correctly on creation when a class is provided
      const parsed = { ...parsedInput } as any;
      try {
      if (parsed.gameSystem === 'dnd') {
        // Apply race ability score bonuses server-side if stats were provided
        if (parsed.race && parsed.stats) {
          try {
            parsed.stats = applyDndRaceBonuses(parsed.stats, parsed.race);
          } catch (err) {
            console.error('Failed to apply race bonuses on character creation:', err);
          }
        }

        // Ensure maxHp is consistent with class/level and constitution
        try {
          if ((!parsed.maxHp || parsed.maxHp === 0) && parsed.class) {
            const conMod = parsed.stats?.constitution ? getAbilityModifier(parsed.stats.constitution) : 0;
            parsed.maxHp = calculateDndMaxHp(parsed.class, parsed.level || 1, conMod);
            parsed.currentHp = parsed.maxHp;
          }
        } catch (err) {
          console.error('Failed to calculate initial maxHp on character creation:', err);
        }

        if ((!parsed.hitDice || parsed.hitDice === '') && parsed.class && classDefinitions[parsed.class as DndClass]) {
          const classDef = classDefinitions[parsed.class as DndClass];
          const lvl = parsed.level || 1;
          parsed.hitDice = `${lvl}d${classDef.hitDie}`;
        }
      }
    } catch (err) {
      console.error('Failed to set initial hitDice and stats on character creation:', err);
    }

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
      const enriched = { ...character, hitDiceParsed: parseHitDiceString(character.hitDice || null, character.level, character.class) };
      res.json(enriched);
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
            const conMod = existing.stats?.constitution ? getAbilityModifier(existing.stats.constitution as number) : 0;

            let hpGain = 0;
            for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
              hpGain += calculateLevelUpHP(existing.class as DndClass, conMod);
            }

            updates.maxHp = (existing.maxHp || 10) + hpGain;
            updates.currentHp = Math.min((updates.currentHp ?? existing.currentHp) + hpGain, updates.maxHp);

            // Update hit dice to reflect new total
            try {
              const classDef = classDefinitions[existing.class as DndClass];
              if (classDef && classDef.hitDie) {
                updates.hitDice = `${newLevel}d${classDef.hitDie}`;
              }
            } catch (err) {
              console.error('Failed to set hitDice on level up:', err);
            }
          }

          // Spellcasters: update spell slots
          if (existing.class && isSpellcaster(existing.class as string)) {
            try {
              const newMaxSlots = getMaxSpellSlots(existing.class as string, newLevel);
              updates.spellSlots = { max: newMaxSlots, current: newMaxSlots };
            } catch (err) {
              console.error("Failed to compute spell slots on level up:", err);
            }
          }

          // Populate level choices for ASI, class features, spells, etc.
          try {
            const existingChoices = (existing.levelChoices as Record<string, unknown>[]) || [];
            const newChoices: Record<string, unknown>[] = [];
            const ASI_LEVELS = [4, 8, 12, 16, 19];
            const FIGHTER_EXTRA_ASI = [6, 14];

            for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
              if (ASI_LEVELS.includes(lvl)) newChoices.push({ level: lvl, feature: 'ASI', applied: false });
              if ((existing.class === 'Fighter' || existing.class === 'fighter') && FIGHTER_EXTRA_ASI.includes(lvl)) {
                newChoices.push({ level: lvl, feature: 'Fighter ASI', applied: false });
              }
            }

            const classFeatures = classSkillFeatures[existing.class as DndClass] || [];
            for (const feat of classFeatures) {
              if (feat.level > oldLevel && feat.level <= newLevel) {
                newChoices.push({ level: feat.level, feature: feat.name, applied: false, type: 'class_feature' });
              }
            }

            // Subclass-level skill features
            const subclassFeatures = subclassSkillFeatures.filter(sf => sf.parentClass === (existing.class as DndClass));
            for (const sf of subclassFeatures) {
              if (sf.level > oldLevel && sf.level <= newLevel) {
                newChoices.push({ level: sf.level, feature: sf.name, applied: false, type: 'subclass_feature' });
              }
            }

            // Spell-related choices
            const normalizedClass = (existing.class as string).toLowerCase();
            for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
              try {
                const prevCantrips = getMaxCantripsKnown(normalizedClass, lvl - 1);
                const newCantrips = getMaxCantripsKnown(normalizedClass, lvl);
                if (newCantrips > prevCantrips) {
                  newChoices.push({ level: lvl, feature: 'Cantrips', count: newCantrips - prevCantrips, applied: false });
                }
              } catch (err) {
                // ignore
              }

              try {
                const prevSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl - 1) ?? 0;
                const newSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl) ?? 0;
                if (newSpellsKnown > prevSpellsKnown) {
                  newChoices.push({ level: lvl, feature: 'Spells Known', count: newSpellsKnown - prevSpellsKnown, applied: false });
                }
              } catch (err) {
                // ignore
              }
            }

            if (newChoices.length > 0) updates.levelChoices = [...existingChoices, ...newChoices];
          } catch (err) {
            console.error('Failed to populate levelChoices on level up:', err);
          }
        }
      }

      // If a direct level bump was provided (not via XP), mirror level-up behavior
      if (!leveledUp && updates.level !== undefined && updates.level > oldLevel) {
        const directNewLevel = updates.level;
        try {
          if (existing.class && classDefinitions[existing.class as DndClass]) {
            const conMod = existing.stats?.constitution ? getAbilityModifier(existing.stats.constitution as number) : 0;
            let hpGain = 0;
            for (let lvl = oldLevel + 1; lvl <= directNewLevel; lvl++) {
              hpGain += calculateLevelUpHP(existing.class as DndClass, conMod);
            }
            updates.maxHp = (existing.maxHp || 10) + hpGain;
            updates.currentHp = Math.min((updates.currentHp ?? existing.currentHp) + hpGain, updates.maxHp);

            // Update hit dice
            const classDef = classDefinitions[existing.class as DndClass];
            if (classDef && classDef.hitDie) {
              updates.hitDice = `${directNewLevel}d${classDef.hitDie}`;
            }
          }

          if (existing.class && isSpellcaster(existing.class as string)) {
            try {
              const newMaxSlots = getMaxSpellSlots(existing.class as string, directNewLevel);
              updates.spellSlots = { max: newMaxSlots, current: newMaxSlots };
            } catch (err) {
              console.error("Failed to compute spell slots on direct level change:", err);
            }
          }

          // Populate level choice entries similarly to XP-based level up
          const existingChoices = (existing.levelChoices as Record<string, unknown>[]) || [];
          const newChoices: Record<string, unknown>[] = [];
          const ASI_LEVELS = [4, 8, 12, 16, 19];
          const FIGHTER_EXTRA_ASI = [6, 14];

          for (let lvl = oldLevel + 1; lvl <= directNewLevel; lvl++) {
            if (ASI_LEVELS.includes(lvl)) newChoices.push({ level: lvl, feature: 'ASI', applied: false });
            if ((existing.class === 'Fighter' || existing.class === 'fighter') && FIGHTER_EXTRA_ASI.includes(lvl)) {
              newChoices.push({ level: lvl, feature: 'Fighter ASI', applied: false });
            }
          }

          const classFeatures = classSkillFeatures[existing.class as DndClass] || [];
          for (const feat of classFeatures) {
            if (feat.level > oldLevel && feat.level <= directNewLevel) {
              newChoices.push({ level: feat.level, feature: feat.name, applied: false, type: 'class_feature' });
            }
          }

          // Subclass-level features
          const subclassFeatures = subclassSkillFeatures.filter(sf => sf.parentClass === (existing.class as DndClass));
          for (const sf of subclassFeatures) {
            if (sf.level > oldLevel && sf.level <= directNewLevel) {
              newChoices.push({ level: sf.level, feature: sf.name, applied: false, type: 'subclass_feature' });
            }
          }

          const normalizedClass = (existing.class as string).toLowerCase();
          for (let lvl = oldLevel + 1; lvl <= directNewLevel; lvl++) {
            try {
              const prevCantrips = getMaxCantripsKnown(normalizedClass, lvl - 1);
              const newCantrips = getMaxCantripsKnown(normalizedClass, lvl);
              if (newCantrips > prevCantrips) newChoices.push({ level: lvl, feature: 'Cantrips', count: newCantrips - prevCantrips, applied: false });
            } catch (err) {}
            try {
              const prevSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl - 1) ?? 0;
              const newSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl) ?? 0;
              if (newSpellsKnown > prevSpellsKnown) newChoices.push({ level: lvl, feature: 'Spells Known', count: newSpellsKnown - prevSpellsKnown, applied: false });
            } catch (err) {}
          }

          if (newChoices.length > 0) updates.levelChoices = [...existingChoices, ...newChoices];
        } catch (err) {
          console.error('Failed to apply direct level change updates:', err);
        }
      }

      const character = await storage.updateSavedCharacter(id, updates);
      res.json({
        ...character,
        leveledUp,
        previousLevel: leveledUp ? oldLevel : undefined,
        newLevel: leveledUp ? newLevel : undefined,
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

      // Delegate to helper to award XP (handles leveling, HP gain and broadcasts)
      const awardResult = await awardXpToCharacter(id, xpAmount, undefined);
      res.json({
        ...awardResult.character,
        xpAwarded: awardResult.xpAwarded,
        leveledUp: awardResult.leveledUp,
        previousLevel: awardResult.leveledUp ? awardResult.previousLevel : undefined,
        levelsGained: awardResult.leveledUp ? awardResult.levelsGained : 0,
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

      const { password, adventureId, useAdventureMode, ...roomData } = req.body;
      
      // Hash password if provided
      let passwordHash: string | undefined;
      if (password && password.trim().length > 0) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      const parsed = insertRoomSchema.parse({ 
        ...roomData, 
        hostName: playerName,
        adventureId: useAdventureMode && adventureId ? adventureId : null,
        useAdventureMode: useAdventureMode || false,
      });
      const room = await storage.createRoom({ ...parsed, passwordHash });

      // If using adventure mode, create progress tracking record
      if (useAdventureMode && adventureId) {
        const { 
          roomAdventureProgress,
          adventureChapters,
          adventures 
        } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        // Get first chapter for this adventure
        const [firstChapter] = await db
          .select()
          .from(adventureChapters)
          .where(eq(adventureChapters.adventureId, adventureId))
          .orderBy(adventureChapters.chapterNumber)
          .limit(1);

        // Create progress tracking
        await db.insert(roomAdventureProgress).values({
          roomId: room.id,
          adventureId: adventureId,
          currentChapterId: firstChapter?.id || null,
          currentLocationId: null,
          completedChapterIds: [],
          discoveredLocationIds: [],
          completedQuestIds: [],
          activeQuestIds: [],
          completedEncounterIds: [],
          metNpcIds: [],
        });
      }

      // Create host player
      const hostPlayer = await storage.createPlayer({
        roomId: room.id,
        userId: userId,
        name: playerName,
        isHost: true,
      });

      // Return room without passwordHash, with isPrivate boolean instead
      const { passwordHash: _, ...roomWithoutHash } = room;
      res.json({ ...roomWithoutHash, isPrivate: !!room.passwordHash, hostPlayer });
    } catch (error) {
      console.error("Error creating room:", error);
      const errorMessage = error instanceof Error ? error.message : "Invalid room data";
      res.status(400).json({ error: errorMessage });
    }
  });

  // Join room by ID (new endpoint with password support)
  app.post("/api/rooms/:id/join", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { savedCharacterId, password } = req.body;

      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";

      // Get room by ID
      const room = await storage.getRoom(id);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      // Check password if room is private
      if (room.passwordHash) {
        if (!password) {
          return res.status(401).json({ error: "Password required", requiresPassword: true });
        }
        const isPasswordValid = await bcrypt.compare(password, room.passwordHash);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Incorrect password" });
        }
      }

      const existingPlayers = await storage.getPlayersByRoom(room.id);
      if (existingPlayers.length >= room.maxPlayers) {
        return res.status(400).json({ error: "Room is full" });
      }

      const existingPlayer = existingPlayers.find((p: any) => p.userId === userId);
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
        if (savedCharacter.currentRoomCode && savedCharacter.currentRoomCode !== room.code) {
          return res.status(400).json({ error: "Character is already in another room" });
        }

        // Join the character to the room
        roomCharacter = (await storage.joinRoom(savedCharacterId, room.code)) || null;
      }

      await storage.updateRoomActivity(room.id);

      broadcastToRoom(room.code, {
        type: "system",
        content: `${playerName} has joined the adventure!`,
      });

      // Return room without passwordHash
      const { passwordHash: _, ...roomWithoutHash } = room;
      res.json({ room: { ...roomWithoutHash, isPrivate: !!room.passwordHash }, player, roomCharacter });
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({ error: "Failed to join room" });
    }
  });

  // Join room by code (legacy endpoint for backward compatibility)
  app.post("/api/rooms/:code/join", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId, password } = req.body;

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

      // Check password if room is private
      if (room.passwordHash) {
        if (!password) {
          return res.status(401).json({ error: "Password required", requiresPassword: true });
        }
        const isPasswordValid = await bcrypt.compare(password, room.passwordHash);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Incorrect password" });
        }
      }

      const existingPlayers = await storage.getPlayersByRoom(room.id);
      if (existingPlayers.length >= room.maxPlayers) {
        return res.status(400).json({ error: "Room is full" });
      }

      const existingPlayer = existingPlayers.find((p: any) => p.userId === userId);
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
        roomCharacter = (await storage.joinRoom(savedCharacterId, code)) || null;
      }

      await storage.updateRoomActivity(room.id);

      broadcastToRoom(code, {
        type: "system",
        content: `${playerName} has joined the adventure!`,
      });

      // Return room without passwordHash
      const { passwordHash: _, ...roomWithoutHash } = room;
      res.json({ room: { ...roomWithoutHash, isPrivate: !!room.passwordHash }, player, roomCharacter });
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
        characters.map(async (char: any) => {
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

      // Return room data merged with players and characters, exclude passwordHash and add isPrivate
      const { passwordHash, ...roomWithoutHash } = room;
      res.json({ ...roomWithoutHash, isPrivate: !!passwordHash, players, characters });
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
      const player = players.find((p: any) => p.userId === userId);

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
      const userPlayer = players.find((p: any) => p.userId === userId);

      if (!userPlayer || !userPlayer.isHost) {
        return res.status(403).json({ error: "Only the host can end the room" });
      }

      // Clear all characters from the room (set currentRoomCode to null)
      await storage.leaveAllCharactersFromRoom(code);

      await storage.updateRoom(room.id, { isActive: false });

      // Clean up story cache for this room
      try {
        const { storyCache } = await import("./cache/story-cache");
        storyCache.invalidate(room.id);
        console.log(`[Cache Cleanup] Invalidated story cache for room ${room.id}`);
      } catch (error) {
        console.warn(`Failed to clean up story cache for room ${room.id}:`, error);
      }

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
      
      // Map rooms to include isPrivate and exclude passwordHash
      const roomsWithPrivacy = rooms.map((room: any) => {
        const { passwordHash, ...roomWithoutHash } = room;
        return {
          ...roomWithoutHash,
          isPrivate: !!passwordHash,
        };
      });
      
      res.json(roomsWithPrivacy);
    } catch (error) {
      res.status(500).json({ error: "Failed to get public rooms" });
    }
  });

  // Get all rooms where the authenticated user is a participant (host or player) with metadata
  app.get("/api/my-rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Get all rooms where user is a player with their role
      const userPlayers = await db.select({
        roomId: players.roomId,
        isHost: players.isHost,
      })
        .from(players)
        .where(eq(players.userId, userId));

      const roomIds = userPlayers.map(p => p.roomId);

      if (roomIds.length === 0) {
        return res.json([]);
      }

      // Create a map of roomId -> isHost for quick lookup
      const hostMap = userPlayers.reduce((map, p) => {
        map.set(p.roomId, p.isHost);
        return map;
      }, new Map<string, boolean>());

      // Get room details for all rooms user is in
      const userRooms = await db.select({
        room: rooms,
        playerCount: sql<number>`count(${players.id})`,
      })
        .from(rooms)
        .leftJoin(players, eq(rooms.id, players.roomId))
        .where(inArray(rooms.id, roomIds))
        .groupBy(rooms.id)
        .orderBy(desc(rooms.lastActivityAt));

      const roomsWithMeta = userRooms.map((r) => {
        const isHost = hostMap.get(r.room.id);
        
        // Log warning if host status is missing (data integrity issue)
        if (isHost === undefined) {
          console.warn(`Host status missing for room ${r.room.id} (code: ${r.room.code})`);
        }
        
        // Exclude passwordHash and add isPrivate
        const { passwordHash, ...roomWithoutHash } = r.room;
        
        return {
          ...roomWithoutHash,
          playerCount: r.playerCount,
          isHost: isHost ?? false,
          isPrivate: !!passwordHash,
        };
      });

      res.json(roomsWithMeta);
    } catch (error) {
      console.error("Error getting user's rooms:", error);
      res.status(500).json({ error: "Failed to get user's rooms" });
    }
  });

  // Delete an inactive room and all associated data (host only)
  app.delete("/api/rooms/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const room = await storage.getRoom(id);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Check if room is active
      if (room.isActive) {
        return res.status(400).json({ error: "Cannot delete active room. End the room first." });
      }

      // Verify user is the host
      const allPlayers = await storage.getPlayersByRoom(room.id);
      const userPlayer = allPlayers.find((p: any) => p.userId === userId);

      if (!userPlayer || !userPlayer.isHost) {
        return res.status(403).json({ error: "Only the host can delete the room" });
      }

      // Delete the room and all associated data
      await storage.deleteRoomWithAllData(room.id);
      
      // Clean up story cache for this room
      try {
        const { storyCache } = await import("./cache/story-cache");
        storyCache.invalidate(room.id);
        console.log(`[Cache Cleanup] Invalidated story cache for room ${room.id}`);
      } catch (error) {
        console.warn(`Failed to clean up story cache for room ${room.id}:`, error);
      }
      
      // Clean up monster cache for this room
      try {
        const { monsterCacheManager } = await import("./cache/monster-cache");
        monsterCacheManager.removeCache(room.id);
        console.log(`[Cache Cleanup] Removed monster cache for room ${room.id}`);
      } catch (error) {
        console.warn(`Failed to clean up monster cache for room ${room.id}:`, error);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ error: "Failed to delete room" });
    }
  });

  // NOTE: legacy /api/characters endpoints removed in favor of unified saved-characters

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
        type: msgType as any,
        diceResult: diceResult ?? undefined,
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
      const characters = await storage.getCharactersByRoomCode(code);

      // Include dynamic NPCs (monsters) present in the room
      let monsters: any[] = [];
      try {
        monsters = await storage.getDynamicNpcsByRoom(room.id) || [];
      } catch (err) {
        console.warn(`[Combat Start] Failed to load dynamic NPCs for room ${room.id}:`, err);
      }

      // Allow the request body to supply additional monsters (optional)
      if (req.body?.monsters && Array.isArray(req.body.monsters)) {
        monsters = monsters.concat(req.body.monsters);
      }

      const initiatives = rollInitiativesForCombat(characters, players, monsters);
      const combatState = createCombatState(code, initiatives);

      // Store the rich combat state separately for the new engine
      roomFullCombatState.set(code, combatState as FullCombatState);

      // Convert to legacy InitiativeEntry shape for roomCombatState (backwards-compat)
      const initiativesForState = initiatives.map((e) => ({
        playerId: e.metadata?.userId ?? e.id,
        playerName: e.metadata?.playerName ?? (e.controller === 'player' ? e.name : 'DM'),
        characterName: e.name,
        roll: e.roll,
        modifier: e.modifier,
        total: e.total,
      }));

      roomCombatState.set(code, {
        isActive: combatState.isActive,
        currentTurnIndex: combatState.currentTurnIndex,
        initiatives: initiativesForState,
      });

      // Broadcast initiative order
      broadcastToRoom(code, {
        type: "system",
        content: "Combat begins! Initiative order:",
        initiatives: initiatives.map((entry) => `${entry.name} (${entry.total})`),
      });

      // Generate starting combat scene if needed
      const startingScene = await generateStartingScene(openai, room.gameSystem, room.name);
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
      if (state.currentTurnIndex >= state.initiatives.length / 2) {
        const room = await storage.getRoomByCode(code);
        if (room) {
          const enemyActions = await generateCombatDMTurn(openai, room, undefined, (db as any).$client);
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

  // Structured combat actions (player or monster actions)
  // Helper used by combat action routes and suggestion confirm
  async function executeCombatAction(code: string, action: any) {
    const state = roomFullCombatState.get(code);
    if (!state || !state.isActive) throw new Error('No active combat');

    const { actorId, type } = action;
    const currentActor = state.initiatives[state.currentTurnIndex];
    if (!currentActor) throw new Error('Invalid combat state');

    // Validate it's actor's turn
    if (currentActor.id !== actorId) {
      const err: any = new Error("Not actor's turn");
      err.code = 403; throw err;
    }

    if (type === 'attack') {
      const { targetId, attackBonus = 0, damageExpression = null } = action;
      const target = state.initiatives.find((i: any) => i.id === targetId);
      if (!target) { const err:any = new Error('Target not found'); err.code = 404; throw err }

      const result = resolveAttack(null, attackBonus, target.ac ?? 10, damageExpression);

      if (result.hit && result.damageTotal) {
        target.currentHp = (target.currentHp ?? target.maxHp ?? 0) - result.damageTotal;
      }

      // Update threat for the actor (attacker gains threat)
      updateThreat(state, actorId, Math.max(1, result.damageTotal || (result.hit ? 5 : 1)));

      // Record action
      state.actionHistory.push({ actorId, type: 'attack', targetId, result, timestamp: Date.now() });

      // Broadcast structured result
      broadcastToRoom(code, {
        type: 'combat_result',
        actorId,
        targetId,
        attackRoll: result.d20,
        attackTotal: result.attackTotal,
        hit: result.hit,
        isCritical: result.isCritical,
        damageRolls: result.damageRolls,
        damageTotal: result.damageTotal,
        targetHp: target.currentHp,
      });

      // If target dies, broadcast and take cares
      if ((target.currentHp ?? 0) <= 0) {
        broadcastToRoom(code, { type: 'combat_event', event: 'defeated', targetId, name: target.name });
      }

      // Advance turn
      const prevActorId = currentActor.id;
      advanceTurn(state);

      // Process held triggers for prev actor
      const inserted = processTrigger(state, prevActorId);
      if (inserted.length > 0) {
        broadcastToRoom(code, { type: 'combat_event', event: 'held_triggered', inserted });
      }

      // Persist back
      roomFullCombatState.set(code, state);
      // Keep legacy short state in sync
      const currentIdx = state.currentTurnIndex;
      const legacyInitiatives = state.initiatives.map((e: any) => ({ playerId: e.id, playerName: e.name, characterName: e.name, roll: e.roll, modifier: e.modifier, total: e.total }));
      roomCombatState.set(code, { isActive: state.isActive, currentTurnIndex: currentIdx, initiatives: legacyInitiatives });

      return { success: true, result };
    }

    if (type === 'pass') {
      // Record pass
      state.actionHistory.push({ actorId, type: 'pass', timestamp: Date.now() });
      broadcastToRoom(code, { type: 'combat_event', event: 'pass', actorId });

      const prevActorId = currentActor.id;
      advanceTurn(state);
      const inserted = processTrigger(state, prevActorId);
      if (inserted.length > 0) {
        broadcastToRoom(code, { type: 'combat_event', event: 'held_triggered', inserted });
      }

      roomFullCombatState.set(code, state);
      const currentIdx = state.currentTurnIndex;
      const legacyInitiatives2 = state.initiatives.map((e: any) => ({ playerId: e.id, playerName: e.name, characterName: e.name, roll: e.roll, modifier: e.modifier, total: e.total }));
      roomCombatState.set(code, { isActive: state.isActive, currentTurnIndex: currentIdx, initiatives: legacyInitiatives2 });

      return { success: true };
    }

    if (type === 'move') {
      const moveResult = applyMoveAction(state, action);
      // Broadcast move
      broadcastToRoom(code, { type: 'combat_event', event: 'move', actorId, to: moveResult });

      // Advance turn
      const prevActorId = currentActor.id;
      advanceTurn(state);
      const inserted = processTrigger(state, prevActorId);
      if (inserted.length > 0) broadcastToRoom(code, { type: 'combat_event', event: 'held_triggered', inserted });

      roomFullCombatState.set(code, state);
      const currentIdx = state.currentTurnIndex;
      const legacyInitiatives2 = state.initiatives.map((e: any) => ({ playerId: e.id, playerName: e.name, characterName: e.name, roll: e.roll, modifier: e.modifier, total: e.total }));
      roomCombatState.set(code, { isActive: state.isActive, currentTurnIndex: currentIdx, initiatives: legacyInitiatives2 });

      return { success: true, moveResult };
    }

    throw new Error('Unsupported action type');
  }

  app.post("/api/rooms/:code/combat/action", async (req, res) => {
    try {
      const { code } = req.params;
      const { action } = req.body;
      if (!action) return res.status(400).json({ error: "Missing action" });

      const result = await executeCombatAction(code, action);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 403) return res.status(403).json({ error: "Not actor's turn" });
      if (error?.code === 404) return res.status(404).json({ error: 'Target not found' });
      if (error?.message === 'No active combat') return res.status(400).json({ error: "No active combat" });
      console.error('Combat action error:', error);
      res.status(500).json({ error: 'Failed to process combat action' });
    }
  });

  // Hold (delay) an actor until a trigger or end of round
  app.post('/api/rooms/:code/combat/hold', async (req, res) => {
    try {
      const { code } = req.params;
      const { actorId, holdType, triggerActorId } = req.body;
      if (!actorId || !holdType) return res.status(400).json({ error: 'Missing params' });

      const state = roomFullCombatState.get(code);
      if (!state || !state.isActive) return res.status(400).json({ error: 'No active combat' });

      addHold(state, actorId, { type: holdType, triggerActorId });
      roomFullCombatState.set(code, state);
      broadcastToRoom(code, { type: 'combat_event', event: 'hold', actorId, holdType, triggerActorId });

      res.json({ success: true });
    } catch (error) {
      console.error('Combat hold error:', error);
      res.status(500).json({ error: 'Failed to set hold' });
    }
  });

  // Set combat environment features for the room
  app.post('/api/rooms/:code/combat/environment', async (req, res) => {
    try {
      const { code } = req.params;
      const { features } = req.body;
      if (!Array.isArray(features)) return res.status(400).json({ error: 'features must be an array' });

      const state = roomFullCombatState.get(code);
      if (!state) return res.status(404).json({ error: 'No active combat for room' });

      // Validate minimal feature shape and set
      state.environment = features.map((f: any) => ({ id: f.id || `env:${Math.random().toString(36).slice(2)}`, type: f.type, position: f.position, radius: f.radius || 1, properties: f.properties || {} }));

      roomFullCombatState.set(code, state);
      broadcastToRoom(code, { type: 'combat_event', event: 'environment_update', features: state.environment });

      res.json({ success: true, environment: state.environment });
    } catch (error) {
      console.error('Set environment error:', error);
      res.status(500).json({ error: 'Failed to set environment' });
    }
  });

  // Pass: ends actor's turn without action
  app.post('/api/rooms/:code/combat/pass', async (req, res) => {
    try {
      const { code } = req.params;
      const { actorId } = req.body;
      const state = roomFullCombatState.get(code);
      if (!state || !state.isActive) return res.status(400).json({ error: 'No active combat' });

      const currentActor = state.initiatives[state.currentTurnIndex];
      if (!currentActor || currentActor.id !== actorId) return res.status(403).json({ error: "Not actor's turn" });

      // Record pass
      state.actionHistory.push({ actorId, type: 'pass', timestamp: Date.now() });
      broadcastToRoom(code, { type: 'combat_event', event: 'pass', actorId });

      const prevActorId = currentActor.id;
      advanceTurn(state);
      const inserted = processTrigger(state, prevActorId);
      if (inserted.length > 0) {
        broadcastToRoom(code, { type: 'combat_event', event: 'held_triggered', inserted });
      }

      roomFullCombatState.set(code, state);
      const currentIdx = state.currentTurnIndex;
      const legacyInitiatives3 = state.initiatives.map((e: any) => ({ playerId: e.id, playerName: e.name, characterName: e.name, roll: e.roll, modifier: e.modifier, total: e.total }));
      roomCombatState.set(code, { isActive: state.isActive, currentTurnIndex: currentIdx, initiatives: legacyInitiatives3 });

      res.json({ success: true });
    } catch (error) {
      console.error('Combat pass error:', error);
      res.status(500).json({ error: 'Failed to pass' });
    }
  });

  // AI Strategy endpoint: return deterministic monster decisions or use LLM for decision-only
  app.post('/api/rooms/:code/combat/ai-strategy', async (req, res) => {
    try {
      const { code } = req.params;
      const { maxActions = 1, useLLM = false } = req.body || {};
      const state = roomFullCombatState.get(code);
      if (!state || !state.isActive) return res.status(400).json({ error: 'No active combat' });

      // If useLLM, call generateCombatDMTurn in decisionOnly mode
      if (useLLM) {
        const room = await storage.getRoomByCode(code);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        const decisionText = await generateCombatDMTurn(openai, room, undefined, (db as any).$client, { decisionOnly: true, maxDecisions: maxActions });
        // parse by lines
        const lines = decisionText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        return res.json({ success: true, decisions: lines });
      }

      // Deterministic server-side decisions
      const decisions = decideMonsterActions(state, maxActions);
      res.json({ success: true, decisions });
    } catch (error) {
      console.error('AI strategy error:', error);
      res.status(500).json({ error: 'Failed to get AI strategy' });
    }
  });

  // Confirm a previously suggested action (NL->Action confirm flow)
  app.post('/api/rooms/:code/suggestions/:id/confirm', isAuthenticated, async (req, res) => {
    try {
      const { code, id } = req.params;
      const suggestion = suggestionStore.get(id);
      if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
      if (suggestion.roomCode !== code) return res.status(400).json({ error: 'Invalid room' });
      if (suggestion.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

      const { actorId, overrideAction } = req.body || {};
      let action = suggestion.action;
      if (overrideAction) action = overrideAction;
      if (actorId) action.actorId = actorId;

      // Execute action using shared helper
      const result = await executeCombatAction(code, action);
      // Remove suggestion
      suggestionStore.delete(id);
      res.json({ success: true, result });
    } catch (error: any) {
      if (error?.code === 403) return res.status(403).json({ error: "Not actor's turn" });
      if (error?.code === 404) return res.status(404).json({ error: 'Target not found' });
      console.error('Suggestion confirm error:', error);
      res.status(500).json({ error: 'Failed to confirm suggestion' });
    }
  });

  // Cancel a previously suggested action
  app.post('/api/rooms/:code/suggestions/:id/cancel', isAuthenticated, async (req, res) => {
    try {
      const { code, id } = req.params;
      const suggestion = suggestionStore.get(id);
      if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
      if (suggestion.roomCode !== code) return res.status(400).json({ error: 'Invalid room' });
      if (suggestion.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

      suggestionStore.delete(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Suggestion cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel suggestion' });
    }
  });

  // Start or load a persisted combat encounter for a location
  app.post('/api/rooms/:code/combat/encounter/start', async (req, res) => {
    try {
      const { code } = req.params;
      const { locationId, seed, allowRegenerate } = req.body || {};
      if (!locationId) return res.status(400).json({ error: 'Missing locationId' });

      // If an encounter exists for this location and regenerate not allowed, return it
      const existing = await storage.getCombatEncounterByLocation(locationId);
      if (existing && !allowRegenerate) {
        const features = await storage.getEnvironmentFeaturesByEncounter(existing.id);
        const spawns = await storage.getCombatSpawnsByEncounter(existing.id);
        return res.json({ success: true, encounter: existing, features, spawns });
      }

      // Else generate a stage using the generator (LLM decision-only) and persist
      const loc = await db.select().from(adventureLocations).where(eq(adventureLocations.id, locationId)).limit(1).then(r => r[0]);
      const locationName = loc?.name || 'Unknown Location';
      const stage = await generateCombatStage(openai, locationName, seed);

      // Persist encounter
      const encounter = await storage.createCombatEncounter({ locationId, name: `${locationName} - auto`, seed: seed || undefined, generatedBy: 'AI', metadata: { summary: stage.summary } });
      const features = await storage.addEnvironmentFeatures(encounter.id, (stage.features || []).map((f: any) => ({ type: f.type, positionX: f.position.x, positionY: f.position.y, radius: f.radius || 1, properties: f.properties || {} })));
      const spawns = await storage.addCombatSpawns(encounter.id, (stage.spawns || []).map((s: any) => ({ monsterName: s.monster, count: s.count || 1, positionX: s.position?.x, positionY: s.position?.y, metadata: s })));

      res.json({ success: true, encounter, features, spawns });
    } catch (error) {
      console.error('Start encounter error:', error);
      res.status(500).json({ error: 'Failed to start encounter' });
    }
  });

  // Get persisted encounter for a location
  app.get('/api/locations/:locationId/encounter', async (req, res) => {
    try {
      const { locationId } = req.params;
      const existing = await storage.getCombatEncounterByLocation(locationId);
      if (!existing) return res.json({ success: true, encounter: null });
      const features = await storage.getEnvironmentFeaturesByEncounter(existing.id);
      const spawns = await storage.getCombatSpawnsByEncounter(existing.id);
      res.json({ success: true, encounter: existing, features, spawns });
    } catch (error) {
      console.error('Get encounter error:', error);
      res.status(500).json({ error: 'Failed to get encounter' });
    }
  });

  // Update encounter
  app.put('/api/encounters/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const updated = await storage.updateCombatEncounter(id, updates);
      res.json({ success: true, updated });
    } catch (error) {
      console.error('Update encounter error:', error);
      res.status(500).json({ error: 'Failed to update encounter' });
    }
  });

  // Request LLM-assisted edits/suggestions for an existing encounter (decision-only)
  app.post('/api/encounters/:id/generate-edit', async (req, res) => {
    try {
      const { id } = req.params;
      const { prompt } = req.body || {};
      const encounter = await storage.getCombatEncounterById(id);
      if (!encounter) return res.status(404).json({ error: 'Encounter not found' });

      const location = await db.select().from(adventureLocations).where(eq(adventureLocations.id, encounter.locationId)).limit(1).then(r => r[0]);
      const locationName = location?.name || 'Unknown Location';

      const editPrompt = `Edit the existing encounter at ${locationName}. Changes requested: ${prompt}. Return JSON in the same format as stage generator (features, spawns, summary).`;
      const response = await openai.chat.completions.create({
        model: 'grok-4-1-fast-reasoning',
        messages: [{ role: 'system', content: 'You are an encounter editor. Return only JSON.' }, { role: 'user', content: editPrompt }],
        max_tokens: 300,
        temperature: 0.2,
      });

      const raw = response.choices[0]?.message?.content || '';
      const jsonStart = raw.indexOf('{');
      const json = jsonStart !== -1 ? raw.slice(jsonStart) : raw;
      let parsed;
      try { parsed = JSON.parse(json); } catch (err) { parsed = null; }

      res.json({ success: true, suggestion: parsed });
    } catch (error) {
      console.error('Generate edit error:', error);
      res.status(500).json({ error: 'Failed to generate edit' });
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
      const dropped: DroppedItem = {
        id: droppedId,
        name: item.name,
        quantity: item.quantity,
        description: (item as any).description || "",
        location: (item as any).location || "ground",
      };
      roomDroppedItems.get(code)!.push(dropped);

      broadcastToRoom(code, {
        type: "system",
        content: `An item has been dropped: ${dropped.name} (${dropped.quantity}) at ${dropped.location}`,
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

  // DEV: Debug endpoint to force-add currency to a player (non-production only)
  app.post("/api/rooms/:code/debug/add-currency", async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not available in production' });
    try {
      const { code } = req.params;
      const { playerName, gp = 0, sp = 0, cp = 0 } = req.body;
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

          const characters = await storage.getCharactersByRoomCode(code);
      let char = characters.find((c: any) => c.characterName === playerName);
      if (!char) {
        // Try matching by the player's username if no character name match
        const userRec = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, playerName))
          .limit(1);

        if (userRec && userRec.length > 0) {
          const userId = userRec[0].id;
          char = characters.find((c: any) => c.userId === userId);
        }
      }

      if (!char) return res.status(404).json({ error: 'Character not found in room' });

      const currentCurrency = char.currency || { cp: 0, sp: 0, gp: 0 };
      const newCurrency = { cp: currentCurrency.cp + cp, sp: currentCurrency.sp + sp, gp: currentCurrency.gp + gp };
      const converted = convertCurrency(newCurrency);
      const updates: any = { currency: converted, gold: converted.gp };
      await storage.updateSavedCharacter(char.id, updates);

      broadcastToRoom(code, {
        type: 'character_update',
        characterId: char.id,
        updates,
      });

      broadcastToRoom(code, {
        type: 'system',
        content: `[CURRENCY] ${playerName} gains: ${converted.gp} gp, ${converted.sp} sp, ${converted.cp} cp`,
      });

      res.json({ success: true, updates });
    } catch (error) {
      console.error('Debug add currency error:', error);
      res.status(500).json({ error: 'Failed to add currency' });
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

  // Monster cache stats (for admin/debug/monitoring)
  app.get("/api/stats/monster-cache/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { monsterCacheManager } = await import("./cache/monster-cache");
      const cache = monsterCacheManager.getCache(roomId);
      const stats = cache.getStats();
      
      res.json({
        room: {
          id: roomId,
          cached: stats.size,
          maxSize: stats.maxSize,
          utilization: `${stats.utilization}%`,
          hotMonsters: stats.hotMonsters,
        },
        global: monsterCacheManager.getGlobalStats(),
      });
    } catch (error) {
      console.error("Cache stats error:", error);
      res.status(500).json({ error: "Failed to get cache stats" });
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

      const filename = `${room.name.replace(/[^a-zA-Z0-9]/g, "_")}_adventure_${room.code}.pdf`;

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

  // Periodic cleanup job: Delete stale inactive rooms
  const STALE_ROOM_HOURS = parseInt(process.env.STALE_ROOM_HOURS || "168", 10); // Default: 168 hours (7 days)
  const CLEANUP_INTERVAL_MS = parseInt(process.env.STALE_ROOM_CLEANUP_INTERVAL_MS || "21600000", 10); // Default: 6 hours

  async function cleanupStaleRooms() {
    try {
      const staleRooms = await storage.getStaleInactiveRooms(STALE_ROOM_HOURS);
      for (const room of staleRooms) {
        console.log(`[Cleanup] Deleting stale room: ${room.code} (ID: ${room.id}, inactive since ${room.lastActivityAt})`);
        await storage.deleteRoomWithAllData(room.id);
        roomConnections.delete(room.code);
        
        // Clean up monster cache for this room
        try {
          const { monsterCacheManager } = await import("./cache/monster-cache");
          monsterCacheManager.removeCache(room.id);
        } catch (error) {
          console.warn(`Failed to clean up monster cache for room ${room.id}:`, error);
        }
      }
      if (staleRooms.length > 0) {
        console.log(`[Cleanup] Deleted ${staleRooms.length} stale room(s)`);
      }
    } catch (error) {
      console.error("[Cleanup] Stale room cleanup error:", error);
    }
  }

  // Run cleanup on startup and then periodically
  console.log(`[Cleanup] Stale room cleanup configured: ${STALE_ROOM_HOURS} hours threshold, running every ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes`);
  cleanupStaleRooms();
  setInterval(cleanupStaleRooms, CLEANUP_INTERVAL_MS);

  // Items API
  app.get("/api/items", async (req, res) => {
    try {
      const { search, category, rarity } = req.query as {
        search?: string;
        category?: string;
        rarity?: string;
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
        result = await storage.getSpells(level !== undefined ? parseInt(level) : undefined, school, classFilter);
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

  // Character Inventory API (unified)
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

      const insert: InsertSavedInventoryItem = {
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

  // PATCH /api/characters/:characterId/inventory/:itemId - Toggle equipped status
  // Request body: { equipped?: boolean }
  // If equipped is not provided, the current equipped status will be toggled
  app.patch("/api/characters/:characterId/inventory/:itemId", isAuthenticated, async (req, res) => {
    try {
      const { characterId, itemId } = req.params;
      const { equipped } = req.body;
      
      // Get the character to verify ownership
      const character = await storage.getSavedCharacter(characterId);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      
      // Verify the user owns this character
      if (character.userId !== req.user?.id) {
        return res.status(403).json({ error: "Forbidden: You do not own this character" });
      }
      
      // Get character's inventory to verify item exists
      const inventory = await storage.getSavedInventoryWithDetails(characterId);
      const invItem = inventory.find((i: any) => i.id === itemId);
      
      if (!invItem) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      
      // Update equipped status (toggle if not explicitly provided)
      const updated = await storage.updateSavedInventoryItem(itemId, { 
        equipped: equipped !== undefined ? equipped : !invItem.equipped 
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  // =============================================================================
  // Adventure Module API Endpoints
  // =============================================================================

  // GET /api/adventures - List all published adventures
  app.get("/api/adventures", async (req, res) => {
    try {
      const { adventures } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const adventureList = await db
        .select({
          id: adventures.id,
          slug: adventures.slug,
          name: adventures.name,
          description: adventures.description,
          gameSystem: adventures.gameSystem,
          minLevel: adventures.minLevel,
          maxLevel: adventures.maxLevel,
          estimatedHours: adventures.estimatedHours,
          source: adventures.source,
          coverImageUrl: adventures.coverImageUrl,
        })
        .from(adventures)
        .where(eq(adventures.isPublished, true))
        .orderBy(adventures.name);

      res.json(adventureList);
    } catch (error) {
      console.error("Error fetching adventures:", error);
      res.status(500).json({ error: "Failed to fetch adventures" });
    }
  });

  // GET /api/adventures/:slug - Get full adventure details with related data
  app.get("/api/adventures/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const {
        adventures,
        adventureChapters,
        adventureLocations,
        adventureNpcs,
        adventureQuests,
        adventureEncounters,
      } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Get adventure
      const [adventure] = await db
        .select()
        .from(adventures)
        .where(eq(adventures.slug, slug))
        .limit(1);

      if (!adventure) {
        return res.status(404).json({ error: "Adventure not found" });
      }

      // Get all related data
      const [chapters, locations, npcs, quests, encounters] = await Promise.all([
        db.select().from(adventureChapters).where(eq(adventureChapters.adventureId, adventure.id)).orderBy(adventureChapters.chapterNumber),
        db.select().from(adventureLocations).where(eq(adventureLocations.adventureId, adventure.id)),
        db.select().from(adventureNpcs).where(eq(adventureNpcs.adventureId, adventure.id)),
        db.select().from(adventureQuests).where(eq(adventureQuests.adventureId, adventure.id)),
        db.select().from(adventureEncounters).where(eq(adventureEncounters.adventureId, adventure.id)),
      ]);

      res.json({
        ...adventure,
        chapters,
        locations,
        npcs,
        quests,
        encounters,
      });
    } catch (error) {
      console.error("Error fetching adventure details:", error);
      res.status(500).json({ error: "Failed to fetch adventure details" });
    }
  });

  // GET /api/rooms/:roomId/adventure-progress - Get adventure progress for a room
  app.get("/api/rooms/:roomId/adventure-progress", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { roomAdventureProgress } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [progress] = await db
        .select()
        .from(roomAdventureProgress)
        .where(eq(roomAdventureProgress.roomId, roomId))
        .limit(1);

      if (!progress) {
        return res.status(404).json({ error: "No adventure progress found for this room" });
      }

      res.json(progress);
    } catch (error) {
      console.error("Error fetching adventure progress:", error);
      res.status(500).json({ error: "Failed to fetch adventure progress" });
    }
  });

  // GET /api/rooms/:roomId/dynamic-npcs - List dynamic NPCs created for this room
  app.get("/api/rooms/:roomId/dynamic-npcs", async (req, res) => {
    try {
      const { roomId } = req.params;
      const npcs = await storage.getDynamicNpcsByRoom(roomId);
      res.json(npcs);
    } catch (error) {
      console.error("Error fetching dynamic NPCs:", error);
      res.status(500).json({ error: "Failed to fetch dynamic NPCs" });
    }
  });

  // GET /api/rooms/:roomId/dynamic-locations - List dynamic locations created for this room
  app.get("/api/rooms/:roomId/dynamic-locations", async (req, res) => {
    try {
      const { roomId } = req.params;
      const locs = await storage.getDynamicLocationsByRoom(roomId);
      res.json(locs);
    } catch (error) {
      console.error("Error fetching dynamic locations:", error);
      res.status(500).json({ error: "Failed to fetch dynamic locations" });
    }
  });

  // POST /api/rooms/:roomId/adventure-progress - Update adventure progress
  app.post("/api/rooms/:roomId/adventure-progress", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { roomAdventureProgress } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Check if progress record exists
      const [existing] = await db
        .select()
        .from(roomAdventureProgress)
        .where(eq(roomAdventureProgress.roomId, roomId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "No adventure progress found for this room" });
      }

      // Update progress
      const updates = {
        ...req.body,
        updatedAt: Math.floor(Date.now() / 1000),
      };

      const [updated] = await db
        .update(roomAdventureProgress)
        .set(updates)
        .where(eq(roomAdventureProgress.id, existing.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating adventure progress:", error);
      res.status(500).json({ error: "Failed to update adventure progress" });
    }
  });

  // ==============================================================================
  // Story Tracking API Endpoints
  // ==============================================================================

  // GET /api/rooms/:roomId/story-events - List story events for room
  app.get("/api/rooms/:roomId/story-events", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { limit, eventType, minImportance } = req.query;

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        eventType: eventType as string | undefined,
        minImportance: minImportance ? parseInt(minImportance as string) : undefined,
      };

      const events = await storage.getStoryEventsByRoom(roomId, options);
      res.json(events);
    } catch (error) {
      console.error("Error fetching story events:", error);
      res.status(500).json({ error: "Failed to fetch story events" });
    }
  });

  // POST /api/rooms/:roomId/story-events - Create a story event (manual DM entry)
  app.post("/api/rooms/:roomId/story-events", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { eventType, title, summary, importance, relatedQuestId, relatedNpcId, relatedLocationId } = req.body;

      if (!eventType || !title || !summary) {
        return res.status(400).json({ error: "Missing required fields: eventType, title, summary" });
      }

      const event = await storage.createStoryEvent({
        roomId,
        eventType,
        title,
        summary,
        importance: importance || 1,
        participants: [],
        relatedQuestId,
        relatedNpcId,
        relatedLocationId,
      });

      // Invalidate story cache for this room
      const { storyCache } = await import("./cache/story-cache");
      storyCache.invalidate(roomId);

      // Broadcast to room clients
      broadcastToRoom(roomId, {
        type: "story_event_created",
        event,
      });

      res.json(event);
    } catch (error) {
      console.error("Error creating story event:", error);
      res.status(500).json({ error: "Failed to create story event" });
    }
  });

  // GET /api/rooms/:roomId/session-summaries - List session summaries
  app.get("/api/rooms/:roomId/session-summaries", async (req, res) => {
    try {
      const { roomId } = req.params;
      const summaries = await storage.getSessionSummariesByRoom(roomId);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching session summaries:", error);
      res.status(500).json({ error: "Failed to fetch session summaries" });
    }
  });

  // POST /api/rooms/:roomId/session-summaries/generate - Generate session summary
  app.post("/api/rooms/:roomId/session-summaries/generate", async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const messageHistory = room.messageHistory || [];
      const lastSummary = await storage.getLatestSessionSummary(roomId);
      
      // Get messages since last summary
      const lastSummaryMessageCount = lastSummary?.messageCount || 0;
      const newMessages = messageHistory.slice(lastSummaryMessageCount);

      if (newMessages.length < 50) {
        return res.status(400).json({ 
          error: "Not enough messages for summary generation",
          currentMessages: newMessages.length,
          required: 50,
        });
      }

      // Generate summary with AI
      const gameSystem = room.gameSystem || "dnd";
      const summaryPrompt = `Summarize the following game session in 3-5 sentences. Include key events, NPCs met, locations visited, and quests progressed:\n\n${
        newMessages.slice(-100).map((m: any) => `${m.playerName}: ${m.content}`).join('\n')
      }`;

      const summaryResponse = await openai.chat.completions.create({
        model: "grok-4-1-fast-reasoning",
        messages: [
          { role: "system", content: `You are summarizing a ${gameSystem} game session.` },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });

      const summaryText = summaryResponse.choices[0]?.message?.content || "Session summary unavailable.";

      // Extract key events from recent story events
      const recentEvents = await storage.getStoryEventsByRoom(roomId, { limit: 10 });
      const keyEvents = recentEvents.slice(0, 5).map((e: any) => e.title);

      // Create session summary
      const sessionNumber = (lastSummary?.sessionNumber || 0) + 1;
      const summary = await storage.createSessionSummary({
        roomId,
        sessionNumber,
        summary: summaryText,
        keyEvents,
        questsProgressed: [],
        npcsEncountered: [],
        locationsVisited: [],
        messageCount: messageHistory.length,
        startedAt: Math.floor(Date.now() / 1000),
      });

      // Invalidate story cache
      const { storyCache } = await import("./cache/story-cache");
      storyCache.invalidate(roomId);

      res.json(summary);
    } catch (error) {
      console.error("Error generating session summary:", error);
      res.status(500).json({ error: "Failed to generate session summary" });
    }
  });

  // GET /api/rooms/:roomId/quest-progress - Get quest progress
  app.get("/api/rooms/:roomId/quest-progress", async (req, res) => {
    try {
      const { roomId } = req.params;
      const objectives = await storage.getQuestObjectivesByRoom(roomId);

      // Group by quest
      const questMap = new Map();
      for (const obj of objectives) {
        if (!questMap.has(obj.questId)) {
          questMap.set(obj.questId, []);
        }
        questMap.get(obj.questId).push(obj);
      }

      // Calculate completion percentages
      const questProgress = Array.from(questMap.entries()).map(([questId, objs]) => {
        const completed = objs.filter((o: any) => o.isCompleted).length;
        const total = objs.length;
        return {
          questId,
          objectives: objs,
          completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });

      res.json(questProgress);
    } catch (error) {
      console.error("Error fetching quest progress:", error);
      res.status(500).json({ error: "Failed to fetch quest progress" });
    }
  });

  // PATCH /api/rooms/:roomId/quest-progress/:objectiveId - Update objective
  app.patch("/api/rooms/:roomId/quest-progress/:objectiveId", async (req, res) => {
    try {
      const { roomId, objectiveId } = req.params;
      const { isCompleted, completedBy, notes } = req.body;

      const updates: any = {};
      if (isCompleted !== undefined) {
        updates.isCompleted = isCompleted;
        if (isCompleted) {
          updates.completedAt = Math.floor(Date.now() / 1000);
        }
      }
      if (completedBy) updates.completedBy = completedBy;
      if (notes !== undefined) updates.notes = notes;

      const updated = await storage.updateQuestObjective(objectiveId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Quest objective not found" });
      }

      // Check if quest is fully completed
      const questObjectives = await storage.getQuestObjectivesByQuest(updated.questId);
      const allCompleted = questObjectives.every((o: any) => o.isCompleted);

      if (allCompleted && isCompleted) {
        // Log quest completion story event
        await storage.createStoryEvent({
          roomId,
          eventType: "quest_complete",
          title: "Quest Completed",
          summary: `All objectives for quest have been completed.`,
          participants: completedBy ? [completedBy] : [],
          relatedQuestId: updated.questId,
          importance: 3,
        });
      }

      // Invalidate story cache
      const { storyCache } = await import("./cache/story-cache");
      storyCache.invalidate(roomId);

      // Broadcast update to room
      broadcastToRoom(roomId, {
        type: "quest_objective_updated",
        objective: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating quest objective:", error);
      res.status(500).json({ error: "Failed to update quest objective" });
    }
  });

  // POST /api/rooms/:roomId/quests - Manually create a dynamic quest (DM tool)
  app.post("/api/rooms/:roomId/quests", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { title, description, objectives, questGiver, rewards, urgency, isMainQuest } = req.body;

      // Validate required fields
      if (!title || !description || !objectives || !Array.isArray(objectives) || objectives.length === 0) {
        return res.status(400).json({ 
          error: "Missing required fields: title, description, and at least one objective" 
        });
      }

      // Create the quest
      const questResult = await db.insert(adventureQuests).values({
        name: title,
        description: description,
        objectives: objectives,
        roomId: roomId,
        questGiver: questGiver || 'Unknown',
        isDynamic: true,
        urgency: urgency || 'medium',
        rewards: rewards ? { other: Array.isArray(rewards) ? rewards : [rewards] } : undefined,
        isMainQuest: isMainQuest || false,
      }).returning();

      if (questResult.length === 0) {
        return res.status(500).json({ error: "Failed to create quest" });
      }

      const createdQuest = questResult[0];

      // Create quest objectives in progress table
      const objectivePromises = objectives.map((obj: string, index: number) =>
        db.insert(questObjectiveProgress).values({
          roomId: roomId,
          questId: createdQuest.id,
          objectiveIndex: index,
          objectiveText: obj,
          isCompleted: false,
        })
      );

      await Promise.all(objectivePromises);

      // Log story event for manual quest creation
      await storage.createStoryEvent({
        roomId,
        eventType: 'quest_start',
        title: `Quest: ${title}`,
        summary: `${questGiver || 'The DM'} has given the party a new quest: ${title}`,
        participants: [],
        relatedQuestId: createdQuest.id,
        importance: 3,
      });

      // Invalidate story cache
      const { storyCache } = await import("./cache/story-cache");
      storyCache.invalidate(roomId);

      // Broadcast to room
      broadcastToRoom(roomId, {
        type: "quest_created",
        quest: createdQuest,
      });

      console.log(`[Manual Quest] Created quest "${title}" for room ${roomId}`);

      res.json({
        quest: createdQuest,
        objectiveCount: objectives.length,
      });
    } catch (error) {
      console.error("Error creating manual quest:", error);
      res.status(500).json({ error: "Failed to create quest" });
    }
  });

  // GET /api/rooms/:roomId/quests - Get all quests for a room
  app.get("/api/rooms/:roomId/quests", async (req, res) => {
    try {
      const { roomId } = req.params;
      
      // Get both adventure quests and dynamic quests for this room
      const quests = await db
        .select()
        .from(adventureQuests)
        .where(
          sql`${adventureQuests.roomId} = ${roomId} OR ${adventureQuests.id} IN (
            SELECT DISTINCT ${questObjectiveProgress.questId} 
            FROM ${questObjectiveProgress} 
            WHERE ${questObjectiveProgress.roomId} = ${roomId}
          )`
        );

      res.json(quests);
    } catch (error) {
      console.error("Error fetching quests:", error);
      res.status(500).json({ error: "Failed to fetch quests" });
    }
  });

  // Get quests with objectives and progress for UI display
  app.get("/api/rooms/:roomCode/quests-with-progress", async (req, res) => {
    try {
      const { roomCode } = req.params;
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Get all quest objectives for this room
      const objectives = await storage.getQuestObjectivesByRoom(room.id);
      
      // Get quest details
      const questIds = [...new Set(objectives.map((o: any) => o.questId))];
      
      let questsWithProgress: any[] = [];
      
      if (questIds.length > 0) {
        const quests = await db
          .select()
          .from(adventureQuests)
          .where(inArray(adventureQuests.id, questIds as string[]));
        
        questsWithProgress = quests.map(quest => {
          const questObjectives = objectives.filter((o: any) => o.questId === quest.id);
          const completed = questObjectives.filter((o: any) => o.isCompleted).length;
          const total = questObjectives.length;
          return {
            quest,
            objectives: questObjectives,
            completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          };
        });
      }
      
      // Also get direct room quests (dynamic quests without objectives yet)
      const roomQuests = await storage.getQuestsByRoom(room.id);
      for (const quest of roomQuests) {
        if (!questIds.includes(quest.id)) {
          const questObjectives = await storage.getQuestObjectives(quest.id);
          const completed = questObjectives.filter((o: any) => o.isCompleted).length;
          const total = questObjectives.length;
          questsWithProgress.push({
            quest,
            objectives: questObjectives,
            completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          });
        }
      }

      res.json(questsWithProgress);
    } catch (error) {
      console.error("Error fetching quests with progress:", error);
      res.status(500).json({ error: "Failed to fetch quests with progress" });
    }
  });

  // Update quest status
  app.patch("/api/quests/:questId", async (req, res) => {
    try {
      const { questId } = req.params;
      const { status } = req.body;

      if (!status || !["active", "in_progress", "completed", "failed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await storage.updateQuest(questId, { status });
      
      if (!updated) {
        return res.status(404).json({ error: "Quest not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating quest:", error);
      res.status(500).json({ error: "Failed to update quest" });
    }
  });

  // Update objective status
  app.patch("/api/objectives/:objectiveId", async (req, res) => {
    try {
      const { objectiveId } = req.params;
      const { isCompleted, completedBy } = req.body;

      const updates: any = {};
      if (typeof isCompleted === "boolean") {
        updates.isCompleted = isCompleted;
        if (isCompleted) {
          updates.completedAt = new Date();
          if (completedBy) updates.completedBy = completedBy;
        }
      }

      const updated = await storage.updateQuestObjective(objectiveId, updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Objective not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating objective:", error);
      res.status(500).json({ error: "Failed to update objective" });
    }
  });

  // Catch-all for unmatched API routes - return JSON 404 instead of falling back to static/index.html
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Monster bestiary API
  app.get("/api/monsters", async (req, res) => {
    try {
      const { search, type, minCr, maxCr, limit } = req.query;
      const client = (db as any).$client;
      const { searchMonsters, getMonstersByType, getMonstersByCR } = await import("./db/bestiary");
      let monsters = [];
      if (search) {
        monsters = await searchMonsters(client, String(search), Number(limit) || 50);
      } else if (type) {
        monsters = await getMonstersByType(client, String(type), Number(limit) || 50);
      } else if (minCr || maxCr) {
        monsters = await getMonstersByCR(client, {
          min: minCr ? Number(minCr) : 0,
          max: maxCr ? Number(maxCr) : 30,
        }, Number(limit) || 50);
      } else {
        monsters = await searchMonsters(client, "", Number(limit) || 50);
      }
      res.json(monsters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch monsters" });
    }
  });

  return httpServer;
}
function generateCombatStage(openai: any, locationName: string, seed: any): Promise<{ summary: string; features: any[]; spawns: any[] }> {
  // Placeholder implementation - returns a basic combat stage
  // TODO: Implement actual LLM-based combat stage generation
  return Promise.resolve({
    summary: `Combat encounter at ${locationName}`,
    features: [],
    spawns: []
  });
}


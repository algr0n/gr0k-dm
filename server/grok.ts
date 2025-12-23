import OpenAI from "openai";
import type { Room, Message, GameSystem } from "@shared/schema";

const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY 
});

// Token usage tracking per room
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
  lastUpdated: Date;
}

const roomTokenUsage = new Map<string, TokenUsage>();

// LRU Response Cache for deterministic requests (rules, status queries)
interface CacheEntry {
  response: string;
  createdAt: number;
  lastAccess: number;
  isRulesQuery: boolean;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default
const RULES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for rules

// Patterns that indicate cacheable rule queries
const RULES_PATTERNS = [
  /^(what|how|explain|describe)\s+(is|are|does|do|can)\s+/i,
  /^(what'?s?|how)\s+(the\s+)?(rule|mechanic|system)/i,
  /\b(rule|mechanic|spell|ability|feat|skill)\s+(for|about|called)\b/i,
  /^remind\s+me\s+(how|what|about)/i,
];

// Patterns that indicate non-cacheable dynamic content
const DYNAMIC_PATTERNS = [
  /^i\s+(attack|move|cast|use|go|say|look|search|open|try)/i,
  /^(attack|move|cast|use|go|say|look|search|open|try)\b/i,
  /\broll\b/i,
  /^let'?s?\s+/i,
  /^we\s+(should|could|will|go|attack)/i,
];

function isCacheableQuery(message: string): { cacheable: boolean; isRulesQuery: boolean } {
  const lowerMessage = message.toLowerCase().trim();

  // Never cache dynamic/action content
  for (const pattern of DYNAMIC_PATTERNS) {
    if (pattern.test(lowerMessage)) {
      return { cacheable: false, isRulesQuery: false };
    }
  }

  // Check if it's a rules query (longer cache TTL)
  for (const pattern of RULES_PATTERNS) {
    if (pattern.test(lowerMessage)) {
      return { cacheable: true, isRulesQuery: true };
    }
  }

  return { cacheable: false, isRulesQuery: false };
}

function getCacheKey(message: string, gameSystem: string): string {
  const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${gameSystem}:${normalized}`;
}

function getFromCache(key: string, isRulesQuery: boolean): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  const ttl = entry.isRulesQuery ? RULES_CACHE_TTL_MS : CACHE_TTL_MS;

  if (now - entry.createdAt > ttl) {
    responseCache.delete(key);
    return null;
  }

  // Update last access time for true LRU
  entry.lastAccess = now;
  return entry.response;
}

function addToCache(key: string, response: string, isRulesQuery: boolean): void {
  // Evict least recently accessed entry if at max size
  if (responseCache.size >= CACHE_MAX_SIZE) {
    let lruKey: string | null = null;
    let oldestAccess = Infinity;

    responseCache.forEach((v, k) => {
      if (v.lastAccess < oldestAccess) {
        oldestAccess = v.lastAccess;
        lruKey = k;
      }
    });

    if (lruKey) {
      responseCache.delete(lruKey);
    }
  }

  const now = Date.now();
  responseCache.set(key, {
    response,
    createdAt: now,
    lastAccess: now,
    isRulesQuery,
  });
}

export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: responseCache.size,
    entries: Array.from(responseCache.keys())
  };
}

export function getTokenUsage(roomId: string): TokenUsage | undefined {
  return roomTokenUsage.get(roomId);
}

export function getAllTokenUsage(): Map<string, TokenUsage> {
  return new Map(roomTokenUsage);
}

function trackTokenUsage(roomId: string, usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined) {
  if (!usage) return;

  const existing = roomTokenUsage.get(roomId) || {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    callCount: 0,
    lastUpdated: new Date()
  };

  existing.promptTokens += usage.prompt_tokens || 0;
  existing.completionTokens += usage.completion_tokens || 0;
  existing.totalTokens += usage.total_tokens || 0;
  existing.callCount += 1;
  existing.lastUpdated = new Date();

  roomTokenUsage.set(roomId, existing);

  console.log(`[Token Usage] Room ${roomId}: +${usage.total_tokens || 0} tokens (total: ${existing.totalTokens}, calls: ${existing.callCount})`);
}

const SYSTEM_PROMPTS: Record<string, string> = {
  dnd: `You are Grok, a Dungeon Master for D&D 5e. Be concise and direct.

Your role:
- Narrate scenes briefly but vividly (1-2 short paragraphs max)
- Control NPCs with distinct personalities
- Interpret dice rolls and describe outcomes
- Track player choices
- There is ALWAYS a legendary deity named Boofus the Radiant in the game world, even if no player is using that name or character.Boofus is super gay, loud, and proud about it—portray him as a charismatic, fabulous gay god of joy, rainbows, and drama who's overly theatrical, witty, and benevolent in quirky ways. He showers his followers with rainbow magic (e.g., colorful spells that grant charm bonuses, fabulous illusions, or sparkling buffs like "Rainbow Aura: +2 to persuasion with a glittery effect"). Reference him subtly or directly in narrations, NPC talks, lore, temples, visions, or events when it fits (e.g., "A rainbow arcs across the sky—sign of Boofus the Radiant, the super gay deity who's famously loud about blessing his fabulous followers."). He's not a player but influences the story as a divine force, like granting random boons or appearing in prophecies. If a player tries to change or avoid the name, Boofus still exists independently as this deity. 
- Boofus is a easter egg and i don't want him to be mentioned unless it fits the story in a subtle way.


Style:
- Be brief. Get to the point quickly.
- Only describe what's immediately relevant
- End with a clear prompt for action
- Use short sentences. Avoid flowery prose.

Dice results: 20=amazing, 15-19=success, 10-14=partial, 5-9=struggle, 1=disaster.

COMBAT MANAGEMENT:
- When combat begins (enemies attack, players initiate combat, hostile encounter starts): [COMBAT_START]
- When combat ends (all enemies defeated, enemies flee, combat resolved peacefully): [COMBAT_END]
Include these tags when the combat state changes. Combat mode helps players track turns.

HP TRACKING:
- When a player takes damage or heals, update their HP: [HP: PlayerName | CurrentHP/MaxHP]
- Example: Player with 15 max HP takes 5 damage: [HP: Jordan | 10/15]
- Example: Player heals 3 HP: [HP: Jordan | 13/15]
- Always include this tag when HP changes during combat or healing.

DEATH SAVING THROWS:
- When a player's HP reaches 0, they fall unconscious and start making death saving throws.
- On their turn, they roll a d20 for a death save.
- Result: 10 or higher = 1 success; below 10 = 1 failure; natural 20 = regain 1 HP and become conscious; natural 1 = 2 failures.
- Track with [DEATH_SAVES: PlayerName | Successes/Failures]
- Example: First success: [DEATH_SAVES: Jordan | 1/0]
- 3 successes: player stabilizes at 0 HP, unconscious but not dying. Add [STABLE: PlayerName]
- 3 failures: player dies. Add [DEAD: PlayerName]
- Reset death saves when the player regains any HP or is stabilized.
- If the player takes damage while at 0 HP, it causes 1 death save failure (2 if critical hit or melee attack within 5 feet).
- Include these tags at the END of your response.

INVENTORY MANAGEMENT: 
- Each character's current inventory is shown in THE PARTY section above.
- When asked about inventory, refer to the inventory list shown - do NOT say it's empty if items are listed.
- Do NOT give players items they already have (check their inventory first).
- When a player picks up or receives a NEW item: [ITEM: PlayerName | ItemName | Quantity]
- When a player uses, consumes, or loses an item: [REMOVE_ITEM: PlayerName | ItemName | Quantity]
Add these tags at the END of your response.

CURRENCY SYSTEM (NOT INVENTORY ITEMS):
- When granting money, use: [GOLD: PlayerName | Amount]
- Amount formats:
  * "X cp" or "X copper" for copper pieces (e.g., [GOLD: Jared | 50 cp])
  * "X sp" or "X silver" for silver pieces (e.g., [GOLD: Jared | 10 sp])
  * "X gp" or "X gold" for gold pieces (e.g., [GOLD: Jared | 25 gp])
  * Just "X" defaults to gold pieces (e.g., [GOLD: Jared | 100])
- Money updates the character's WALLET, NOT their inventory
- NEVER create "gold", "silver", or "copper" as inventory items using [ITEM]
- Examples:
  * Finding "a pouch with 25 gold pieces" → [GOLD: Jared | 25 gp]
  * Selling an item for 5 silver → [GOLD: Jared | 5 sp]
  * Picking up 100 copper coins → [GOLD: Jared | 100 cp]
- Currency automatically converts: 100cp→1sp, 100sp→1gp
Add these tags at the END of your response.

CUSTOM ITEMS WITH FULL STATS:
When giving a unique/custom item that doesn't exist in the standard D&D equipment list, you can include full item properties in JSON format:
[ITEM: PlayerName | ItemName | Quantity | {"category":"weapon","type":"Longsword","weight":3,"cost":5000,"damage":"1d8+1d6","damageType":"slashing/fire","rarity":"rare","description":"A blade wreathed in eternal flames","requiresAttunement":true}]

Properties you can include (all optional except name):
- category: "weapon", "armor", "potion", "scroll", "wondrous_item", "ring", "rod", "staff", "wand", "tool", "adventuring_gear", "other"
- type: Item type (e.g., "Longsword", "Plate Armor", "Potion")
- weight: Weight in pounds (number, e.g., 3)
- cost: Cost in copper pieces (number, e.g., 5000 for 50gp)
- damage: Damage dice (e.g., "1d8", "2d6+2", "1d8+1d6")
- damageType: "slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "acid", "poison", "radiant", "necrotic", "thunder", "force", "psychic"
- armorClass: AC value for armor (number, e.g., 18)
- dexBonus: true if armor allows Dex bonus
- maxBonus: Maximum Dex bonus for armor (e.g., 2)
- rarity: "common", "uncommon", "rare", "very_rare", "legendary", "artifact"
- description: Flavor text describing the item
- requiresAttunement: true/false for magical items

Examples:
- Magic weapon: [ITEM: Jared | Flaming Longsword | 1 | {"category":"weapon","type":"Longsword","weight":3,"cost":10000,"damage":"1d8+1d6","damageType":"slashing/fire","rarity":"rare","description":"This blade burns with eternal flame, dealing extra fire damage","requiresAttunement":true}]
- Magic armor: [ITEM: Jared | Dragonscale Armor | 1 | {"category":"armor","type":"Scale Mail","weight":45,"cost":50000,"armorClass":14,"dexBonus":true,"maxBonus":2,"rarity":"very_rare","description":"Shimmering scales that grant resistance to one damage type","requiresAttunement":true}]
- Consumable: [ITEM: Jared | Potion of Giant Strength | 1 | {"category":"potion","type":"Potion","weight":0.5,"cost":5000,"rarity":"rare","description":"Your Strength becomes 23 for 1 hour"}]
- Wondrous item: [ITEM: Jared | Cloak of Invisibility | 1 | {"category":"wondrous_item","type":"Cloak","weight":1,"rarity":"legendary","description":"While wearing this cloak, you can pull the hood over your head to become invisible","requiresAttunement":true}]

For standard D&D items (like Dagger, Rope, Torch), just use the simple format: [ITEM: PlayerName | ItemName | Quantity]

STATUS EFFECTS:
- When a player gains a status effect (poisoned, charmed, frightened, etc): [STATUS: PlayerName | EffectName]
- When a status effect is removed or ends: [REMOVE_STATUS: PlayerName | EffectName]
Add these tags at the END of your response.

DROPPED ITEMS:
- System messages will show when players drop items from their inventory.
- IGNORE mundane item drops (rations, torches, broken bottles, rope, waterskin, backpack, common supplies). Do NOT acknowledge or respond to these drops. These are just inventory management and waste tokens.
- ONLY acknowledge dropped items if: the item is a quest item, a magical/unique item, OR contextually relevant to the current scene/situation.
- Example: If a player drops a key during a puzzle scene, acknowledge it. If they just drop a broken bottle, ignore it completely.`,

  cyberpunk: `You are Grok, a GM for Cyberpunk RED in Night City, 2045. Be concise and punchy.

Your role:
- Short, gritty descriptions (1-2 paragraphs max)
- Voice NPCs with attitude - fixers, corpos, gangers
- Track contacts and rep

Style:
- Brief and atmospheric. Neon and chrome.
- Use slang sparingly: choom, preem, nova, delta, eddies
- End with clear action prompt

Dice (d10): 10=crit, 7-9=success, 5-6=partial, 2-4=fail, 1=disaster.

COMBAT MANAGEMENT:
- When combat begins (shootout starts, enemies attack, firefight breaks out): [COMBAT_START]
- When combat ends (enemies flatlined, situation de-escalated, combat resolved): [COMBAT_END]
Include these tags when the combat state changes. Combat mode helps players track turns.

HP TRACKING:
- When a player takes damage or heals, update their HP: [HP: PlayerName | CurrentHP/MaxHP]
- Example: Player with 40 max HP takes 8 damage: [HP: V | 32/40]
- Always include this tag when HP changes during combat or healing.

INVENTORY MANAGEMENT:
- Each character's current inventory is shown in THE PARTY section above.
- When asked about inventory, refer to the inventory list shown - do NOT say it's empty if items are listed.
- Do NOT give players items they already have (check their inventory first).
- When a player gets a NEW item: [ITEM: PlayerName | ItemName | Quantity]
- When a player uses or loses an item: [REMOVE_ITEM: PlayerName | ItemName | Quantity]
Add these tags at the END of your response.

EDDIES (CURRENCY):
- When granting eddies (money), use: [GOLD: PlayerName | Amount]
- Money updates the character's wallet, NOT their inventory
- NEVER create "eddies" or "eurodollars" as inventory items
- Example: Receiving payment of 500 eddies → [GOLD: V | 500]
Add these tags at the END of your response.

CUSTOM ITEMS WITH FULL STATS:
When giving custom cyberware, weapons, or gear, include properties:
[ITEM: V | Mantis Blades | 1 | {"category":"weapon","type":"Cyberware","cost":15000,"damage":"2d6","damageType":"slashing","rarity":"uncommon","description":"Retractable arm blades for close combat"}]

Properties: category, type, cost (in eddies), damage, damageType, rarity, description, weight
For standard items, use simple format: [ITEM: PlayerName | ItemName | Quantity]

STATUS EFFECTS:
- When a player gains a status effect (stun, wounded, burning, etc): [STATUS: PlayerName | EffectName]
- When a status effect is removed or ends: [REMOVE_STATUS: PlayerName | EffectName]
Add these tags at the END of your response.

DROPPED ITEMS:
- System messages will show when players drop items from their inventory.
- IGNORE mundane item drops (kibble, ammo cans, common gear, basic meds). Do NOT acknowledge or respond to these drops. These are just inventory management and waste tokens.
- ONLY acknowledge dropped items if: the item is mission-critical, rare cyberware, OR contextually relevant to the current situation.
- Example: If a player drops a datachip during a heist, acknowledge it. If they just drop spare ammo, ignore it completely.`,
};

export interface CharacterInfo {
  playerName: string;
  characterName: string;
  stats: Record<string, unknown>;
  notes?: string | null;
  inventory?: string[];
}

export interface DroppedItemInfo {
  name: string;
  quantity: number;
}

export async function generateDMResponse(
  userMessage: string,
  room: Room,
  playerName: string,
  diceResult?: { expression: string; total: number; rolls: number[] },
  playerCount?: number,
  playerInventory?: { name: string; quantity: number }[],
  partyCharacters?: CharacterInfo[],
  droppedItems?: DroppedItemInfo[]
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.dnd;

  // Check cache for deterministic queries (rules, status)
  const { cacheable, isRulesQuery } = isCacheableQuery(userMessage);
  if (cacheable && !diceResult) {
    const cacheKey = getCacheKey(userMessage, gameSystem);
    const cached = getFromCache(cacheKey, isRulesQuery);
    if (cached) {
      console.log(`[Cache Hit] Returning cached response for: "${userMessage.slice(0, 50)}..." (rules: ${isRulesQuery})`);
      return cached;
    }
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (room.currentScene) {
    messages.push({ 
      role: "system", 
      content: `Current Scene: ${room.currentScene}` 
    });
  }

  // Add party characters context
  if (partyCharacters && partyCharacters.length > 0) {
    const charDescriptions = partyCharacters.map(c => {
      const statsStr = Object.entries(c.stats)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const inventoryStr = c.inventory && c.inventory.length > 0 
        ? `Inventory: ${c.inventory.join(", ")}` 
        : "Inventory: empty";
      const desc = `${c.playerName}'s character: ${c.characterName}`;
      const fullDesc = statsStr ? `${desc} (${statsStr})` : desc;
      return `${fullDesc}\n  ${inventoryStr}`;
    }).join("\n");
    messages.push({
      role: "system",
      content: `THE PARTY:\n${charDescriptions}`
    });
  } else if (playerCount !== undefined && playerCount > 0) {
    // Fallback to just player count if no character data
    messages.push({
      role: "system",
      content: `Party size: ${playerCount} player${playerCount > 1 ? "s" : ""} in this session.`
    });
  }

  // Add current player's inventory context
  if (playerInventory && playerInventory.length > 0) {
    const itemList = playerInventory.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
    messages.push({
      role: "system",
      content: `${playerName}'s inventory: ${itemList}`
    });
  }

  // Add dropped items context (items on the ground)
  if (droppedItems && droppedItems.length > 0) {
    const itemList = droppedItems.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
    messages.push({
      role: "system",
      content: `Items on the ground nearby: ${itemList}`
    });
  }

  const recentHistory = (room.messageHistory || []).slice(-15);
  for (const msg of recentHistory) {
    if (msg.type === "dm") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.type === "chat" || msg.type === "action" || msg.type === "roll") {
      let content = `${msg.playerName}: ${msg.content}`;
      // Include dice roll results so the AI can see them
      if (msg.diceResult) {
        content += ` [Rolled: ${msg.diceResult.expression} = [${msg.diceResult.rolls.join(", ")}] = ${msg.diceResult.total}]`;
      }
      messages.push({ role: "user", content });
    }
  }

  let currentMessage = `${playerName}: ${userMessage}`;
  if (diceResult) {
    currentMessage += `\n\n[Dice Roll: ${diceResult.expression} = [${diceResult.rolls.join(", ")}] = ${diceResult.total}]`;
  }
  messages.push({ role: "user", content: currentMessage });

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: 1000,
      temperature: cacheable ? 0.3 : 0.8, // Lower temperature for cacheable queries for consistency
    });

    trackTokenUsage(room.id, response.usage);
    const result = response.choices[0]?.message?.content || "The DM ponders silently...";

    // Cache the response if it was a cacheable query
    if (cacheable && !diceResult) {
      const cacheKey = getCacheKey(userMessage, gameSystem);
      addToCache(cacheKey, result, isRulesQuery);
      console.log(`[Cache Store] Cached response for: "${userMessage.slice(0, 50)}..." (rules: ${isRulesQuery}, TTL: ${isRulesQuery ? '1hr' : '5min'})`);
    }

    return result;
  } catch (error) {
    console.error("Grok API error:", error);
    throw new Error("Failed to get response from Grok DM");
  }
}

// Batched message type for multi-player responses
export interface BatchedMessage {
  playerName: string;
  content: string;
  type: "chat" | "action";
  diceResult?: { expression: string; total: number; rolls: number[] };
}

export async function generateBatchedDMResponse(
  batchedMessages: BatchedMessage[],
  room: Room,
  playerCount?: number,
  partyCharacters?: CharacterInfo[],
  droppedItems?: DroppedItemInfo[]
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.dnd;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (room.currentScene) {
    messages.push({ 
      role: "system", 
      content: `Current Scene: ${room.currentScene}` 
    });
  }

  if (partyCharacters && partyCharacters.length > 0) {
    const charDescriptions = partyCharacters.map(c => {
      const statsStr = Object.entries(c.stats)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const inventoryStr = c.inventory && c.inventory.length > 0 
        ? `Inventory: ${c.inventory.join(", ")}` 
        : "Inventory: empty";
      const desc = `${c.playerName}'s character: ${c.characterName}`;
      const fullDesc = statsStr ? `${desc} (${statsStr})` : desc;
      return `${fullDesc}\n  ${inventoryStr}`;
    }).join("\n");
    messages.push({
      role: "system",
      content: `THE PARTY:\n${charDescriptions}`
    });
  } else if (playerCount !== undefined && playerCount > 0) {
    messages.push({
      role: "system",
      content: `Party size: ${playerCount} player${playerCount > 1 ? "s" : ""} in this session.`
    });
  }

  // Add dropped items context (items on the ground)
  if (droppedItems && droppedItems.length > 0) {
    const itemList = droppedItems.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
    messages.push({
      role: "system",
      content: `Items on the ground nearby: ${itemList}`
    });
  }

  const recentHistory = (room.messageHistory || []).slice(-15);
  for (const msg of recentHistory) {
    if (msg.type === "dm") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.type === "chat" || msg.type === "action" || msg.type === "roll") {
      let content = `${msg.playerName}: ${msg.content}`;
      // Include dice roll results so the AI can see them
      if (msg.diceResult) {
        content += ` [Rolled: ${msg.diceResult.expression} = [${msg.diceResult.rolls.join(", ")}] = ${msg.diceResult.total}]`;
      }
      messages.push({ role: "user", content });
    }
  }

  // Format batched messages as a single user message
  const batchContent = batchedMessages.map(m => {
    let content = `${m.playerName}: ${m.content}`;
    if (m.diceResult) {
      content += ` [Rolled: ${m.diceResult.expression} = ${m.diceResult.total}]`;
    }
    return content;
  }).join("\n");

  messages.push({ 
    role: "user", 
    content: `[Multiple player actions this round]\n${batchContent}\n\n[Respond to all actions in one cohesive narrative response]` 
  });

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: 1200,
      temperature: 0.8,
    });

    trackTokenUsage(room.id, response.usage);
    console.log(`[Batched Response] Handled ${batchedMessages.length} messages in one API call`);
    return response.choices[0]?.message?.content || "The DM ponders silently...";
  } catch (error) {
    console.error("Grok API error:", error);
    throw new Error("Failed to get response from Grok DM");
  }
}

export async function generateSceneDescription(prompt: string, gameSystem: string = "dnd"): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.dnd;

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: systemPrompt + "\n\nDescribe this scene vividly in 2-3 paragraphs." },
        { role: "user", content: `Describe this scene: ${prompt}` },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content || "The scene unfolds before you...";
  } catch (error) {
    console.error("Scene generation error:", error);
    return "The scene unfolds before you...";
  }
}

export async function generateStartingScene(gameSystem: string, roomName: string): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.dnd;

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `New adventure "${roomName}" starting. Welcome the players briefly, then ask 2-3 quick questions: What kind of characters are you playing? What tone do you prefer (serious/lighthearted)? Any themes you'd like to explore or avoid? Keep it conversational and brief.` },
      ],
      max_tokens: 400,
      temperature: 0.9,
    });

    return response.choices[0]?.message?.content || "Welcome, adventurers! Before we begin, tell me about your characters.";
  } catch (error) {
    console.error("Starting scene error:", error);
    return "Welcome, adventurers! Tell me about your characters and what kind of adventure you're looking for.";
  }
}

// Generate enemy actions during combat when it's the DM's turn
export async function generateCombatDMTurn(
  room: Room,
  partyCharacters?: CharacterInfo[]
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.dnd;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { 
      role: "system", 
      content: systemPrompt + `\n\nCOMBAT TURN: It's now the enemies' turn in initiative order. Describe what the enemies do - their attacks, movements, abilities. Roll dice for enemy attacks and describe the results. Be brief but dramatic. Target specific player characters by name if known.`
    },
  ];

  if (room.currentScene) {
    messages.push({ 
      role: "system", 
      content: `Current Scene: ${room.currentScene}` 
    });
  }

  if (partyCharacters && partyCharacters.length > 0) {
    const charDescriptions = partyCharacters.map(c => {
      const statsStr = Object.entries(c.stats)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const desc = `${c.playerName}'s character: ${c.characterName}`;
      return statsStr ? `${desc} (${statsStr})` : desc;
    }).join("\n");
    messages.push({
      role: "system",
      content: `THE PARTY (your targets):\n${charDescriptions}`
    });
  }

  // Add recent combat history for context
  const recentHistory = (room.messageHistory || []).slice(-10);
  for (const msg of recentHistory) {
    if (msg.type === "dm") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.type === "chat" || msg.type === "action" || msg.type === "roll") {
      let content = `${msg.playerName}: ${msg.content}`;
      // Include dice roll results so the AI can see them
      if (msg.diceResult) {
        content += ` [Rolled: ${msg.diceResult.expression} = [${msg.diceResult.rolls.join(", ")}] = ${msg.diceResult.total}]`;
      }
      messages.push({ role: "user", content });
    }
  }

  messages.push({ 
    role: "user", 
    content: `[COMBAT - ENEMY TURN] The enemies act now. Describe their actions, roll their attacks, and narrate the results. Keep it brief and dramatic.` 
  });

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: 600,
      temperature: 0.8,
    });

    trackTokenUsage(room.id, response.usage);
    console.log(`[Combat DM Turn] Generated enemy actions for room ${room.id}`);
    return response.choices[0]?.message?.content || "The enemies prepare their next move...";
  } catch (error) {
    console.error("Combat DM turn error:", error);
    return "The enemies ready themselves for their next attack...";
  }
}
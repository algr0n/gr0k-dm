// Main entry point for Grok AI integration
// This module provides a clean interface to all AI functionality

import OpenAI from "openai";

// Initialize OpenAI client for xAI Grok API lazily/safely.
// In browser-like test environments (jsdom) the OpenAI client refuses to initialize —
// so only create the client when running in Node and when an API key is available.
export const openai: any = (typeof window === 'undefined' && process.env.XAI_API_KEY)
  ? new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: process.env.XAI_API_KEY })
  : null; // tests can stub/mock this as needed


// Re-export generators
export {
  generateDMResponse,
  generateBatchedDMResponse,
  generateCombatDMTurn,
  generateSceneDescription,
  generateStartingScene,
  type BatchedMessage,
} from "./generators";

// Re-export cache utilities
import { responseCache } from "./cache/response-cache";
export { responseCache };
export function getCacheStats(): { size: number; entries: string[] } {
  return responseCache.getStats();
}

// Re-export token tracking
import { tokenTracker } from "./utils/token-tracker";
export { tokenTracker, type TokenUsage } from "./utils/token-tracker";
export function getTokenUsage(roomId: string) {
  return tokenTracker.get(roomId);
}
export function getAllTokenUsage() {
  return tokenTracker.getAll();
}

// Re-export conversation summary utilities
export { 
  getOrCreateConversationSummary,
  summarizeConversation 
} from "./utils/conversation-summary";

// Re-export types from context builder
export type {
  AdventureContext,
  CharacterInfo,
  DroppedItemInfo,
  ItemInfo,
  DiceResult,
} from "./context/context-builder";

// =============================================================================
// NPC Stat Block Generation with AI
// =============================================================================

import type { NpcStatBlock } from "./npc-stats";
// Import the JSON extraction utility
import { extractJsonFromResponse } from "./npc-stats";
import type { Client } from "@libsql/client";

/**
 * Generate and save a monster to the bestiary using Grok AI
 * Returns the created monster detail for immediate use
 */
export async function generateAndSaveMonster(
  name: string,
  client: Client,
  context?: {
    role?: string;
    description?: string;
    personality?: string;
    environment?: string;
  }
): Promise<any | null> {
  // Return null if no API key available
  if (!openai) {
    console.warn(`[Monster Generation] No XAI_API_KEY, cannot generate ${name}`);
    return null;
  }

  const prompt = `Generate a D&D 5th Edition monster stat block for: ${name}

Context:
- Role: ${context?.role ?? "Unknown"}
- Description: ${context?.description ?? "A mysterious creature"}
- Personality: ${context?.personality ?? "Neutral"}
- Environment: ${context?.environment ?? "Various"}

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "name": "${name}",
  "size": "<Tiny|Small|Medium|Large|Huge|Gargantuan>",
  "type": "<aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead>",
  "subtype": "<optional subtype>",
  "alignment": "<alignment>",
  "armor_class": <number 10-20>,
  "armor_type": "<optional, e.g., 'natural armor'>",
  "hit_points": "<dice expression like '2d8 + 2'>",
  "speed": "<speed string like '30 ft., fly 60 ft.'>",
  "ability_scores": {
    "str": <3-20>,
    "dex": <3-20>,
    "con": <3-20>,
    "int": <3-20>,
    "wis": <3-20>,
    "cha": <3-20>
  },
  "saving_throws": { "<ability>": <bonus> },
  "skills": { "<skill>": <bonus> },
  "damage_resistances": "<optional>",
  "damage_immunities": "<optional>",
  "condition_immunities": "<optional>",
  "senses": "<senses string>",
  "languages": "<languages string>",
  "challenge_rating": "<CR like '1/2', '3', '10'>",
  "cr_decimal": <number 0-30>,
  "traits": [
    { "name": "<trait name>", "description": "<description>" }
  ],
  "actions": [
    {
      "name": "<action name>",
      "description": "<description>",
      "attack_bonus": <optional number>,
      "damage": "<optional dice expression>"
    }
  ],
  "legendary_actions": ["<optional legendary action text>"]
}

Make the stat block appropriate for the creature's role and description. Ensure all numbers are realistic for D&D 5e. Use the Monster Manual as a reference.`;

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [
        {
          role: "system",
          content: "You are a D&D 5e monster designer. Return only valid JSON with no markdown formatting, no code blocks, and no extra text. Follow the Monster Manual stat block structure.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4, // Balanced between consistency and creativity
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`[Monster Generation] Grok returned no content for ${name}`);
      return null;
    }

    // Extract JSON from response (handles markdown wrapping)
    const jsonStr = extractJsonFromResponse(content);
    
    // Parse JSON
    const monsterPayload = JSON.parse(jsonStr);
    
    // Import and use createMonster
    const { createMonster, getMonsterByName } = await import("./db/bestiary");
    
    // Save to database
    const monsterId = await createMonster(client, monsterPayload, {
      isGenerated: true,
      isPublished: false,
      createdBy: "grok",
      createdByType: "grok",
    });

    // Fetch the complete monster detail (with traits, actions, etc.)
    const savedMonster = await getMonsterByName(client, name);
    
    console.log(`[Monster Generation] Successfully created and saved: ${name} (id: ${monsterId})`);
    return savedMonster;
  } catch (error) {
    console.error(`[Monster Generation] Error generating ${name}:`, error);
    return null;
  }
}

/**
 * Generate an NPC stat block using Grok AI
 * Returns null if XAI_API_KEY is not available
 */
export async function generateNpcWithGrok(payload: {
  name: string;
  role?: string | null;
  description?: string | null;
  personality?: string | null;
  [key: string]: any;
}): Promise<NpcStatBlock | null> {
  // Return null if no API key available (triggers deterministic fallback)
  if (!openai) {
    return null;
  }

  const prompt = `Generate a D&D 5th Edition NPC stat block for combat use.

NPC Details:
- Name: ${payload.name}
- Role: ${payload.role || 'Unknown'}
- Description: ${payload.description || 'A generic NPC'}
- Personality: ${payload.personality || 'Neutral'}

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "abilities": {
    "strength": <number 3-20>,
    "dexterity": <number 3-20>,
    "constitution": <number 3-20>,
    "intelligence": <number 3-20>,
    "wisdom": <number 3-20>,
    "charisma": <number 3-20>
  },
  "modifiers": {
    "strength": <modifier>,
    "dexterity": <modifier>,
    "constitution": <modifier>,
    "intelligence": <modifier>,
    "wisdom": <modifier>,
    "charisma": <modifier>
  },
  "profBonus": <number 2-6>,
  "ac": <number 10-20>,
  "hp": <number 1-300>,
  "maxHp": <number 1-300>,
  "speed": "<string like '30 ft'>",
  "attacks": [
    {
      "name": "<attack name>",
      "attackBonus": <number>,
      "damage": "<dice expression like '1d8+3'>",
      "damageType": "<slashing/piercing/bludgeoning/etc>",
      "range": "<range string>"
    }
  ],
  "passivePerception": <number 10-25>,
  "skills": {
    "perception": <number>,
    "stealth": <number>
  },
  "notes": "Generated by Grok AI"
}

Make the stat block appropriate for the NPC's role and description. Ensure all numbers are realistic for D&D 5e.`;

  try {
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [
        {
          role: "system",
          content: "You are a D&D 5e stat block generator. Return only valid JSON with no markdown formatting, no code blocks, and no extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistent, reliable output
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[NPC Stats] Grok returned no content");
      return null;
    }

    // Extract JSON from response (handles markdown wrapping)
    const jsonStr = extractJsonFromResponse(content);
    
    // Parse JSON
    const statBlock = JSON.parse(jsonStr) as NpcStatBlock;
    
    // Validate required fields
    if (!statBlock.abilities || !statBlock.hp || !statBlock.ac || !statBlock.attacks) {
      console.warn("[NPC Stats] Grok returned invalid stat block structure");
      return null;
    }

    return statBlock;
  } catch (error) {
    console.error("[NPC Stats] Error calling Grok API:", error);
    return null;
  }
}
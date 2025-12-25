// Combat DM turn generator

import OpenAI from "openai";
import type { Client } from "@libsql/client";
import type { Room } from "@shared/schema";
import { tokenTracker } from "../utils/token-tracker";
import { ContextBuilder } from "../context/context-builder";
import type { CharacterInfo } from "../context/context-builder";
import { monsterCacheManager } from "../cache/monster-cache";

// Generate enemy actions during combat when it's the DM's turn
export async function generateCombatDMTurn(
  openaiClient: OpenAI,
  room: Room,
  partyCharacters?: CharacterInfo[],
  client?: Client,
  options?: { decisionOnly?: boolean; maxDecisions?: number }
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";

  const builder = new ContextBuilder();
  builder.addSystemPrompt(gameSystem);

  if (options?.decisionOnly) {
    builder.addCombatContext(`\n\nDECISION MODE: Provide a short, one-line decision for each enemy in initiative order (max ${options.maxDecisions ?? 3}). For each enemy, return: MonsterName -> action (e.g., 'Goblin -> Attack Alice with Scimitar'). Do NOT roll dice or resolve damage. Keep responses short and machine-parseable.`);
  } else {
    builder.addCombatContext(`\n\nCOMBAT TURN: It's now the enemies' turn in initiative order. Describe what the enemies do - their attacks, movements, abilities. Roll dice for enemy attacks and describe the results. Be brief but dramatic. Target specific player characters by name if known.`);
  }

  if (room.currentScene) {
    builder.addScene(room.currentScene);
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
    builder.addUserMessage(`THE PARTY (your targets):\n${charDescriptions}`);
  }

  // Add recent combat history for context
  builder.addMessageHistory(room.messageHistory || [], 10);

  // Add monster context from bestiary with caching
  if (client && room.messageHistory && room.messageHistory.length > 0) {
    // Try to extract monster names from recent messages
    const recentMessages = room.messageHistory.slice(-5);
    const monsterNames = extractMonsterNames(recentMessages);
    const cache = monsterCacheManager.getCache(room.id);
    
    for (const monsterName of monsterNames.slice(0, 3)) { // Limit to 3 monsters to avoid token bloat
      // Check cache first
      let cachedMonster = cache.get(monsterName);
      if (cachedMonster) {
        console.log(`[Combat Cache HIT] ${monsterName} in room ${room.id}`);
        await builder.addMonsterContext(monsterName, client, cachedMonster);
      } else {
        // Cache miss - fetch from DB
        console.log(`[Combat Cache MISS] ${monsterName} in room ${room.id}`);
        try {
          const { getMonsterByName } = await import("../db/bestiary");
          const fetchedMonster = await getMonsterByName(client, monsterName);
          if (fetchedMonster) {
            // Store in cache for next time
            cache.set(monsterName, fetchedMonster);
            await builder.addMonsterContext(monsterName, client, fetchedMonster);
          }
        } catch (error) {
          console.warn(`Failed to fetch monster ${monsterName}:`, error);
        }
      }
    }
    
    // Log cache statistics
    const stats = cache.getStats();
    console.log(`[Combat Cache Stats] Room: ${room.id}, Cached: ${stats.size}/${stats.maxSize}, Utilization: ${stats.utilization}%`);
  }

  const messages = builder.build();

  try {
    const response = await openaiClient.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: options?.decisionOnly ? 150 : 600,
      temperature: options?.decisionOnly ? 0.2 : 0.8,
    });

    tokenTracker.track(room.id, response.usage);
    console.log(`[Combat DM Turn] Generated enemy actions for room ${room.id}`);
    return response.choices[0]?.message?.content || (options?.decisionOnly ? "" : "The enemies prepare their next move...");
  } catch (error) {
    console.error("Combat DM turn error:", error);
    return options?.decisionOnly ? "" : "The enemies ready themselves for their next attack...";
  }
}

/**
 * Extract potential monster names from recent chat history
 */
function extractMonsterNames(messages: any[]): string[] {
  const monsterNames = new Set<string>();
  const commonMonsters = [
    "goblin", "orc", "ogre", "dragon", "troll", "skeleton", "zombie",
    "spider", "giant", "demon", "devil", "angel", "beholder", "owlbear",
    "wyvern", "basilisk", "manticore", "hydra", "lich", "vampire"
  ];
  
  for (const msg of messages) {
    const content = (msg.content || "").toLowerCase();
    for (const monster of commonMonsters) {
      if (content.includes(monster)) {
        monsterNames.add(monster.charAt(0).toUpperCase() + monster.slice(1));
      }
    }
  }
  
  return Array.from(monsterNames);
}

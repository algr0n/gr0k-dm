// DM response generator

import OpenAI from "openai";
import type { Room } from "@shared/schema";
import { responseCache } from "../cache/response-cache";
import { tokenTracker } from "../utils/token-tracker";
import { ContextBuilder } from "../context/context-builder";
import type { CharacterInfo, DroppedItemInfo, DiceResult } from "../context/context-builder";

export async function generateDMResponse(
  openaiClient: OpenAI,
  userMessage: string,
  room: Room,
  playerName: string,
  diceResult?: DiceResult,
  playerCount?: number,
  playerInventory?: { name: string; quantity: number }[],
  partyCharacters?: CharacterInfo[],
  droppedItems?: DroppedItemInfo[]
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";

  // Check cache for deterministic queries (rules, status)
  const { cacheable, isRulesQuery } = responseCache.isCacheable(userMessage);
  if (cacheable && !diceResult) {
    const cacheKey = responseCache.getCacheKey(userMessage, gameSystem);
    const cached = responseCache.get(cacheKey, isRulesQuery);
    if (cached) {
      console.log(`[Cache Hit] Returning cached response for: "${userMessage.slice(0, 50)}..." (rules: ${isRulesQuery})`);
      return cached;
    }
  }

  const builder = new ContextBuilder();
  builder.addSystemPrompt(gameSystem);

  if (room.currentScene) {
    builder.addScene(room.currentScene);
  }

  builder.addPartyCharacters(partyCharacters || [], playerCount);

  if (playerInventory) {
    builder.addInventory(playerName, playerInventory);
  }

  if (droppedItems) {
    builder.addDroppedItems(droppedItems);
  }

  builder.addMessageHistory(room.messageHistory || [], 15);
  builder.addCurrentMessage(playerName, userMessage, diceResult);

  const messages = builder.build();

  try {
    const response = await openaiClient.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: 1000,
      temperature: cacheable ? 0.3 : 0.8, // Lower temperature for cacheable queries for consistency
    });

    tokenTracker.track(room.id, response.usage);
    const result = response.choices[0]?.message?.content || "The DM ponders silently...";

    // Cache the response if it was a cacheable query
    if (cacheable && !diceResult) {
      const cacheKey = responseCache.getCacheKey(userMessage, gameSystem);
      responseCache.set(cacheKey, result, isRulesQuery);
      console.log(`[Cache Store] Cached response for: "${userMessage.slice(0, 50)}..." (rules: ${isRulesQuery}, TTL: ${isRulesQuery ? '1hr' : '5min'})`);
    }

    return result;
  } catch (error) {
    console.error("Grok API error:", error);
    throw new Error("Failed to get response from Grok DM");
  }
}

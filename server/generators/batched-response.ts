// Batched DM response generator for multi-player actions

import OpenAI from "openai";
import type { Client } from "@libsql/client";
import type { Room } from "@shared/schema";
import { tokenTracker } from "../utils/token-tracker";
import { getOrCreateConversationSummary } from "../utils/conversation-summary";
import { ContextBuilder } from "../context/context-builder";
import type { CharacterInfo, DroppedItemInfo, AdventureContext, DiceResult } from "../context/context-builder";

// Batched message type for multi-player responses
export interface BatchedMessage {
  playerName: string;
  content: string;
  type: "chat" | "action";
  diceResult?: DiceResult;
}

export async function generateBatchedDMResponse(
  openaiClient: OpenAI,
  batchedMessages: BatchedMessage[],
  room: Room,
  playerCount?: number,
  partyCharacters?: CharacterInfo[],
  droppedItems?: DroppedItemInfo[],
  adventureContext?: AdventureContext,
  client?: Client
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";

  const builder = new ContextBuilder();
  builder.addSystemPrompt(gameSystem);

  // Add adventure context if available
  if (adventureContext) {
    builder.addAdventureContext(adventureContext);
  }

  if (room.currentScene) {
    builder.addScene(room.currentScene);
  }

  builder.addPartyCharacters(partyCharacters || [], playerCount);

  if (droppedItems) {
    builder.addDroppedItems(droppedItems);
  }

  // Add conversation summary for long adventures (prevent hallucination)
  const messageHistory = room.messageHistory || [];
  if (messageHistory.length > 30) {
    const summary = await getOrCreateConversationSummary(openaiClient, room.id, messageHistory, gameSystem);
    if (summary) {
      builder.addConversationSummary(summary);
    }
  }

  // Use sliding window: keep last 15 messages for immediate context
  builder.addMessageHistory(messageHistory, 15);

  // Format batched messages as a single user message
  const batchContent = batchedMessages.map(m => {
    let content = `${m.playerName}: ${m.content}`;
    if (m.diceResult) {
      content += ` [Rolled: ${m.diceResult.expression} = ${m.diceResult.total}]`;
    }
    return content;
  }).join("\n");

  builder.addUserMessage(`[Multiple player actions this round]\n${batchContent}\n\n[Respond to all actions in one cohesive narrative response]`);

  const messages = builder.build();

  try {
    const response = await openaiClient.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: 1200,
      temperature: 0.8,
    });

    tokenTracker.track(room.id, response.usage);
    console.log(`[Batched Response] Handled ${batchedMessages.length} messages in one API call`);
    return response.choices[0]?.message?.content || "The DM ponders silently...";
  } catch (error) {
    console.error("Grok API error:", error);
    throw new Error("Failed to get response from Grok DM");
  }
}

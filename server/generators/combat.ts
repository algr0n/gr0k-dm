// Combat DM turn generator

import OpenAI from "openai";
import type { Room } from "@shared/schema";
import { tokenTracker } from "../utils/token-tracker";
import { ContextBuilder } from "../context/context-builder";
import type { CharacterInfo } from "../context/context-builder";

// Generate enemy actions during combat when it's the DM's turn
export async function generateCombatDMTurn(
  openaiClient: OpenAI,
  room: Room,
  partyCharacters?: CharacterInfo[]
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd";

  const builder = new ContextBuilder();
  builder.addSystemPrompt(gameSystem);
  builder.addCombatContext(`\n\nCOMBAT TURN: It's now the enemies' turn in initiative order. Describe what the enemies do - their attacks, movements, abilities. Roll dice for enemy attacks and describe the results. Be brief but dramatic. Target specific player characters by name if known.`);

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

  builder.addUserMessage(`[COMBAT - ENEMY TURN] The enemies act now. Describe their actions, roll their attacks, and narrate the results. Keep it brief and dramatic.`);

  const messages = builder.build();

  try {
    const response = await openaiClient.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages,
      max_tokens: 600,
      temperature: 0.8,
    });

    tokenTracker.track(room.id, response.usage);
    console.log(`[Combat DM Turn] Generated enemy actions for room ${room.id}`);
    return response.choices[0]?.message?.content || "The enemies prepare their next move...";
  } catch (error) {
    console.error("Combat DM turn error:", error);
    return "The enemies ready themselves for their next attack...";
  }
}

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

Style:
- Be brief. Get to the point quickly.
- Only describe what's immediately relevant
- End with a clear prompt for action
- Use short sentences. Avoid flowery prose.

Dice results: 20=amazing, 15-19=success, 10-14=partial, 5-9=struggle, 1=disaster.

INVENTORY: When a player picks up an item, add this at the END:
[ITEM: PlayerName | ItemName | Quantity]`,

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

INVENTORY: When a player gets an item, add at END:
[ITEM: PlayerName | ItemName | Quantity]`,
};

export interface CharacterInfo {
  playerName: string;
  characterName: string;
  stats: Record<string, unknown>;
  notes?: string | null;
}

export async function generateDMResponse(
  userMessage: string,
  room: Room,
  playerName: string,
  diceResult?: { expression: string; total: number; rolls: number[] },
  playerCount?: number,
  playerInventory?: { name: string; quantity: number }[],
  partyCharacters?: CharacterInfo[]
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

  // Add party characters context
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

  const recentHistory = (room.messageHistory || []).slice(-15);
  for (const msg of recentHistory) {
    if (msg.type === "dm") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.type === "chat" || msg.type === "action") {
      messages.push({ role: "user", content: `${msg.playerName}: ${msg.content}` });
    }
  }

  let currentMessage = `${playerName}: ${userMessage}`;
  if (diceResult) {
    currentMessage += `\n\n[Dice Roll: ${diceResult.expression} = [${diceResult.rolls.join(", ")}] = ${diceResult.total}]`;
  }
  messages.push({ role: "user", content: currentMessage });

  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages,
      max_tokens: 1000,
      temperature: 0.8,
    });

    trackTokenUsage(room.id, response.usage);
    return response.choices[0]?.message?.content || "The DM ponders silently...";
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
  partyCharacters?: CharacterInfo[]
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
      const desc = `${c.playerName}'s character: ${c.characterName}`;
      return statsStr ? `${desc} (${statsStr})` : desc;
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

  const recentHistory = (room.messageHistory || []).slice(-15);
  for (const msg of recentHistory) {
    if (msg.type === "dm") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.type === "chat" || msg.type === "action") {
      messages.push({ role: "user", content: `${msg.playerName}: ${msg.content}` });
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
      model: "grok-2-1212",
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
      model: "grok-2-1212",
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
      model: "grok-2-1212",
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

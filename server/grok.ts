import OpenAI from "openai";
import type { Room, Message, GameSystem } from "@shared/schema";

const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY 
});

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

export async function generateDMResponse(
  userMessage: string,
  room: Room,
  playerName: string,
  diceResult?: { expression: string; total: number; rolls: number[] }
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
        { role: "user", content: `Start a new adventure called "${roomName}". Set an exciting opening scene and welcome the players. End with a clear prompt for what they can do next.` },
      ],
      max_tokens: 600,
      temperature: 0.9,
    });

    return response.choices[0]?.message?.content || "Your adventure begins...";
  } catch (error) {
    console.error("Starting scene error:", error);
    return "Your adventure begins... Tell me what you'd like to do!";
  }
}

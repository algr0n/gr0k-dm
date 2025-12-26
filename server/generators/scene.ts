// Scene description generators

import OpenAI from "openai";
import { getSystemPrompt } from "../prompts";

export async function generateSceneDescription(
  openaiClient: OpenAI,
  prompt: string, 
  gameSystem: string = "dnd"
): Promise<string> {
  const systemPrompt = getSystemPrompt(gameSystem);

  try {
    const response = await openaiClient.chat.completions.create({
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

export async function generateStartingScene(
  openaiClient: OpenAI,
  gameSystem: string, 
  roomName: string,
  firstCharacter?: {
    characterName: string;
    class?: string | null;
    race?: string | null;
    level?: number;
    background?: string | null;
  }
): Promise<string> {
  const systemPrompt = getSystemPrompt(gameSystem);

  let userPrompt = `New adventure "${roomName}" starting.`;
  
  if (firstCharacter) {
    // Include character info in the prompt
    userPrompt += ` The first adventurer has arrived: ${firstCharacter.characterName}`;
    if (firstCharacter.race || firstCharacter.class) {
      const charDetails = [];
      if (firstCharacter.level) charDetails.push(`level ${firstCharacter.level}`);
      if (firstCharacter.race) charDetails.push(firstCharacter.race);
      if (firstCharacter.class) charDetails.push(firstCharacter.class);
      if (charDetails.length > 0) {
        userPrompt += ` (${charDetails.join(' ')})`;
      }
    }
    if (firstCharacter.background) {
      userPrompt += `, background: ${firstCharacter.background}`;
    }
    userPrompt += `. Welcome them by name and acknowledge their character details naturally. Then ask 1-2 quick questions about the tone they prefer (serious/lighthearted) and any themes they'd like to explore. Keep it warm, conversational, and brief (2-3 sentences max).`;
  } else {
    userPrompt += ` Welcome the players briefly, then ask 2-3 quick questions: What kind of characters are you playing? What tone do you prefer (serious/lighthearted)? Any themes you'd like to explore or avoid? Keep it conversational and brief.`;
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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

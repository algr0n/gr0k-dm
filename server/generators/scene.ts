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
  roomName: string
): Promise<string> {
  const systemPrompt = getSystemPrompt(gameSystem);

  try {
    const response = await openaiClient.chat.completions.create({
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

// Grok AI integration for TTRPG Dungeon Master - using xAI blueprint
import OpenAI from "openai";
import type { Character, GameSession, Message } from "@shared/schema";

const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY 
});

const DM_SYSTEM_PROMPT = `You are an experienced and creative Dungeon Master for a tabletop role-playing game. Your role is to:

1. **Narrate the Story**: Describe scenes vividly and immersively, creating a rich fantasy world.
2. **Control NPCs**: Voice and roleplay all non-player characters with distinct personalities.
3. **Manage Combat**: When combat occurs, describe actions dramatically and ask players for their actions.
4. **Track Progress**: Remember player choices and their consequences for continuity.
5. **Encourage Roleplay**: Engage players with interesting choices and consequences.
6. **Be Fair but Challenging**: Create challenges that are difficult but surmountable.

Guidelines:
- Keep responses engaging but concise (2-4 paragraphs typically)
- Use vivid sensory descriptions (sights, sounds, smells)
- End responses with a clear prompt for player action when appropriate
- React meaningfully to player choices and dice rolls
- Maintain a balance of combat, exploration, and roleplay
- Create memorable NPCs with distinct voices
- Never break character unless absolutely necessary

When players roll dice, interpret the results:
- Natural 20: Spectacular success with bonus effects
- 15-19: Clear success
- 10-14: Success with minor complications
- 5-9: Partial success or failure with opportunity
- 2-4: Failure with consequences
- Natural 1: Critical failure with dramatic consequences`;

export async function generateDMResponse(
  userMessage: string,
  character: Character | null,
  session: GameSession,
  diceResult?: { expression: string; total: number; rolls: number[] }
): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: DM_SYSTEM_PROMPT },
  ];

  // Add character context if available
  if (character) {
    const characterContext = `Current Player Character:
Name: ${character.name}
Race: ${character.race}
Class: ${character.characterClass}
Level: ${character.level}
HP: ${character.currentHp}/${character.maxHp}
AC: ${character.armorClass}
Stats: STR ${character.stats.strength}, DEX ${character.stats.dexterity}, CON ${character.stats.constitution}, INT ${character.stats.intelligence}, WIS ${character.stats.wisdom}, CHA ${character.stats.charisma}
${character.backstory ? `Backstory: ${character.backstory}` : ""}`;
    
    messages.push({ role: "system", content: characterContext });
  }

  // Add current scene context
  if (session.currentScene) {
    messages.push({ 
      role: "system", 
      content: `Current Scene: ${session.currentScene}` 
    });
  }

  // Add quest context
  const activeQuests = session.quests.filter(q => q.status === "active");
  if (activeQuests.length > 0) {
    const questContext = `Active Quests:\n${activeQuests.map(q => `- ${q.title}: ${q.description}`).join("\n")}`;
    messages.push({ role: "system", content: questContext });
  }

  // Add recent message history (limited to last 10 for context)
  const recentHistory = session.messageHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add the current message with dice result if applicable
  let currentMessage = userMessage;
  if (diceResult) {
    currentMessage = `${userMessage}\n\n[Dice Roll: ${diceResult.expression} = ${diceResult.rolls.join(" + ")} = ${diceResult.total}]`;
  }
  messages.push({ role: "user", content: currentMessage });

  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages,
      max_tokens: 1000,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content || "The Dungeon Master ponders silently...";
  } catch (error) {
    console.error("Grok API error:", error);
    throw new Error("Failed to get response from the Dungeon Master");
  }
}

export async function generateCharacterBackstory(
  name: string,
  race: string,
  characterClass: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: "You are a creative writer specializing in fantasy character backstories. Create compelling, brief backstories (2-3 paragraphs) for tabletop RPG characters.",
        },
        {
          role: "user",
          content: `Create a brief but compelling backstory for a ${race} ${characterClass} named ${name}. Include their motivation for adventuring and a hint at a personal goal or secret.`,
        },
      ],
      max_tokens: 400,
      temperature: 0.9,
    });

    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Grok API error:", error);
    return "";
  }
}

export async function generateQuestFromContext(
  session: GameSession,
  context: string
): Promise<{ title: string; description: string; objectives: { text: string; completed: boolean }[] } | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a Dungeon Master creating quests for a TTRPG. Based on the story context, create a new quest. Respond with JSON in this exact format:
{
  "title": "Quest Title",
  "description": "Brief quest description",
  "objectives": [
    {"text": "Objective 1", "completed": false},
    {"text": "Objective 2", "completed": false}
  ]
}`,
        },
        {
          role: "user",
          content: `Current scene: ${session.currentScene || "Unknown"}\nContext: ${context}\n\nCreate an appropriate quest based on this context.`,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
    return null;
  } catch (error) {
    console.error("Quest generation error:", error);
    return null;
  }
}

export async function generateSceneDescription(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: "You are a Dungeon Master. Describe scenes vividly with sensory details. Keep descriptions to 2-3 paragraphs.",
        },
        {
          role: "user",
          content: `Describe this scene: ${prompt}`,
        },
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

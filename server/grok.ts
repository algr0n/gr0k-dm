import OpenAI from "openai";
import type { Room, Message, GameSystem } from "@shared/schema";

const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY 
});

const SYSTEM_PROMPTS: Record<string, string> = {
  dnd5e: `You are Grok, an experienced and creative Dungeon Master for Dungeons & Dragons 5th Edition. Your role is to:

1. **Narrate the Story**: Describe scenes vividly and immersively, creating a rich fantasy world.
2. **Control NPCs**: Voice and roleplay all non-player characters with distinct personalities.
3. **Manage Combat**: When combat occurs, describe actions dramatically and guide players.
4. **Track Progress**: Remember player choices and their consequences.
5. **Encourage Roleplay**: Engage players with interesting choices and consequences.
6. **Handle Dice**: When players roll dice, interpret the results dramatically.

Guidelines:
- Keep responses engaging but concise (2-4 paragraphs typically)
- Use vivid sensory descriptions (sights, sounds, smells)
- End responses with a clear prompt for player action when appropriate
- React meaningfully to player choices and dice rolls
- Create memorable NPCs with distinct voices
- Be helpful with rules when asked

Dice interpretation:
- Natural 20: Spectacular success with bonus effects
- 15-19: Clear success
- 10-14: Success with minor complications
- 5-9: Partial success or failure with opportunity
- 2-4: Failure with consequences
- Natural 1: Critical failure with dramatic consequences`,

  cyberpunk: `You are Grok, a gritty Game Master for Cyberpunk RED set in Night City, 2045. Your role is to:

1. **Narrate the Story**: Describe scenes with neon-soaked, gritty cyberpunk atmosphere.
2. **Control NPCs**: Voice fixers, corpos, gangers, netrunners with distinct attitudes.
3. **Manage Combat**: Describe the brutality of chrome and lead.
4. **Track Progress**: Remember contacts, enemies, and reputation.
5. **Embrace the Genre**: Corporate conspiracies, street survival, cyberware, humanity cost.

Setting:
- Night City: Megacity divided by corporate towers and combat zones
- Technology: Cyberware, netrunning, braindance, smart weapons
- Factions: Arasaka, Militech, Maelstrom, Valentinos, Tyger Claws

Guidelines:
- Use cyberpunk slang naturally (choom, preem, nova, delta, flatline, eddies, chrome)
- Describe neon lights, holographic ads, synth-food, gun oil
- Keep it punchy and atmospheric

Dice interpretation (d10 system):
- 10: Critical success
- 7-9: Success with style
- 5-6: Partial success
- 2-4: Failure with consequences
- 1: Critical failure`,

  daggerheart: `You are Grok, a compassionate Game Master for Daggerheart. Your role is to:

1. **Narrate with Heart**: Focus on character emotions and relationships alongside action.
2. **Manage Fear & Hope**: Track the tension between these narrative forces.
3. **Control NPCs**: Give each character emotional depth and motivation.
4. **Encourage Drama**: Let players' choices create meaningful consequences.

Guidelines:
- Balance action with emotional beats
- Use the Fear/Hope mechanics to create tension
- Celebrate character moments and growth
- Keep combat cinematic but meaningful`,

  pathfinder: `You are Grok, a knowledgeable Game Master for Pathfinder 2nd Edition. Your role is to:

1. **Master the Rules**: Help players navigate Pathfinder's tactical depth.
2. **Narrate Vividly**: Describe Golarion's rich fantasy world.
3. **Run Tactical Combat**: Guide players through the three-action economy.
4. **Track Conditions**: Manage status effects and modifiers.

Guidelines:
- Be helpful with rules clarifications
- Describe combat tactically and dramatically
- Use Golarion lore when appropriate
- Encourage creative use of the action economy`,

  coc: `You are Grok, a chilling Keeper for Call of Cthulhu. Your role is to:

1. **Build Dread**: Create atmosphere of cosmic horror and mounting tension.
2. **Investigate Mysteries**: Guide players through investigation and revelation.
3. **Manage Sanity**: Track the psychological toll of forbidden knowledge.
4. **Control NPCs**: Portray cultists, scholars, and things that should not be.

Guidelines:
- Describe horrors obliquely - suggestion over explicit description
- Build tension through investigation before confrontation
- Track sanity meaningfully
- The unknown is more terrifying than the known`,

  custom: `You are Grok, a flexible and creative Game Master. Adapt your style to whatever system or setting the players describe. Your role is to:

1. **Listen and Adapt**: Match the tone and genre the players want.
2. **Narrate Creatively**: Describe scenes vividly in whatever style fits.
3. **Support Play**: Help players with rules, narration, or improv as needed.
4. **Be Collaborative**: Work with players to build the story together.

Guidelines:
- Ask clarifying questions about the setting or system if needed
- Be flexible with rules interpretations
- Focus on fun and collaborative storytelling`,
};

export async function generateDMResponse(
  userMessage: string,
  room: Room,
  playerName: string,
  diceResult?: { expression: string; total: number; rolls: number[] }
): Promise<string> {
  const gameSystem = room.gameSystem || "dnd5e";
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.custom;
  
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

export async function generateSceneDescription(prompt: string, gameSystem: string = "dnd5e"): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.custom;
  
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
  const systemPrompt = SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.custom;
  
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

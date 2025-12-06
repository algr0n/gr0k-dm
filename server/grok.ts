// Grok AI integration for TTRPG - using xAI blueprint
import OpenAI from "openai";
import type { Character, GameSession, Message, DndStats, CyberpunkStats } from "@shared/schema";

const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY 
});

const DND_SYSTEM_PROMPT = `You are an experienced and creative Dungeon Master for a Dungeons & Dragons tabletop role-playing game. Your role is to:

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

const CYBERPUNK_SYSTEM_PROMPT = `You are an experienced Game Master for Cyberpunk RED tabletop role-playing game set in Night City, 2045. Your role is to:

1. **Narrate the Story**: Describe scenes with gritty, neon-soaked atmosphere. Focus on the contrast between high technology and low life.
2. **Control NPCs**: Voice fixers, corpos, gangers, netrunners, and street samurai with distinct cyberpunk attitudes.
3. **Manage Combat**: When combat occurs, describe the brutality of chrome and lead. Ask players for their actions.
4. **Track Progress**: Remember player choices, contacts, enemies, and reputation.
5. **Embrace the Genre**: Corporate conspiracies, street-level survival, cybernetic enhancement, and the cost of humanity.
6. **Be Gritty but Fair**: Night City is dangerous, but clever players can survive and thrive.

Setting Details:
- Night City: A sprawling megacity divided into corporate towers, combat zones, and everything in between
- Technology: Cyberware, netrunning, braindance, smart weapons, vehicles
- Factions: Corporations (Arasaka, Militech), gangs (Maelstrom, Valentinos, Tyger Claws), fixers, nomads
- Themes: Transhumanism, corporate control, street survival, the price of technology

Guidelines:
- Keep responses punchy and atmospheric (2-4 paragraphs)
- Use cyberpunk slang naturally (choom, preem, nova, delta, flatline, eddies, chrome)
- Describe neon lights, holographic ads, the smell of synth-food and gun oil
- End responses with clear options or tension
- React meaningfully to player choices and dice rolls
- Create memorable characters with cyberpunk edge

When players roll dice, interpret the results (1d10 system):
- 10: Critical success - things go very right
- 7-9: Success with style
- 5-6: Partial success or complication
- 2-4: Failure with consequences
- 1: Critical failure - things go very wrong`;

function isDndStats(stats: DndStats | CyberpunkStats): stats is DndStats {
  return 'strength' in stats;
}

function formatCharacterStats(character: Character): string {
  if (isDndStats(character.stats)) {
    const s = character.stats;
    return `Stats: STR ${s.strength}, DEX ${s.dexterity}, CON ${s.constitution}, INT ${s.intelligence}, WIS ${s.wisdom}, CHA ${s.charisma}`;
  } else {
    const s = character.stats;
    return `Stats: INT ${s.int}, REF ${s.ref}, DEX ${s.dex}, TECH ${s.tech}, COOL ${s.cool}, WILL ${s.will}, LUCK ${s.luck}, MOVE ${s.move}, BODY ${s.body}, EMP ${s.emp}`;
  }
}

export async function generateDMResponse(
  userMessage: string,
  character: Character | null,
  session: GameSession,
  diceResult?: { expression: string; total: number; rolls: number[] }
): Promise<string> {
  const gameSystem = session.gameSystem || "dnd";
  const systemPrompt = gameSystem === "cyberpunk" ? CYBERPUNK_SYSTEM_PROMPT : DND_SYSTEM_PROMPT;
  
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (character) {
    const roleLabel = gameSystem === "cyberpunk" ? "Role" : "Class";
    const characterContext = `Current Player Character:
Name: ${character.name}
${gameSystem === "cyberpunk" ? "Background" : "Race"}: ${character.race}
${roleLabel}: ${character.characterClass}
Level: ${character.level}
HP: ${character.currentHp}/${character.maxHp}
${gameSystem === "cyberpunk" ? "SP (Armor)" : "AC"}: ${character.armorClass}
${formatCharacterStats(character)}
${character.backstory ? `Backstory: ${character.backstory}` : ""}`;
    
    messages.push({ role: "system", content: characterContext });
  }

  if (session.currentScene) {
    messages.push({ 
      role: "system", 
      content: `Current Scene: ${session.currentScene}` 
    });
  }

  const activeQuests = session.quests.filter(q => q.status === "active");
  if (activeQuests.length > 0) {
    const questLabel = gameSystem === "cyberpunk" ? "Active Gigs" : "Active Quests";
    const questContext = `${questLabel}:\n${activeQuests.map(q => `- ${q.title}: ${q.description}`).join("\n")}`;
    messages.push({ role: "system", content: questContext });
  }

  const recentHistory = session.messageHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

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

    const fallback = gameSystem === "cyberpunk" 
      ? "The fixer stares at you silently, chrome eyes glinting..."
      : "The Dungeon Master ponders silently...";
    return response.choices[0]?.message?.content || fallback;
  } catch (error) {
    console.error("Grok API error:", error);
    throw new Error(gameSystem === "cyberpunk" 
      ? "Failed to get response from the Game Master" 
      : "Failed to get response from the Dungeon Master");
  }
}

export async function generateCharacterBackstory(
  name: string,
  race: string,
  characterClass: string,
  gameSystem: string = "dnd"
): Promise<string> {
  try {
    const prompt = gameSystem === "cyberpunk"
      ? `Create a brief but compelling backstory for a ${race} ${characterClass} named ${name} in Night City, 2045. Include their motivation for running the edge and a hint at a personal goal, enemy, or secret. Use cyberpunk themes and slang.`
      : `Create a brief but compelling backstory for a ${race} ${characterClass} named ${name}. Include their motivation for adventuring and a hint at a personal goal or secret.`;
    
    const systemContent = gameSystem === "cyberpunk"
      ? "You are a creative writer specializing in cyberpunk character backstories. Create compelling, brief backstories (2-3 paragraphs) for Cyberpunk RED characters in Night City."
      : "You are a creative writer specializing in fantasy character backstories. Create compelling, brief backstories (2-3 paragraphs) for tabletop RPG characters.";

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt },
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
    const gameSystem = session.gameSystem || "dnd";
    const systemContent = gameSystem === "cyberpunk"
      ? `You are a Cyberpunk RED Game Master creating gigs for edgerunners. Based on the story context, create a new gig (job/mission). Respond with JSON in this exact format:
{
  "title": "Gig Title",
  "description": "Brief gig description - what the job is and who's paying",
  "objectives": [
    {"text": "Objective 1", "completed": false},
    {"text": "Objective 2", "completed": false}
  ]
}`
      : `You are a Dungeon Master creating quests for a TTRPG. Based on the story context, create a new quest. Respond with JSON in this exact format:
{
  "title": "Quest Title",
  "description": "Brief quest description",
  "objectives": [
    {"text": "Objective 1", "completed": false},
    {"text": "Objective 2", "completed": false}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: `Current scene: ${session.currentScene || "Unknown"}\nContext: ${context}\n\nCreate an appropriate ${gameSystem === "cyberpunk" ? "gig" : "quest"} based on this context.`,
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

export async function generateSceneDescription(prompt: string, gameSystem: string = "dnd"): Promise<string> {
  try {
    const systemContent = gameSystem === "cyberpunk"
      ? "You are a Cyberpunk RED Game Master. Describe scenes with neon-lit, gritty cyberpunk atmosphere. Include sensory details - the hum of neon, the smell of synth-food, the chrome of cyberware. Keep descriptions to 2-3 paragraphs."
      : "You are a Dungeon Master. Describe scenes vividly with sensory details. Keep descriptions to 2-3 paragraphs.";

    const response = await openai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: `Describe this scene: ${prompt}` },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const fallback = gameSystem === "cyberpunk"
      ? "The neon lights flicker as the scene unfolds..."
      : "The scene unfolds before you...";
    return response.choices[0]?.message?.content || fallback;
  } catch (error) {
    console.error("Scene generation error:", error);
    return gameSystem === "cyberpunk"
      ? "The neon lights flicker as the scene unfolds..."
      : "The scene unfolds before you...";
  }
}

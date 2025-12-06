// Discord bot integration using Replit Discord connector
import { Client, GatewayIntentBits, Events, Message as DiscordMessage } from "discord.js";
import { storage } from "./storage";
import { parseDiceExpression, extractDiceFromText } from "./dice";
import { generateDMResponse, generateCharacterBackstory } from "./grok";
import type { Message, CharacterStats, DndStats, CyberpunkStats, GameSystem } from "@shared/schema";
import { randomUUID } from "crypto";

// Track user's selected game system per channel (default to D&D)
const channelGameSystems: Map<string, GameSystem> = new Map();

// Helper to check if stats are D&D style
function isDndStats(stats: CharacterStats): stats is DndStats {
  return 'strength' in stats;
}

// Helper to format character stats based on game system
function formatStats(stats: CharacterStats, gameSystem: string): string {
  if (isDndStats(stats)) {
    return Object.entries(stats)
      .map(([stat, val]) => `${stat.slice(0, 3).toUpperCase()}: ${val}`)
      .join(" | ");
  } else {
    const s = stats as CyberpunkStats;
    return `INT ${s.int} | REF ${s.ref} | DEX ${s.dex} | TECH ${s.tech} | COOL ${s.cool} | WILL ${s.will} | LUCK ${s.luck} | MOVE ${s.move} | BODY ${s.body} | EMP ${s.emp}`;
  }
}

let connectionSettings: any;
let discordClient: Client | null = null;
let botStatus = {
  isOnline: false,
  connectedGuilds: 0,
  activeGames: 0,
  totalCharacters: 0,
  lastActivity: undefined as string | undefined,
};

async function getAccessToken() {
  // Use dev token in development, production token in production
  const isDev = process.env.NODE_ENV === "development";
  const token = isDev 
    ? process.env.DISCORD_DEV_BOT_TOKEN 
    : process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    const envVar = isDev ? "DISCORD_DEV_BOT_TOKEN" : "DISCORD_BOT_TOKEN";
    throw new Error(`${envVar} environment variable not set`);
  }
  
  console.log(`Using ${isDev ? "development" : "production"} Discord bot`);
  return token;
}

export function getBotStatus() {
  return { ...botStatus };
}

export async function updateBotStatus() {
  const sessions = await storage.getActiveSessions();
  const characters = await storage.getAllCharacters();
  
  botStatus.activeGames = sessions.length;
  botStatus.totalCharacters = characters.length;
  
  if (discordClient?.isReady()) {
    botStatus.isOnline = true;
    botStatus.connectedGuilds = discordClient.guilds.cache.size;
  }
  
  return botStatus;
}

async function handleCommand(message: DiscordMessage, command: string, args: string[]) {
  const userId = message.author.id;
  const username = message.author.username;
  const channelId = message.channel.id;
  const guildId = message.guild?.id;

  botStatus.lastActivity = new Date().toISOString();

  // Get current game system for channel
  const currentSystem = channelGameSystems.get(channelId) || "dnd";

  switch (command) {
    case "help": {
      const systemName = currentSystem === "cyberpunk" ? "Cyberpunk RED" : "D&D 5e";
      const helpText = `**Grok DM - AI Game Master** (${systemName})

**System Commands:**
\`!menu\` - Show main menu with game system options
\`!dnd\` - Switch to D&D 5e
\`!cyberpunk\` - Switch to Cyberpunk RED

**Game Commands:**
\`!start [name]\` - Start a new adventure
\`!scene\` - Describe the current scene
\`!action [text]\` - Perform an action
\`!say [text]\` - Say something in character

**Character Commands:**
\`!create\` - Create a new character
\`!characters\` - View all your saved characters
\`!play [name/#]\` - Play as a saved character
\`!character\` - View your active character
\`!stats\` - View your stats
\`!inventory\` - Check your inventory
\`!delete\` - Delete your character

**Dice Commands:**
\`!roll [dice]\` - Roll dice (e.g., !roll 2d6+3)

**${currentSystem === "cyberpunk" ? "Gig" : "Quest"} Commands:**
\`!quest\` - View your ${currentSystem === "cyberpunk" ? "gigs" : "quests"}

Or just chat naturally - I'll respond as your ${currentSystem === "cyberpunk" ? "GM" : "DM"}!`;
      
      await message.reply(helpText);
      break;
    }

    case "menu": {
      const activeSystem = channelGameSystems.get(channelId) || "dnd";
      const menuText = `**Grok DM - Main Menu**

**Current Game System:** ${activeSystem === "cyberpunk" ? "Cyberpunk RED" : "D&D 5e"}

**Switch Game System:**
\`!dnd\` - Play Dungeons & Dragons 5e
\`!cyberpunk\` - Play Cyberpunk RED

**Quick Start:**
\`!create\` - Create a new character
\`!start\` - Begin a new adventure
\`!help\` - View all commands

*Choose your world, choom!*`;
      
      await message.reply(menuText);
      break;
    }

    case "dnd": {
      channelGameSystems.set(channelId, "dnd");
      // Reset session if one exists to prevent mixed narratives
      const existingSession = await storage.getSessionByChannel(channelId);
      if (existingSession && existingSession.gameSystem !== "dnd") {
        await storage.updateSession(existingSession.id, { 
          gameSystem: "dnd",
          messageHistory: [],
          currentScene: null,
          quests: [],
        });
      }
      // Deactivate any active character that doesn't match the new system
      const activeChar = await storage.getActiveCharacterByDiscordUser(userId);
      if (activeChar && activeChar.gameSystem !== "dnd") {
        await storage.updateCharacter(activeChar.id, { isActive: false });
      }
      await message.reply(`**Game System Changed: D&D 5e**

Welcome to the realm of fantasy! Swords, sorcery, and dragons await.

Use \`!create\` to make a new character, or \`!start\` to begin an adventure.`);
      break;
    }

    case "cyberpunk": {
      channelGameSystems.set(channelId, "cyberpunk");
      // Reset session if one exists to prevent mixed narratives
      const existingSession = await storage.getSessionByChannel(channelId);
      if (existingSession && existingSession.gameSystem !== "cyberpunk") {
        await storage.updateSession(existingSession.id, { 
          gameSystem: "cyberpunk",
          messageHistory: [],
          currentScene: null,
          quests: [],
        });
      }
      // Deactivate any active character that doesn't match the new system
      const activeChar = await storage.getActiveCharacterByDiscordUser(userId);
      if (activeChar && activeChar.gameSystem !== "cyberpunk") {
        await storage.updateCharacter(activeChar.id, { isActive: false });
      }
      await message.reply(`**Game System Changed: Cyberpunk RED**

Welcome to Night City, 2045. Chrome, neon, and corporate warfare await.

Use \`!create\` to make a new edgerunner, or \`!start\` to begin a gig.`);
      break;
    }

    case "start": {
      const sessionName = args.join(" ") || (currentSystem === "cyberpunk" ? "New Gig" : "New Adventure");
      
      let session = await storage.getSessionByChannel(channelId);
      if (!session) {
        session = await storage.createSession({
          discordChannelId: channelId,
          discordGuildId: guildId ?? null,
          name: sessionName,
          description: `${currentSystem === "cyberpunk" ? "Gig" : "Adventure"} started by ${username}`,
          messageHistory: [],
          quests: [],
          isActive: true,
          gameSystem: currentSystem,
        });
      } else if (session.gameSystem !== currentSystem) {
        // Update session game system if it changed
        await storage.updateSession(session.id, { gameSystem: currentSystem });
        session = { ...session, gameSystem: currentSystem };
      }

      const intro = await generateDMResponse(
        "Start a new adventure. Set the scene for the beginning of an epic journey.",
        await storage.getActiveCharacterByDiscordUser(userId) ?? null,
        session
      );

      await storage.updateSession(session.id, {
        currentScene: "The adventure begins...",
        messageHistory: [
          ...session.messageHistory,
          { id: randomUUID(), role: "assistant", content: intro, timestamp: new Date().toISOString() }
        ],
      });

      await message.reply(intro);
      break;
    }

    case "create": {
      if (currentSystem === "cyberpunk") {
        await message.reply(`**Edgerunner Creation** (Cyberpunk RED)

Let's build your street legend! Reply with your choices:

**Step 1:** What is your character's name?
**Step 2:** Choose a background: Streetkid, Corporate, Nomad
**Step 3:** Choose a role:
- **Solo** - Combat specialist, hired muscle
- **Netrunner** - Hacker, data thief
- **Tech** - Mechanic, inventor
- **Rockerboy** - Musician, influencer, rebel
- **Media** - Journalist, truth-seeker
- **Nomad** - Road warrior, family clan
- **Fixer** - Broker, deal-maker
- **Cop** - Lawman (or ex-lawman)
- **Exec** - Corporate climber
- **Medtech** - Street doc, healer

Format: \`!newchar [name] [background] [role]\`
Example: \`!newchar V Streetkid Solo\``);
      } else {
        await message.reply(`**Character Creation** (D&D 5e)

Let's create your character! Reply with your choices:

**Step 1:** What is your character's name?
**Step 2:** Choose a race: Human, Elf, Dwarf, Halfling, Gnome, Half-Elf, Half-Orc, Tiefling, Dragonborn
**Step 3:** Choose a class: Fighter, Wizard, Rogue, Cleric, Ranger, Paladin, Barbarian, Bard, Druid, Monk, Sorcerer, Warlock

Format: \`!newchar [name] [race] [class]\`
Example: \`!newchar Thorin Dwarf Fighter\``);
      }
      break;
    }

    case "newchar": {
      if (args.length < 3) {
        if (currentSystem === "cyberpunk") {
          await message.reply("Usage: `!newchar [name] [background] [role]`\nExample: `!newchar V Streetkid Solo`");
        } else {
          await message.reply("Usage: `!newchar [name] [race] [class]`\nExample: `!newchar Thorin Dwarf Fighter`");
        }
        return;
      }

      const name = args[0];
      const race = args[1]; // Background for Cyberpunk, Race for D&D
      const characterClass = args[2]; // Role for Cyberpunk, Class for D&D

      let stats: CharacterStats;
      let maxHp: number;
      let armorClass: number;
      let inventory: { id: string; name: string; type: "weapon" | "armor" | "potion" | "misc" | "gold"; quantity: number }[];

      if (currentSystem === "cyberpunk") {
        // Cyberpunk RED stats: Roll 1d10 for each, minimum 2
        const rollCyberpunkStat = () => Math.max(2, Math.floor(Math.random() * 10) + 1);
        
        const cyberpunkStats: CyberpunkStats = {
          int: rollCyberpunkStat(),
          ref: rollCyberpunkStat(),
          dex: rollCyberpunkStat(),
          tech: rollCyberpunkStat(),
          cool: rollCyberpunkStat(),
          will: rollCyberpunkStat(),
          luck: rollCyberpunkStat(),
          move: rollCyberpunkStat(),
          body: rollCyberpunkStat(),
          emp: rollCyberpunkStat(),
        };
        stats = cyberpunkStats;
        
        // HP in Cyberpunk RED = 10 + (BODY + WILL) / 2
        maxHp = 10 + Math.floor((cyberpunkStats.body + cyberpunkStats.will) / 2);
        armorClass = 11; // Base SP (Stopping Power)
        
        inventory = [
          { id: randomUUID(), name: "Agent (Phone)", type: "misc", quantity: 1 },
          { id: randomUUID(), name: "Eddies", type: "gold", quantity: 500 },
          { id: randomUUID(), name: "Light Armorjack", type: "armor", quantity: 1 },
        ];
      } else {
        // D&D stats: 4d6 drop lowest
        const rollStat = () => {
          const rolls = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
          rolls.sort((a, b) => b - a);
          return rolls.slice(0, 3).reduce((a, b) => a + b, 0);
        };

        const dndStats: DndStats = {
          strength: rollStat(),
          dexterity: rollStat(),
          constitution: rollStat(),
          intelligence: rollStat(),
          wisdom: rollStat(),
          charisma: rollStat(),
        };
        stats = dndStats;

        const conModifier = Math.floor((dndStats.constitution - 10) / 2);
        maxHp = 10 + conModifier;
        armorClass = 10 + Math.floor((dndStats.dexterity - 10) / 2);
        
        inventory = [
          { id: randomUUID(), name: "Traveler's Pack", type: "misc", quantity: 1 },
          { id: randomUUID(), name: "Gold Coins", type: "gold", quantity: 15 },
        ];
      }

      // Generate backstory with game system context
      const backstory = await generateCharacterBackstory(name, race, characterClass, currentSystem);

      // Deactivate all existing characters for this user before creating new one
      const existingChars = await storage.getCharactersByDiscordUser(userId);
      for (const char of existingChars) {
        if (char.isActive) {
          await storage.updateCharacter(char.id, { isActive: false });
        }
      }

      const character = await storage.createCharacter({
        discordUserId: userId,
        discordUsername: username,
        name,
        race,
        characterClass,
        level: 1,
        currentHp: maxHp,
        maxHp,
        armorClass,
        stats,
        inventory,
        backstory: backstory || undefined,
        isActive: true,
        gameSystem: currentSystem,
      });

      let statBlock: string;
      let replyText: string;

      if (currentSystem === "cyberpunk") {
        const s = stats as CyberpunkStats;
        statBlock = `INT ${s.int} | REF ${s.ref} | DEX ${s.dex} | TECH ${s.tech} | COOL ${s.cool}\nWILL ${s.will} | LUCK ${s.luck} | MOVE ${s.move} | BODY ${s.body} | EMP ${s.emp}`;
        
        replyText = `**Edgerunner Created!**

**${character.name}** - ${character.race} ${character.characterClass}
HP: ${character.currentHp}/${character.maxHp} | SP: ${character.armorClass}
${statBlock}

${backstory ? `*${backstory.substring(0, 300)}${backstory.length > 300 ? "..." : ""}*` : ""}

Time to hit the streets, choom! Use \`!start\` to begin a gig.`;
      } else {
        const s = stats as DndStats;
        statBlock = Object.entries(s)
          .map(([stat, val]) => `${stat.slice(0, 3).toUpperCase()}: ${val} (${val >= 10 ? "+" : ""}${Math.floor((val - 10) / 2)})`)
          .join(" | ");

        replyText = `**Character Created!**

**${character.name}** - Level ${character.level} ${character.race} ${character.characterClass}
HP: ${character.currentHp}/${character.maxHp} | AC: ${character.armorClass}
${statBlock}

${backstory ? `*${backstory.substring(0, 300)}${backstory.length > 300 ? "..." : ""}*` : ""}

Your adventure awaits! Use \`!start\` to begin.`;
      }

      await message.reply(replyText);
      break;
    }

    case "characters":
    case "chars": {
      // Get characters by both user ID and username
      const byId = await storage.getCharactersByDiscordUser(userId);
      const byUsername = await storage.getCharactersByDiscordUsername(username);
      
      // Merge and deduplicate
      const seenIds = new Set<string>();
      const userCharacters = [...byId, ...byUsername].filter(char => {
        if (seenIds.has(char.id)) return false;
        seenIds.add(char.id);
        return true;
      });
      
      if (userCharacters.length === 0) {
        await message.reply("You don't have any saved characters! Use `!create` to make one.");
        return;
      }

      const activeChar = userCharacters.find(c => c.isActive);
      const charList = userCharacters.map((char, index) => {
        const activeMarker = char.isActive ? " [ACTIVE]" : "";
        return `**${index + 1}.** ${char.name} - Level ${char.level} ${char.race} ${char.characterClass}${activeMarker}`;
      }).join("\n");

      await message.reply(`**Your Characters:**\n\n${charList}\n\nUse \`!play [name or #]\` to switch characters.`);
      break;
    }

    case "play":
    case "switch": {
      // Get characters by both user ID and username
      const byId = await storage.getCharactersByDiscordUser(userId);
      const byUsername = await storage.getCharactersByDiscordUsername(username);
      
      // Merge and deduplicate
      const seenIds = new Set<string>();
      const userCharacters = [...byId, ...byUsername].filter(char => {
        if (seenIds.has(char.id)) return false;
        seenIds.add(char.id);
        return true;
      });
      
      if (userCharacters.length === 0) {
        await message.reply("You don't have any characters! Use `!create` to make one.");
        return;
      }

      if (args.length === 0) {
        await message.reply("Usage: `!play [character name or number]`\nExample: `!play Thorin` or `!play 1`");
        return;
      }

      const input = args.join(" ");
      let selectedChar;

      // Check if input is a number
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= userCharacters.length) {
        selectedChar = userCharacters[num - 1];
      } else {
        // Search by name (case-insensitive)
        selectedChar = userCharacters.find(c => 
          c.name.toLowerCase() === input.toLowerCase()
        );
      }

      if (!selectedChar) {
        await message.reply(`Character not found. Use \`!characters\` to see your saved characters.`);
        return;
      }

      // Deactivate all characters for this user
      for (const char of userCharacters) {
        if (char.isActive) {
          await storage.updateCharacter(char.id, { isActive: false });
        }
      }

      // Activate the selected character
      await storage.updateCharacter(selectedChar.id, { isActive: true });

      const statBlock = Object.entries(selectedChar.stats)
        .map(([stat, val]) => `${stat.slice(0, 3).toUpperCase()}: ${val}`)
        .join(" | ");

      await message.reply(`**Now playing as ${selectedChar.name}!**

**${selectedChar.name}** - Level ${selectedChar.level} ${selectedChar.race} ${selectedChar.characterClass}
HP: ${selectedChar.currentHp}/${selectedChar.maxHp} | AC: ${selectedChar.armorClass}
${statBlock}

Your adventure continues!`);
      break;
    }

    case "character":
    case "char": {
      const character = await storage.getActiveCharacterByDiscordUser(userId);
      if (!character) {
        await message.reply("You don't have a character yet! Use `!create` to make one.");
        return;
      }

      const isCyberpunk = character.gameSystem === "cyberpunk" || !isDndStats(character.stats);
      const statBlock = formatStats(character.stats, character.gameSystem || "dnd");
      const defenseLabel = isCyberpunk ? "SP" : "AC";

      await message.reply(`**${character.name}** - ${isCyberpunk ? "" : `Level ${character.level} `}${character.race} ${character.characterClass}
HP: ${character.currentHp}/${character.maxHp} | ${defenseLabel}: ${character.armorClass}
${statBlock}`);
      break;
    }

    case "stats": {
      const character = await storage.getActiveCharacterByDiscordUser(userId);
      if (!character) {
        await message.reply("You don't have a character yet! Use `!create` to make one.");
        return;
      }

      const isCyberpunk = character.gameSystem === "cyberpunk" || !isDndStats(character.stats);
      
      if (isCyberpunk) {
        const s = character.stats as CyberpunkStats;
        const lines = [
          `**INT:** ${s.int}`,
          `**REF:** ${s.ref}`,
          `**DEX:** ${s.dex}`,
          `**TECH:** ${s.tech}`,
          `**COOL:** ${s.cool}`,
          `**WILL:** ${s.will}`,
          `**LUCK:** ${s.luck}`,
          `**MOVE:** ${s.move}`,
          `**BODY:** ${s.body}`,
          `**EMP:** ${s.emp}`,
        ];
        await message.reply(`**${character.name}'s Stats**\n\n${lines.join("\n")}`);
      } else {
        const lines = Object.entries(character.stats).map(([stat, val]) => {
          const mod = Math.floor((val - 10) / 2);
          return `**${stat.charAt(0).toUpperCase() + stat.slice(1)}:** ${val} (${mod >= 0 ? "+" : ""}${mod})`;
        });
        await message.reply(`**${character.name}'s Ability Scores**\n\n${lines.join("\n")}`);
      }
      break;
    }

    case "inventory":
    case "inv": {
      const character = await storage.getActiveCharacterByDiscordUser(userId);
      if (!character) {
        await message.reply("You don't have a character yet! Use `!create` to make one.");
        return;
      }

      if (character.inventory.length === 0) {
        await message.reply(`**${character.name}'s Inventory**\n\n*Your pack is empty.*`);
        return;
      }

      const items = character.inventory.map(item => 
        `- ${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ""}`
      ).join("\n");

      await message.reply(`**${character.name}'s Inventory**\n\n${items}`);
      break;
    }

    case "delete":
    case "remove": {
      const character = await storage.getActiveCharacterByDiscordUser(userId);
      if (!character) {
        await message.reply("You don't have a character to delete!");
        return;
      }

      await storage.deleteCharacter(character.id);
      await message.reply(`**${character.name}** has been deleted. Use \`!create\` to make a new character.`);
      break;
    }

    case "roll":
    case "r": {
      const expression = args.join("") || "1d20";
      const result = parseDiceExpression(expression);

      if (!result) {
        await message.reply("Invalid dice expression. Try: `!roll 2d6+3` or `!roll d20`");
        return;
      }

      await storage.createDiceRoll({
        expression: result.expression,
        rolls: result.rolls,
        modifier: result.modifier,
        total: result.total,
      });

      const rollDisplay = result.rolls.length > 1 
        ? `[${result.rolls.join(", ")}]${result.modifier !== 0 ? ` ${result.modifier > 0 ? "+" : ""}${result.modifier}` : ""} = **${result.total}**`
        : `**${result.total}**`;

      await message.reply(`Rolling ${result.expression}: ${rollDisplay}`);
      break;
    }

    case "quest":
    case "quests": {
      const session = await storage.getSessionByChannel(channelId);
      if (!session) {
        await message.reply("No active game in this channel. Use `!start` to begin.");
        return;
      }

      const activeQuests = session.quests.filter(q => q.status === "active");
      if (activeQuests.length === 0) {
        await message.reply("**Quest Log**\n\n*No active quests. Your adventure awaits!*");
        return;
      }

      const questList = activeQuests.map(q => `**${q.title}**\n${q.description}`).join("\n\n");
      await message.reply(`**Quest Log**\n\n${questList}`);
      break;
    }

    case "scene": {
      const session = await storage.getSessionByChannel(channelId);
      if (!session) {
        await message.reply("No active game in this channel. Use `!start` to begin.");
        return;
      }

      const character = await storage.getActiveCharacterByDiscordUser(userId);
      const description = await generateDMResponse(
        "Describe the current scene in detail. What do I see, hear, and smell?",
        character ?? null,
        session
      );

      await message.reply(description);
      break;
    }

    case "action":
    case "do": {
      const actionText = args.join(" ");
      if (!actionText) {
        await message.reply("What action do you want to take? Example: `!action I search the room`");
        return;
      }

      const session = await storage.getSessionByChannel(channelId);
      if (!session) {
        await message.reply("No active game in this channel. Use `!start` to begin.");
        return;
      }

      const character = await storage.getActiveCharacterByDiscordUser(userId);
      
      // Check if action involves a roll
      const diceExpr = extractDiceFromText(actionText);
      let diceResult = undefined;
      if (diceExpr) {
        const result = parseDiceExpression(diceExpr);
        if (result) {
          diceResult = result;
          await storage.createDiceRoll({
            expression: result.expression,
            rolls: result.rolls,
            modifier: result.modifier,
            total: result.total,
            sessionId: session.id,
            characterId: character?.id,
          });
        }
      }

      const response = await generateDMResponse(
        actionText,
        character ?? null,
        session,
        diceResult
      );

      // Update session history
      const newHistory: Message[] = [
        ...session.messageHistory,
        { id: randomUUID(), role: "user", content: actionText, timestamp: new Date().toISOString(), discordUserId: userId, discordUsername: username },
        { id: randomUUID(), role: "assistant", content: response, timestamp: new Date().toISOString() },
      ];

      await storage.updateSession(session.id, { messageHistory: newHistory.slice(-50) });
      await message.reply(response);
      break;
    }

    case "say": {
      const speech = args.join(" ");
      if (!speech) {
        await message.reply("What do you want to say? Example: `!say Hello, friend!`");
        return;
      }

      const session = await storage.getSessionByChannel(channelId);
      if (!session) {
        await message.reply("No active game in this channel. Use `!start` to begin.");
        return;
      }

      const character = await storage.getActiveCharacterByDiscordUser(userId);
      const response = await generateDMResponse(
        `I say: "${speech}"`,
        character ?? null,
        session
      );

      const newHistory: Message[] = [
        ...session.messageHistory,
        { id: randomUUID(), role: "user", content: `Says: "${speech}"`, timestamp: new Date().toISOString(), discordUserId: userId, discordUsername: username },
        { id: randomUUID(), role: "assistant", content: response, timestamp: new Date().toISOString() },
      ];

      await storage.updateSession(session.id, { messageHistory: newHistory.slice(-50) });
      await message.reply(response);
      break;
    }

    default:
      await message.reply(`Unknown command. Use \`!help\` to see available commands.`);
  }
}

async function handleNaturalMessage(message: DiscordMessage) {
  const channelId = message.channel.id;
  const userId = message.author.id;
  const username = message.author.username;
  const content = message.content;

  const session = await storage.getSessionByChannel(channelId);
  if (!session) {
    // No active session, ignore natural messages
    return;
  }

  botStatus.lastActivity = new Date().toISOString();

  const character = await storage.getActiveCharacterByDiscordUser(userId);

  // Check for dice roll in message
  const diceExpr = extractDiceFromText(content);
  let diceResult = undefined;
  if (diceExpr) {
    const result = parseDiceExpression(diceExpr);
    if (result) {
      diceResult = result;
      await storage.createDiceRoll({
        expression: result.expression,
        rolls: result.rolls,
        modifier: result.modifier,
        total: result.total,
        sessionId: session.id,
        characterId: character?.id,
      });
    }
  }

  const response = await generateDMResponse(
    content,
    character ?? null,
    session,
    diceResult
  );

  const newHistory: Message[] = [
    ...session.messageHistory,
    { id: randomUUID(), role: "user", content, timestamp: new Date().toISOString(), discordUserId: userId, discordUsername: username },
    { id: randomUUID(), role: "assistant", content: response, timestamp: new Date().toISOString() },
  ];

  await storage.updateSession(session.id, { messageHistory: newHistory.slice(-50) });
  await message.reply(response);
}

export async function initDiscordBot() {
  // Prevent multiple initializations
  if (discordClient) {
    console.log("Discord bot already initialized, skipping...");
    return;
  }

  try {
    const token = await getAccessToken();

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ]
    });

    discordClient.on(Events.ClientReady, (client) => {
      console.log(`Discord bot logged in as ${client.user.tag}`);
      botStatus.isOnline = true;
      botStatus.connectedGuilds = client.guilds.cache.size;
    });

    discordClient.on(Events.MessageCreate, async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      const content = message.content.trim();

      // Check for command prefix
      if (content.startsWith("!")) {
        const parts = content.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        try {
          await handleCommand(message, command, args);
        } catch (error) {
          console.error("Command error:", error);
          await message.reply("An error occurred while processing your command.");
        }
      } else {
        // Handle natural language in active sessions
        try {
          await handleNaturalMessage(message);
        } catch (error) {
          console.error("Natural message error:", error);
        }
      }
    });

    discordClient.on(Events.Error, (error) => {
      console.error("Discord client error:", error);
      botStatus.isOnline = false;
    });

    await discordClient.login(token);
    console.log("Discord bot initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Discord bot:", error);
    botStatus.isOnline = false;
  }
}

export function getDiscordClient() {
  return discordClient;
}

export async function sendMessageToChannel(channelId: string, content: string, username?: string) {
  if (!discordClient || !discordClient.isReady()) {
    throw new Error("Discord client not ready");
  }

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Channel not found or not a text channel");
  }

  const formattedContent = username ? `**[Web] ${username}:** ${content}` : `**[Web]:** ${content}`;
  
  if ('send' in channel && typeof channel.send === 'function') {
    await channel.send(formattedContent);
  } else {
    throw new Error("Channel does not support sending messages");
  }
  
  return true;
}

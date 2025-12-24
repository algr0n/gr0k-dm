// Context builder with fluent API for building OpenAI message arrays

import OpenAI from "openai";
import type { Message } from "@shared/schema";
import type { Client } from "@libsql/client";
import type { 
  AdventureChapter, 
  AdventureLocation, 
  AdventureNpc, 
  AdventureQuest 
} from "@shared/adventure-schema";
import { getSystemPrompt } from "../prompts";
import { getMonsterByName, formatMonsterStatBlock, type MonsterDetail } from "../db/bestiary";
import { monsterCacheManager } from "../cache/monster-cache";

// Adventure context for AI DM
export interface AdventureContext {
  adventureName: string;
  currentChapter?: AdventureChapter;
  currentLocation?: AdventureLocation;
  activeQuests?: AdventureQuest[];
  availableNpcs?: AdventureNpc[];
  metNpcIds?: string[];
  discoveredLocationIds?: string[];
}

export interface CharacterInfo {
  playerName: string;
  characterName: string;
  stats: Record<string, unknown>;
  notes?: string | null;
  inventory?: string[];
}

export interface ItemInfo {
  name: string;
  quantity: number;
}

export interface DroppedItemInfo {
  name: string;
  quantity: number;
  description?: string;
  location?: string;
}

export interface DiceResult {
  expression: string;
  total: number;
  rolls: number[];
  modifier: number;
}

export class ContextBuilder {
  private messages: OpenAI.ChatCompletionMessageParam[];

  constructor() {
    this.messages = [];
  }

  addSystemPrompt(gameSystem: string): this {
    const systemPrompt = getSystemPrompt(gameSystem);
    this.messages.push({ role: "system", content: systemPrompt });
    return this;
  }

  addScene(scene: string): this {
    this.messages.push({ 
      role: "system", 
      content: `Current Scene: ${scene}` 
    });
    return this;
  }

  addAdventureContext(context: AdventureContext): this {
    let adventurePrompt = `ADVENTURE MODE: ${context.adventureName}\n\n`;
    
    if (context.currentChapter) {
      adventurePrompt += `CURRENT CHAPTER: ${context.currentChapter.title}\n`;
      adventurePrompt += `Chapter Description: ${context.currentChapter.description}\n`;
      if (context.currentChapter.objectives && context.currentChapter.objectives.length > 0) {
        adventurePrompt += `Chapter Objectives:\n${context.currentChapter.objectives.map((o: string) => `  - ${o}`).join('\n')}\n`;
      }
      adventurePrompt += '\n';
    }
    
    if (context.currentLocation) {
      adventurePrompt += `CURRENT LOCATION: ${context.currentLocation.name}\n`;
      adventurePrompt += `Description: ${context.currentLocation.description}\n`;
      if (context.currentLocation.boxedText) {
        adventurePrompt += `\n[READ-ALOUD TEXT - Use this for atmospheric descriptions]:\n"${context.currentLocation.boxedText}"\n`;
      }
      adventurePrompt += '\n';
    }
    
    if (context.activeQuests && context.activeQuests.length > 0) {
      adventurePrompt += `ACTIVE QUESTS:\n`;
      context.activeQuests.forEach((quest: AdventureQuest) => {
        const questLabel = (quest as any).type ? ` (${(quest as any).type})` : (quest.isMainQuest ? ' (Main Quest)' : '');
        adventurePrompt += `  - ${quest.name}${questLabel}\n`;
      });
      adventurePrompt += '\n';
    }
    
    if (context.availableNpcs && context.availableNpcs.length > 0) {
      adventurePrompt += `NPCS IN THIS AREA:\n`;
      context.availableNpcs.forEach((npc: AdventureNpc) => {
        const metBefore = context.metNpcIds?.includes(npc.id);
        adventurePrompt += `  - ${npc.name}${npc.role ? ` (${npc.role})` : ''}${metBefore ? ' [ALREADY MET]' : ' [NEW]'}\n`;
        if (npc.personality) {
          adventurePrompt += `    Personality: ${npc.personality}\n`;
        }
        if (npc.ideals) {
          adventurePrompt += `    Ideals: ${npc.ideals}\n`;
        }
        if (npc.description) {
          adventurePrompt += `    Description: ${npc.description}\n`;
        }
      });
      adventurePrompt += '\n';
    }
    
    adventurePrompt += `IMPORTANT: Follow the adventure's story structure. Use the boxed text for location descriptions. Reference NPCs by their personalities. Guide players toward chapter objectives naturally.`;
    
    this.messages.push({
      role: "system",
      content: adventurePrompt
    });
    return this;
  }

  addPartyCharacters(characters: CharacterInfo[], playerCount?: number): this {
    if (characters && characters.length > 0) {
      const charDescriptions = characters.map(c => {
        const statsStr = Object.entries(c.stats)
          .filter(([_, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        const inventoryStr = c.inventory && c.inventory.length > 0 
          ? `Inventory: ${c.inventory.join(", ")}` 
          : "Inventory: empty";
        const desc = `${c.playerName}'s character: ${c.characterName}`;
        const fullDesc = statsStr ? `${desc} (${statsStr})` : desc;
        return `${fullDesc}\n  ${inventoryStr}`;
      }).join("\n");
      this.messages.push({
        role: "system",
        content: `THE PARTY:\n${charDescriptions}`
      });
    } else if (playerCount !== undefined && playerCount > 0) {
      // Fallback to just player count if no character data
      this.messages.push({
        role: "system",
        content: `Party size: ${playerCount} player${playerCount > 1 ? "s" : ""} in this session.`
      });
    }
    return this;
  }

  addInventory(playerName: string, inventory: ItemInfo[]): this {
    if (inventory && inventory.length > 0) {
      const itemList = inventory.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
      this.messages.push({
        role: "system",
        content: `${playerName}'s inventory: ${itemList}`
      });
    }
    return this;
  }

  addDroppedItems(items: DroppedItemInfo[]): this {
    if (items && items.length > 0) {
      const itemList = items.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
      this.messages.push({
        role: "system",
        content: `Items on the ground nearby: ${itemList}`
      });
    }
    return this;
  }

  addConversationSummary(summary: string): this {
    this.messages.push({
      role: "system",
      content: `PREVIOUS SESSION SUMMARY:\n${summary}\n\n[Keep this context in mind but focus on recent events below]`
    });
    return this;
  }

  addMessageHistory(messages: Message[], limit: number = 15): this {
    const recentHistory = messages.slice(-limit);
    for (const msg of recentHistory) {
      if (msg.type === "dm") {
        this.messages.push({ role: "assistant", content: msg.content });
      } else if (msg.type === "chat" || msg.type === "action" || msg.type === "roll") {
        let content = `${msg.playerName}: ${msg.content}`;
        // Include dice roll results so the AI can see them
        if (msg.diceResult) {
          content += ` [Rolled: ${msg.diceResult.expression} = [${msg.diceResult.rolls.join(", ")}] = ${msg.diceResult.total}]`;
        }
        this.messages.push({ role: "user", content });
      }
    }
    return this;
  }

  addCurrentMessage(playerName: string, message: string, diceResult?: DiceResult): this {
    let currentMessage = `${playerName}: ${message}`;
    if (diceResult) {
      currentMessage += `\n\n[Dice Roll: ${diceResult.expression} = [${diceResult.rolls.join(", ")}] = ${diceResult.total}]`;
    }
    this.messages.push({ role: "user", content: currentMessage });
    return this;
  }

  addCombatContext(combatPrompt: string): this {
    this.messages.push({ 
      role: "system", 
      content: combatPrompt
    });
    return this;
  }

  addUserMessage(content: string): this {
    this.messages.push({ role: "user", content });
    return this;
  }

  async addMonsterContext(monsterName: string, client: Client, cachedMonster?: MonsterDetail | null): Promise<this> {
    try {
      // Use cached monster if provided, otherwise fetch from DB
      let monster: MonsterDetail | null | undefined = cachedMonster ?? null;
      if (!monster) {
        monster = await getMonsterByName(client, monsterName);
      }
      
      if (monster) {
        const statBlock = formatMonsterStatBlock(monster);
        this.messages.push({ 
          role: "system", 
          content: `MONSTER STATS FOR: ${monsterName}\n${statBlock}` 
        });
        
        // Store in cache for future use (if not already cached)
        if (!cachedMonster && client) {
          // Note: Room ID passed elsewhere, cache manager handles it at call site
        }
      }
    } catch (error) {
      console.warn(`Failed to load monster context for ${monsterName}:`, error);
    }
    return this;
  }

  addQuestProgress(quests: import('@shared/adventure-schema').QuestWithProgress[]): this {
    if (quests && quests.length > 0) {
      let questPrompt = 'QUEST PROGRESS:\n';
      quests.forEach((q) => {
        const completedCount = q.objectives.filter(obj => obj.isCompleted).length;
        const totalCount = q.objectives.length;
        questPrompt += `  - ${q.quest.name}: ${completedCount}/${totalCount} objectives complete\n`;
        
        // Show incomplete objectives
        const incompleteObjectives = q.objectives.filter(obj => !obj.isCompleted);
        if (incompleteObjectives.length > 0) {
          incompleteObjectives.forEach(obj => {
            questPrompt += `    ☐ ${obj.objectiveText}\n`;
          });
        }
      });
      questPrompt += '\nIMPORTANT: Track quest objectives naturally as players make progress. Guide them toward completing objectives without being heavy-handed.';
      
      this.messages.push({
        role: 'system',
        content: questPrompt,
      });
    }
    return this;
  }

  addStoryHistory(events: import('@shared/adventure-schema').StoryEvent[], limit: number = 10): this {
    if (events && events.length > 0) {
      // Sort by importance and recency (importance desc, timestamp desc)
      const sortedEvents = [...events].sort((a, b) => {
        if (a.importance !== b.importance) {
          return b.importance - a.importance; // Higher importance first
        }
        return b.timestamp.getTime() - a.timestamp.getTime(); // More recent first
      });
      
      // Take top N events
      const topEvents = sortedEvents.slice(0, limit);
      
      let historyPrompt = 'IMPORTANT STORY EVENTS:\n';
      topEvents.forEach((event) => {
        historyPrompt += `  - ${event.title}: ${event.summary}\n`;
      });
      historyPrompt += '\nIMPORTANT: Keep these past events in mind for story continuity. Reference them naturally when relevant.';
      
      this.messages.push({
        role: 'system',
        content: historyPrompt,
      });
    }
    return this;
  }

  addSessionSummary(summary: import('@shared/adventure-schema').SessionSummary): this {
    let summaryPrompt = `PREVIOUS SESSION #${summary.sessionNumber}:\n\n`;
    summaryPrompt += `${summary.summary}\n\n`;
    
    if (summary.keyEvents && summary.keyEvents.length > 0) {
      summaryPrompt += 'Key Events:\n';
      summary.keyEvents.forEach((event) => {
        summaryPrompt += `  - ${event}\n`;
      });
      summaryPrompt += '\n';
    }
    
    summaryPrompt += 'IMPORTANT: The party is resuming from the previous session. Maintain continuity with these events while focusing on current gameplay.';
    
    this.messages.push({
      role: 'system',
      content: summaryPrompt,
    });
    return this;
  }

  build(): OpenAI.ChatCompletionMessageParam[] {
    return this.messages;
  }
}

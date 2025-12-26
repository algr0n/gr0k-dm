/**
 * Story Event Detection - Automatically detect and log story events from DM responses
 * 
 * This module analyzes DM responses to identify key story moments and creates
 * story event records for AI memory and continuity tracking.
 * 
 * Also detects quest-giving language and creates dynamic quests.
 */

import type { AdventureContext } from '@shared/adventure-schema';
import type { InsertStoryEvent } from '@shared/adventure-schema';
import { db } from '../db';
import { storyEvents, adventureQuests, questObjectiveProgress } from '@shared/adventure-schema';
import { containsQuestLanguage, extractQuestFromNarrative } from './quest-detection';

// Event detection patterns
const QUEST_COMPLETE_PATTERNS = [
  /quest.*(complete|finished|accomplished|done)/i,
  /(complete|finish|accomplish).*(quest|objective)/i,
  /you'?ve?\s+(completed|finished|accomplished)/i,
];

const COMBAT_VICTORY_PATTERNS = [
  /(defeated|killed|slain|vanquished).*(enemy|monster|foe|creature)/i,
  /(enemy|monster|foe|creature).*(defeated|killed|slain|falls?|dies?)/i,
  /victory|victorious|triumph/i,
];

const BOSS_DEFEAT_PATTERNS = [
  /boss.*(defeated|killed|slain|falls?|dies?)/i,
  /(defeat|kill|slay).*(boss|dragon|leader|chief)/i,
  /(dragon|leader|chief|boss).*(defeated|killed|slain|falls?|dies?)/i,
];

const PLAYER_DEATH_PATTERNS = [
  /\[DEAD:/i,
  /(player|character).*(dies?|dead|killed|slain|falls?)/i,
  /death\s+saving\s+throw.*fail/i,
];

/**
 * Detect and log story events from a DM response
 * @param dmResponse The DM's response text
 * @param roomId The room ID where the event occurred
 * @param adventureContext Optional adventure context for linking to quests/NPCs/locations
 * @param gameSystem The game system being used (for context in quest extraction)
 * @returns Object with created story event IDs and quest IDs
 */
export async function detectAndLogStoryEvents(
  dmResponse: string,
  roomId: string,
  adventureContext?: AdventureContext,
  gameSystem?: string
): Promise<{ eventIds: string[]; questId?: string }> {
  const events: InsertStoryEvent[] = [];
  let createdQuestId: string | undefined;
  
  // Detect boss defeats (highest importance)
  for (const pattern of BOSS_DEFEAT_PATTERNS) {
    if (pattern.test(dmResponse)) {
      const match = dmResponse.match(pattern);
      const context = extractSentenceContext(dmResponse, match?.index || 0);
      events.push({
        roomId,
        eventType: 'boss_defeated',
        title: 'Boss Defeated',
        summary: context || 'A powerful boss has been defeated!',
        participants: [],
        importance: 5,
      });
      break; // Only log once per response
    }
  }

  // Detect player deaths (high importance)
  for (const pattern of PLAYER_DEATH_PATTERNS) {
    if (pattern.test(dmResponse)) {
      const match = dmResponse.match(pattern);
      const context = extractSentenceContext(dmResponse, match?.index || 0);
      const playerName = extractPlayerNameFromDeath(dmResponse);
      events.push({
        roomId,
        eventType: 'player_death',
        title: playerName ? `${playerName} Has Fallen` : 'Character Death',
        summary: context || 'A party member has fallen in battle.',
        participants: playerName ? [playerName] : [],
        importance: 4,
      });
      break; // Only log once per response
    }
  }

  // Detect quest completions
  for (const pattern of QUEST_COMPLETE_PATTERNS) {
    if (pattern.test(dmResponse)) {
      const match = dmResponse.match(pattern);
      const context = extractSentenceContext(dmResponse, match?.index || 0);
      const questId = adventureContext?.activeQuests?.[0]?.id; // Try to link to active quest
      events.push({
        roomId,
        eventType: 'quest_complete',
        title: 'Quest Completed',
        summary: context || 'The party has completed an important quest.',
        participants: [],
        relatedQuestId: questId,
        importance: 3,
      });
      break; // Only log once per response
    }
  }

  // Detect combat victories (if not already detected as boss)
  if (!events.some(e => e.eventType === 'boss_defeated')) {
    for (const pattern of COMBAT_VICTORY_PATTERNS) {
      if (pattern.test(dmResponse)) {
        const match = dmResponse.match(pattern);
        const context = extractSentenceContext(dmResponse, match?.index || 0);
        events.push({
          roomId,
          eventType: 'combat_victory',
          title: 'Combat Victory',
          summary: context || 'The party emerged victorious from combat.',
          participants: [],
          importance: 2,
        });
        break; // Only log once per response
      }
    }
  }

  // Detect NPC encounters (check if new NPC mentioned)
  if (adventureContext?.availableNpcs && adventureContext.metNpcIds) {
    for (const npc of adventureContext.availableNpcs) {
      const isNew = !adventureContext.metNpcIds.includes(npc.id);
      if (isNew && dmResponse.toLowerCase().includes(npc.name.toLowerCase())) {
        events.push({
          roomId,
          eventType: 'npc_met',
          title: `Met ${npc.name}`,
          summary: `The party encountered ${npc.name}${npc.role ? `, ${npc.role}` : ''}.`,
          participants: [],
          relatedNpcId: npc.id,
          importance: 2,
        });
        break; // Only log one NPC encounter per response
      }
    }
  }

  // Detect location discoveries (check if new location mentioned)
  if (adventureContext?.currentLocation && adventureContext.discoveredLocationIds) {
    const currentLocationId = adventureContext.currentLocation.id;
    const isNewLocation = !adventureContext.discoveredLocationIds.includes(currentLocationId);
    if (isNewLocation) {
      events.push({
        roomId,
        eventType: 'location_discovered',
        title: `Discovered ${adventureContext.currentLocation.name}`,
        summary: `The party has discovered ${adventureContext.currentLocation.name}.`,
        participants: [],
        relatedLocationId: currentLocationId,
        importance: 2,
      });
    }
  }

  // ============================================================================
  // QUEST DETECTION - Only for rooms without a predefined adventure
  // ============================================================================
  if (!adventureContext?.adventureName) {
    console.log('[Quest Detection] Checking for quest-giving language...');
    
    if (containsQuestLanguage(dmResponse)) {
      console.log('[Quest Detection] ✅ Quest language detected, extracting quest data...');
      
      const extractedQuest = await extractQuestFromNarrative(
        dmResponse,
        roomId,
        {
          currentLocation: adventureContext?.currentLocation?.name,
          recentNpcs: adventureContext?.availableNpcs?.map(npc => npc.name),
          gameSystem: gameSystem || 'dnd',
        }
      );

      if (extractedQuest) {
        try {
          // Create the dynamic quest in the database
          const questResult = await db.insert(adventureQuests).values({
            name: extractedQuest.title,
            description: dmResponse.substring(0, 500), // First 500 chars as description
            objectives: extractedQuest.objectives,
            roomId: roomId,
            questGiver: extractedQuest.questGiver,
            isDynamic: true,
            urgency: extractedQuest.urgency,
            rewards: extractedQuest.rewards ? { other: [extractedQuest.rewards] } : undefined,
            isMainQuest: false,
          }).returning({ id: adventureQuests.id });

          if (questResult.length > 0) {
            createdQuestId = questResult[0].id;
            console.log(`[Quest Detection] ✅ Created dynamic quest: "${extractedQuest.title}" (ID: ${createdQuestId})`);

            // Note: Quest objectives will be created when quest is accepted
            // This gives players choice to accept or decline quests

            // Log a story event for quest offered
            events.push({
              roomId,
              eventType: 'quest_offered',
              title: `Quest Offered: ${extractedQuest.title}`,
              summary: `${extractedQuest.questGiver} has offered the party a quest: ${extractedQuest.title}`,
              participants: [],
              relatedQuestId: createdQuestId,
              importance: 2,
            });

            console.log(`[Quest Detection] ✅ Quest offered to party (${extractedQuest.objectives.length} objectives)`);
          }
        } catch (error) {
          console.error('[Quest Detection] Error creating dynamic quest:', error);
        }
      } else {
        console.log('[Quest Detection] ❌ No valid quest extracted from narrative');
      }
    }
  } else {
    console.log('[Quest Detection] Skipping (predefined adventure active)');
  }

  // Insert all detected events into the database
  const createdIds: string[] = [];
  if (events.length > 0) {
    try {
      for (const event of events) {
        const result = await db.insert(storyEvents).values(event).returning({ id: storyEvents.id });
        if (result.length > 0) {
          createdIds.push(result[0].id);
          console.log(`[Story Detection] Created ${event.eventType} event: ${event.title}`);
        }
      }
    } catch (error) {
      console.error('[Story Detection] Error inserting story events:', error);
    }
  }

  return { eventIds: createdIds, questId: createdQuestId };
}

/**
 * Extract a sentence or two around the matched pattern for context
 */
function extractSentenceContext(text: string, matchIndex: number, contextLength: number = 200): string {
  const start = Math.max(0, matchIndex - contextLength / 2);
  const end = Math.min(text.length, matchIndex + contextLength / 2);
  let context = text.substring(start, end).trim();
  
  // Try to complete sentences
  const firstPeriod = context.indexOf('. ');
  if (firstPeriod > 0 && firstPeriod < 50) {
    context = context.substring(firstPeriod + 2);
  }
  
  const lastPeriod = context.lastIndexOf('.');
  if (lastPeriod > context.length - 50 && lastPeriod > 0) {
    context = context.substring(0, lastPeriod + 1);
  }
  
  return context || text.substring(0, Math.min(text.length, 200));
}

/**
 * Try to extract player/character name from death message
 */
function extractPlayerNameFromDeath(text: string): string | undefined {
  const deadTagMatch = text.match(/\[DEAD:\s*([^\]]+)\]/i);
  if (deadTagMatch) {
    return deadTagMatch[1].trim();
  }
  
  const deathMatch = text.match(/(\w+)\s+(dies?|dead|killed|slain|falls?)/i);
  if (deathMatch) {
    return deathMatch[1];
  }
  
  return undefined;
}

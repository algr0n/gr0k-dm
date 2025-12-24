/**
 * Story Event Detection - Automatically detect and log story events from DM responses
 * 
 * This module analyzes DM responses to identify key story moments and creates
 * story event records for AI memory and continuity tracking.
 */

import type { AdventureContext } from '@shared/adventure-schema';
import type { InsertStoryEvent } from '@shared/adventure-schema';
import { db } from '../db';
import { storyEvents } from '@shared/adventure-schema';

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
 * @returns Array of created story event IDs
 */
export async function detectAndLogStoryEvents(
  dmResponse: string,
  roomId: string,
  adventureContext?: AdventureContext
): Promise<string[]> {
  const events: InsertStoryEvent[] = [];
  
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

  return createdIds;
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

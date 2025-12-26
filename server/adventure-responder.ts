/**
 * Adventure Response Cache and Handler
 * For pre-made adventures, use cached/predefined responses to avoid AI token usage
 */

import type { Room } from "@shared/schema";
import type { AdventureContext } from "./grok";

interface CachedResponse {
  pattern: RegExp;
  response: string;
  context?: string; // Optional context to match (e.g., location, chapter)
}

// Cache of common adventure responses that don't need AI
const adventureResponses: Map<string, CachedResponse[]> = new Map();

/**
 * Initialize cached responses for a specific adventure
 */
export function initializeAdventureResponses(adventureId: string, adventureName: string) {
  if (adventureResponses.has(adventureId)) {
    return; // Already initialized
  }

  const responses: CachedResponse[] = [];

  // Generic exploration responses
  responses.push(
    {
      pattern: /\b(look|examine|search)\b.*\b(around|area|room)\b/i,
      response: "You take a moment to survey your surroundings. The area is as described, with no immediate threats visible.",
    },
    {
      pattern: /\b(rest|camp|sleep|long rest)\b/i,
      response: "The party finds a relatively safe spot to rest and recover. You take a long rest, restoring your hit points and spell slots.",
    },
    {
      pattern: /\b(short rest)\b/i,
      response: "The party takes a brief respite. You complete a short rest, allowing you to spend Hit Dice to recover hit points and regain some abilities.",
    }
  );

  adventureResponses.set(adventureId, responses);
}

/**
 * Check if a player's message can be answered with a cached response
 * Returns the cached response if found, null if AI should handle it
 */
export function getCachedAdventureResponse(
  playerMessage: string,
  adventureId: string,
  adventureContext?: AdventureContext
): string | null {
  if (!adventureContext?.adventureName) {
    return null; // No adventure context, use AI
  }

  // Initialize responses for this adventure if not done
  initializeAdventureResponses(adventureId, adventureContext.adventureName);

  const responses = adventureResponses.get(adventureId);
  if (!responses) {
    return null;
  }

  // Check for pattern matches
  for (const cached of responses) {
    if (cached.pattern.test(playerMessage)) {
      // If context-specific, verify context matches
      if (cached.context && adventureContext.currentLocation) {
        if (!adventureContext.currentLocation.name.includes(cached.context)) {
          continue;
        }
      }
      return cached.response;
    }
  }

  return null;
}

/**
 * Determine if a message requires AI processing or can use cached/simple responses
 */
export function shouldUseAI(
  messages: Array<{ content: string; type: string }>,
  room: Room,
  adventureContext?: AdventureContext
): boolean {
  // Check if any message requires complex AI processing
  for (const msg of messages) {
    const content = msg.content.toLowerCase();

    // Simple checks that don't need AI (works for both adventure and dynamic games)
    const simplePatterns = [
      /^(hi|hello|hey)\s*$/i,
      /^(thank you|thanks)\s*$/i,
      /^\b(rest|sleep|camp|long rest|short rest)\b\s*$/i,
      /^\b(look|look around)\b\s*$/i,
    ];

    const isSimple = simplePatterns.some(pattern => pattern.test(content));
    if (!isSimple) {
      // Complex message, use AI
      return true;
    }
  }

  // All messages are simple, try cached responses first
  return false;
}

/**
 * Generate a simple response without AI
 */
export function generateSimpleResponse(
  message: string,
  adventureId: string | null,
  adventureContext?: AdventureContext
): string {
  // Check cached responses first (for pre-made adventures)
  if (adventureId && adventureContext) {
    const cached = getCachedAdventureResponse(message, adventureId, adventureContext);
    if (cached) {
      return cached;
    }
  }

  // Default acknowledgments (work for both adventure and dynamic games)
  const content = message.toLowerCase();
  
  if (/^(hi|hello|hey)/.test(content)) {
    return "Greetings, adventurer! What would you like to do?";
  }
  
  if (/\b(thank|thanks)\b/.test(content)) {
    return "You're welcome! What's your next move?";
  }
  
  if (/\b(long rest)\b/.test(content)) {
    return "The party finds a safe place to rest. You take a long rest, fully recovering your hit points, spell slots, and abilities. Several hours pass as you sleep and recuperate.";
  }
  
  if (/\b(short rest)\b/.test(content)) {
    return "The party takes a brief respite. You complete a short rest (about 1 hour), allowing you to spend Hit Dice to recover hit points and regain certain abilities.";
  }
  
  if (/^\b(rest|sleep|camp)\b/.test(content)) {
    return "The party stops to rest. Do you want to take a short rest (1 hour) or a long rest (8 hours)?";
  }
  
  if (/^\b(look|look around)\b/.test(content)) {
    return "You take a moment to carefully survey your surroundings. Everything appears as previously described. What do you do?";
  }

  // Fallback
  return "Understood. What do you do next?";
}

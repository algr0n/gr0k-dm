// Main entry point for Grok AI integration
// This module provides a clean interface to all AI functionality

import OpenAI from "openai";

// Initialize OpenAI client for xAI Grok API lazily/safely.
// In browser-like test environments (jsdom) the OpenAI client refuses to initialize —
// so only create the client when running in Node and when an API key is available.
export const openai: any = (typeof window === 'undefined' && process.env.XAI_API_KEY)
  ? new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: process.env.XAI_API_KEY })
  : null; // tests can stub/mock this as needed


// Re-export generators
export {
  generateDMResponse,
  generateBatchedDMResponse,
  generateCombatDMTurn,
  generateSceneDescription,
  generateStartingScene,
  type BatchedMessage,
} from "./generators";

// Re-export cache utilities
import { responseCache } from "./cache/response-cache";
export { responseCache };
export function getCacheStats(): { size: number; entries: string[] } {
  return responseCache.getStats();
}

// Re-export token tracking
import { tokenTracker } from "./utils/token-tracker";
export { tokenTracker, type TokenUsage } from "./utils/token-tracker";
export function getTokenUsage(roomId: string) {
  return tokenTracker.get(roomId);
}
export function getAllTokenUsage() {
  return tokenTracker.getAll();
}

// Re-export conversation summary utilities
export { 
  getOrCreateConversationSummary,
  summarizeConversation 
} from "./utils/conversation-summary";

// Re-export types from context builder
export type {
  AdventureContext,
  CharacterInfo,
  DroppedItemInfo,
  ItemInfo,
  DiceResult,
} from "./context/context-builder";
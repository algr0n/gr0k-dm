/**
 * Story Cache - In-memory cache for story context per game session
 * 
 * Purpose: Reduce database queries and token usage by caching story context
 * (quest progress, story events, session summaries) for active game rooms.
 * 
 * Architecture:
 * - Per-room cache: Each active game room maintains its own story context cache
 * - TTL-based expiration: Cache entries expire after 5 minutes by default
 * - Automatic invalidation: Cache is cleared when story events are created or quest objectives are updated
 * - Memory-efficient: Only stores data for active rooms, cleaned up on room close
 */

import type { QuestWithProgress, StoryEvent, SessionSummary } from '@shared/adventure-schema';

interface StoryCacheEntry {
  questProgress: QuestWithProgress[];
  storyEvents: StoryEvent[];
  sessionSummary?: SessionSummary;
  lastUpdated: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class StoryCache {
  private cache: Map<string, StoryCacheEntry> = new Map();
  private ttl: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttl = ttlMs;
  }

  /**
   * Get cached story context for a room
   * Returns null if not cached or expired
   */
  get(roomId: string): StoryCacheEntry | null {
    const entry = this.cache.get(roomId);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.lastUpdated > this.ttl) {
      // Cache expired, remove it
      this.cache.delete(roomId);
      return null;
    }

    return entry;
  }

  /**
   * Store story context for a room
   */
  set(roomId: string, context: Omit<StoryCacheEntry, 'lastUpdated'>): void {
    this.cache.set(roomId, {
      ...context,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Invalidate cache for a specific room
   * Call this when story events are created or quest objectives are updated
   */
  invalidate(roomId: string): void {
    this.cache.delete(roomId);
    console.log(`[Story Cache] Invalidated cache for room ${roomId}`);
  }

  /**
   * Clear all caches
   * Call this for cleanup or testing
   */
  clear(): void {
    this.cache.clear();
    console.log('[Story Cache] All caches cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    let totalQuestProgress = 0;
    let totalStoryEvents = 0;
    let totalSummaries = 0;

    for (const entry of this.cache.values()) {
      totalQuestProgress += entry.questProgress.length;
      totalStoryEvents += entry.storyEvents.length;
      if (entry.sessionSummary) {
        totalSummaries++;
      }
    }

    return {
      activeRooms: this.cache.size,
      totalQuestProgress,
      totalStoryEvents,
      totalSummaries,
      ttlMinutes: this.ttl / 60000,
    };
  }
}

// Singleton instance for global use
export const storyCache = new StoryCache();

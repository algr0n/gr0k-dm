/**
 * Monster Cache - In-memory cache for bestiary lookups per game session
 * 
 * Purpose: Reduce database queries when the same monsters are referenced multiple times
 * in a single game session. For example, if a dragon is encountered and referenced multiple
 * times during combat, we fetch the stat block once and reuse it.
 * 
 * Architecture:
 * - Per-room cache: Each active game room maintains its own monster cache
 * - Cache hit on monster name (case-insensitive)
 * - Automatic cleanup when room closes
 * - Simple LRU eviction if cache grows too large
 */

import { MonsterDetail } from '../db/bestiary'

interface CacheEntry {
  monster: MonsterDetail
  lastAccessed: number
  accessCount: number
}

export class MonsterCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize = 50 // Max monsters per room session
  private accessThreshold = 2 // Consider "hot" after N accesses
  
  /**
   * Get cached monster, returns null if not cached
   */
  get(name: string): MonsterDetail | null {
    const key = name.toLowerCase()
    const entry = this.cache.get(key)
    
    if (entry) {
      // Update access metadata
      entry.lastAccessed = Date.now()
      entry.accessCount++
      return entry.monster
    }
    
    return null
  }
  
  /**
   * Store monster in cache
   */
  set(name: string, monster: MonsterDetail): void {
    const key = name.toLowerCase()
    
    // If cache is full, evict least recently used entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, {
      monster,
      lastAccessed: Date.now(),
      accessCount: 0,
    })
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    let hotMonsters = 0
    for (const entry of this.cache.values()) {
      if (entry.accessCount >= this.accessThreshold) {
        hotMonsters++
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: Math.round((this.cache.size / this.maxSize) * 100),
      hotMonsters, // Monsters accessed 2+ times
    }
  }
  
  /**
   * Clear all cached monsters (call when room closes)
   */
  clear(): void {
    this.cache.clear()
  }
  
  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }
}

/**
 * Global cache manager - maintains caches per room
 * Clean up caches when rooms close to prevent memory leaks
 */
export class MonsterCacheManager {
  private roomCaches: Map<string, MonsterCache> = new Map()
  
  /**
   * Get or create cache for a room
   */
  getCache(roomId: string): MonsterCache {
    if (!this.roomCaches.has(roomId)) {
      this.roomCaches.set(roomId, new MonsterCache())
    }
    return this.roomCaches.get(roomId)!
  }
  
  /**
   * Remove cache for a room (call when room closes/ends)
   */
  removeCache(roomId: string): void {
    const cache = this.roomCaches.get(roomId)
    if (cache) {
      cache.clear()
      this.roomCaches.delete(roomId)
    }
  }
  
  /**
   * Get all active caches (for monitoring/stats)
   */
  getCaches(): Map<string, MonsterCache> {
    return new Map(this.roomCaches)
  }
  
  /**
   * Get global stats across all rooms
   */
  getGlobalStats() {
    let totalCached = 0
    let totalRooms = this.roomCaches.size
    let totalUtilization = 0
    
    for (const cache of this.roomCaches.values()) {
      const stats = cache.getStats()
      totalCached += stats.size
      totalUtilization += stats.utilization
    }
    
    return {
      activeRooms: totalRooms,
      totalMonstersCached: totalCached,
      averageUtilization: totalRooms > 0 ? Math.round(totalUtilization / totalRooms) : 0,
    }
  }
}

// Export singleton instance
export const monsterCacheManager = new MonsterCacheManager()

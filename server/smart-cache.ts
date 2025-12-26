/**
 * Smart Dynamic Response Cache
 * Learns common patterns and caches AI responses for future reuse
 */

// Simple in-memory cache implementation (no external dependency)
class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private ttl: number;

  constructor(options: { max: number; ttl: number; updateAgeOnGet?: boolean }) {
    this.maxSize = options.max;
    this.ttl = options.ttl;
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value as K;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  get size(): number {
    return this.cache.size;
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  clear(): void {
    this.cache.clear();
  }
}

interface CachedResponse {
  pattern: string; // Original message pattern
  response: string; // AI-generated response
  context?: string; // Optional context (room, location, adventure)
  useCount: number; // How many times this was used
  lastUsed: number; // Timestamp of last use
  generatedAt: number; // When this was first cached
}

interface CacheKey {
  normalizedMessage: string;
  roomId?: string;
  locationId?: string;
  adventureId?: string;
}

// Smart cache with LRU eviction (keeps most-used responses)
const smartCache = new SimpleLRUCache<string, CachedResponse>({
  max: 1000, // Store up to 1000 cached responses
  ttl: 1000 * 60 * 60 * 24 * 7, // 7 days TTL
  updateAgeOnGet: true, // Extend TTL when accessed
});

/**
 * Normalize a message for pattern matching
 * Removes pronouns, converts to lowercase, trims whitespace
 */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/\b(i|we|me|us|my|our)\b/g, "") // Remove pronouns
    .replace(/[?!.,]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Generate a cache key from message and context
 */
function generateCacheKey(input: CacheKey): string {
  const parts = [input.normalizedMessage];
  if (input.adventureId) parts.push(`adv:${input.adventureId}`);
  if (input.locationId) parts.push(`loc:${input.locationId}`);
  if (input.roomId) parts.push(`room:${input.roomId}`);
  return parts.join("|");
}

/**
 * Check if a message matches a cacheable pattern
 * Returns true for questions/actions that are likely to be repeated
 */
function isCacheable(message: string): boolean {
  const normalized = normalizeMessage(message);
  
  // Common cacheable patterns
  const cacheablePatterns = [
    /\b(what|where|who|how|describe|tell|explain)\b/i, // Questions
    /\b(look|examine|inspect|check|search)\b/i, // Examinations
    /\b(talk|speak|ask|say)\b.*\b(to|with|about)\b/i, // Conversations
    /\b(open|close|use|pull|push)\b/i, // Object interactions
  ];

  return cacheablePatterns.some(pattern => pattern.test(normalized));
}

/**
 * Try to get a cached response
 */
export function getCachedResponse(
  message: string,
  roomId?: string,
  locationId?: string,
  adventureId?: string
): string | null {
  const normalized = normalizeMessage(message);
  const key = generateCacheKey({ normalizedMessage: normalized, roomId, locationId, adventureId });
  
  const cached = smartCache.get(key);
  if (cached) {
    // Update usage stats
    cached.useCount++;
    cached.lastUsed = Date.now();
    smartCache.set(key, cached);
    
    const tokensSaved = 600; // Rough estimate per AI call
    console.log(`[Smart Cache] ✅ HIT (used ${cached.useCount}x) - Saved ~${tokensSaved} tokens: "${message.substring(0, 60)}..."`);
    return cached.response;
  }
  
  return null;
}

/**
 * Store an AI response in the smart cache
 */
export function cacheResponse(
  message: string,
  response: string,
  roomId?: string,
  locationId?: string,
  adventureId?: string
): void {
  // Only cache if the message is a cacheable pattern
  if (!isCacheable(message)) {
    return;
  }
  
  // Don't cache very short responses (likely errors or unclear)
  if (response.length < 50) {
    return;
  }
  
  const normalized = normalizeMessage(message);
  const key = generateCacheKey({ normalizedMessage: normalized, roomId, locationId, adventureId });
  
  const cached: CachedResponse = {
    pattern: message,
    response,
    context: locationId || adventureId || roomId,
    useCount: 0,
    lastUsed: Date.now(),
    generatedAt: Date.now(),
  };
  
  smartCache.set(key, cached);
  console.log(`[Smart Cache] 💾 STORED for future reuse: "${message.substring(0, 60)}..." (${response.length} chars)`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(smartCache.entries());
  const totalUses = entries.reduce((sum: number, [_, cache]: [string, CachedResponse]) => sum + cache.useCount, 0);
  const avgUses = entries.length > 0 ? totalUses / entries.length : 0;
  
  // Find most used entries
  const topEntries = entries
    .sort((a: [string, CachedResponse], b: [string, CachedResponse]) => b[1].useCount - a[1].useCount)
    .slice(0, 10)
    .map(([key, cache]: [string, CachedResponse]) => ({
      pattern: cache.pattern,
      uses: cache.useCount,
      context: cache.context,
    }));
  
  return {
    size: smartCache.size,
    totalUses,
    avgUses: Math.round(avgUses * 100) / 100,
    topEntries,
    estimatedTokensSaved: totalUses * 500, // Rough estimate
  };
}

/**
 * Clear the smart cache
 */
export function clearSmartCache(): void {
  smartCache.clear();
  console.log("[Smart Cache] Cleared all entries");
}

/**
 * Check if a similar question was asked recently in this context
 * Used to provide hints to AI about cacheable responses
 */
export function findSimilarQuestions(
  message: string,
  roomId?: string,
  adventureId?: string
): string[] {
  const normalized = normalizeMessage(message);
  const words = normalized.split(" ").filter(w => w.length > 3);
  
  const similar: string[] = [];
  
  for (const [key, cache] of smartCache.entries()) {
    // Check if context matches
    if (roomId && !key.includes(`room:${roomId}`)) continue;
    if (adventureId && !key.includes(`adv:${adventureId}`)) continue;
    
    // Check for word overlap
    const cacheWords = normalizeMessage(cache.pattern).split(" ");
    const overlap = words.filter(w => cacheWords.includes(w));
    
    if (overlap.length >= 2) {
      similar.push(cache.pattern);
    }
  }
  
  return similar.slice(0, 5); // Return top 5 similar questions
}

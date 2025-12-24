// LRU Response Cache for deterministic requests (rules, status queries)

interface CacheEntry {
  response: string;
  createdAt: number;
  lastAccess: number;
  isRulesQuery: boolean;
}

const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default
const RULES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for rules

// Patterns that indicate cacheable rule queries
const RULES_PATTERNS = [
  /^(what|how|explain|describe)\s+(is|are|does|do|can)\s+/i,
  /^(what'?s?|how)\s+(the\s+)?(rule|mechanic|system)/i,
  /\b(rule|mechanic|spell|ability|feat|skill)\s+(for|about|called)\b/i,
  /^remind\s+me\s+(how|what|about)/i,
];

// Patterns that indicate non-cacheable dynamic content
const DYNAMIC_PATTERNS = [
  /^i\s+(attack|move|cast|use|go|say|look|search|open|try)/i,
  /^(attack|move|cast|use|go|say|look|search|open|try)\b/i,
  /\broll\b/i,
  /^let'?s?\s+/i,
  /^we\s+(should|could|will|go|attack)/i,
];

export class ResponseCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  isCacheable(message: string): { cacheable: boolean; isRulesQuery: boolean } {
    const lowerMessage = message.toLowerCase().trim();

    // Never cache dynamic/action content
    for (const pattern of DYNAMIC_PATTERNS) {
      if (pattern.test(lowerMessage)) {
        return { cacheable: false, isRulesQuery: false };
      }
    }

    // Check if it's a rules query (longer cache TTL)
    for (const pattern of RULES_PATTERNS) {
      if (pattern.test(lowerMessage)) {
        return { cacheable: true, isRulesQuery: true };
      }
    }

    return { cacheable: false, isRulesQuery: false };
  }

  getCacheKey(message: string, gameSystem: string): string {
    const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ');
    return `${gameSystem}:${normalized}`;
  }

  get(key: string, isRulesQuery: boolean): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const ttl = entry.isRulesQuery ? RULES_CACHE_TTL_MS : CACHE_TTL_MS;

    if (now - entry.createdAt > ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update last access time for true LRU
    entry.lastAccess = now;
    return entry.response;
  }

  set(key: string, response: string, isRulesQuery: boolean): void {
    // Evict least recently accessed entry if at max size
    if (this.cache.size >= CACHE_MAX_SIZE) {
      let lruKey: string | null = null;
      let oldestAccess = Infinity;

      this.cache.forEach((v, k) => {
        if (v.lastAccess < oldestAccess) {
          oldestAccess = v.lastAccess;
          lruKey = k;
        }
      });

      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      response,
      createdAt: now,
      lastAccess: now,
      isRulesQuery,
    });
  }

  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const responseCache = new ResponseCache();

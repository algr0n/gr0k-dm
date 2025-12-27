/**
 * Combat Narrator - AI-powered narrative enhancement for combat engine
 * 
 * The combat engine handles all mechanics (dice, damage, HP, death).
 * This module uses AI to add cinematic flair for epic moments.
 */

import OpenAI from "openai";

interface NarrationContext {
  actorName: string;
  targetName?: string;
  actionType: "attack" | "spell" | "ability" | "death" | "fumble";
  isCritical?: boolean;
  damageTotal?: number;
  targetHp?: number;
  targetMaxHp?: number;
  isKillingBlow?: boolean;
  gameSystem?: string;
}

const NARRATION_CACHE = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Generate a brief, dramatic narration for a combat moment
 * Uses caching to avoid redundant AI calls
 */
export async function narrateCombatMoment(
  openai: OpenAI,
  context: NarrationContext
): Promise<string> {
  // Generate cache key based on context
  const cacheKey = generateCacheKey(context);
  
  // Check cache first
  const cached = NARRATION_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Combat Narrator] Cache hit for ${context.actionType} (${context.isCritical ? "CRIT" : "normal"})`);
    return cached.text;
  }

  // Only narrate special moments to save tokens
  if (!shouldNarrate(context)) {
    return ""; // No narration for regular hits
  }

  try {
    const prompt = buildNarrationPrompt(context);
    
    console.log(`[Combat Narrator] Generating narration for ${context.actionType} (${context.isCritical ? "CRIT" : "normal"})`);
    
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [
        {
          role: "system",
          content: "You are a dramatic combat narrator. Provide SHORT (1-2 sentences) cinematic descriptions of combat moments. Be vivid but concise. No mechanics, just drama.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100, // Keep it short!
      temperature: 0.9, // Creative flair
    });

    const narration = response.choices[0]?.message?.content || "";
    
    // Cache the result
    NARRATION_CACHE.set(cacheKey, { text: narration, timestamp: Date.now() });
    
    return narration;
  } catch (error) {
    console.error("[Combat Narrator] Error generating narration:", error);
    return ""; // Fail gracefully - combat works without narration
  }
}

/**
 * Decide if this moment is worth narrating
 * Only narrate: crits, kills, fumbles, special abilities
 */
function shouldNarrate(context: NarrationContext): boolean {
  // Always narrate these
  if (context.isCritical) return true;
  if (context.isKillingBlow) return true;
  if (context.actionType === "fumble") return true;
  if (context.actionType === "death") return true;
  if (context.actionType === "spell") return true;
  if (context.actionType === "ability") return true;
  
  // Regular attacks? 20% chance to add flavor
  if (context.actionType === "attack") {
    return Math.random() < 0.2;
  }
  
  return false;
}

/**
 * Build a focused prompt for AI narration
 */
function buildNarrationPrompt(context: NarrationContext): string {
  const { actorName, targetName, actionType, isCritical, damageTotal, isKillingBlow } = context;
  
  if (isKillingBlow) {
    return `${actorName} delivers a killing blow to ${targetName}. Describe this dramatic moment in 1-2 sentences. Make it memorable!`;
  }
  
  if (isCritical && actionType === "attack") {
    return `${actorName} lands a CRITICAL HIT on ${targetName} for ${damageTotal} damage! Describe how this crit changes the flow of combat. 1-2 sentences, make it EPIC!`;
  }
  
  if (actionType === "fumble") {
    return `${actorName} fumbles their attack badly! Describe this embarrassing moment in 1-2 sentences. Add tension or comedy.`;
  }
  
  if (actionType === "spell") {
    return `${actorName} casts a spell${targetName ? ` at ${targetName}` : ""}. Describe the magical effect in 1-2 sentences.`;
  }
  
  if (actionType === "death") {
    return `${actorName} has fallen in combat. Describe this dramatic moment in 1-2 sentences.`;
  }
  
  // Default: basic attack narration
  return `${actorName} attacks ${targetName}. Add brief flavor text (1 sentence).`;
}

/**
 * Generate a cache key for similar combat moments
 */
function generateCacheKey(context: NarrationContext): string {
  const parts: string[] = [
    context.actionType,
    context.isCritical ? "crit" : "normal",
    context.isKillingBlow ? "kill" : "hit",
  ];
  
  // Don't include names in cache key - allows reuse across different actors
  return parts.join(":");
}

/**
 * Clear old cache entries
 */
export function cleanNarrationCache(): void {
  const now = Date.now();
  let removed = 0;
  
  for (const [key, value] of NARRATION_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      NARRATION_CACHE.delete(key);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`[Combat Narrator] Cleaned ${removed} expired cache entries`);
  }
}

// Clean cache every 30 minutes
setInterval(cleanNarrationCache, 1000 * 60 * 30);

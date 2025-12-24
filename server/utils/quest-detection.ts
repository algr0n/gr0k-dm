/**
 * Quest Detection and Extraction Utility
 * 
 * Detects quest-giving language in AI responses and uses AI to extract
 * structured quest data for dynamic quest creation.
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || "",
  baseURL: "https://api.x.ai/v1",
});

/**
 * Patterns that indicate quest-giving language in AI responses
 */
const QUEST_PATTERNS = [
  // Direct quest assignment
  /(?:asks?|tells?|requests?|needs?|wants?|begs?|pleads?|demands?|orders?|commands?).{0,50}(?:to|you to)\s+(?:help|find|retrieve|rescue|defeat|kill|investigate|explore|deliver|escort|protect|gather|collect|capture|discover)/i,
  
  // Quest hooks
  /(?:mission|task|job|quest|assignment|request|favor|challenge|problem).{0,30}(?:for you|available|awaits?|needs? (?:doing|completion))/i,
  
  // Reward-based hooks
  /(?:reward|pay|offer|gold|treasure|payment|compensation|bounty).{0,50}(?:if you|for|to (?:find|retrieve|defeat|rescue|help))/i,
  
  // NPC direct requests with objectives
  /(?:can you|could you|will you|would you|please|I need you to|you must|you should)\s+(?:help|find|retrieve|rescue|defeat|kill|investigate|explore|deliver|escort|protect|gather|collect|capture|discover)/i,
  
  // Problem statements that imply quests
  /(?:we have a|there's a|there is a).{0,50}(?:problem|issue|situation|crisis|threat|danger|mystery|plague|curse)/i,
  
  // Location-based hooks
  /(?:go to|travel to|venture to|head to|visit|journey to)\s+(?:the|a).{0,50}(?:and|to)\s+(?:find|retrieve|defeat|rescue|investigate|explore|discover)/i,
];

/**
 * Check if AI response contains quest-giving language
 */
export function containsQuestLanguage(text: string): boolean {
  return QUEST_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Extract structured quest data from narrative text using AI
 */
export async function extractQuestFromNarrative(
  narrativeText: string,
  roomId: string,
  contextInfo?: {
    currentLocation?: string;
    recentNpcs?: string[];
    gameSystem?: string;
  }
): Promise<ExtractedQuest | null> {
  try {
    const systemPrompt = `You are a quest extraction specialist. Analyze the narrative text and extract structured quest information.

Extract:
1. Quest Title (short, memorable)
2. Quest Giver (NPC name if mentioned, or "Unknown" if not clear)
3. Objectives (1-5 clear, actionable steps)
4. Rewards (if mentioned)
5. Urgency (low/medium/high/critical)

Return ONLY valid JSON in this format:
{
  "hasQuest": true/false,
  "title": "Quest Title",
  "questGiver": "NPC Name or Unknown",
  "objectives": ["Objective 1", "Objective 2"],
  "rewards": "Reward description or null",
  "urgency": "medium",
  "reasoning": "Brief explanation of why this is a quest"
}

If no clear quest is present, return: {"hasQuest": false, "reasoning": "Explanation"}`;

    const userPrompt = `Narrative Text:
${narrativeText}

${contextInfo ? `Context:
- Current Location: ${contextInfo.currentLocation || 'Unknown'}
- Recent NPCs: ${contextInfo.recentNpcs?.join(', ') || 'None'}
- Game System: ${contextInfo.gameSystem || 'D&D 5e'}
` : ''}

Extract quest information if present.`;

    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning", // Match the model used for main DM responses
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // Lower temperature for more structured output
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.log('[Quest Detection] No response from AI');
      return null;
    }

    // Parse JSON response
    const parsed = JSON.parse(content);

    if (!parsed.hasQuest) {
      console.log(`[Quest Detection] No quest found: ${parsed.reasoning}`);
      return null;
    }

    // Validate required fields
    if (!parsed.title || !parsed.objectives || !Array.isArray(parsed.objectives) || parsed.objectives.length === 0) {
      console.log('[Quest Detection] Invalid quest structure');
      return null;
    }

    console.log(`[Quest Detection] ✅ Extracted quest: "${parsed.title}" with ${parsed.objectives.length} objectives`);

    return {
      title: parsed.title,
      questGiver: parsed.questGiver || 'Unknown',
      objectives: parsed.objectives,
      rewards: parsed.rewards || null,
      urgency: parsed.urgency || 'medium',
      roomId,
    };

  } catch (error) {
    console.error('[Quest Detection] Error extracting quest:', error);
    return null;
  }
}

/**
 * Extracted quest structure
 */
export interface ExtractedQuest {
  title: string;
  questGiver: string;
  objectives: string[];
  rewards: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  roomId: string;
}

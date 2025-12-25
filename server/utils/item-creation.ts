/**
 * AI-Powered Dynamic Item Creation Utility
 * 
 * This module provides functionality to create items dynamically using AI
 * when quest rewards or DM actions reference items that don't exist in the database.
 */

import { openai } from "../grok";
import { storage } from "../storage";
import type { Item } from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * Create a new item in the database using AI to generate D&D 5e appropriate stats
 * 
 * @param itemName - Name of the item to create
 * @param context - Optional context for better item generation
 * @returns The created item record
 */
export async function createItemFromReward(
  itemName: string,
  context?: {
    questDescription?: string;
    gameSystem?: string;
  }
): Promise<Item> {
  const gameSystem = context?.gameSystem || "dnd";
  const questContext = context?.questDescription || "General adventuring reward";

  console.log(`[Item Creation] Generating AI stats for item: "${itemName}"`);

  // Build AI prompt for item generation
  const prompt = `You are a D&D 5e item creation expert. Create complete stats for this item: "${itemName}"

Context: ${questContext}
Game System: ${gameSystem}

Generate appropriate D&D 5e stats. Return ONLY valid JSON with this exact structure:
{
  "name": "Item Name",
  "category": "weapon|armor|potion|wondrous_item|adventuring_gear|scroll|ring|rod|staff|wand|ammunition|tool|container|other",
  "type": "specific type (e.g., 'longsword', 'light armor', 'healing potion')",
  "rarity": "common|uncommon|rare|very_rare|legendary",
  "cost": <number in copper pieces (1 gp = 100 cp)>,
  "weight": <number in pounds>,
  "description": "Full D&D 5e description with lore and usage",
  "properties": {
    // For weapons: include damage, damageType, range, weaponProperties
    // For armor: include armorClass, armorType, stealthDisadvantage
    // For magic items: include effect, charges, etc.
  },
  "requiresAttunement": false
}

Examples:
- Weapon: {"category": "weapon", "type": "longsword", "properties": {"damage": "1d8", "damageType": "slashing", "weaponProperties": ["versatile (1d10)"]}}
- Armor: {"category": "armor", "type": "light", "properties": {"armorClass": 12, "armorType": "leather", "stealthDisadvantage": false}}
- Potion: {"category": "potion", "type": "healing", "properties": {"healingDice": "2d4+2", "effect": "restore hit points"}}
- Magic Item: {"category": "wondrous_item", "properties": {"effect": "grants +1 bonus to...", "charges": 3, "recharge": "daily"}}

Be creative but balanced for D&D 5e. Return ONLY the JSON, no markdown, no code blocks.`;

  try {
    // Call AI to generate item stats
    const response = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are an expert D&D 5e item designer. Always respond with valid JSON only, no markdown formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    console.log(`[Item Creation] AI response:`, aiResponse);

    // Parse AI response, handling potential markdown code blocks
    let jsonResponse = aiResponse.trim();
    
    // Remove markdown code blocks if present
    if (jsonResponse.startsWith("```")) {
      jsonResponse = jsonResponse.replace(/```json?\n?/g, "").replace(/```\n?$/g, "").trim();
    }

    const itemData = JSON.parse(jsonResponse);

    // Validate required fields
    if (!itemData.name || !itemData.category || !itemData.type || !itemData.description) {
      throw new Error("AI response missing required fields");
    }

    // Generate a unique ID for the item
    const slug = itemName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    
    // Add random suffix to ensure uniqueness
    const itemId = slug ? `ai-${slug}-${randomUUID().slice(0, 6)}` : `ai-item-${randomUUID().slice(0, 8)}`;

    // Create the item in the database
    const item = await storage.createItem({
      id: itemId,
      name: itemData.name,
      category: itemData.category,
      type: itemData.type,
      description: itemData.description,
      rarity: itemData.rarity || "uncommon",
      cost: itemData.cost || 100, // Default 1 gp
      weight: itemData.weight || 1,
      properties: itemData.properties || {},
      requiresAttunement: itemData.requiresAttunement || false,
      gameSystem: gameSystem,
    });

    console.log(`[Item Creation] Successfully created item "${item.name}" (${item.id}) with AI-generated stats`);
    return item;

  } catch (error) {
    console.error(`[Item Creation] Failed to generate AI stats for "${itemName}":`, error);
    
    // Fallback: Create a basic generic item
    console.log(`[Item Creation] Creating fallback item for "${itemName}"`);
    
    const slug = itemName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const itemId = slug ? `fallback-${slug}-${randomUUID().slice(0, 6)}` : `fallback-${randomUUID().slice(0, 8)}`;

    const fallbackItem = await storage.createItem({
      id: itemId,
      name: itemName,
      category: "other",
      type: "Quest Reward",
      description: `A special item rewarded for completing a quest: ${itemName}. This item was created dynamically and may have special properties determined by your Dungeon Master.`,
      rarity: "uncommon",
      cost: 100,
      weight: 1,
      properties: {},
      requiresAttunement: false,
      gameSystem: gameSystem,
    });

    console.log(`[Item Creation] Created fallback item "${fallbackItem.name}" (${fallbackItem.id})`);
    return fallbackItem;
  }
}

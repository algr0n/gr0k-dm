/**
 * Character Database Helpers
 * 
 * Type-safe Drizzle query helpers for character creation, updates, and inventory management.
 * These functions provide a clean interface for character persistence operations.
 */

import { db } from "../db";
import { 
  savedCharacters, 
  characterInventoryItems,
  items,
  type SavedCharacter,
  type InsertSavedCharacter,
  type CharacterInventoryItem,
  type InsertCharacterInventoryItem,
  type Item
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Create a new character
 * @param character - Character data to insert
 * @returns The created character
 */
export async function createCharacter(character: InsertSavedCharacter): Promise<SavedCharacter> {
  const [created] = await db
    .insert(savedCharacters)
    .values(character)
    .returning();
  return created;
}

/**
 * Update an existing character
 * @param id - Character ID
 * @param updates - Fields to update
 * @returns The updated character or undefined if not found
 */
export async function updateCharacter(
  id: string, 
  updates: Partial<SavedCharacter>
): Promise<SavedCharacter | undefined> {
  const [updated] = await db
    .update(savedCharacters)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(savedCharacters.id, id))
    .returning();
  return updated;
}

/**
 * Get a character by ID
 * @param id - Character ID
 * @returns The character or undefined if not found
 */
export async function getCharacter(id: string): Promise<SavedCharacter | undefined> {
  return await db.query.savedCharacters.findFirst({
    where: eq(savedCharacters.id, id)
  });
}

/**
 * Get all characters for a user
 * @param userId - User ID
 * @returns Array of characters owned by the user
 */
export async function getCharactersByUser(userId: string): Promise<SavedCharacter[]> {
  return await db
    .select()
    .from(savedCharacters)
    .where(eq(savedCharacters.userId, userId))
    .orderBy(savedCharacters.updatedAt);
}

/**
 * Add an item to a character's inventory
 * If the item already exists in inventory, increases the quantity
 * @param characterId - Character ID
 * @param itemId - Item ID to add
 * @param quantity - Number of items to add (default 1)
 * @returns The created or updated inventory item
 */
export async function addItemToCharacter(
  characterId: string,
  itemId: string,
  quantity: number = 1
): Promise<CharacterInventoryItem> {
  // Check if item already exists in character's inventory
  const existing = await db.query.characterInventoryItems.findFirst({
    where: and(
      eq(characterInventoryItems.characterId, characterId),
      eq(characterInventoryItems.itemId, itemId)
    ),
  });

  if (existing) {
    // Update existing item quantity
    const [updated] = await db
      .update(characterInventoryItems)
      .set({ 
        quantity: existing.quantity + quantity,
        updatedAt: new Date(),
      })
      .where(eq(characterInventoryItems.id, existing.id))
      .returning();
    return updated;
  }

  // Create new inventory item
  const [created] = await db
    .insert(characterInventoryItems)
    .values({
      characterId,
      itemId,
      quantity,
    })
    .returning();
  return created;
}

/**
 * Get character's full inventory with item details
 * @param characterId - Character ID
 * @returns Array of inventory items with full item data
 */
export async function getCharacterWithInventory(
  characterId: string
): Promise<Array<CharacterInventoryItem & { item: Item }>> {
  return await db.query.characterInventoryItems.findMany({
    where: eq(characterInventoryItems.characterId, characterId),
    with: {
      item: true,
    },
  });
}

/**
 * Remove an item from character's inventory
 * @param characterId - Character ID
 * @param itemId - Item ID to remove
 * @param quantity - Number of items to remove (default: remove all)
 * @returns true if item was removed, false if not found
 */
export async function removeItemFromCharacter(
  characterId: string,
  itemId: string,
  quantity?: number
): Promise<boolean> {
  const existing = await db.query.characterInventoryItems.findFirst({
    where: and(
      eq(characterInventoryItems.characterId, characterId),
      eq(characterInventoryItems.itemId, itemId)
    ),
  });

  if (!existing) {
    return false;
  }

  // If no quantity specified or quantity >= existing, delete the item
  if (!quantity || quantity >= existing.quantity) {
    await db
      .delete(characterInventoryItems)
      .where(eq(characterInventoryItems.id, existing.id));
    return true;
  }

  // Otherwise, decrease the quantity
  await db
    .update(characterInventoryItems)
    .set({ 
      quantity: existing.quantity - quantity,
      updatedAt: new Date(),
    })
    .where(eq(characterInventoryItems.id, existing.id));
  return true;
}

/**
 * Delete a character and all associated data
 * @param id - Character ID
 * @returns true if deleted
 */
export async function deleteCharacter(id: string): Promise<boolean> {
  // Cascade delete will handle inventory items automatically
  await db.delete(savedCharacters).where(eq(savedCharacters.id, id));
  return true;
}

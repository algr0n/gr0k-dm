// Example Combat Integration for NPC Stat Generation
// This file demonstrates how to integrate NPC stat generation into combat start flow
// It provides helper functions that can be called from your combat start handler

import { ensureNpcHasStats, type NpcRow, type NpcStatBlock } from "./npc-stats";

// =============================================================================
// Database Adapter Interface
// =============================================================================

/**
 * Adapter function to save NPC stats back to the database
 * You should implement this using your database client (Drizzle ORM)
 */
export type SaveNpcStatsAdapter = (npcId: string, statsBlock: NpcStatBlock) => Promise<void>;

/**
 * Example implementation using Drizzle ORM (you'll need to import your db client)
 * 
 * ```typescript
 * import { db } from "./db";
 * import { dynamicNpcs } from "@shared/adventure-schema";
 * import { eq } from "drizzle-orm";
 * 
 * export async function saveNpcStatsToDb(npcId: string, statsBlock: NpcStatBlock): Promise<void> {
 *   await db
 *     .update(dynamicNpcs)
 *     .set({ statsBlock: statsBlock as any })
 *     .where(eq(dynamicNpcs.id, npcId));
 * }
 * ```
 */

// =============================================================================
// Combat Integration Helpers
// =============================================================================

/**
 * Ensure all NPCs in a combat encounter have stat blocks
 * This should be called when combat starts, before rolling initiative
 * 
 * @param npcRows - Array of NPC rows from the database
 * @param saveAdapter - Function to save stats back to database
 * @returns Array of NPCs with guaranteed stat blocks
 */
export async function ensureNpcsForCombat(
  npcRows: NpcRow[],
  saveAdapter: SaveNpcStatsAdapter
): Promise<Array<NpcRow & { statsBlock: NpcStatBlock }>> {
  console.log(`[Combat Integration] Ensuring stats for ${npcRows.length} NPCs`);

  const npcsWithStats = await Promise.all(
    npcRows.map(async (npc) => {
      const statsBlock = await ensureNpcHasStats(npc, {
        forceRegenerate: false, // Only generate if missing
        saveStats: saveAdapter,
      });

      return {
        ...npc,
        statsBlock,
      };
    })
  );

  console.log(`[Combat Integration] All NPCs now have stat blocks`);
  return npcsWithStats;
}

/**
 * Convert NPC stat block to combat-ready format
 * This formats the NPC for use in the combat engine's initiative system
 */
export function npcToCombatEntry(npc: NpcRow & { statsBlock: NpcStatBlock }) {
  const stats = npc.statsBlock;

  return {
    id: npc.id,
    name: npc.name,
    ac: stats.ac,
    hp: stats.hp,
    maxHp: stats.maxHp,
    currentHp: stats.hp,
    dex: stats.abilities.dexterity,
    initiativeModifier: stats.modifiers.dexterity,
    stats: {
      ac: stats.ac,
      hp: stats.hp,
      dex: stats.abilities.dexterity,
      abilities: stats.abilities,
      modifiers: stats.modifiers,
    },
    attacks: stats.attacks,
    metadata: {
      npcId: npc.id,
      role: npc.role,
      statsBlock: stats,
    },
  };
}

// =============================================================================
// Example Usage in Combat Start Handler
// =============================================================================

/**
 * Example: How to integrate into your combat start route handler
 * 
 * ```typescript
 * // In your routes.ts or combat handler:
 * 
 * import { ensureNpcsForCombat, npcToCombatEntry } from "./example-combat-integration";
 * import { db } from "./db";
 * import { dynamicNpcs } from "@shared/adventure-schema";
 * import { eq } from "drizzle-orm";
 * 
 * // Define the save adapter
 * async function saveNpcStatsToDb(npcId: string, statsBlock: NpcStatBlock): Promise<void> {
 *   await db
 *     .update(dynamicNpcs)
 *     .set({ statsBlock: statsBlock as any })
 *     .where(eq(dynamicNpcs.id, npcId));
 * }
 * 
 * // In your combat start handler:
 * app.post("/api/rooms/:code/combat/start", async (req, res) => {
 *   const { code } = req.params;
 *   const { npcIds } = req.body; // IDs of NPCs in this encounter
 *   
 *   // Fetch NPCs from database
 *   const npcRows = await db
 *     .select()
 *     .from(dynamicNpcs)
 *     .where(inArray(dynamicNpcs.id, npcIds));
 *   
 *   // Ensure all NPCs have stats
 *   const npcsWithStats = await ensureNpcsForCombat(npcRows, saveNpcStatsToDb);
 *   
 *   // Convert to combat format
 *   const monsters = npcsWithStats.map(npcToCombatEntry);
 *   
 *   // Now use monsters with your existing combat engine
 *   // ... rest of combat initialization
 * });
 * ```
 */

// =============================================================================
// Testing and Debugging Helpers
// =============================================================================

/**
 * Generate stats for a single NPC without saving
 * Useful for testing and debugging
 */
export async function previewNpcStats(npc: NpcRow): Promise<NpcStatBlock> {
  return ensureNpcHasStats(npc, {
    forceRegenerate: true, // Always generate fresh
    // No saveStats - don't persist to DB
  });
}

/**
 * Batch regenerate stats for multiple NPCs
 * Useful for refreshing stats after game system changes
 */
export async function regenerateAllNpcStats(
  npcRows: NpcRow[],
  saveAdapter: SaveNpcStatsAdapter
): Promise<void> {
  console.log(`[Batch Regenerate] Regenerating stats for ${npcRows.length} NPCs`);

  // Process NPCs in parallel for better performance
  const results = await Promise.allSettled(
    npcRows.map(async (npc) => {
      await ensureNpcHasStats(npc, {
        forceRegenerate: true,
        saveStats: saveAdapter,
      });
      return npc.name;
    })
  );

  // Log results
  results.forEach((result, index) => {
    const npcName = npcRows[index].name;
    if (result.status === 'fulfilled') {
      console.log(`[Batch Regenerate] ✓ ${npcName}`);
    } else {
      console.error(`[Batch Regenerate] ✗ ${npcName}:`, result.reason);
    }
  });

  console.log(`[Batch Regenerate] Complete`);
}

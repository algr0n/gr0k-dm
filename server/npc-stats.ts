// NPC Statblock Generation
// This module generates complete NPC stat blocks for combat and skill checks
// with AI (Grok) generation and deterministic fallback

import { randomInt } from "crypto";
import { generateNpcWithGrok } from "./grok";

// =============================================================================
// Type Definitions
// =============================================================================

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface Attack {
  name: string;
  attackBonus: number;
  damage: string;
  damageType?: string;
  range?: string;
  description?: string;
}

export interface NpcStatBlock {
  abilities: AbilityScores;
  modifiers: AbilityScores;
  profBonus: number;
  ac: number;
  hp: number;
  maxHp: number;
  speed: string;
  attacks: Attack[];
  passivePerception: number;
  skills?: Record<string, number>;
  savingThrows?: Record<string, number>;
  notes?: string;
}

// NPC row type - matches database schema
export interface NpcRow {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  personality?: string | null;
  statsBlock?: Record<string, any> | null;
  [key: string]: any;
}

// =============================================================================
// Deterministic Stat Generation
// =============================================================================

/**
 * Roll 4d6 and drop the lowest die (standard D&D ability score generation)
 */
export function roll4d6DropLowest(): number {
  const rolls = [
    randomInt(1, 7),
    randomInt(1, 7),
    randomInt(1, 7),
    randomInt(1, 7),
  ];
  rolls.sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

/**
 * Calculate ability modifier from ability score
 */
export function modFor(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Calculate average HP based on hit dice
 * @param hitDice - Number of hit dice (e.g., 3 for 3d8)
 * @param dieSize - Size of hit die (e.g., 8 for d8)
 * @param conMod - Constitution modifier
 */
export function averageHpForHd(hitDice: number, dieSize: number, conMod: number): number {
  const avgPerDie = (dieSize + 1) / 2;
  return Math.floor(avgPerDie * hitDice + conMod * hitDice);
}

/**
 * Generate complete ability scores using 4d6 drop lowest
 */
function generateAbilityScores(): AbilityScores {
  return {
    strength: roll4d6DropLowest(),
    dexterity: roll4d6DropLowest(),
    constitution: roll4d6DropLowest(),
    intelligence: roll4d6DropLowest(),
    wisdom: roll4d6DropLowest(),
    charisma: roll4d6DropLowest(),
  };
}

/**
 * Calculate all ability modifiers from ability scores
 */
function calculateModifiers(abilities: AbilityScores): AbilityScores {
  return {
    strength: modFor(abilities.strength),
    dexterity: modFor(abilities.dexterity),
    constitution: modFor(abilities.constitution),
    intelligence: modFor(abilities.intelligence),
    wisdom: modFor(abilities.wisdom),
    charisma: modFor(abilities.charisma),
  };
}

/**
 * Estimate proficiency bonus and challenge rating from NPC context
 */
function estimateProficiencyBonus(npc: NpcRow): number {
  // Try to infer from role or description
  const text = `${npc.role || ''} ${npc.description || ''}`.toLowerCase();
  
  if (text.includes('powerful') || text.includes('legendary') || text.includes('boss')) {
    return 4; // CR 9-12
  } else if (text.includes('veteran') || text.includes('leader') || text.includes('captain')) {
    return 3; // CR 5-8
  } else if (text.includes('guard') || text.includes('soldier') || text.includes('warrior')) {
    return 2; // CR 1-4
  }
  
  return 2; // Default to CR 1-4
}

/**
 * Estimate hit dice from NPC context
 */
function estimateHitDice(npc: NpcRow): { count: number; size: number } {
  const text = `${npc.role || ''} ${npc.description || ''}`.toLowerCase();
  
  if (text.includes('powerful') || text.includes('legendary') || text.includes('boss')) {
    return { count: 10, size: 10 }; // ~100 HP
  } else if (text.includes('veteran') || text.includes('leader') || text.includes('captain')) {
    return { count: 8, size: 8 }; // ~60 HP
  } else if (text.includes('guard') || text.includes('soldier') || text.includes('warrior')) {
    return { count: 4, size: 8 }; // ~30 HP
  }
  
  return { count: 3, size: 8 }; // Default
}

/**
 * Generate deterministic stat block (fallback when AI unavailable)
 */
function generateDeterministicStatBlock(npc: NpcRow): NpcStatBlock {
  const abilities = generateAbilityScores();
  const modifiers = calculateModifiers(abilities);
  const profBonus = estimateProficiencyBonus(npc);
  const hitDice = estimateHitDice(npc);
  
  const hp = averageHpForHd(hitDice.count, hitDice.size, modifiers.constitution);
  const ac = 10 + modifiers.dexterity + 3; // Base AC + DEX + light armor bonus
  
  // Default melee and ranged attacks
  const attacks: Attack[] = [
    {
      name: "Melee Attack",
      attackBonus: profBonus + modifiers.strength,
      damage: `1d8+${modifiers.strength}`,
      damageType: "slashing",
      range: "5 ft",
    },
  ];
  
  // Add ranged attack if DEX is decent
  if (modifiers.dexterity > 0) {
    attacks.push({
      name: "Ranged Attack",
      attackBonus: profBonus + modifiers.dexterity,
      damage: `1d6+${modifiers.dexterity}`,
      damageType: "piercing",
      range: "80/320 ft",
    });
  }
  
  return {
    abilities,
    modifiers,
    profBonus,
    ac,
    hp,
    maxHp: hp,
    speed: "30 ft",
    attacks,
    passivePerception: 10 + modifiers.wisdom,
    skills: {
      perception: modifiers.wisdom,
      athletics: modifiers.strength,
      stealth: modifiers.dexterity,
    },
    notes: "Generated deterministically (fallback)",
  };
}

// =============================================================================
// NPC Stat Block Generation with AI Fallback
// =============================================================================

/**
 * Generate a complete NPC stat block, preferring AI generation with fallback
 * @param npc - The NPC row from the database
 * @returns A complete NpcStatBlock ready for combat
 */
export async function generateNpcStatBlock(npc: NpcRow): Promise<NpcStatBlock> {
  // Try AI generation first if available
  try {
    const aiStatBlock = await generateNpcWithGrok(npc);
    if (aiStatBlock) {
      console.log(`[NPC Stats] Generated stat block for "${npc.name}" using Grok AI`);
      return aiStatBlock;
    }
  } catch (error) {
    console.warn(`[NPC Stats] Grok AI generation failed for "${npc.name}":`, error);
  }
  
  // Fall back to deterministic generation
  console.log(`[NPC Stats] Using deterministic fallback for "${npc.name}"`);
  return generateDeterministicStatBlock(npc);
}

// =============================================================================
// Helper Functions for Integration
// =============================================================================

/**
 * Ensure an NPC has a valid stat block, generating if needed
 * @param npc - The NPC row from the database
 * @param options - Optional configuration
 * @returns The parsed or generated stat block
 */
export async function ensureNpcHasStats(
  npc: NpcRow,
  options?: {
    forceRegenerate?: boolean;
    saveStats?: (npcId: string, statsBlock: NpcStatBlock) => Promise<void>;
  }
): Promise<NpcStatBlock> {
  // If we already have stats and not forcing regeneration, parse and return them
  if (!options?.forceRegenerate && npc.statsBlock) {
    try {
      // Validate that the stats block has required fields
      const stats = npc.statsBlock as NpcStatBlock;
      if (stats.abilities && stats.hp && stats.ac && stats.attacks) {
        console.log(`[NPC Stats] Using existing stat block for "${npc.name}"`);
        return stats;
      }
    } catch (error) {
      console.warn(`[NPC Stats] Failed to parse existing stats for "${npc.name}":`, error);
    }
  }
  
  // Generate new stats
  const statsBlock = await generateNpcStatBlock(npc);
  
  // Save if callback provided
  if (options?.saveStats) {
    try {
      await options.saveStats(npc.id, statsBlock);
      console.log(`[NPC Stats] Saved generated stats for "${npc.name}" to database`);
    } catch (error) {
      console.error(`[NPC Stats] Failed to save stats for "${npc.name}":`, error);
    }
  }
  
  return statsBlock;
}

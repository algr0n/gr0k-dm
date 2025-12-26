/**
 * Bestiary Query Utilities
 * 
 * Provides functions to query the bestiary database and retrieve monster data
 * for use by the Grok AI DM during gameplay.
 */

import type { Client } from "@libsql/client";
import { z } from "zod";

export interface MonsterStats {
  id: string;
  name: string;
  size: string;
  type: string;
  armor_class: number;
  hp_avg: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  challenge_rating: string;
  cr_decimal: number;
  skills: string | null;
  senses: string | null;
  languages: string | null;
  xp?: number;
}

export interface MonsterDetail extends MonsterStats {
  hit_points: string;
  speed: string;
  alignment: string;
  saving_throws: string | null;
  damage_resistances: string | null;
  damage_immunities: string | null;
  damage_vulnerabilities: string | null;
  condition_immunities: string | null;
  traits: Array<{ name: string; description: string }>;
  actions: Array<{ name: string; description: string; damage?: string }>;
  legendary_actions: Array<string>;
}

/**
 * Search for monsters by name or type
 */
export async function searchMonsters(
  client: Client,
  query: string,
  limit = 5
): Promise<MonsterStats[]> {
  try {
    const result = await client.execute({
      sql: `
        SELECT 
          id, name, size, type, armor_class, hp_avg,
          str, dex, con, int, wis, cha,
          challenge_rating, cr_decimal, skills, senses, languages
        FROM bestiary_monsters
        WHERE name LIKE ? OR type LIKE ?
        ORDER BY cr_decimal DESC
        LIMIT ?
      `,
      args: [`%${query}%`, `%${query}%`, limit]
    });
    
    return result.rows as unknown as MonsterStats[];
  } catch (error) {
    console.error("Error searching monsters:", error);
    return [];
  }
}

/**
 * Get a monster by exact name
 * Includes AI-generated monsters (for gameplay use)
 */
export async function getMonsterByName(
  client: Client,
  name: string
): Promise<MonsterDetail | null> {
  try {
    // Get base monster data (case-insensitive search, exclude deleted)
    const result = await client.execute({
      sql: `
        SELECT * FROM bestiary_monsters 
        WHERE LOWER(name) = LOWER(?) AND is_deleted = 0
        LIMIT 1
      `,
      args: [name]
    });
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const monster = result.rows[0] as any;
    const monsterId = monster.id;
    
    // Get traits
    const traitsResult = await client.execute({
      sql: `
        SELECT name, description FROM bestiary_traits 
        WHERE monster_id = ? ORDER BY name
      `,
      args: [monsterId]
    });
    
    // Get actions
    const actionsResult = await client.execute({
      sql: `
        SELECT name, description, damage FROM bestiary_actions 
        WHERE monster_id = ? ORDER BY name
      `,
      args: [monsterId]
    });
    
    // Get legendary actions
    const legendaryResult = await client.execute({
      sql: `
        SELECT option_text FROM bestiary_legendary_actions 
        WHERE monster_id = ? ORDER BY rowid
      `,
      args: [monsterId]
    });
    
    return {
      id: monster.id,
      name: monster.name,
      size: monster.size,
      type: monster.type,
      armor_class: monster.armor_class,
      hp_avg: monster.hp_avg,
      str: monster.str,
      dex: monster.dex,
      con: monster.con,
      int: monster.int,
      wis: monster.wis,
      cha: monster.cha,
      challenge_rating: monster.challenge_rating,
      cr_decimal: monster.cr_decimal,
      xp: monster.xp,
      hit_points: monster.hit_points,
      speed: monster.speed,
      alignment: monster.alignment,
      skills: monster.skills,
      saving_throws: monster.saving_throws,
      damage_resistances: monster.damage_resistances,
      damage_immunities: monster.damage_immunities,
      damage_vulnerabilities: monster.damage_vulnerabilities,
      condition_immunities: monster.condition_immunities,
      senses: monster.senses,
      languages: monster.languages,
      traits: traitsResult.rows as unknown as Array<{ name: string; description: string }>,
      actions: actionsResult.rows as unknown as Array<{ name: string; description: string; damage?: string }>,
      legendary_actions: legendaryResult.rows.map((r: any) => r.option_text)
    };
  } catch (error) {
    console.error("Error fetching monster:", error);
    return null;
  }
}

/**
 * Get monsters by challenge rating for encounter building
 */
export async function getMonstersByCR(
  client: Client,
  crRange: { min: number; max: number },
  limit = 10
): Promise<MonsterStats[]> {
  try {
    const result = await client.execute({
      sql: `
        SELECT 
          id, name, size, type, armor_class, hp_avg,
          str, dex, con, int, wis, cha,
          challenge_rating, cr_decimal, skills, senses, languages
        FROM bestiary_monsters
        WHERE cr_decimal >= ? AND cr_decimal <= ?
        ORDER BY cr_decimal, name
        LIMIT ?
      `,
      args: [crRange.min, crRange.max, limit]
    });
    
    return result.rows as unknown as MonsterStats[];
  } catch (error) {
    console.error("Error fetching monsters by CR:", error);
    return [];
  }
}

/**
 * Get monsters by type (e.g., "dragon", "humanoid", "beast")
 */
export async function getMonstersByType(
  client: Client,
  type: string,
  limit = 20
): Promise<MonsterStats[]> {
  try {
    const result = await client.execute({
      sql: `
        SELECT 
          id, name, size, type, armor_class, hp_avg,
          str, dex, con, int, wis, cha,
          challenge_rating, cr_decimal, skills, senses, languages
        FROM bestiary_monsters
        WHERE type LIKE ?
        ORDER BY cr_decimal DESC
        LIMIT ?
      `,
      args: [`%${type}%`, limit]
    });
    
    return result.rows as unknown as MonsterStats[];
  } catch (error) {
    console.error("Error fetching monsters by type:", error);
    return [];
  }
}

/**
 * Full-text search using FTS5
 */
export async function ftsSearchMonsters(
  client: Client,
  query: string,
  limit = 10
): Promise<Array<{ monster_id: string; name: string; rank: number }>> {
  try {
    const result = await client.execute({
      sql: `
        SELECT monster_id, name, rank FROM bestiary_fts
        WHERE bestiary_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `,
      args: [`${query}*`, limit]
    });
    
    return result.rows as unknown as Array<{ monster_id: string; name: string; rank: number }>;
  } catch (error) {
    console.error("Error with FTS search:", error);
    return [];
  }
}

/**
 * Format a monster stat block as readable text for AI context
 */
export function formatMonsterStatBlock(monster: MonsterDetail): string {
  const lines = [
    `## ${monster.name}`,
    `*${monster.size} ${monster.type}${monster.alignment ? ", " + monster.alignment : ""}*`,
    ``,
    `**Armor Class** ${monster.armor_class}`,
    `**Hit Points** ${monster.hit_points} (avg: ${monster.hp_avg})`,
    `**Speed** ${monster.speed}`,
    ``,
    `| STR | DEX | CON | INT | WIS | CHA |`,
    `|-----|-----|-----|-----|-----|-----|`,
    `| ${monster.str} | ${monster.dex} | ${monster.con} | ${monster.int} | ${monster.wis} | ${monster.cha} |`,
    ``,
  ];
  
  if (monster.skills) lines.push(`**Skills** ${monster.skills}`);
  if (monster.senses) lines.push(`**Senses** ${monster.senses}`);
  if (monster.languages) lines.push(`**Languages** ${monster.languages}`);
  if (monster.challenge_rating) lines.push(`**Challenge** ${monster.challenge_rating}`);
  
  if (monster.traits.length > 0) {
    lines.push(``, `### Traits`);
    for (const trait of monster.traits) {
      lines.push(`**${trait.name}.** ${trait.description}`);
    }
  }
  
  if (monster.actions.length > 0) {
    lines.push(``, `### Actions`);
    for (const action of monster.actions) {
      lines.push(`**${action.name}.** ${action.description}${action.damage ? ` ${action.damage}` : ""}`);
    }
  }
  
  if (monster.legendary_actions.length > 0) {
    lines.push(``, `### Legendary Actions`);
    for (const action of monster.legendary_actions) {
      lines.push(`${action}`);
    }
  }
  
  return lines.join("\n");
}

// ============================================================================
// Monster Creation & Validation
// ============================================================================

/**
 * Zod schema for validating monster creation payloads
 * Based on monster_stats.json structure
 */
export const MonsterCreateSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.enum(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]),
  type: z.string().min(1),
  subtype: z.string().optional(),
  alignment: z.string().optional(),
  armor_class: z.number().int().min(1).max(30),
  armor_type: z.string().optional(),
  hit_points: z.string(), // e.g., "2d8 + 2"
  hp_avg: z.number().int().min(1).optional(),
  speed: z.string(), // e.g., "30 ft., fly 60 ft."
  ability_scores: z.object({
    str: z.number().int().min(1).max(30),
    dex: z.number().int().min(1).max(30),
    con: z.number().int().min(1).max(30),
    int: z.number().int().min(1).max(30),
    wis: z.number().int().min(1).max(30),
    cha: z.number().int().min(1).max(30),
  }),
  saving_throws: z.record(z.number()).optional(),
  skills: z.record(z.number()).optional(),
  damage_vulnerabilities: z.string().optional(),
  damage_resistances: z.string().optional(),
  damage_immunities: z.string().optional(),
  condition_immunities: z.string().optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  challenge_rating: z.string(), // e.g., "1/2", "3", "21"
  cr_decimal: z.number().min(0).max(30),
  xp: z.number().int().min(0).optional(),
  traits: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  actions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.string().optional(),
    attack_bonus: z.number().optional(),
    damage: z.string().optional(),
    reach: z.string().optional(),
    range: z.string().optional(),
  })).optional(),
  legendary_actions: z.array(z.string()).optional(),
  legendary_action_count: z.number().int().min(0).optional(),
});

export type MonsterCreatePayload = z.infer<typeof MonsterCreateSchema>;

/**
 * Create a new monster in the bestiary database
 * Automatically handles FTS index update and related tables
 */
export async function createMonster(
  client: Client,
  payload: MonsterCreatePayload,
  options: {
    isGenerated?: boolean;
    isPublished?: boolean;
    createdBy?: string;
    createdByType?: "admin" | "grok" | "user";
  } = {}
): Promise<string> {
  // Validate payload
  const validated = MonsterCreateSchema.parse(payload);
  
  const {
    isGenerated = true,
    isPublished = false,
    createdBy = "grok",
    createdByType = "grok",
  } = options;

  // Calculate hp_avg if not provided
  const hpAvg = validated.hp_avg ?? calculateAverageHP(validated.hit_points);
  
  // Calculate XP if not provided
  const xp = validated.xp ?? calculateXP(validated.cr_decimal);

  try {
    // Start transaction
    await client.execute("BEGIN TRANSACTION");

    // Insert main monster record
    const monsterResult = await client.execute({
      sql: `
        INSERT INTO bestiary_monsters (
          name, size, type, subtype, alignment,
          armor_class, armor_type, hit_points, hp_avg, speed,
          str, dex, con, int, wis, cha,
          saving_throws, skills,
          damage_vulnerabilities, damage_resistances, damage_immunities,
          condition_immunities, senses, languages,
          challenge_rating, cr_decimal, xp,
          legendary_action_count,
          is_published, is_generated, created_by, created_by_type,
          raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `,
      args: [
        validated.name,
        validated.size,
        validated.type,
        validated.subtype ?? null,
        validated.alignment ?? null,
        validated.armor_class,
        validated.armor_type ?? null,
        validated.hit_points,
        hpAvg,
        validated.speed,
        validated.ability_scores.str,
        validated.ability_scores.dex,
        validated.ability_scores.con,
        validated.ability_scores.int,
        validated.ability_scores.wis,
        validated.ability_scores.cha,
        validated.saving_throws ? JSON.stringify(validated.saving_throws) : null,
        validated.skills ? JSON.stringify(validated.skills) : null,
        validated.damage_vulnerabilities ?? null,
        validated.damage_resistances ?? null,
        validated.damage_immunities ?? null,
        validated.condition_immunities ?? null,
        validated.senses ?? null,
        validated.languages ?? null,
        validated.challenge_rating,
        validated.cr_decimal,
        xp,
        validated.legendary_action_count ?? 0,
        isPublished ? 1 : 0,
        isGenerated ? 1 : 0,
        createdBy,
        createdByType,
        JSON.stringify(validated),
      ],
    });

    const monsterId = (monsterResult.rows[0] as any).id;

    // Insert traits
    if (validated.traits && validated.traits.length > 0) {
      for (const trait of validated.traits) {
        await client.execute({
          sql: `INSERT INTO bestiary_traits (monster_id, name, description) VALUES (?, ?, ?)`,
          args: [monsterId, trait.name, trait.description],
        });
      }
    }

    // Insert actions
    if (validated.actions && validated.actions.length > 0) {
      for (const action of validated.actions) {
        await client.execute({
          sql: `
            INSERT INTO bestiary_actions (
              monster_id, name, description, type, attack_bonus, damage, reach, range
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            monsterId,
            action.name,
            action.description,
            action.type ?? null,
            action.attack_bonus ?? null,
            action.damage ?? null,
            action.reach ?? null,
            action.range ?? null,
          ],
        });
      }
    }

    // Insert legendary actions
    if (validated.legendary_actions && validated.legendary_actions.length > 0) {
      for (const legendaryAction of validated.legendary_actions) {
        await client.execute({
          sql: `INSERT INTO bestiary_legendary_actions (monster_id, option_text) VALUES (?, ?)`,
          args: [monsterId, legendaryAction],
        });
      }
    }

    // Update FTS index
    const traitsText = validated.traits?.map(t => `${t.name}: ${t.description}`).join(" ") ?? "";
    const actionsText = validated.actions?.map(a => `${a.name}: ${a.description}`).join(" ") ?? "";
    
    await client.execute({
      sql: `
        INSERT INTO bestiary_fts (monster_id, name, description, traits_text, actions_text)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [monsterId, validated.name, validated.type, traitsText, actionsText],
    });

    // Commit transaction
    await client.execute("COMMIT");

    console.log(`[Bestiary] Created monster: ${validated.name} (id: ${monsterId}, generated: ${isGenerated})`);
    return monsterId;
  } catch (error) {
    // Rollback on error
    await client.execute("ROLLBACK");
    console.error("[Bestiary] Error creating monster:", error);
    throw error;
  }
}

/**
 * Calculate average HP from hit dice expression
 * Example: "2d8 + 2" => 11
 */
function calculateAverageHP(hitPoints: string): number {
  const match = hitPoints.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/);
  if (!match) return 10; // fallback
  
  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3].replace(/\s/g, "")) : 0;
  
  const avgPerDie = (dieSize + 1) / 2;
  return Math.floor(numDice * avgPerDie + modifier);
}

/**
 * Calculate XP from CR decimal
 */
function calculateXP(crDecimal: number): number {
  const xpTable: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
  };
  return xpTable[crDecimal] ?? 0;
}

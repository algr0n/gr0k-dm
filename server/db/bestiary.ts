/**
 * Bestiary Query Utilities
 * 
 * Provides functions to query the bestiary database and retrieve monster data
 * for use by the Grok AI DM during gameplay.
 */

import type { Client } from "@libsql/client";

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
 */
export async function getMonsterByName(
  client: Client,
  name: string
): Promise<MonsterDetail | null> {
  try {
    // Get base monster data (case-insensitive search)
    const result = await client.execute({
      sql: `
        SELECT * FROM bestiary_monsters WHERE LOWER(name) = LOWER(?) LIMIT 1
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

export type DndStatName = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
export type CyberpunkStatName = "int" | "ref" | "dex" | "tech" | "cool" | "will" | "luck" | "move" | "body" | "emp";

export interface StatBonuses {
  [key: string]: number;
}

export const DND_RACE_BONUSES: Record<string, Partial<Record<DndStatName, number>>> = {
  Human: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
  Elf: { dexterity: 2 },
  Dwarf: { constitution: 2 },
  Halfling: { dexterity: 2 },
  Gnome: { intelligence: 2 },
  "Half-Elf": { charisma: 2, dexterity: 1, constitution: 1 },
  "Half-Orc": { strength: 2, constitution: 1 },
  Tiefling: { charisma: 2, intelligence: 1 },
  Dragonborn: { strength: 2, charisma: 1 },
};

export const DND_CLASS_HP_BONUSES: Record<string, { baseHp: number; hpPerLevel: number }> = {
  Fighter: { baseHp: 10, hpPerLevel: 6 },
  Wizard: { baseHp: 6, hpPerLevel: 4 },
  Rogue: { baseHp: 8, hpPerLevel: 5 },
  Cleric: { baseHp: 8, hpPerLevel: 5 },
  Ranger: { baseHp: 10, hpPerLevel: 6 },
  Paladin: { baseHp: 10, hpPerLevel: 6 },
  Barbarian: { baseHp: 12, hpPerLevel: 7 },
  Bard: { baseHp: 8, hpPerLevel: 5 },
  Druid: { baseHp: 8, hpPerLevel: 5 },
  Monk: { baseHp: 8, hpPerLevel: 5 },
  Sorcerer: { baseHp: 6, hpPerLevel: 4 },
  Warlock: { baseHp: 8, hpPerLevel: 5 },
};

export const DND_CLASS_STAT_PRIORITIES: Record<string, DndStatName[]> = {
  Fighter: ["strength", "constitution"],
  Wizard: ["intelligence", "constitution"],
  Rogue: ["dexterity", "intelligence"],
  Cleric: ["wisdom", "constitution"],
  Ranger: ["dexterity", "wisdom"],
  Paladin: ["strength", "charisma"],
  Barbarian: ["strength", "constitution"],
  Bard: ["charisma", "dexterity"],
  Druid: ["wisdom", "constitution"],
  Monk: ["dexterity", "wisdom"],
  Sorcerer: ["charisma", "constitution"],
  Warlock: ["charisma", "constitution"],
};

export const CYBERPUNK_BACKGROUND_BONUSES: Record<string, Partial<Record<CyberpunkStatName, number>>> = {
  Streetkid: { cool: 1, will: 1 },
  Corporate: { int: 1, cool: 1 },
  Nomad: { ref: 1, body: 1 },
};

export const CYBERPUNK_ROLE_BONUSES: Record<string, Partial<Record<CyberpunkStatName, number>>> = {
  Solo: { ref: 2, body: 1 },
  Netrunner: { int: 2, tech: 1 },
  Tech: { tech: 2, int: 1 },
  Rockerboy: { cool: 2, emp: 1 },
  Media: { int: 1, cool: 1, emp: 1 },
  Nomad: { ref: 1, tech: 1, body: 1 },
  Fixer: { cool: 2, int: 1 },
  Cop: { ref: 1, will: 1, body: 1 },
  Exec: { int: 1, cool: 1, will: 1 },
  Medtech: { tech: 2, emp: 1 },
};

export function applyDndRaceBonuses(
  baseStats: Record<DndStatName, number>,
  race: string
): Record<DndStatName, number> {
  const bonuses = DND_RACE_BONUSES[race] || {};
  return {
    strength: (baseStats.strength || 10) + (bonuses.strength || 0),
    dexterity: (baseStats.dexterity || 10) + (bonuses.dexterity || 0),
    constitution: (baseStats.constitution || 10) + (bonuses.constitution || 0),
    intelligence: (baseStats.intelligence || 10) + (bonuses.intelligence || 0),
    wisdom: (baseStats.wisdom || 10) + (bonuses.wisdom || 0),
    charisma: (baseStats.charisma || 10) + (bonuses.charisma || 0),
  };
}

export function calculateDndMaxHp(
  characterClass: string,
  level: number,
  constitutionModifier: number
): number {
  const classHp = DND_CLASS_HP_BONUSES[characterClass] || { baseHp: 8, hpPerLevel: 5 };
  const baseHp = classHp.baseHp + constitutionModifier;
  const additionalHp = (level - 1) * (classHp.hpPerLevel + constitutionModifier);
  return Math.max(1, baseHp + additionalHp);
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function applyCyberpunkBonuses(
  baseStats: Record<CyberpunkStatName, number>,
  background: string,
  role: string
): Record<CyberpunkStatName, number> {
  const backgroundBonuses = CYBERPUNK_BACKGROUND_BONUSES[background] || {};
  const roleBonuses = CYBERPUNK_ROLE_BONUSES[role] || {};
  
  const statNames: CyberpunkStatName[] = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
  const result: Record<CyberpunkStatName, number> = {} as Record<CyberpunkStatName, number>;
  
  for (const stat of statNames) {
    const base = baseStats[stat] || 5;
    const bgBonus = backgroundBonuses[stat] || 0;
    const roleBonus = roleBonuses[stat] || 0;
    result[stat] = Math.min(10, base + bgBonus + roleBonus);
  }
  
  return result;
}

export function getRaceBonusDescription(race: string, gameSystem: string): string {
  if (gameSystem === "dnd") {
    const bonuses = DND_RACE_BONUSES[race];
    if (!bonuses) return "";
    return Object.entries(bonuses)
      .map(([stat, value]) => `+${value} ${stat.toUpperCase().slice(0, 3)}`)
      .join(", ");
  } else if (gameSystem === "cyberpunk") {
    const bonuses = CYBERPUNK_BACKGROUND_BONUSES[race];
    if (!bonuses) return "";
    return Object.entries(bonuses)
      .map(([stat, value]) => `+${value} ${stat.toUpperCase()}`)
      .join(", ");
  }
  return "";
}

export function getClassBonusDescription(characterClass: string, gameSystem: string): string {
  if (gameSystem === "dnd") {
    const hpInfo = DND_CLASS_HP_BONUSES[characterClass];
    if (!hpInfo) return "";
    return `Base HP: ${hpInfo.baseHp}, HP/Level: d${hpInfo.hpPerLevel * 2}`;
  } else if (gameSystem === "cyberpunk") {
    const bonuses = CYBERPUNK_ROLE_BONUSES[characterClass];
    if (!bonuses) return "";
    return Object.entries(bonuses)
      .map(([stat, value]) => `+${value} ${stat.toUpperCase()}`)
      .join(", ");
  }
  return "";
}

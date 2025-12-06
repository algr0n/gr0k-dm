// Dice rolling utility for TTRPG

export interface RollResult {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

// Parse and roll dice expressions like "2d6+3", "d20", "4d6-2"
export function parseDiceExpression(expression: string): RollResult | null {
  const cleanExpr = expression.toLowerCase().replace(/\s/g, "");
  
  // Match patterns like: 2d6, d20, 2d6+3, d20-1, 4d6+2
  const match = cleanExpr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  
  if (!match) {
    return null;
  }
  
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    return null;
  }
  
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  
  const rollSum = rolls.reduce((a, b) => a + b, 0);
  const total = rollSum + modifier;
  
  return {
    expression: cleanExpr,
    rolls,
    modifier,
    total,
  };
}

// Extract dice roll from natural language
export function extractDiceFromText(text: string): string | null {
  const patterns = [
    /roll\s+(?:a\s+)?(\d*d\d+(?:[+-]\d+)?)/i,
    /(\d*d\d+(?:[+-]\d+)?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Common roll types
export const COMMON_ROLLS = {
  ability: "4d6", // Roll for ability scores (drop lowest)
  attack: "1d20",
  damage: "1d8",
  initiative: "1d20",
  savingThrow: "1d20",
  skillCheck: "1d20",
  advantage: "2d20", // Take highest
  disadvantage: "2d20", // Take lowest
};

// Calculate ability modifier from stat
export function getAbilityModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

// Roll with advantage (take highest of two d20)
export function rollAdvantage(): { rolls: [number, number]; result: number } {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  return {
    rolls: [roll1, roll2],
    result: Math.max(roll1, roll2),
  };
}

// Roll with disadvantage (take lowest of two d20)
export function rollDisadvantage(): { rolls: [number, number]; result: number } {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  return {
    rolls: [roll1, roll2],
    result: Math.min(roll1, roll2),
  };
}

// Roll 4d6 drop lowest (standard ability score generation)
export function rollAbilityScore(): { rolls: number[]; result: number } {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => b - a);
  const keptRolls = rolls.slice(0, 3);
  const result = keptRolls.reduce((a, b) => a + b, 0);
  return { rolls, result };
}

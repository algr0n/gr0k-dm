// Dice rolling utility for TTRPG

export interface DiceRoll {
  value: number;
  dropped?: boolean;
  rerolled?: boolean;
  exploded?: boolean;
  floored?: boolean;
}

export interface RollResult {
  expression: string;
  rolls: DiceRoll[];
  modifier: number;
  total: number;
  breakdown: string;
  details?: {
    kept?: number[];
    dropped?: number[];
    rerolled?: number[];
    exploded?: number[];
    floored?: number[];
  };
}

export interface DiceComponent {
  count: number;
  sides: number;
  keepHighest?: number;
  keepLowest?: number;
  dropHighest?: number;
  dropLowest?: number;
  rerollOn?: number[];
  explodeOn?: number[];
  modifier: number;
}

export interface FiveETraitsConfig {
  halflingLucky?: boolean; // reroll 1s on d20 checks/attacks/saves once
  greatWeaponFighting?: boolean; // reroll 1s/2s on damage dice once
  savageAttacks?: boolean; // +1 weapon die on crit
  brutalCriticalDice?: number; // +N weapon dice on crit
  reliableTalentFloor?: number; // floor d20 to this value on ability checks
}

export interface RollContext {
  isAttackRoll?: boolean;
  isAbilityCheck?: boolean;
  isSavingThrow?: boolean;
  isDamageRoll?: boolean;
  isCritical?: boolean;
  weaponDieSize?: number; // e.g. 6 for d6
  // Optional metadata for downstream logging/analytics
  actorId?: string;
  actorName?: string;
  attackerId?: string;
  attackerName?: string;
  targetId?: string;
  targetName?: string;
  actorController?: string;
  isSpell?: boolean;
  isMonster?: boolean;
  isHealingRoll?: boolean;
  isDeathSave?: boolean;
  isOpportunityAttack?: boolean;
}

export interface RollOptions {
  maxExplosions?: number;
  maxRerolls?: number;
  rerollOnce?: boolean;
  traits?: FiveETraitsConfig;
  context?: RollContext;
}

// Roll a single die
function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// Parse dice modifiers like "kh3", "kl2", "dh1", "dl1", "r1", "!"
function parseModifiers(modStr: string): {
  keepHighest?: number;
  keepLowest?: number;
  dropHighest?: number;
  dropLowest?: number;
  rerollOn?: number[];
  explodeOn?: number[];
} {
  const result: ReturnType<typeof parseModifiers> = {};
  
  // Keep highest N (kh3)
  const khMatch = modStr.match(/kh(\d+)/);
  if (khMatch) result.keepHighest = parseInt(khMatch[1], 10);
  
  // Keep lowest N (kl2)
  const klMatch = modStr.match(/kl(\d+)/);
  if (klMatch) result.keepLowest = parseInt(klMatch[1], 10);
  
  // Drop highest N (dh1)
  const dhMatch = modStr.match(/dh(\d+)/);
  if (dhMatch) result.dropHighest = parseInt(dhMatch[1], 10);
  
  // Drop lowest N (dl1)
  const dlMatch = modStr.match(/dl(\d+)/);
  if (dlMatch) result.dropLowest = parseInt(dlMatch[1], 10);
  
  // Reroll on specific values (r1, r12)
  const rerollMatches = modStr.matchAll(/r(\d+)/g);
  result.rerollOn = Array.from(rerollMatches, m => parseInt(m[1], 10));
  
  // Explode (!) - reroll on max value and add
  if (modStr.includes("!")) {
    result.explodeOn = []; // Will be filled with max value
  }
  
  return result;
}

// Parse and roll dice expressions with advanced features
// Supports: 2d6+3, 4d6kh3, 2d20kh1+5, 1d6!, 4d6r1, 3d8+2d6+4, 2d6-1d4+3
export function parseDiceExpression(expression: string, options: RollOptions = {}): RollResult | null {
  const cleanExpr = expression.toLowerCase().replace(/\s/g, "");

  const tokens = cleanExpr.match(/([+-]?[^+-]+)/g);
  if (!tokens || tokens.length === 0) {
    return null;
  }

  const maxExplosions = options.maxExplosions ?? 10;
  const maxRerolls = options.maxRerolls ?? 10;
  const rerollOnce = options.rerollOnce ?? true;

  // Auto-add extra dice for crit traits (savage attacks, brutal critical) on damage rolls
  if (options.context?.isCritical && options.context?.isDamageRoll && options.context.weaponDieSize) {
    const extraDiceCount = (options.traits?.savageAttacks ? 1 : 0) + (options.traits?.brutalCriticalDice ?? 0);
    if (extraDiceCount > 0) {
      tokens.push(`+${extraDiceCount}d${options.context.weaponDieSize}`);
    }
  }

  let flatModifier = 0;
  let diceTotal = 0;
  const allRolls: DiceRoll[] = [];
  const breakdownParts: string[] = [];
  const details = {
    kept: [] as number[],
    dropped: [] as number[],
    rerolled: [] as number[],
    exploded: [] as number[],
    floored: [] as number[],
  };

  const shouldReroll = (value: number, sides: number, modifiers: ReturnType<typeof parseModifiers>): boolean => {
    if (modifiers.rerollOn && modifiers.rerollOn.includes(value)) {
      return true;
    }

    const isD20 = sides === 20;
    const ctx = options.context;
    const traits = options.traits;

    if (traits?.halflingLucky && isD20 && value === 1 && (ctx?.isAttackRoll || ctx?.isAbilityCheck || ctx?.isSavingThrow)) {
      return true;
    }

    if (traits?.greatWeaponFighting && ctx?.isDamageRoll && (value === 1 || value === 2)) {
      return true;
    }

    return false;
  };

  for (const token of tokens) {
    const sign = token.startsWith("-") ? -1 : 1;
    const body = token.startsWith("+") || token.startsWith("-") ? token.slice(1) : token;

    // Flat modifier
    if (/^\d+$/.test(body)) {
      const value = parseInt(body, 10) * sign;
      flatModifier += value;
      breakdownParts.push(`${sign === -1 ? "-" : "+"}${body}`);
      continue;
    }

    // Dice term
    const match = body.match(/^(\d*)d(\d+|%)([kdhlr!\d]*)$/);
    if (!match) {
      return null;
    }

    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = match[2] === "%" ? 100 : parseInt(match[2], 10);
    const modifiersStr = match[3] || "";

    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return null;
    }

    const modifiers = parseModifiers(modifiersStr);

    if (modifiers.explodeOn) {
      modifiers.explodeOn = [sides];
    }

    const groupRolls: DiceRoll[] = [];

    for (let i = 0; i < count; i++) {
      let value = rollDie(sides);
      const roll: DiceRoll = { value };

      let rerollCount = 0;
      while (shouldReroll(value, sides, modifiers) && rerollCount < maxRerolls) {
        details.rerolled.push(value);
        roll.rerolled = true;
        value = rollDie(sides);
        roll.value = value;
        rerollCount++;
        if (rerollOnce) break;
      }

      groupRolls.push(roll);

      if (modifiers.explodeOn && modifiers.explodeOn.includes(value)) {
        let explosionValue = value;
        let explosionCount = 0;

        while (modifiers.explodeOn.includes(explosionValue) && explosionCount < maxExplosions) {
          explosionValue = rollDie(sides);
          groupRolls.push({ value: explosionValue, exploded: true });
          details.exploded.push(explosionValue);
          explosionCount++;
          if (explosionValue !== sides) break;
        }
      }
    }

    if (modifiers.keepHighest || modifiers.keepLowest || modifiers.dropHighest || modifiers.dropLowest) {
      const sorted = [...groupRolls].sort((a, b) => b.value - a.value);

      if (modifiers.keepHighest) {
        for (let i = modifiers.keepHighest; i < sorted.length; i++) {
          const droppedRoll = groupRolls.find(r => r.value === sorted[i].value && !r.dropped);
          if (droppedRoll) {
            droppedRoll.dropped = true;
            details.dropped.push(droppedRoll.value);
          }
        }
      } else if (modifiers.keepLowest) {
        for (let i = 0; i < sorted.length - modifiers.keepLowest; i++) {
          const droppedRoll = groupRolls.find(r => r.value === sorted[i].value && !r.dropped);
          if (droppedRoll) {
            droppedRoll.dropped = true;
            details.dropped.push(droppedRoll.value);
          }
        }
      } else if (modifiers.dropHighest) {
        for (let i = 0; i < modifiers.dropHighest && i < sorted.length; i++) {
          const droppedRoll = groupRolls.find(r => r.value === sorted[i].value && !r.dropped);
          if (droppedRoll) {
            droppedRoll.dropped = true;
            details.dropped.push(droppedRoll.value);
          }
        }
      } else if (modifiers.dropLowest) {
        for (let i = sorted.length - 1; i >= sorted.length - modifiers.dropLowest && i >= 0; i--) {
          const droppedRoll = groupRolls.find(r => r.value === sorted[i].value && !r.dropped);
          if (droppedRoll) {
            droppedRoll.dropped = true;
            details.dropped.push(droppedRoll.value);
          }
        }
      }

      groupRolls.forEach(r => {
        if (!r.dropped) {
          details.kept.push(r.value);
        }
      });
    }

    if (options.traits?.reliableTalentFloor && options.context?.isAbilityCheck && sides === 20) {
      groupRolls.forEach(r => {
        if (!r.dropped && r.value < options.traits!.reliableTalentFloor!) {
          r.value = options.traits!.reliableTalentFloor!;
          r.floored = true;
          details.floored.push(r.value);
        }
      });
    }

    allRolls.push(...groupRolls);

    const keptValues = groupRolls.filter(r => !r.dropped).map(r => r.value);
    const groupSum = keptValues.reduce((a, b) => a + b, 0);
    const signedGroupSum = groupSum * sign;
    diceTotal += signedGroupSum;

    breakdownParts.push(`${sign === -1 ? "-" : "+"}${match[0]}=[${keptValues.join(",")}]=${signedGroupSum}`);
  }

  const total = diceTotal + flatModifier;

  let breakdown = breakdownParts.join(" ");
  if (flatModifier !== 0) {
    breakdown += ` ${flatModifier >= 0 ? "+" : ""}${flatModifier}`;
  }
  breakdown += ` = ${total}`;

  return {
    expression: cleanExpr,
    rolls: allRolls,
    modifier: flatModifier,
    total,
    breakdown,
    details: Object.keys(details).some(k => details[k as keyof typeof details].length > 0)
      ? details
      : undefined,
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
export function rollAdvantage(options: RollOptions = {}): { rolls: [number, number]; result: number; breakdown: string } {
  const result = parseDiceExpression("2d20kh1", options);
  if (!result) {
    // Fallback
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    return {
      rolls: [roll1, roll2],
      result: Math.max(roll1, roll2),
      breakdown: `[${roll1}, ${roll2}] → ${Math.max(roll1, roll2)}`,
    };
  }
  return {
    rolls: [result.rolls[0].value, result.rolls[1].value],
    result: result.total,
    breakdown: result.breakdown,
  };
}

// Roll with Elven Accuracy (3d20 keep highest)
export function rollElvenAccuracy(options: RollOptions = {}): { rolls: [number, number, number]; result: number; breakdown: string } {
  const result = parseDiceExpression("3d20kh1", options);
  if (!result) {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const roll3 = Math.floor(Math.random() * 20) + 1;
    const best = Math.max(roll1, roll2, roll3);
    return {
      rolls: [roll1, roll2, roll3],
      result: best,
      breakdown: `[${roll1}, ${roll2}, ${roll3}] → ${best}`,
    };
  }
  return {
    rolls: [result.rolls[0].value, result.rolls[1].value, result.rolls[2].value],
    result: result.total,
    breakdown: result.breakdown,
  };
}

// Roll with disadvantage (take lowest of two d20)
export function rollDisadvantage(options: RollOptions = {}): { rolls: [number, number]; result: number; breakdown: string } {
  const result = parseDiceExpression("2d20kl1", options);
  if (!result) {
    // Fallback
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    return {
      rolls: [roll1, roll2],
      result: Math.min(roll1, roll2),
      breakdown: `[${roll1}, ${roll2}] → ${Math.min(roll1, roll2)}`,
    };
  }
  return {
    rolls: [result.rolls[0].value, result.rolls[1].value],
    result: result.total,
    breakdown: result.breakdown,
  };
}

// Roll 4d6 drop lowest (standard ability score generation)
export function rollAbilityScore(): { rolls: number[]; result: number; breakdown: string } {
  const result = parseDiceExpression("4d6dl1");
  if (!result) {
    // Fallback
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    const keptRolls = rolls.slice(0, 3);
    const total = keptRolls.reduce((a, b) => a + b, 0);
    return { 
      rolls, 
      result: total,
      breakdown: `[${rolls.join(", ")}] drop lowest → ${total}`,
    };
  }
  return { 
    rolls: result.rolls.map(r => r.value), 
    result: result.total,
    breakdown: result.breakdown,
  };
}

// Roll with Reliable Talent floor (defaults to 10 on d20 ability checks)
export function rollReliableTalent(expression = "1d20", floor = 10): RollResult | null {
  return parseDiceExpression(expression, {
    traits: { reliableTalentFloor: floor },
    context: { isAbilityCheck: true },
  });
}

// Roll for critical hit (double dice)
export function rollCritical(normalExpression: string, options: RollOptions = {}): RollResult | null {
  const result = parseDiceExpression(normalExpression, options);
  if (!result) return null;
  
  const dicePattern = /(\d*)d(\d+)/g;
  const critExpression = normalExpression.replace(dicePattern, (match, count, sides) => {
    const diceCount = count ? parseInt(count, 10) : 1;
    return `${diceCount * 2}d${sides}`;
  });
  
  const context = { ...options.context, isCritical: true };
  return parseDiceExpression(critExpression, { ...options, context });
}

// Validate a dice expression without rolling
export function validateDiceExpression(expression: string): { valid: boolean; error?: string } {
  const cleanExpr = expression.toLowerCase().replace(/\s/g, "");
  
  // Check for basic dice pattern
  const hasDice = /\d*d\d+/.test(cleanExpr);
  if (!hasDice) {
    return { valid: false, error: "No valid dice expression found" };
  }
  
  // Try to parse it
  const result = parseDiceExpression(cleanExpr);
  if (!result) {
    return { valid: false, error: "Invalid dice expression format" };
  }
  
  return { valid: true };
}

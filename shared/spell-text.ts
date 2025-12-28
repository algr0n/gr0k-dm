import type { Spell } from "./schema";

export type ParsedSpellEffect = {
  saveAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha";
  onSuccess?: "half" | "none" | "custom";
  damageExpression?: string | null;
  requiresAttackRoll?: boolean;
  tags?: string[];
};

const abilityMap: Record<string, ParsedSpellEffect["saveAbility"]> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const diceRegex = /(\d+d\d+(?:\s*[+\-]\s*\d+)?)/i;

export function inferSpellEffects(spell: Pick<Spell, "description" | "name">): ParsedSpellEffect {
  const text = (spell.description || "").toLowerCase();
  const tags: string[] = [];

  // Detect saving throw
  const saveMatch = text.match(/make a ([a-z]+) saving throw/);
  const saveAbility = saveMatch ? abilityMap[saveMatch[1]] : undefined;

  // Detect half damage on success
  const halfOnSuccess = /half as much damage on a successful/.test(text);
  const noEffectOnSuccess = /no effect on a successful/.test(text);
  const onSuccess: ParsedSpellEffect["onSuccess"] = noEffectOnSuccess ? "none" : halfOnSuccess ? "half" : undefined;

  // Detect damage expression from text if present
  const diceMatch = text.match(diceRegex);
  const damageExpression = diceMatch ? diceMatch[1].replace(/\s+/g, "") : null;

  // Detect utility tags
  if (/invisible|charmed|frightened|blinded|deafened|paralyzed|petrified/.test(text)) tags.push("debuff");
  if (/resistance|advantage|bonus|temp hp|temporary hit points/.test(text)) tags.push("buff");
  if (/heal|regain hit points/.test(text)) tags.push("healing");
  if (/move|telekin|levitat|fly/.test(text)) tags.push("movement");
  if (/hand|mage hand|telekinesis/.test(text)) tags.push("manipulation");

  // Detect attack roll language
  const requiresAttackRoll = /ranged spell attack|melee spell attack/.test(text);

  return {
    saveAbility,
    onSuccess,
    damageExpression,
    requiresAttackRoll,
    tags,
  };
}

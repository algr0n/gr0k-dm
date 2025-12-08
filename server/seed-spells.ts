import { db } from "./db";
import { spells } from "@shared/schema";
import { count } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

interface SpellData {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: { verbal: boolean; somatic: boolean; material: string | null };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels: string | null;
  classes: string[];
  source: string;
}

/**
 * Check if spells are already seeded
 */
export async function isSpellsSeeded(): Promise<boolean> {
  const result = await db.select({ count: count() }).from(spells);
  return result[0].count > 0;
}

/**
 * Seed spells from local JSON data if the table is empty
 * Uses bundled spell data for reliable, offline-safe startup
 */
export async function seedSpells(): Promise<void> {
  // Check if already seeded
  if (await isSpellsSeeded()) {
    console.log("[Seed] Spells already exist in database, skipping seed.");
    return;
  }

  console.log("[Seed] Seeding spells from local data...");

  try {
    // Read spell data from local JSON file
    const spellDataPath = join(process.cwd(), "shared/data/spells.json");
    const spellDataRaw = readFileSync(spellDataPath, "utf-8");
    const spellData: SpellData[] = JSON.parse(spellDataRaw);

    if (!spellData || spellData.length === 0) {
      console.log("[Seed] No spell data found in local file.");
      return;
    }

    console.log(`[Seed] Found ${spellData.length} spells to insert...`);

    // Insert all spells in a single batch for efficiency
    const spellValues = spellData.map((spell) => ({
      id: spell.id,
      name: spell.name,
      level: spell.level,
      school: spell.school as any,
      castingTime: spell.castingTime,
      range: spell.range,
      components: spell.components,
      duration: spell.duration,
      concentration: spell.concentration,
      ritual: spell.ritual,
      description: spell.description,
      higherLevels: spell.higherLevels,
      classes: spell.classes,
      source: spell.source || "SRD",
    }));

    // Batch insert - much faster than one at a time
    await db.insert(spells).values(spellValues).onConflictDoNothing();

    console.log(`[Seed] Spell seeding complete! ${spellData.length} spells added.`);
  } catch (err) {
    console.error("[Seed] Failed to seed spells:", err);
    throw err;
  }
}

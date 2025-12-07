import { db } from "./db";
import { items, itemCategoryEnum, itemRarityEnum } from "@shared/schema";
import { eq } from "drizzle-orm";

// Unit conversion: gp=100cp, sp=10cp, cp=1
const UNIT_TO_CP: Record<string, number> = { gp: 100, sp: 10, cp: 1 };

// Category mapping (simplified from API)
const API_TO_CATEGORY: Partial<Record<string, typeof itemCategoryEnum.enumValues[number]>> = {
  "ammunition": "ammunition",
  "armor": "armor",
  "potion": "potion",
  "ring": "ring",
  "rod": "rod",
  "scroll": "scroll",
  "staff": "staff",
  "wand": "wand",
  "weapon": "weapon",
  "wondrous-item": "wondrous_item",
};

async function seedItems() {
  // Clear existing items (safe for re-seeding)
  await db.delete(items);

  // Fetch mundane equipment
  const eqRes = await fetch("https://www.dnd5eapi.co/api/equipment");
  const eqData = await eqRes.json();
  for (const eq of eqData.results) {
    const detailRes = await fetch(`https://www.dnd5eapi.co${eq.url}`);
    const detail = await detailRes.json();
    const categoryKey = detail.equipment_category?.index || "adventuring_gear";
    const category = API_TO_CATEGORY[categoryKey] || "adventuring_gear";
    const costCp = detail.cost ? detail.cost.quantity * (UNIT_TO_CP[detail.cost.unit] || 1) : null;
    await db.insert(items).values({
      id: detail.index,
      name: detail.name,
      category: category,
      type: detail.weapon_category || detail.armor_category || categoryKey,
      subtype: detail.index,
      rarity: "common",
      cost: costCp,
      weight: detail.weight || 0,
      description: detail.desc?.join("\n") || "",
      properties: detail, // Full API data as JSON for flexibility
      gameSystem: "dnd",
      source: "SRD",
    }).onConflictDoNothing(); // Skip if duplicate
  }

  // Fetch magic items
  const miRes = await fetch("https://www.dnd5eapi.co/api/magic-items");
  const miData = await miRes.json();
  for (const mi of miData.results) {
    const detailRes = await fetch(`https://www.dnd5eapi.co${mi.url}`);
    const detail = await detailRes.json();
    const categoryKey = detail.equipment_category?.index || "wondrous-item";
    const category = API_TO_CATEGORY[categoryKey] || "wondrous_item";
    await db.insert(items).values({
      id: detail.index,
      name: detail.name,
      category: category,
      type: detail.equipment_category?.name || categoryKey,
      subtype: detail.index,
      rarity: detail.rarity.name.toLowerCase().replace(/ /g, "_"),
      cost: null, // Magic items often priceless
      weight: detail.weight || 0,
      description: detail.desc?.join("\n") || "",
      properties: detail, // Full API data as JSON
      requiresAttunement: detail.attunement || false,
      gameSystem: "dnd",
      source: "SRD",
    }).onConflictDoNothing();
  }

  console.log("Seeded items successfully!");
}

seedItems().catch(console.error);
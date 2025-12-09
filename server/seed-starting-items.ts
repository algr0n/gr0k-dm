import { db } from "./db";
import { items } from "@shared/schema";

/**
 * Seed file for core D&D starting items used in character creation.
 * This is idempotent - can be run multiple times safely using INSERT OR IGNORE.
 * 
 * Run after database initialization with:
 *   tsx server/seed-starting-items.ts
 */

interface SeedItem {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
  cost?: number;  // in copper pieces (100cp = 1gp)
  weight?: number;
  rarity?: string;
}

// Core starting items referenced in server/routes.ts dndStartingItems
const startingItems: SeedItem[] = [
  // Adventuring Gear
  {
    id: "backpack",
    name: "Backpack",
    category: "adventuring_gear",
    type: "container",
    description: "A backpack can hold one cubic foot or 30 pounds of gear. You can also strap items, such as a bedroll or a coil of rope, to the outside of a backpack.",
    cost: 200, // 2 gp
    weight: 5,
    rarity: "common"
  },
  {
    id: "bedroll",
    name: "Bedroll",
    category: "adventuring_gear",
    type: "gear",
    description: "A bedroll consists of bedding and a blanket that can be rolled up and carried.",
    cost: 100, // 1 gp
    weight: 7,
    rarity: "common"
  },
  {
    id: "rations-1-day",
    name: "Rations (1 day)",
    category: "adventuring_gear",
    type: "consumable",
    description: "Rations consist of dry foods suitable for extended travel, including jerky, dried fruit, hardtack, and nuts.",
    cost: 50, // 5 sp
    weight: 2,
    rarity: "common"
  },
  {
    id: "waterskin",
    name: "Waterskin",
    category: "adventuring_gear",
    type: "container",
    description: "A waterskin can hold 4 pints of liquid.",
    cost: 20, // 2 sp
    weight: 5,
    rarity: "common"
  },
  {
    id: "torch",
    name: "Torch",
    category: "adventuring_gear",
    type: "light",
    description: "A torch burns for 1 hour, providing bright light in a 20-foot radius and dim light for an additional 20 feet. If you make a melee attack with a burning torch and hit, it deals 1 fire damage.",
    cost: 1, // 1 cp
    weight: 1,
    rarity: "common"
  },
  {
    id: "component-pouch",
    name: "Component Pouch",
    category: "adventuring_gear",
    type: "tool",
    description: "A component pouch is a small, watertight leather belt pouch that has compartments to hold all the material components and other special items you need to cast your spells, except for those components that have a specific cost.",
    cost: 2500, // 25 gp
    weight: 2,
    rarity: "common"
  },
  {
    id: "holy-symbol",
    name: "Holy Symbol",
    category: "adventuring_gear",
    type: "tool",
    description: "A holy symbol is a representation of a god or pantheon. A cleric or paladin can use a holy symbol as a spellcasting focus. To use the symbol in this way, the caster must hold it in hand, wear it visibly, or bear it on a shield.",
    cost: 500, // 5 gp
    weight: 1,
    rarity: "common"
  },

  // Weapons - Simple Melee
  {
    id: "dagger",
    name: "Dagger",
    category: "weapon",
    type: "Simple Melee",
    description: "A small, easily concealed blade. Damage: 1d4 piercing. Properties: Finesse, light, thrown (range 20/60).",
    cost: 200, // 2 gp
    weight: 1,
    rarity: "common"
  },
  {
    id: "mace",
    name: "Mace",
    category: "weapon",
    type: "Simple Melee",
    description: "A simple bludgeoning weapon with a heavy head on a handle. Damage: 1d6 bludgeoning.",
    cost: 500, // 5 gp
    weight: 4,
    rarity: "common"
  },
  {
    id: "quarterstaff",
    name: "Quarterstaff",
    category: "weapon",
    type: "Simple Melee",
    description: "A long wooden staff. Damage: 1d6 bludgeoning (1d8 if wielded with two hands). Properties: Versatile.",
    cost: 20, // 2 sp
    weight: 4,
    rarity: "common"
  },

  // Weapons - Simple Ranged
  {
    id: "dart",
    name: "Dart",
    category: "weapon",
    type: "Simple Ranged",
    description: "A small throwing weapon. Damage: 1d4 piercing. Properties: Finesse, thrown (range 20/60).",
    cost: 5, // 5 cp
    weight: 0.25,
    rarity: "common"
  },

  // Weapons - Martial Melee
  {
    id: "longsword",
    name: "Longsword",
    category: "weapon",
    type: "Martial Melee",
    description: "A classic versatile blade. Damage: 1d8 slashing (1d10 if wielded with two hands). Properties: Versatile.",
    cost: 1500, // 15 gp
    weight: 3,
    rarity: "common"
  },
  {
    id: "shortsword",
    name: "Shortsword",
    category: "weapon",
    type: "Martial Melee",
    description: "A light, quick blade. Damage: 1d6 piercing. Properties: Finesse, light.",
    cost: 1000, // 10 gp
    weight: 2,
    rarity: "common"
  },
  {
    id: "rapier",
    name: "Rapier",
    category: "weapon",
    type: "Martial Melee",
    description: "A slender, sharply pointed sword. Damage: 1d8 piercing. Properties: Finesse.",
    cost: 2500, // 25 gp
    weight: 2,
    rarity: "common"
  },
  {
    id: "greataxe",
    name: "Greataxe",
    category: "weapon",
    type: "Martial Melee",
    description: "A large, heavy axe. Damage: 1d12 slashing. Properties: Heavy, two-handed.",
    cost: 3000, // 30 gp
    weight: 7,
    rarity: "common"
  },
  {
    id: "handaxe",
    name: "Handaxe",
    category: "weapon",
    type: "Martial Melee",
    description: "A small throwing axe. Damage: 1d6 slashing. Properties: Light, thrown (range 20/60).",
    cost: 500, // 5 gp
    weight: 2,
    rarity: "common"
  },

  // Weapons - Martial Ranged
  {
    id: "longbow",
    name: "Longbow",
    category: "weapon",
    type: "Martial Ranged",
    description: "A tall bow for long-range attacks. Damage: 1d8 piercing. Properties: Ammunition (range 150/600), heavy, two-handed.",
    cost: 5000, // 50 gp
    weight: 2,
    rarity: "common"
  },
];

async function seedStartingItems() {
  console.log("Seeding core D&D starting items...");
  
  let inserted = 0;
  let skipped = 0;

  for (const item of startingItems) {
    try {
      await db.insert(items)
        .values({
          id: item.id,
          name: item.name,
          category: item.category as any,
          type: item.type,
          description: item.description,
          cost: item.cost || null,
          weight: item.weight || null,
          rarity: (item.rarity || "common") as any,
          gameSystem: "dnd",
          source: "SRD",
        })
        .onConflictDoNothing(); // Idempotent - skip if already exists
      
      inserted++;
    } catch (error) {
      // If the item already exists, that's fine
      if (error && String(error).includes("UNIQUE constraint")) {
        skipped++;
        console.log(`  → Skipped ${item.id} (already exists)`);
      } else {
        console.error(`  ✗ Failed to insert ${item.id}:`, error);
        throw error;
      }
    }
  }

  console.log(`✓ Seeded ${inserted} starting items (${skipped} already existed)`);
  console.log("Core starting items are now available for character creation!");
}

// Run the seed if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedStartingItems()
    .then(() => {
      console.log("Seed completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedStartingItems };

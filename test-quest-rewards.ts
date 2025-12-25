/**
 * Manual test script for quest reward distribution and dynamic item creation
 * Run this with: tsx test-quest-rewards.ts
 */

import { createItemFromReward } from "./server/utils/item-creation";

async function testItemCreation() {
  console.log("\n=== Testing Dynamic Item Creation ===\n");

  try {
    // Test 1: Create a simple weapon
    console.log("Test 1: Creating 'Sword of Testing'...");
    const sword = await createItemFromReward("Sword of Testing", {
      questDescription: "A quest to test the reward system",
      gameSystem: "dnd"
    });
    console.log("✓ Created:", sword.name, `(${sword.id})`);
    console.log("  Category:", sword.category);
    console.log("  Type:", sword.type);
    console.log("  Rarity:", sword.rarity);
    console.log("  Description:", sword.description.substring(0, 100) + "...");
    console.log("  Properties:", JSON.stringify(sword.properties).substring(0, 100) + "...");

    // Test 2: Create a magic item
    console.log("\nTest 2: Creating 'Amulet of Protection'...");
    const amulet = await createItemFromReward("Amulet of Protection", {
      questDescription: "Reward for saving the village",
      gameSystem: "dnd"
    });
    console.log("✓ Created:", amulet.name, `(${amulet.id})`);
    console.log("  Category:", amulet.category);
    console.log("  Rarity:", amulet.rarity);

    // Test 3: Create a healing potion
    console.log("\nTest 3: Creating 'Greater Healing Potion'...");
    const potion = await createItemFromReward("Greater Healing Potion", {
      gameSystem: "dnd"
    });
    console.log("✓ Created:", potion.name, `(${potion.id})`);
    console.log("  Category:", potion.category);

    console.log("\n=== All Tests Passed ===\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
testItemCreation().catch(console.error);

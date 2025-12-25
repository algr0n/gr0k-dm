import { storage } from "./server/storage";

async function testAdvancedCombat() {
  console.log("Testing Advanced Combat System...\n");
  
  try {
    // Test 1: Create a combat encounter
    console.log("1. Creating combat encounter...");
    const encounter = await storage.createCombatEncounter({
      name: "Goblin Ambush",
      roomId: "test-room-id",
      generatedBy: "manual",
      seed: "test-123",
      metadata: { difficulty: "medium", partyLevel: 3 }
    });
    console.log("   ✓ Encounter created:", encounter.id);
    
    // Test 2: Add environment features
    console.log("\n2. Adding environment features...");
    const features = await storage.addEnvironmentFeatures(encounter.id, [
      { type: "cover", positionX: 10, positionY: 5, radius: 3, properties: { coverBonus: 2 } },
      { type: "difficult", positionX: 15, positionY: 8, radius: 5, properties: { movementCostMultiplier: 2 } }
    ]);
    console.log(`   ✓ Added ${features.length} environment features`);
    
    // Test 3: Add combat spawns
    console.log("\n3. Adding combat spawns...");
    const spawns = await storage.addCombatSpawns(encounter.id, [
      { monsterName: "Goblin", count: 3, positionX: 20, positionY: 10, behavior: "aggressive" },
      { monsterName: "Goblin Boss", count: 1, positionX: 25, positionY: 12, behavior: "defensive" }
    ]);
    console.log(`   ✓ Added ${spawns.length} spawn points`);
    
    // Test 4: Retrieve encounter by ID
    console.log("\n4. Retrieving encounter...");
    const retrieved = await storage.getCombatEncounterById(encounter.id);
    console.log("   ✓ Retrieved:", retrieved?.name);
    
    // Test 5: Get environment features
    console.log("\n5. Getting environment features...");
    const retrievedFeatures = await storage.getEnvironmentFeaturesByEncounter(encounter.id);
    console.log(`   ✓ Found ${retrievedFeatures.length} features`);
    
    // Test 6: Get spawns
    console.log("\n6. Getting spawns...");
    const retrievedSpawns = await storage.getCombatSpawnsByEncounter(encounter.id);
    console.log(`   ✓ Found ${retrievedSpawns.length} spawns`);
    retrievedSpawns.forEach(s => {
      console.log(`      - ${s.count}x ${s.monsterName} at (${s.positionX}, ${s.positionY})`);
    });
    
    // Test 7: Update encounter
    console.log("\n7. Updating encounter...");
    const updated = await storage.updateCombatEncounter(encounter.id, {
      metadata: JSON.stringify({ difficulty: "hard", partyLevel: 4 })
    });
    console.log("   ✓ Updated:", updated?.id);
    
    console.log("\n✅ All tests passed!");
    
  } catch (err) {
    console.error("\n❌ Test failed:", err);
    throw err;
  }
  
  process.exit(0);
}

testAdvancedCombat();

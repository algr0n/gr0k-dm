import { storage } from "./storage";

async function testItems() {
  // Search for a sword
  const swords = await storage.searchItems("sword");
  console.log("Found swords:", swords.length);

  // Get a specific item
  const longsword = await storage.getItem("longsword");
  console.log("Longsword details:", longsword);

  // Assume you have a characterId from your DB – replace with a real one
  const characterId = "your-character-uuid-here";  // Get from DB
  await storage.addToInventory({
    characterId,
    itemId: "longsword",
    quantity: 1,
  });

  const inventory = await storage.getInventoryWithDetails(characterId);
  console.log("Inventory:", inventory);
}

testItems().catch(console.error);
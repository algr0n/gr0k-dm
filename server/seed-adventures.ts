/**
 * Seed script for adventure modules
 * Populates the database with Lost Mine of Phandelver adventure data
 */

import { db } from "./db";
import {
  adventures,
  adventureChapters,
  adventureLocations,
  adventureNpcs,
  adventureQuests,
  adventureEncounters,
} from "@shared/schema";
import { lostMineData } from "./data/adventures/lostmine-data";
import { eq } from "drizzle-orm";

async function seedAdventures() {
  try {
    console.log("Starting adventure seeding...");

    // Check if Lost Mine already exists
    const existing = await db
      .select()
      .from(adventures)
      .where(eq(adventures.slug, lostMineData.adventure.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log("Lost Mine of Phandelver already exists. Removing old data...");
      // Delete existing adventure (cascade will clean up related records)
      await db.delete(adventures).where(eq(adventures.id, existing[0].id));
      console.log("Old data removed.");
    }

    // Insert the adventure
    console.log("Inserting adventure metadata...");
    const [insertedAdventure] = await db
      .insert(adventures)
      .values(lostMineData.adventure)
      .returning();
    console.log(`✓ Adventure created: ${insertedAdventure.name} (ID: ${insertedAdventure.id})`);

    // Insert chapters
    console.log("\nInserting chapters...");
    const chapterMap = new Map<number, string>(); // chapterNumber -> chapterId
    for (const chapterData of lostMineData.chapters) {
      const [chapter] = await db
        .insert(adventureChapters)
        .values({
          ...chapterData,
          adventureId: insertedAdventure.id,
        })
        .returning();
      chapterMap.set(chapter.chapterNumber, chapter.id);
      console.log(`  ✓ Chapter ${chapter.chapterNumber}: ${chapter.title}`);
    }

    // Map chapter numbers to locations
    const chapterLocationMapping: Record<string, number> = {
      "Goblin Ambush Site": 1,
      "Cragmaw Hideout": 1,
      "Phandalin": 2,
      "Redbrand Hideout": 2,
      "Cragmaw Castle": 3,
      "Thundertree": 3,
      "Old Owl Well": 3,
      "Wyvern Tor": 3,
      "Wave Echo Cave": 4,
    };

    // Insert locations
    console.log("\nInserting locations...");
    const locationMap = new Map<string, string>(); // locationName -> locationId
    for (const locationData of lostMineData.locations) {
      const chapterNumber = chapterLocationMapping[locationData.name];
      const chapterId = chapterNumber ? chapterMap.get(chapterNumber) : undefined;

      const [location] = await db
        .insert(adventureLocations)
        .values({
          ...locationData,
          adventureId: insertedAdventure.id,
          chapterId: chapterId || null,
        })
        .returning();
      locationMap.set(location.name, location.id);
      console.log(`  ✓ Location: ${location.name} (Type: ${location.type})`);
    }

    // Map NPCs to locations
    const npcLocationMapping: Record<string, string> = {
      "Sildar Hallwinter": "Cragmaw Hideout",
      "Klarg": "Cragmaw Hideout",
      "King Grol": "Cragmaw Castle",
      "Toblen Stonehill": "Phandalin",
      "Sister Garaele": "Phandalin",
      "Halia Thornton": "Phandalin",
      "Daran Edermath": "Phandalin",
      "Linene Graywind": "Phandalin",
      "Harbin Wester": "Phandalin",
      "Glasstaff (Iarno Albrek)": "Redbrand Hideout",
      "Reidoth the Druid": "Thundertree",
      "Venomfang": "Thundertree",
      "Hamun Kost": "Old Owl Well",
      "Nezznar (The Black Spider)": "Wave Echo Cave",
    };

    // Insert NPCs
    console.log("\nInserting NPCs...");
    const npcMap = new Map<string, string>(); // npcName -> npcId
    for (const npcData of lostMineData.npcs) {
      const locationName = npcLocationMapping[npcData.name];
      const locationId = locationName ? locationMap.get(locationName) : undefined;

      const [npc] = await db
        .insert(adventureNpcs)
        .values({
          ...npcData,
          adventureId: insertedAdventure.id,
          locationId: locationId || null,
        })
        .returning();
      npcMap.set(npc.name, npc.id);
      console.log(`  ✓ NPC: ${npc.name} (${npc.role})`);
    }

    // Map quests to chapters and quest givers
    const questChapterMapping: Record<string, number> = {
      "Escort Supplies to Phandalin": 1,
      "Rescue Sildar Hallwinter": 1,
      "Deal with the Redbrands": 2,
      "Find Cragmaw Castle": 3,
      "Explore Wave Echo Cave": 4,
      "The Orc Trouble": 3,
      "Reidoth the Druid": 3,
      "Old Owl Well": 3,
      "Banshee's Bargain": 2,
      "Recover Lionshield Cargo": 2,
    };

    const questGiverMapping: Record<string, string> = {
      "Escort Supplies to Phandalin": "Gundren Rockseeker",
      "Rescue Sildar Hallwinter": "Sildar Hallwinter",
      "Deal with the Redbrands": "Sildar Hallwinter",
      "Find Cragmaw Castle": "Sildar Hallwinter",
      "Explore Wave Echo Cave": "Gundren Rockseeker",
      "The Orc Trouble": "Daran Edermath",
      "Reidoth the Druid": "Sildar Hallwinter",
      "Old Owl Well": "Daran Edermath",
      "Banshee's Bargain": "Sister Garaele",
      "Recover Lionshield Cargo": "Linene Graywind",
    };

    // Insert quests
    console.log("\nInserting quests...");
    for (const questData of lostMineData.quests) {
      const chapterNumber = questChapterMapping[questData.name];
      const chapterId = chapterNumber ? chapterMap.get(chapterNumber) : undefined;
      
      const questGiverName = questGiverMapping[questData.name];
      const questGiverId = questGiverName ? npcMap.get(questGiverName) : undefined;

      await db
        .insert(adventureQuests)
        .values({
          ...questData,
          adventureId: insertedAdventure.id,
          chapterId: chapterId || null,
          questGiverId: questGiverId || null,
        });
      console.log(`  ✓ Quest: ${questData.name} (${questData.isMainQuest ? 'Main' : 'Side'})`);
    }

    // Map encounters to locations
    const encounterLocationMapping: Record<string, string> = {
      "Goblin Ambush": "Goblin Ambush Site",
      "Klarg and the Wolves": "Cragmaw Hideout",
      "Redbrand Ruffians at the Sleeping Giant": "Phandalin",
      "The Nothic": "Redbrand Hideout",
      "Glasstaff's Chamber": "Redbrand Hideout",
      "King Grol and Companions": "Cragmaw Castle",
      "Owlbear in Cragmaw Castle": "Cragmaw Castle",
      "Venomfang the Dragon": "Thundertree",
      "Orcs at Wyvern Tor": "Wyvern Tor",
      "Flameskull Guardian": "Wave Echo Cave",
      "The Spectator": "Wave Echo Cave",
      "Nezznar the Black Spider": "Wave Echo Cave",
    };

    // Insert encounters
    console.log("\nInserting encounters...");
    for (const encounterData of lostMineData.encounters) {
      const locationName = encounterLocationMapping[encounterData.name];
      const locationId = locationName ? locationMap.get(locationName) : undefined;

      await db
        .insert(adventureEncounters)
        .values({
          ...encounterData,
          adventureId: insertedAdventure.id,
          locationId: locationId || null,
        });
      console.log(`  ✓ Encounter: ${encounterData.name} (${encounterData.type}, ${encounterData.difficulty})`);
    }

    console.log("\n✅ Adventure seeding completed successfully!");
    console.log(`\nSummary:`);
    console.log(`  - 1 Adventure: ${insertedAdventure.name}`);
    console.log(`  - ${lostMineData.chapters.length} Chapters`);
    console.log(`  - ${lostMineData.locations.length} Locations`);
    console.log(`  - ${lostMineData.npcs.length} NPCs`);
    console.log(`  - ${lostMineData.quests.length} Quests`);
    console.log(`  - ${lostMineData.encounters.length} Encounters`);

  } catch (error) {
    console.error("Error seeding adventures:", error);
    throw error;
  }
}

// Run the seeding
seedAdventures()
  .then(() => {
    console.log("\nSeeding complete. Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

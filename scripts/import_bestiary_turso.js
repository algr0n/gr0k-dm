/**
 * Import Bestiary to Turso Database
 * 
 * This script imports monster data from ref/monster_stats.json into the
 * bestiary tables in a Turso SQLite database.
 * 
 * Environment Variables:
 * - TURSO_DATABASE_URL: The Turso database URL (required)
 * - TURSO_AUTH_TOKEN: The Turso auth token (required)
 * - BATCH_SIZE: Number of monsters to process per batch (default: 10)
 * 
 * Usage:
 *   node scripts/import_bestiary_turso.js
 */

import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);

// Validate environment variables
if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error("❌ Missing required environment variables:");
  console.error("   - TURSO_DATABASE_URL");
  console.error("   - TURSO_AUTH_TOKEN");
  console.error("\nPlease set these in your .env file or environment.");
  process.exit(1);
}

/**
 * Parse challenge rating string or number to decimal value
 */
function parseChallengeRating(cr) {
  if (!cr && cr !== 0) return 0;
  
  // Handle numeric input
  if (typeof cr === "number") return cr;
  
  // Handle string fractions
  const crStr = String(cr);
  if (crStr.includes("/")) {
    const [num, denom] = crStr.split("/").map(Number);
    return num / denom;
  }
  
  return parseFloat(crStr) || 0;
}

/**
 * Extract average HP from hit points string
 * e.g., "180 (19d10 + 76)" -> 180
 */
function extractHpAverage(hitPoints) {
  if (!hitPoints) return null;
  
  const match = hitPoints.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse speed string into JSON object
 * e.g., "20 ft., fly 50 ft." -> {"walk": 20, "fly": 50}
 */
function parseSpeed(speedStr) {
  if (!speedStr) return null;
  
  const speeds = {};
  const parts = speedStr.split(",").map(s => s.trim());
  
  for (const part of parts) {
    const match = part.match(/^(\d+)\s*ft\.?$/);
    if (match) {
      speeds.walk = parseInt(match[1], 10);
      continue;
    }
    
    const namedMatch = part.match(/^([\w\s]+)\s+(\d+)\s*ft\.?/);
    if (namedMatch) {
      const [, type, value] = namedMatch;
      speeds[type.trim().toLowerCase()] = parseInt(value, 10);
    }
  }
  
  return Object.keys(speeds).length > 0 ? JSON.stringify(speeds) : null;
}

/**
 * Import a single monster with all its related data
 */
async function importMonster(client, monster) {
  const crDecimal = parseChallengeRating(monster.challenge_rating);
  const hpAvg = extractHpAverage(monster.hit_points);
  const speedJson = parseSpeed(monster.speed);
  
  const abilities = monster.ability_scores || {};
  const legendaryCount = monster.legendary_actions?.count || 0;
  
  try {
    // Upsert monster
    const monsterResult = await client.execute({
      sql: `
        INSERT INTO bestiary_monsters (
          name, size, type, subtype, alignment, armor_class, armor_type,
          hit_points, hp_avg, speed, speed_json,
          str, dex, con, int, wis, cha,
          saving_throws, skills, damage_resistances, damage_immunities,
          damage_vulnerabilities, condition_immunities, senses, languages,
          challenge_rating, cr_decimal, xp, legendary_action_count, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(name) DO UPDATE SET
          size = excluded.size,
          type = excluded.type,
          subtype = excluded.subtype,
          alignment = excluded.alignment,
          armor_class = excluded.armor_class,
          armor_type = excluded.armor_type,
          hit_points = excluded.hit_points,
          hp_avg = excluded.hp_avg,
          speed = excluded.speed,
          speed_json = excluded.speed_json,
          str = excluded.str,
          dex = excluded.dex,
          con = excluded.con,
          int = excluded.int,
          wis = excluded.wis,
          cha = excluded.cha,
          saving_throws = excluded.saving_throws,
          skills = excluded.skills,
          damage_resistances = excluded.damage_resistances,
          damage_immunities = excluded.damage_immunities,
          damage_vulnerabilities = excluded.damage_vulnerabilities,
          condition_immunities = excluded.condition_immunities,
          senses = excluded.senses,
          languages = excluded.languages,
          challenge_rating = excluded.challenge_rating,
          cr_decimal = excluded.cr_decimal,
          xp = excluded.xp,
          legendary_action_count = excluded.legendary_action_count,
          raw_json = excluded.raw_json,
          updated_at = unixepoch()
        RETURNING id
      `,
      args: [
        monster.name,
        monster.size || "Medium",
        monster.type || "humanoid",
        monster.subtype || null,
        monster.alignment || null,
        monster.armor_class || 10,
        monster.armor_type || null,
        monster.hit_points || "10 (1d8)",
        hpAvg,
        monster.speed || "30 ft.",
        speedJson,
        abilities.str || 10,
        abilities.dex || 10,
        abilities.con || 10,
        abilities.int || 10,
        abilities.wis || 10,
        abilities.cha || 10,
        monster.saving_throws ? JSON.stringify(monster.saving_throws) : null,
        monster.skills ? JSON.stringify(monster.skills) : null,
        monster.damage_resistances || null,
        monster.damage_immunities || null,
        monster.damage_vulnerabilities || null,
        monster.condition_immunities || null,
        monster.senses || null,
        monster.languages || null,
        monster.challenge_rating || "0",
        crDecimal,
        monster.xp || 0,
        legendaryCount,
        JSON.stringify(monster)
      ]
    });
    
    const monsterId = monsterResult.rows[0].id;
    
    // Delete existing child records
    await client.execute({
      sql: "DELETE FROM bestiary_traits WHERE monster_id = ?",
      args: [monsterId]
    });
    
    await client.execute({
      sql: "DELETE FROM bestiary_legendary_actions WHERE monster_id = ?",
      args: [monsterId]
    });
    
    // Delete actions and their rays (cascade should handle rays)
    await client.execute({
      sql: "DELETE FROM bestiary_actions WHERE monster_id = ?",
      args: [monsterId]
    });
    
    // Insert traits
    const traits = monster.traits || monster.special_abilities || [];
    for (const trait of traits) {
      await client.execute({
        sql: `
          INSERT INTO bestiary_traits (monster_id, name, description)
          VALUES (?, ?, ?)
        `,
        args: [monsterId, trait.name, trait.description]
      });
    }
    
    // Insert actions
    const actions = monster.actions || [];
    for (const action of actions) {
      const hasRays = action.rays && action.rays.length > 0;
      
      const actionResult = await client.execute({
        sql: `
          INSERT INTO bestiary_actions (
            monster_id, name, type, attack_bonus, reach, range,
            target, hit, description, damage, has_rays
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        args: [
          monsterId,
          action.name,
          action.type || null,
          action.attack_bonus || null,
          action.reach || null,
          action.range || null,
          action.target || null,
          action.hit || null,
          action.description || null,
          action.damage || null,
          hasRays ? 1 : 0
        ]
      });
      
      // Insert rays if present
      if (hasRays) {
        const actionId = actionResult.rows[0].id;
        for (const ray of action.rays) {
          await client.execute({
            sql: `
              INSERT INTO bestiary_action_rays (action_id, name, save, effect)
              VALUES (?, ?, ?, ?)
            `,
            args: [actionId, ray.name, ray.save || null, ray.effect]
          });
        }
      }
    }
    
    // Insert legendary actions
    if (monster.legendary_actions?.options) {
      for (const option of monster.legendary_actions.options) {
        await client.execute({
          sql: `
            INSERT INTO bestiary_legendary_actions (monster_id, option_text)
            VALUES (?, ?)
          `,
          args: [monsterId, option]
        });
      }
    }
    
    // Update FTS table (try to insert, skip if FTS5 not available)
    try {
      const traitsText = traits.map(t => `${t.name}: ${t.description}`).join(" ");
      const actionsText = actions.map(a => {
        const base = a.name + (a.description ? `: ${a.description}` : "");
        if (a.rays) {
          return base + " " + a.rays.map(r => `${r.name}: ${r.effect}`).join(" ");
        }
        return base;
      }).join(" ");
      
      // For FTS5 tables, we need to delete by rowid, not by regular columns
      // First, find the rowid(s) for this monster_id
      const existingRows = await client.execute({
        sql: "SELECT rowid FROM bestiary_fts WHERE monster_id = ?",
        args: [monsterId]
      });
      
      // Delete existing entries using rowid
      for (const row of existingRows.rows) {
        await client.execute({
          sql: "DELETE FROM bestiary_fts WHERE rowid = ?",
          args: [row.rowid]
        });
      }
      
      // Insert new FTS entry
      await client.execute({
        sql: `
          INSERT INTO bestiary_fts (monster_id, name, description, traits_text, actions_text)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
          monsterId,
          monster.name,
          monster.description || "",
          traitsText,
          actionsText
        ]
      });
    } catch (ftsError) {
      // FTS5 might not be available, skip gracefully
      if (!ftsError.message.includes("no such table") && !ftsError.message.includes("virtual table")) {
        console.warn(`   ⚠️  FTS update skipped: ${ftsError.message}`);
      }
    }
    
    return { success: true, id: monsterId };
  } catch (error) {
    throw error;
  }
}

/**
 * Main import function
 */
async function importBestiary() {
  console.log("🐉 Starting Bestiary Import");
  console.log("━".repeat(50));
  
  // Read monster data
  const dataPath = path.join(__dirname, "..", "ref", "monster_stats.json");
  
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Monster data file not found: ${dataPath}`);
    process.exit(1);
  }
  
  let data;
  try {
    const rawData = fs.readFileSync(dataPath, "utf-8");
    data = JSON.parse(rawData);
  } catch (error) {
    console.error(`❌ Failed to read/parse monster data: ${error.message}`);
    process.exit(1);
  }
  
  // Validate data structure
  if (!data.monsters || !Array.isArray(data.monsters)) {
    console.error("❌ Invalid data structure: expected { monsters: [...] }");
    process.exit(1);
  }
  
  console.log(`📚 Found ${data.monsters.length} monsters to import`);
  console.log(`🔄 Batch size: ${BATCH_SIZE}`);
  console.log("");
  
  // Connect to Turso
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });
  
  // Import monsters in batches
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  for (let i = 0; i < data.monsters.length; i += BATCH_SIZE) {
    const batch = data.monsters.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(data.monsters.length / BATCH_SIZE);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} monsters)`);
    
    for (const monster of batch) {
      try {
        await importMonster(client, monster);
        successCount++;
        process.stdout.write(`   ✅ ${monster.name}\n`);
      } catch (error) {
        errorCount++;
        errors.push({ name: monster.name, error: error.message });
        process.stdout.write(`   ❌ ${monster.name}: ${error.message}\n`);
      }
    }
    
    console.log("");
  }
  
  // Summary
  console.log("━".repeat(50));
  console.log("📊 Import Summary");
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log("\n❌ Errors:");
    errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
  } else if (errors.length > 10) {
    console.log(`\n❌ ${errors.length} errors occurred (showing first 10):`);
    errors.slice(0, 10).forEach(e => console.log(`   - ${e.name}: ${e.error}`));
  }
  
  console.log("\n🎉 Import complete!");
  
  // Exit with error code if there were failures
  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run import
importBestiary().catch(error => {
  console.error("\n💥 Fatal error during import:", error);
  process.exit(1);
});

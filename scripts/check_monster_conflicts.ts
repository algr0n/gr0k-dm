import { client as libsqlClient } from "../server/db";

const actionVerbs = [
  "screech", "screeching", "charge", "charging", "attack", "attacking",
  "rush", "rushing", "leap", "leaping", "jump", "jumping", "burst", "bursting",
  "erupt", "erupting", "emerge", "emerging", "appear", "appearing",
  "come", "coming", "go", "going", "run", "running", "walk", "walking",
  "crawl", "crawling", "fly", "flying", "swim", "swimming", "strike", "striking",
  "hit", "hitting", "slash", "slashing", "bite", "biting", "claw", "clawing",
  "grab", "grabbing", "throw", "throwing", "cast", "casting", "speak", "speaking",
  "say", "saying", "yell", "yelling", "shout", "shouting", "roar", "roaring",
  "growl", "growling", "snarl", "snarling", "draw", "drawing", "raise", "raising",
  "drawn", "raised", "demand", "demanding", "lunge", "lunging", "swing", "swinging"
];

async function checkMonsterNames() {
  const result = await libsqlClient.execute("SELECT name FROM bestiary_monsters ORDER BY name");
  
  const conflicts: Array<{ monster: string; conflictWord: string }> = [];
  
  for (const row of result.rows) {
    const name = String(row.name).toLowerCase();
    const words = name.split(/\s+/);
    
    for (const word of words) {
      if (actionVerbs.includes(word)) {
        conflicts.push({ monster: String(row.name), conflictWord: word });
      }
    }
  }
  
  if (conflicts.length > 0) {
    console.log("⚠️  CONFLICTS FOUND:");
    conflicts.forEach(c => console.log(`  - "${c.monster}" contains filtered word: "${c.conflictWord}"`));
  } else {
    console.log("✅ No conflicts found! All monster names are safe.");
  }
  
  console.log(`\nTotal monsters checked: ${result.rows.length}`);
}

checkMonsterNames().catch(console.error);

/**
 * Lost Mine of Phandelver Adventure Data
 * 
 * Copyright Notice: This content is from Wizards of the Coast's D&D 5e Starter Set
 * and is for personal use only. All rights reserved by Wizards of the Coast.
 * 
 * This is a structured representation of the key elements from the adventure,
 * including chapters, locations, NPCs, quests, and encounters.
 */

import type {
  InsertAdventure,
  InsertAdventureChapter,
  InsertAdventureLocation,
  InsertAdventureNpc,
  InsertAdventureQuest,
  InsertAdventureEncounter,
} from "@shared/schema";

// =============================================================================
// Adventure Metadata
// =============================================================================

export const adventure: InsertAdventure = {
  slug: "lost-mine-of-phandelver",
  name: "Lost Mine of Phandelver",
  description: "A classic D&D adventure for characters level 1-5. Discover the truth behind the lost mine and confront the mysterious Black Spider.",
  longDescription: `The Lost Mine of Phandelver is a thrilling adventure where heroes journey to the frontier town of Phandalin, investigate the disappearance of their dwarf patron, and uncover a conspiracy involving bandits, monsters, and ancient magic. The adventure features dungeon exploration, wilderness travel, social interaction, and exciting combat encounters.

The adventure is designed for 1st-level characters who advance to 5th level by the conclusion. Players explore goblin hideouts, navigate town politics, delve into mysterious ruins, and ultimately confront the villainous Black Spider in the legendary Wave Echo Cave.`,
  gameSystem: "dnd",
  minLevel: 1,
  maxLevel: 5,
  estimatedHours: "20-30 hours",
  source: "D&D 5e Starter Set",
  isPublished: true,
};

// =============================================================================
// Chapters
// =============================================================================

export const chapters: Omit<InsertAdventureChapter, "adventureId">[] = [
  {
    chapterNumber: 1,
    title: "Goblin Arrows",
    description: "The adventure begins as the heroes are ambushed by goblins on the Triboar Trail. Following the goblin trail leads to Cragmaw Hideout.",
    objectives: [
      "Escort supplies to Phandalin",
      "Investigate the goblin ambush",
      "Rescue Sildar Hallwinter from Cragmaw Hideout",
      "Defeat Klarg the bugbear"
    ],
    summary: "The party is hired to escort a wagon of supplies to Phandalin for the dwarf prospector Gundren Rockseeker. Along the Triboar Trail, they are ambushed by goblins. Investigating the ambush site, they discover Gundren and his bodyguard Sildar have been captured. The trail leads to Cragmaw Hideout, where Sildar is being held prisoner by Klarg the bugbear and his goblin followers.",
  },
  {
    chapterNumber: 2,
    title: "Phandalin",
    description: "The heroes arrive in Phandalin and discover the town is being terrorized by the Redbrands, a gang of ruffians led by a mysterious figure called Glasstaff.",
    objectives: [
      "Deliver supplies to Barthen's Provisions",
      "Learn about the Redbrand problem",
      "Investigate the Redbrand hideout under Tresendar Manor",
      "Defeat Glasstaff and the Redbrand thugs",
      "Rescue Mirna Dendrar's family"
    ],
    summary: "Upon arriving in Phandalin, the heroes learn that the town is being terrorized by the Redbrands, a gang of bullies operating out of the ruined Tresendar Manor. The party can gather information from townspeople, potentially confront Redbrand ruffians, and eventually assault the Redbrand hideout beneath the manor to confront their leader, Glasstaff.",
  },
  {
    chapterNumber: 3,
    title: "The Spider's Web",
    description: "Following leads from Phandalin, the heroes pursue various quests that reveal a larger conspiracy orchestrated by someone called the Black Spider.",
    objectives: [
      "Complete side quests for townsfolk",
      "Locate Cragmaw Castle",
      "Rescue Gundren Rockseeker",
      "Discover the location of Wave Echo Cave",
      "Learn about the Black Spider's plans"
    ],
    summary: "This chapter features several side quests that can be pursued in any order: clearing out the Redbrand hideout, dealing with the orcs at Wyvern Tor, investigating Old Owl Well, exploring the ruins of Thundertree, and locating Cragmaw Castle. The party learns that a mysterious figure called the Black Spider is behind many of the region's troubles and seeks the legendary Wave Echo Cave.",
  },
  {
    chapterNumber: 4,
    title: "Wave Echo Cave",
    description: "The heroes explore the legendary Wave Echo Cave, confront the Black Spider, and decide the fate of the lost mine.",
    objectives: [
      "Navigate the dangers of Wave Echo Cave",
      "Deal with undead and other monsters",
      "Locate the Forge of Spells",
      "Confront Nezznar the Black Spider",
      "Secure the mine"
    ],
    summary: "The climactic finale takes place in Wave Echo Cave, where the party must navigate underground hazards, fight undead guardians, and ultimately confront Nezznar the Black Spider - a drow villain seeking to claim the mine's magical forge for himself. Victory means securing the mine and its treasures for the Rockseeker brothers.",
  },
];

// =============================================================================
// Locations
// =============================================================================

export const locations: Omit<InsertAdventureLocation, "adventureId" | "chapterId">[] = [
  // Chapter 1 Locations
  {
    name: "Goblin Ambush Site",
    type: "wilderness",
    description: "A section of the Triboar Trail where the party is ambushed by goblins. Two dead horses lie in the road, pierced by arrows.",
    boxedText: "You've been on the Triboar Trail for about half a day. As you come around a bend, you spot two dead horses sprawled about fifty feet ahead of you, blocking the path. Each has several black-feathered arrows sticking out of it. The woods press close to the trail here, with a steep embankment and dense thickets on either side.",
    features: ["Dead horses blocking the road", "Goblin tracks leading into the woods", "Hidden goblins in the thickets"],
    connections: [],
  },
  {
    name: "Cragmaw Hideout",
    type: "dungeon",
    description: "A cave complex serving as a hideout for the Cragmaw goblin tribe. The cave is located up a narrow trail following a stream.",
    boxedText: "Following the goblins' trail, you arrive at the entrance to Cragmaw Hideout. The trail leads to a steep, narrow valley with a stream flowing out of a cave mouth at the far end. A waterfall sounds from within the cave.",
    features: [
      "Cave entrance with stream",
      "Multiple chambers connected by rough passages",
      "Klarg the bugbear's den",
      "Wolf pen",
      "Captured supplies from Gundren's wagon"
    ],
    connections: [],
  },
  
  // Chapter 2 Locations
  {
    name: "Phandalin",
    type: "town",
    description: "A small frontier settlement consisting of forty or fifty simple log buildings. The town serves as a trading post and supply center for nearby miners and prospectors.",
    boxedText: "The frontier town of Phandalin is nestled in a rocky area at the foot of a wooded hillside. The town consists of forty or fifty simple log buildings, some built on old fieldstone foundations. More old ruins—crumbling stone walls covered in ivy and briars—surround the newer houses and shops, showing how this must have been a much larger town in centuries past.",
    features: [
      "Barthen's Provisions - General store",
      "Stonehill Inn - Run by Toblen Stonehill",
      "Shrine of Luck - Tended by Sister Garaele",
      "Townmaster's Hall - Where Harbin Wester resides",
      "Tresendar Manor - Ruined mansion, Redbrand hideout beneath",
      "Sleeping Giant - Tap house frequented by Redbrands",
      "Edermath Orchard - Home of retired adventurer Daran Edermath",
      "Lionshield Coster - Trading post run by Linene Graywind",
      "Phandalin Miner's Exchange - Run by Halia Thornton"
    ],
    connections: [],
  },
  {
    name: "Redbrand Hideout",
    type: "dungeon",
    description: "A network of cellars and tunnels beneath Tresendar Manor, serving as the base of operations for the Redbrand ruffians and their leader, Glasstaff.",
    boxedText: "A set of stone steps descends into darkness beneath the ruins of Tresendar Manor. The air is cold and damp, and you hear the sound of water dripping somewhere ahead.",
    features: [
      "Crypt with undead skeletons",
      "Nothic's lair",
      "Prison cells holding captives",
      "Glasstaff's quarters with alchemical equipment",
      "Hidden armory",
      "Secret tunnel to woods outside town"
    ],
    connections: [],
  },
  
  // Chapter 3 Locations
  {
    name: "Cragmaw Castle",
    type: "dungeon",
    description: "The ruins of an old castle now occupied by the Cragmaw goblin tribe and their leader, King Grol. This is where Gundren Rockseeker is held prisoner.",
    boxedText: "Cragmaw Castle is a ruined fortress deep in the forest. Two round towers flank the main entry at the front of the castle, and a third tower stands in the center. All three towers have crumbling battlements. Moss-covered stone walls surround a courtyard choked with weeds and wildflowers.",
    features: [
      "Ruined towers",
      "Overgrown courtyard",
      "King Grol's chamber",
      "Owlbear lair",
      "Goblin barracks"
    ],
    connections: [],
  },
  {
    name: "Thundertree",
    type: "wilderness",
    description: "A ruined village destroyed by volcanic eruptions from Mount Hotenow thirty years ago. Now occupied by ash zombies, twig blights, and a young green dragon named Venomfang.",
    boxedText: "Thundertree was once a prosperous village on the outskirts of the Neverwinter Wood. Then thirty years ago, the eruption of Mount Hotenow to the north devastated the town. Now Thundertree is a ruin, its buildings blackened and half-collapsed. The place is eerily quiet, with no birdsong or sounds of animals.",
    features: [
      "Ruined cottages and shops",
      "Dragon's tower - Young green dragon Venomfang",
      "Druid Reidoth's hideout",
      "Cultist camp",
      "Ash zombie encounters"
    ],
    connections: [],
  },
  {
    name: "Old Owl Well",
    type: "wilderness",
    description: "Ancient ruins where a Red Wizard of Thay named Hamun Kost is excavating, guarded by undead.",
    boxedText: "The Old Owl Well is so named because of the wide well at the center of the ruins, built ages ago by a long-vanished empire. More recently, prospectors and adventurers have used the site as a campground.",
    features: [
      "Ancient well",
      "Ruined watchtower",
      "Excavation site",
      "Zombie guardians",
      "Red Wizard's camp"
    ],
    connections: [],
  },
  {
    name: "Wyvern Tor",
    type: "wilderness",
    description: "A craggy, windswept hill where a band of orcs and their ogre ally have made camp.",
    boxedText: "The Wyvern Tor is a craggy, windswept hill with commanding views of the surrounding countryside. Orcs have recently occupied a cave on the north side of the hill.",
    features: [
      "Rocky hilltop",
      "Cave entrance",
      "Orc campsite"
    ],
    connections: [],
  },
  
  // Chapter 4 Locations
  {
    name: "Wave Echo Cave",
    type: "dungeon",
    description: "The legendary cavern where dwarves and gnomes once worked together at the Forge of Spells. The site of the final confrontation with Nezznar the Black Spider.",
    boxedText: "After days of searching, you finally locate the hidden entrance to Wave Echo Cave. The cave mouth stands at the end of a narrow ravine, its interior dark and silent. A faint echo can be heard from within, like the sound of a distant wave crashing on a beach—hence the name.",
    features: [
      "Ancient mine tunnels",
      "Fungal caverns",
      "Underground lake",
      "Forge of Spells - Ancient magical forge",
      "Temple of Dumathoin",
      "Dwarven temples and shrines",
      "Spectator guardian",
      "Black Spider's lair"
    ],
    connections: [],
  },
];

// =============================================================================
// NPCs
// =============================================================================

export const npcs: Omit<InsertAdventureNpc, "adventureId" | "locationId">[] = [
  // Quest Givers and Allies
  {
    name: "Gundren Rockseeker",
    race: "Dwarf",
    role: "Quest Giver",
    description: "A friendly dwarf prospector who has discovered the location of Wave Echo Cave and hired the party to escort supplies to Phandalin.",
    personality: "Ambitious and driven by the dream of restoring his family's mine. Friendly but sometimes secretive about his plans.",
    ideals: "Believes in hard work, family loyalty, and the promise of wealth through honest prospecting.",
    bonds: "Devoted to his two brothers (Nundro and Tharden) and the legacy of the Rockseeker family.",
    flaws: "His ambition can make him reckless. He keeps secrets even from those trying to help him.",
    questConnections: [],
  },
  {
    name: "Sildar Hallwinter",
    race: "Human",
    role: "Ally",
    description: "A human warrior in his fifties, member of the Lords' Alliance. He was escorting Gundren to Phandalin when they were ambushed.",
    personality: "Honorable, brave, and dedicated to his mission. Acts as a mentor figure to young adventurers.",
    ideals: "Justice, order, and the protection of innocent people from those who would exploit them.",
    bonds: "Member of the Lords' Alliance, seeking his missing friend Iarno Albrek who was supposed to be in Phandalin.",
    flaws: "Can be overly trusting of those who claim to work for law and order.",
    statsBlock: {
      ac: 16,
      hp: 27,
      abilities: { STR: 13, DEX: 10, CON: 12, INT: 11, WIS: 11, CHA: 10 },
      specialAbilities: ["Multiattack", "Longsword", "Heavy Crossbow"]
    },
    questConnections: [],
  },
  
  // Villains
  {
    name: "Nezznar (The Black Spider)",
    race: "Drow",
    role: "Villain",
    description: "A dark elf wizard seeking Wave Echo Cave and its magical forge. The mastermind behind the Cragmaw goblin raids and the Redbrand gang.",
    personality: "Cold, calculating, and utterly ruthless. Views surface dwellers as inferior and obstacles to be removed.",
    ideals: "Power through ancient magic. Believes the strong should rule the weak.",
    bonds: "Seeks the Forge of Spells to craft magical items for his own ambition and profit.",
    flaws: "Arrogant and overconfident, believing himself superior to all surface dwellers.",
    statsBlock: {
      ac: 11,
      hp: 27,
      speed: "30 ft.",
      abilities: { STR: 9, DEX: 13, CON: 10, INT: 16, WIS: 14, CHA: 13 },
      specialAbilities: [
        "Spellcasting (Wizard)",
        "Spider Staff",
        "Fey Ancestry",
        "Sunlight Sensitivity",
        "Spells: ray of sickness, witch bolt, misty step, spider climb, invisibility, lightning bolt"
      ]
    },
    questConnections: [],
  },
  {
    name: "Glasstaff (Iarno Albrek)",
    race: "Human",
    role: "Villain",
    description: "A former member of the Lords' Alliance who turned to evil. He leads the Redbrand gang as 'Glasstaff' and works for the Black Spider.",
    personality: "Ambitious and greedy. Skilled at deception and manipulation, but cowardly when cornered.",
    ideals: "Personal power and wealth at any cost. Sees himself as deserving of more than he had.",
    bonds: "Serves the Black Spider in exchange for promises of power and wealth.",
    flaws: "Cowardly and prone to betraying others to save himself.",
    statsBlock: {
      ac: 11,
      hp: 22,
      abilities: { STR: 9, DEX: 13, CON: 11, INT: 16, WIS: 10, CHA: 11 },
      specialAbilities: [
        "Spellcasting (Wizard)",
        "Staff of Defense",
        "Spells: mage armor, magic missile, suggestion, burning hands"
      ]
    },
    questConnections: [],
  },
  {
    name: "King Grol",
    race: "Bugbear",
    role: "Villain",
    description: "The brutish leader of the Cragmaw tribe. He holds Gundren prisoner at Cragmaw Castle on the Black Spider's orders.",
    personality: "Cruel, greedy, and enjoys bullying those weaker than himself. Loyal to the Black Spider out of fear and greed.",
    ideals: "Might makes right. The strong should take what they want.",
    bonds: "Leader of the Cragmaw tribe. Serves the Black Spider.",
    flaws: "Overconfident in his own strength and easily angered.",
    statsBlock: {
      ac: 16,
      hp: 45,
      abilities: { STR: 17, DEX: 14, CON: 15, INT: 8, WIS: 11, CHA: 9 },
      specialAbilities: ["Brute", "Surprise Attack", "Morningstar"]
    },
    questConnections: [],
  },
  {
    name: "Klarg",
    race: "Bugbear",
    role: "Villain",
    description: "A bugbear leading the goblins at Cragmaw Hideout. Works for King Grol and the Black Spider.",
    personality: "Brutal and greedy. Enjoys tormenting prisoners.",
    ideals: "Take what you can by force.",
    bonds: "Serves King Grol.",
    flaws: "Easily bribed with food or treasure.",
    statsBlock: {
      ac: 16,
      hp: 27,
      abilities: { STR: 15, DEX: 14, CON: 13, INT: 8, WIS: 11, CHA: 9 },
      specialAbilities: ["Brute", "Surprise Attack", "Morningstar"]
    },
    questConnections: [],
  },
  
  // Phandalin Townsfolk
  {
    name: "Toblen Stonehill",
    race: "Human",
    role: "Quest Giver",
    description: "The friendly owner of the Stonehill Inn in Phandalin. A good source of information about the town and surrounding area.",
    personality: "Cheerful, welcoming, and loves to gossip. Always eager to help travelers.",
    ideals: "Hospitality and community. Believes in helping neighbors.",
    bonds: "His family and the inn are his life. Wants to see Phandalin thrive.",
    flaws: "Can be too trusting and shares information freely, sometimes to dangerous people.",
    questConnections: [],
  },
  {
    name: "Sister Garaele",
    race: "Half-Elf",
    role: "Quest Giver",
    description: "A young cleric of Tymora serving at the Shrine of Luck. Secret member of the Harpers seeking information about a spellbook.",
    personality: "Kind and diplomatic, but determined in her duties to the Harpers.",
    ideals: "Good should triumph over evil, and knowledge should be used to help others.",
    bonds: "Member of the Harpers, working to maintain balance and fight evil.",
    flaws: "Sometimes too idealistic about people's motivations.",
    questConnections: [],
  },
  {
    name: "Halia Thornton",
    race: "Human",
    role: "Quest Giver",
    description: "The ambitious guildmaster of the Phandalin Miner's Exchange. Secret agent of the Zhentarim.",
    personality: "Calculating, ambitious, and ruthless in pursuing her goals.",
    ideals: "Power and influence through wealth and information.",
    bonds: "Member of the Zhentarim, working to expand their influence in the region.",
    flaws: "Sees people as tools to be used for her benefit.",
    questConnections: [],
  },
  {
    name: "Daran Edermath",
    race: "Half-Elf",
    role: "Quest Giver",
    description: "A retired adventurer who grows apples in Phandalin. Former member of the Order of the Gauntlet.",
    personality: "Wise, thoughtful, and still possesses a strong sense of justice despite his retirement.",
    ideals: "Evil must be opposed, and justice must be upheld.",
    bonds: "Former member of the Order of the Gauntlet. Cares deeply about Phandalin's safety.",
    flaws: "His age limits his ability to act on his convictions.",
    questConnections: [],
  },
  {
    name: "Linene Graywind",
    race: "Human",
    role: "Merchant",
    description: "The sharp-tongued proprietor of the Lionshield Coster in Phandalin.",
    personality: "Pragmatic, no-nonsense, and protective of her business interests.",
    ideals: "Fair dealing and hard work.",
    bonds: "The Lionshield Coster trading company.",
    flaws: "Can be stubborn and holds grudges against those who wrong her.",
    questConnections: [],
  },
  {
    name: "Harbin Wester",
    race: "Human",
    role: "Quest Giver",
    description: "The cowardly townmaster of Phandalin. More concerned with avoiding trouble than solving problems.",
    personality: "Timid, self-serving, and eager to pass problems to others.",
    ideals: "Personal safety above all else.",
    bonds: "His position as townmaster.",
    flaws: "Cowardly and refuses to take decisive action.",
    questConnections: [],
  },
  
  // Other Notable NPCs
  {
    name: "Reidoth the Druid",
    race: "Human",
    role: "Ally",
    description: "An elderly druid who knows the location of Cragmaw Castle. Lives in the ruins of Thundertree.",
    personality: "Wise, reclusive, and devoted to protecting nature.",
    ideals: "Nature must be preserved and protected from civilization's excesses.",
    bonds: "The forests of the Sword Coast and the creatures within.",
    flaws: "Isolated and suspicious of most people.",
    questConnections: [],
  },
  {
    name: "Venomfang",
    race: "Young Green Dragon",
    role: "Villain",
    description: "A dangerous young green dragon that has taken up residence in the tower at Thundertree.",
    personality: "Cunning, cruel, and arrogant. Enjoys toying with victims.",
    ideals: "Dragons are superior to all other creatures.",
    bonds: "His lair and treasure.",
    flaws: "Overconfident in his power and easily flattered.",
    statsBlock: {
      ac: 17,
      hp: 136,
      speed: "40 ft., fly 80 ft., swim 40 ft.",
      abilities: { STR: 19, DEX: 12, CON: 17, INT: 16, WIS: 13, CHA: 15 },
      specialAbilities: [
        "Poison Breath (Recharge 5-6)",
        "Amphibious",
        "Multiattack",
        "Bite",
        "Claw"
      ]
    },
    questConnections: [],
  },
  {
    name: "Hamun Kost",
    race: "Human",
    role: "Neutral",
    description: "A Red Wizard of Thay excavating the ruins at Old Owl Well, searching for ancient knowledge.",
    personality: "Cold, scholarly, and primarily interested in his research.",
    ideals: "Knowledge and magical power.",
    bonds: "The Red Wizards of Thay.",
    flaws: "Obsessed with his research to the exclusion of ethics.",
    questConnections: [],
  },
];

// =============================================================================
// Quests
// =============================================================================

export const quests: Omit<InsertAdventureQuest, "adventureId" | "chapterId" | "questGiverId">[] = [
  {
    name: "Escort Supplies to Phandalin",
    description: "Gundren Rockseeker has hired you to escort a wagon of mining supplies to Phandalin. He and a warrior named Sildar Hallwinter have ridden ahead.",
    objectives: [
      "Safely deliver the wagon to Barthen's Provisions in Phandalin",
      "Collect 10 gold pieces each upon delivery"
    ],
    rewards: {
      gold: 10,
    },
    isMainQuest: true,
    prerequisiteQuestIds: [],
  },
  {
    name: "Rescue Sildar Hallwinter",
    description: "Sildar Hallwinter has been captured by goblins along with Gundren Rockseeker. Track down the goblins and rescue Sildar.",
    objectives: [
      "Follow the goblin trail from the ambush site",
      "Infiltrate Cragmaw Hideout",
      "Rescue Sildar from Klarg's captivity"
    ],
    rewards: {
      xp: 200,
      gold: 50,
    },
    isMainQuest: true,
    prerequisiteQuestIds: [],
  },
  {
    name: "Deal with the Redbrands",
    description: "The Redbrand ruffians are terrorizing Phandalin. Investigate their hideout beneath Tresendar Manor and put an end to their activities.",
    objectives: [
      "Gather information about the Redbrands in town",
      "Locate the entrance to the Redbrand hideout",
      "Defeat or drive off Glasstaff and the Redbrands",
      "Free any captives held in the hideout"
    ],
    rewards: {
      xp: 600,
      gold: 100,
      items: ["Glasstaff's Staff of Defense"],
    },
    isMainQuest: true,
    prerequisiteQuestIds: [],
  },
  {
    name: "Find Cragmaw Castle",
    description: "Gundren Rockseeker is being held at Cragmaw Castle. Find the castle's location and rescue Gundren from King Grol.",
    objectives: [
      "Locate Cragmaw Castle (possibly with Reidoth's help)",
      "Infiltrate the castle",
      "Rescue Gundren from King Grol",
      "Obtain the map to Wave Echo Cave"
    ],
    rewards: {
      xp: 1000,
      items: ["Map to Wave Echo Cave"],
    },
    isMainQuest: true,
    prerequisiteQuestIds: [],
  },
  {
    name: "Explore Wave Echo Cave",
    description: "The legendary Wave Echo Cave has been found. Explore the cave, deal with any threats, and secure the Forge of Spells.",
    objectives: [
      "Navigate the dangers of Wave Echo Cave",
      "Confront Nezznar the Black Spider",
      "Secure the Forge of Spells",
      "Rescue the surviving Rockseeker brothers"
    ],
    rewards: {
      xp: 2000,
      gold: 200,
      items: ["Various magic items from the Forge"],
      other: ["Access to the Forge of Spells"]
    },
    isMainQuest: true,
    prerequisiteQuestIds: [],
  },
  {
    name: "The Orc Trouble",
    description: "Orcs have been raiding farmsteads and travelers near Wyvern Tor. Daran Edermath asks you to deal with this threat.",
    objectives: [
      "Travel to Wyvern Tor",
      "Defeat the orc band and their ogre ally"
    ],
    rewards: {
      xp: 400,
      gold: 100,
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Reidoth the Druid",
    description: "The druid Reidoth knows the location of Cragmaw Castle. Find him in the ruins of Thundertree.",
    objectives: [
      "Travel to Thundertree",
      "Find Reidoth",
      "Learn the location of Cragmaw Castle"
    ],
    rewards: {
      xp: 200,
      other: ["Location of Cragmaw Castle"]
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Old Owl Well",
    description: "Prospectors have reported undead near Old Owl Well. Daran Edermath asks you to investigate.",
    objectives: [
      "Travel to Old Owl Well",
      "Investigate the undead presence",
      "Deal with Hamun Kost and his zombies"
    ],
    rewards: {
      xp: 300,
      gold: 100,
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Banshee's Bargain",
    description: "Sister Garaele asks you to visit Agatha the banshee at Conyberry and ask about the location of a spellbook belonging to the legendary mage Bowgentle.",
    objectives: [
      "Travel to Conyberry",
      "Negotiate with Agatha the banshee",
      "Ask about Bowgentle's spellbook",
      "Report back to Sister Garaele"
    ],
    rewards: {
      xp: 300,
      gold: 0,
      items: ["3 potions of healing"],
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Recover Lionshield Cargo",
    description: "The Redbrands stole a shipment of supplies meant for Linene Graywind's trading post. Recover the goods from the Redbrand hideout.",
    objectives: [
      "Infiltrate the Redbrand hideout",
      "Find the stolen Lionshield Coster goods",
      "Return them to Linene Graywind"
    ],
    rewards: {
      xp: 100,
      gold: 0,
      other: ["Discount on goods at Lionshield Coster"]
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
];

// =============================================================================
// Encounters
// =============================================================================

export const encounters: Omit<InsertAdventureEncounter, "adventureId" | "locationId">[] = [
  {
    name: "Goblin Ambush",
    type: "combat",
    difficulty: "easy",
    description: "Four goblins ambush the party from the thickets near two dead horses on the Triboar Trail.",
    enemies: [
      { name: "Goblin", count: 4, hp: 7, ac: 15, specialAbilities: ["Nimble Escape", "Scimitar", "Shortbow"] }
    ],
    xpReward: 200,
    treasure: [
      { item: "Goblin ears", quantity: 4, description: "Proof of the encounter" }
    ],
    triggerCondition: "Approaching the dead horses on the Triboar Trail",
  },
  {
    name: "Klarg and the Wolves",
    type: "combat",
    difficulty: "medium",
    description: "Klarg the bugbear, his pet wolf Ripper, and a goblin attendant guard the entrance area of Cragmaw Hideout.",
    enemies: [
      { name: "Klarg (Bugbear)", count: 1, hp: 27, ac: 16, specialAbilities: ["Brute", "Morningstar"] },
      { name: "Wolf", count: 2, hp: 11, ac: 13, specialAbilities: ["Keen Hearing and Smell", "Pack Tactics", "Bite"] },
      { name: "Goblin", count: 1, hp: 7, ac: 15, specialAbilities: ["Nimble Escape"] }
    ],
    xpReward: 400,
    treasure: [
      { item: "Chest", quantity: 1, description: "Contains 600 cp, 110 sp, two potions of healing, and jade statuette (40 gp)" }
    ],
    triggerCondition: "Entering the main chamber of Cragmaw Hideout",
  },
  {
    name: "Redbrand Ruffians at the Sleeping Giant",
    type: "combat",
    difficulty: "easy",
    description: "Four Redbrand ruffians drinking at the Sleeping Giant tap house, looking for trouble.",
    enemies: [
      { name: "Redbrand Ruffian", count: 4, hp: 11, ac: 14, specialAbilities: ["Shortsword"] }
    ],
    xpReward: 200,
    treasure: [
      { item: "Gold pieces", quantity: 10, description: "Combined from all four ruffians" }
    ],
    triggerCondition: "Entering the Sleeping Giant and drawing attention",
  },
  {
    name: "The Nothic",
    type: "social",
    difficulty: "medium",
    description: "A nothic lurks in the crevasse beneath the Redbrand hideout. It can be fought, negotiated with, or bribed.",
    enemies: [
      { name: "Nothic", count: 1, hp: 45, ac: 15, specialAbilities: ["Rotting Gaze", "Weird Insight", "Keen Sight"] }
    ],
    xpReward: 450,
    treasure: [],
    triggerCondition: "Entering the crevasse area of the Redbrand hideout",
  },
  {
    name: "Glasstaff's Chamber",
    type: "combat",
    difficulty: "medium",
    description: "Confrontation with Glasstaff (Iarno Albrek) in his quarters beneath Tresendar Manor.",
    enemies: [
      { name: "Glasstaff (Evil Mage)", count: 1, hp: 22, ac: 14, specialAbilities: ["Spellcasting", "Mage Armor", "Magic Missile", "Burning Hands", "Staff of Defense"] }
    ],
    xpReward: 450,
    treasure: [
      { item: "Staff of Defense", quantity: 1, description: "+1 AC while held, cast mage armor and shield" },
      { item: "Black Spider letters", quantity: 1, description: "Correspondence revealing the conspiracy" },
      { item: "Potion of invisibility", quantity: 1 },
      { item: "Gold and gems", quantity: 1, description: "Total value 180 gp" }
    ],
    triggerCondition: "Finding and confronting Glasstaff in his quarters",
  },
  {
    name: "King Grol and Companions",
    type: "combat",
    difficulty: "hard",
    description: "The final confrontation at Cragmaw Castle with King Grol, his wolf, and a doppelganger named Vyerith posing as Gundren.",
    enemies: [
      { name: "King Grol (Bugbear)", count: 1, hp: 45, ac: 16, specialAbilities: ["Brute", "Surprise Attack", "Morningstar"] },
      { name: "Dire Wolf", count: 1, hp: 37, ac: 14, specialAbilities: ["Keen Hearing and Smell", "Pack Tactics", "Bite"] },
      { name: "Doppelganger (Vyerith)", count: 1, hp: 52, ac: 14, specialAbilities: ["Shapechanger", "Ambusher", "Surprise Attack", "Read Thoughts"] }
    ],
    xpReward: 1100,
    treasure: [
      { item: "Map to Wave Echo Cave", quantity: 1, description: "Crucial for finding the lost mine" },
      { item: "Potion of healing", quantity: 1 },
      { item: "Gundren's equipment", quantity: 1, description: "Various items" }
    ],
    triggerCondition: "Entering King Grol's chamber at Cragmaw Castle",
  },
  {
    name: "Owlbear in Cragmaw Castle",
    type: "combat",
    difficulty: "medium",
    description: "A hungry owlbear has been trapped in a tower of Cragmaw Castle by the goblins.",
    enemies: [
      { name: "Owlbear", count: 1, hp: 59, ac: 13, specialAbilities: ["Keen Sight and Smell", "Multiattack", "Beak", "Claws"] }
    ],
    xpReward: 700,
    treasure: [],
    triggerCondition: "Opening the door to the owlbear's tower",
  },
  {
    name: "Venomfang the Dragon",
    type: "combat",
    difficulty: "deadly",
    description: "Optional encounter with Venomfang, a young green dragon residing in the tower at Thundertree.",
    enemies: [
      { name: "Venomfang (Young Green Dragon)", count: 1, hp: 136, ac: 17, specialAbilities: ["Poison Breath", "Multiattack", "Bite", "Claw", "Amphibious", "Legendary Resistance"] }
    ],
    xpReward: 3900,
    treasure: [
      { item: "Dragon's hoard", quantity: 1, description: "800 sp, 150 gp, 4 gems (30 gp each), magic weapon +1 longsword, scroll of misty step" }
    ],
    triggerCondition: "Entering the tower where Venomfang lairs",
  },
  {
    name: "Orcs at Wyvern Tor",
    type: "combat",
    difficulty: "medium",
    description: "A band of orcs and their ogre ally have set up camp at Wyvern Tor.",
    enemies: [
      { name: "Orc", count: 4, hp: 15, ac: 13, specialAbilities: ["Aggressive", "Greataxe", "Javelin"] },
      { name: "Ogre", count: 1, hp: 59, ac: 11, specialAbilities: ["Greatclub", "Javelin"] }
    ],
    xpReward: 850,
    treasure: [
      { item: "Coins and trinkets", quantity: 1, description: "Total value 90 gp" }
    ],
    triggerCondition: "Approaching the orc camp at Wyvern Tor",
  },
  {
    name: "Flameskull Guardian",
    type: "combat",
    difficulty: "hard",
    description: "A flameskull guards the northern passages of Wave Echo Cave, animated by ancient defensive magic.",
    enemies: [
      { name: "Flameskull", count: 1, hp: 40, ac: 13, specialAbilities: ["Rejuvenation", "Spellcasting", "Fire Ray", "Fireball", "Magic Missile"] }
    ],
    xpReward: 1100,
    treasure: [],
    triggerCondition: "Entering the northern section of Wave Echo Cave",
  },
  {
    name: "The Spectator",
    type: "combat",
    difficulty: "medium",
    description: "A spectator was summoned long ago to guard the Forge of Spells and still performs its duty.",
    enemies: [
      { name: "Spectator", count: 1, hp: 39, ac: 14, specialAbilities: ["Bite", "Eye Rays", "Spell Reflection", "Flight"] }
    ],
    xpReward: 700,
    treasure: [],
    triggerCondition: "Approaching the Forge of Spells in Wave Echo Cave",
  },
  {
    name: "Nezznar the Black Spider",
    type: "combat",
    difficulty: "hard",
    description: "The final confrontation with Nezznar the Black Spider and his minions in Wave Echo Cave.",
    enemies: [
      { name: "Nezznar (Drow Mage)", count: 1, hp: 27, ac: 11, specialAbilities: ["Spellcasting", "Fey Ancestry", "Sunlight Sensitivity", "Spider Staff", "Invisibility", "Lightning Bolt", "Web"] },
      { name: "Giant Spider", count: 2, hp: 26, ac: 14, specialAbilities: ["Spider Climb", "Web Sense", "Web Walker", "Bite (poison)", "Web"] },
      { name: "Bugbear", count: 4, hp: 27, ac: 16, specialAbilities: ["Brute", "Surprise Attack", "Morningstar"] }
    ],
    xpReward: 1750,
    treasure: [
      { item: "Spider Staff", quantity: 1, description: "Quarterstaff that can cast web and spider climb" },
      { item: "Black Spider's equipment", quantity: 1, description: "Spellbook, potion of healing, potion of invisibility" },
      { item: "Coins", quantity: 1, description: "190 ep, 130 gp, 15 pp" },
      { item: "Black pearl", quantity: 1, description: "Worth 500 gp" }
    ],
    triggerCondition: "Finding Nezznar near the temple of Dumathoin in Wave Echo Cave",
  },
];

export const lostMineData = {
  adventure,
  chapters,
  locations,
  npcs,
  quests,
  encounters,
};

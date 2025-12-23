/**
 * Dragon of Icespire Peak Adventure Data
 * 
 * Copyright Notice: This content is from Wizards of the Coast's D&D Essentials Kit
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
  slug: "dragon-of-icespire-peak",
  name: "Dragon of Icespire Peak",
  description: "A dragon terrorizes the Sword Coast. Brave adventurers must complete dangerous quests to stop the white dragon Cryovain.",
  longDescription: `Dragon of Icespire Peak is an exciting sandbox adventure where a young white dragon named Cryovain terrorizes the Sword Mountains region. Players take on various quests from a job board in Phandalin, gradually building their strength and reputation before confronting the dragon in its icy lair at Icespire Hold.

The adventure features a flexible quest structure allowing players to tackle challenges in any order, from investigating gnome refuges to battling orcs, undead, and other threats displaced by the dragon's arrival. The story builds toward an epic confrontation with Cryovain at Icespire Hold.`,
  gameSystem: "dnd",
  minLevel: 1,
  maxLevel: 6,
  estimatedHours: "15-25 hours",
  source: "D&D Essentials Kit",
  isPublished: true,
};

// =============================================================================
// Chapters
// =============================================================================

export const chapters: Omit<InsertAdventureChapter, "adventureId">[] = [
  {
    chapterNumber: 1,
    title: "Arriving in Phandalin",
    description: "Heroes arrive in the frontier town of Phandalin and learn of the dragon threat from Townmaster Harbin Wester. A job board offers various quests.",
    objectives: [
      "Arrive in Phandalin and learn about the town",
      "Meet Townmaster Harbin Wester",
      "Review available quests on the job board",
      "Choose initial quests to pursue"
    ],
    summary: "The adventure begins in Phandalin, a small frontier settlement threatened by Cryovain, a young white dragon. Townmaster Harbin Wester posts quests on a job board, desperate for brave adventurers to help protect the region. The party can choose from initial quests: warning dwarf prospectors at the Dwarven Excavation, seeking magical aid from the gnomes of Gnomengarde, or protecting the midwife Adabra Gwynn at Umbrage Hill.",
  },
  {
    chapterNumber: 2,
    title: "Initial Quests",
    description: "The party tackles their first assignments, including the Dwarven Excavation, Gnomengarde, and Umbrage Hill, while learning about the dragon's movements.",
    objectives: [
      "Complete at least two starting quests",
      "Encounter evidence of the dragon's presence",
      "Help NPCs in danger",
      "Gather information about Cryovain"
    ],
    summary: "As the heroes venture out from Phandalin, they face various challenges. At the Dwarven Excavation, they must warn miners about the dragon and deal with an ochre jelly. At Gnomengarde, they meet the paranoid gnome kings and might acquire magical items. At Umbrage Hill, they protect the midwife Adabra Gwynn from a manticore. The dragon's shadow looms over all these locations, creating tension and urgency.",
  },
  {
    chapterNumber: 3,
    title: "Dragon Encounters",
    description: "Cryovain's attacks intensify. The party pursues follow-up quests while dealing with displaced monsters and orc attacks orchestrated by evil spellcasters.",
    objectives: [
      "Complete follow-up quests",
      "Survive potential dragon encounters",
      "Deal with orcs at Butterskull Ranch",
      "Help loggers, miners, and other frontier folk",
      "Investigate the evil spellcasters in Woodland Manse"
    ],
    summary: "The dragon's presence causes chaos throughout the region. Orcs displaced from Icespire Hold attack Butterskull Ranch. Ankhegs threaten the Loggers' Camp. Wererats infest Mountain's Toe Gold Mine. The party also learns about evil half-orc spellcasters of Talos dwelling in the Woodland Manse who manipulate the orcs. Each quest brings the party closer to understanding the scope of the threat.",
  },
  {
    chapterNumber: 4,
    title: "Final Confrontation",
    description: "The heroes prepare for the ultimate showdown with Cryovain. They may seek the dragon-slaying sword from Dragon Barrow, explore the Tower of Storms, or open Axeholm as a refuge before assaulting Icespire Hold.",
    objectives: [
      "Complete advanced quests to prepare",
      "Acquire powerful items and allies",
      "Locate Icespire Hold in the mountains",
      "Confront Cryovain the white dragon",
      "Secure the region from the dragon threat"
    ],
    summary: "In the climactic final chapter, the party takes on the most dangerous quests. They might retrieve a dragon-slaying sword from Dragon Barrow, challenge the sea hag at Tower of Storms, or open the ancient dwarven fortress of Axeholm as a refuge. Finally, the heroes must scale Icespire Peak and invade Cryovain's frozen lair at Icespire Hold, facing the young white dragon in an epic battle that will determine the fate of the Sword Coast region.",
  },
];

// =============================================================================
// Locations
// =============================================================================

export const locations: Omit<InsertAdventureLocation, "adventureId" | "chapterId">[] = [
  // Chapter 1 & 2 Locations
  {
    name: "Phandalin",
    type: "town",
    description: "A small frontier settlement built on ancient ruins. Home to farmers, prospectors, and traders, now threatened by a white dragon.",
    boxedText: "Nestled in the rocky foothills of the snow-capped Sword Mountains is the mining town of Phandalin, which consists of forty or fifty simple log buildings. Crumbling stone ruins surround the newer houses and shops, showing how this must have been a much larger town in centuries past.",
    features: [
      "Townmaster's Hall with job board - Quest hub",
      "Stonehill Inn - Lodging and rumors",
      "Barthen's Provisions - General store",
      "Lionshield Coster - Weapons and armor",
      "Phandalin Miner's Exchange - Run by Halia Thornton",
      "Shrine of Luck - Tymora temple (unattended)"
    ],
    connections: [],
  },
  {
    name: "Townmaster's Hall",
    type: "building",
    description: "Phandalin's administrative center where Harbin Wester posts quests on a job board outside.",
    boxedText: "A simple wooden building with a covered porch. Posted outside on a wooden board are various notices written in neat script, each describing a task that needs brave adventurers.",
    features: ["Job board with quest postings", "Harbin Wester's office", "Town records"],
    connections: [],
  },
  {
    name: "Dwarven Excavation",
    type: "dungeon",
    description: "Ancient dwarven ruins being excavated by Norbus Ironrune and Gwyn Oresong. An ochre jelly threatens the site.",
    boxedText: "The ruins of an ancient dwarven settlement lie nestled in a canyon. Stone foundations and crumbling walls are all that remain of the surface structures. A partially excavated entrance leads underground.",
    features: [
      "Excavation site with exposed ruins",
      "Underground chambers",
      "Ochre jelly lair",
      "Ancient dwarven artifacts",
      "Potential orc attack"
    ],
    connections: [],
  },
  {
    name: "Gnomengarde",
    type: "dungeon",
    description: "A small network of caves inhabited by rock gnomes led by Kings Korboz and Gnerkli. The gnomes are paranoid and inventive.",
    boxedText: "A waterfall spills from a cleft in a rocky mountainside, feeding a stream that tumbles down to the valley below. Hidden behind the waterfall is a narrow cave entrance.",
    features: [
      "Waterfall entrance",
      "King Korboz and King Gnerkli's chambers",
      "Gnome workshops with wild inventions",
      "Mimic threat",
      "Mushroom caverns"
    ],
    connections: [],
  },
  {
    name: "Umbrage Hill",
    type: "wilderness",
    description: "A windmill on a hillside where Adabra Gwynn, a midwife and acolyte of Chauntea, lives. A manticore has taken up residence nearby.",
    boxedText: "Atop a lonely hill stands a wooden windmill, its sails turning slowly in the mountain breeze. Vegetable gardens and herb patches surround the structure.",
    features: [
      "Stone windmill",
      "Adabra Gwynn's home",
      "Manticore lair nearby",
      "Herb gardens",
      "Potions of healing for sale"
    ],
    connections: [],
  },
  
  // Chapter 3 Locations
  {
    name: "Butterskull Ranch",
    type: "wilderness",
    description: "A ranch owned by retired sheriff Alfonse 'Big Al' Kalazorn. Recently attacked by orcs who burned the barn and captured Big Al.",
    boxedText: "The ranch sprawls across fertile land, with fields, orchards, and animal pens. Smoke rises from the charred remains of a barn. The stench of death hangs in the air.",
    features: [
      "Burned barn and smithy",
      "Main ranch house",
      "Orc encampment",
      "Big Al held prisoner",
      "Scattered livestock"
    ],
    connections: [],
  },
  {
    name: "Loggers' Camp",
    type: "wilderness",
    description: "A logging operation in Neverwinter Wood run by Tibor Wester. Recently plagued by ankhegs emerging from the ground.",
    boxedText: "The sounds of axes and falling trees echo through the forest. A collection of sturdy cabins sits near piles of cut lumber. The ground is torn up in several places, with large burrow holes visible.",
    features: [
      "Logging camp buildings",
      "Timber stockpiles",
      "Ankheg burrows",
      "River for log transport",
      "Tibor Wester's cabin"
    ],
    connections: [],
  },
  {
    name: "Mountain's Toe Gold Mine",
    type: "dungeon",
    description: "An active gold mine infested with wererats. The new overseer Don-Jon Raskin needs escort from Phandalin.",
    boxedText: "The mine entrance is a reinforced timber framework set into the mountainside. Ore carts and mining equipment lie scattered about. Strange scratching sounds echo from within.",
    features: [
      "Mine tunnels",
      "Wererat lair",
      "Gold ore veins",
      "Mining equipment",
      "Trapped miners"
    ],
    connections: [],
  },
  {
    name: "Falcon's Hunting Lodge",
    type: "building",
    description: "A sturdy lodge deep in Neverwinter Wood, home to Falcon, a retired veteran who offers sanctuary to travelers.",
    boxedText: "Built of strong timber and stone, this lodge sits on the banks of a river. A palisade surrounds the main building. The banner of a hunting falcon flies from the roof.",
    features: [
      "Fortified lodge",
      "River dock",
      "Falcon's trophy room",
      "Guest quarters",
      "Armory and storage"
    ],
    connections: [],
  },
  {
    name: "Woodland Manse",
    type: "dungeon",
    description: "A vine-covered stone ruin inhabited by evil half-orc anchorites of Talos and their twig blight servants.",
    boxedText: "An ancient stone manor stands in a forest clearing, its walls covered in twisted vines. The windows are dark, and an aura of malevolence pervades the place. Strange stick-like creatures creep through the undergrowth.",
    features: [
      "Overgrown stone manse",
      "Anchorite quarters",
      "Twig blight infestation",
      "Shrine to Talos",
      "Underground crypt"
    ],
    connections: [],
  },
  {
    name: "Circle of Thunder",
    type: "wilderness",
    description: "An ancient stone circle on a hilltop where anchorites of Talos summon Gorthok the Thunder Boar during storms.",
    boxedText: "Atop a windswept hill, seven weathered menhirs form a circle. The stones are carved with primitive symbols of storms and lightning. Dark clouds gather overhead even on clear days.",
    features: [
      "Stone circle with menhirs",
      "Ritual site",
      "Anchorite camp",
      "Gorthok summoning area",
      "Storm magic effects"
    ],
    connections: [],
  },
  
  // Chapter 4 Locations
  {
    name: "Tower of Storms",
    type: "dungeon",
    description: "An ancient lighthouse on a rocky promontory, now home to the sea hag Moesko and her harpies.",
    boxedText: "A crumbling stone tower rises from a rocky outcrop surrounded by crashing waves. Broken ramparts encircle the lighthouse. Eerie singing echoes on the wind.",
    features: [
      "Lighthouse tower",
      "Harpy roosts",
      "Moesko's lair",
      "Charm of the Storm",
      "Treacherous cliffs"
    ],
    connections: [],
  },
  {
    name: "Dragon Barrow",
    type: "dungeon",
    description: "A burial mound containing a warrior's tomb and a legendary dragon-slaying sword. Guarded by a zombie minotaur.",
    boxedText: "An earthen mound rises from the plain, its entrance a stone doorway half-buried in the hillside. Ancient runes warn of the guardian within.",
    features: [
      "Burial mound entrance",
      "Warrior's tomb",
      "Zombie minotaur guardian",
      "Dragon-slaying sword",
      "Ancient treasures"
    ],
    connections: [],
  },
  {
    name: "Axeholm",
    type: "dungeon",
    description: "An abandoned dwarven fortress carved into a mountain, haunted by a banshee and infested with ghouls.",
    boxedText: "A massive stone fortress is built into the base of a mountain. Its portcullis stands closed, and arrow slits dot the walls. An oppressive silence hangs over the place, broken occasionally by a distant, mournful wail.",
    features: [
      "Fortified entrance with portcullis",
      "Great halls and barracks",
      "Banshee (Vyldara) haunting upper levels",
      "Ghoul infestation",
      "Dwarven vault with magic items",
      "Defensible refuge for Phandalin"
    ],
    connections: [],
  },
  {
    name: "Icespire Hold",
    type: "dungeon",
    description: "Cryovain's lair atop Icespire Peak. A crumbling orc fortress claimed by the white dragon after killing the orc war chief.",
    boxedText: "At the peak of the highest mountain stands a fortress of ice-covered stone. The air is frigid, and snow swirls around the battlements. The ground is littered with frozen corpses and dragon claw marks scar the walls.",
    features: [
      "Icy fortress at mountain peak",
      "Cryovain's treasure hoard",
      "Frozen corpses",
      "Orc remnants",
      "Treacherous ice and snow",
      "Final dragon battle arena"
    ],
    connections: [],
  },
  {
    name: "Shrine of Savras",
    type: "dungeon",
    description: "An abandoned shrine to Savras (god of divination) south of Conyberry, now inhabited by an ochre jelly.",
    boxedText: "Stone walls covered in ivy mark the ruins of an old shrine. A statue of an all-seeing eye stands in the courtyard, its stone gaze seeming to follow visitors.",
    features: [
      "Ruined shrine structure",
      "Statue of Savras",
      "Ochre jelly inhabitant",
      "Hidden treasures",
      "Divination altar"
    ],
    connections: [],
  },
  {
    name: "High Road",
    type: "wilderness",
    description: "The coastal highway connecting Neverwinter to Waterdeep, patrolled by guards but still dangerous.",
    boxedText: "A well-maintained road of packed earth and gravel stretches along the coast. Guard patrols pass by occasionally, but the road remains dangerous between settlements.",
    features: ["Coastal highway", "Patrol routes", "Camping sites", "Coastal views"],
    connections: [],
  },
  {
    name: "Triboar Trail",
    type: "wilderness",
    description: "The safest route between Neverwinter and Triboar to the east, though monster attacks are commonplace.",
    boxedText: "A dirt trail winds through foothills and forests. Wagon ruts mark the path, but the forest presses close on both sides. Distant howls and roars echo through the trees.",
    features: ["Forest trail", "Wagon ruts", "Camping clearings", "Monster tracks"],
    connections: [],
  },
  {
    name: "Conyberry",
    type: "wilderness",
    description: "An abandoned town sacked by barbarians years ago. The Triboar Trail runs through its ruins.",
    boxedText: "Ruined buildings and overgrown foundations mark where a town once stood. The Triboar Trail cuts through the center. An eerie quiet pervades the ruins.",
    features: ["Ruined buildings", "Overgrown streets", "Abandoned wells", "Potential dragon encounter"],
    connections: [],
  },
];

// =============================================================================
// NPCs
// =============================================================================

export const npcs: Omit<InsertAdventureNpc, "adventureId" | "locationId">[] = [
  // Quest Givers and Allies
  {
    name: "Harbin Wester",
    race: "Human",
    role: "Quest Giver",
    description: "Phandalin's pompous townmaster and banker. Terrified of the dragon, he rarely leaves his house but posts quests on the job board.",
    personality: "Cowardly, pompous, and self-important. Speaks through his door rather than opening it when dragon sightings are recent.",
    ideals: "Self-preservation and maintaining his position of authority. Believes money and bureaucracy can solve problems.",
    bonds: "Responsible for Phandalin's safety, though his fear often paralyzes him. His half-brother Tibor runs the Loggers' Camp.",
    flaws: "Cowardice. Refuses to put himself in danger. Often makes decisions that protect himself rather than the town.",
    questConnections: [],
  },
  {
    name: "Toblen Stonehill",
    race: "Human",
    role: "Ally",
    description: "Proprietor of the Stonehill Inn. A short, friendly man originally from Triboar who came to Phandalin to prospect but found he was better at innkeeping.",
    personality: "Friendly, hospitable, and loves sharing stories and gossip with travelers.",
    ideals: "Good hospitality and helping travelers feel welcome in a dangerous land.",
    bonds: "Cares deeply about Phandalin and its people. Knows everyone in town.",
    flaws: "Sometimes shares information that should remain private. Gossips too freely.",
    questConnections: [],
  },
  {
    name: "Adabra Gwynn",
    race: "Human",
    role: "Ally",
    description: "A midwife and acolyte of Chauntea who lives in a windmill on Umbrage Hill. Sells potions of healing. Has a manticore companion.",
    personality: "Kind, nurturing, but tough and independent. Refuses to abandon her post despite danger.",
    ideals: "Healing and helping those in need. Protecting life and nurturing growth.",
    bonds: "Devoted to Chauntea. Has befriended a manticore that she healed after it was wounded by the dragon.",
    flaws: "Stubborn. Sometimes too trusting of creatures others would consider monsters.",
    statsBlock: {
      ac: 10,
      hp: 9,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 11 },
      specialAbilities: ["Spellcasting (Cleric)", "Healing spells"]
    },
    questConnections: [],
  },
  {
    name: "Norbus Ironrune",
    race: "Dwarf",
    role: "Ally",
    description: "A dwarf prospector working at the Dwarven Excavation with his partner Gwyn Oresong.",
    personality: "Practical, hardworking, and curious about ancient dwarven history.",
    ideals: "Honoring dwarven heritage by uncovering lost history.",
    bonds: "Partner to Gwyn Oresong. Devoted to the excavation.",
    flaws: "Can become so focused on his work that he ignores danger.",
    questConnections: [],
  },
  {
    name: "Gwyn Oresong",
    race: "Dwarf",
    role: "Ally",
    description: "A dwarf prospector working at the Dwarven Excavation with Norbus Ironrune.",
    personality: "Cheerful, optimistic, loves singing while working.",
    ideals: "Finding beauty and value in the old stones of the world.",
    bonds: "Partner to Norbus Ironrune. Dreams of discovering great treasures.",
    flaws: "Sometimes too optimistic about dangerous situations.",
    questConnections: [],
  },
  {
    name: "King Korboz",
    race: "Rock Gnome",
    role: "Ally",
    description: "Co-ruler of Gnomengarde with King Gnerkli. Paranoid and suspicious of outsiders but inventive.",
    personality: "Paranoid, nervous, and suspicious. Constantly worried about threats.",
    ideals: "Protecting his people through caution and vigilance.",
    bonds: "Rules Gnomengarde alongside King Gnerkli. Devoted to gnome safety.",
    flaws: "Extreme paranoia. Sees threats where none exist.",
    questConnections: [],
  },
  {
    name: "King Gnerkli",
    race: "Rock Gnome",
    role: "Ally",
    description: "Co-ruler of Gnomengarde with King Korboz. More optimistic but still cautious. Creates wild inventions.",
    personality: "Inventive, curious, slightly less paranoid than Korboz but still cautious.",
    ideals: "Progress through invention and ingenuity.",
    bonds: "Rules Gnomengarde alongside King Korboz. Loves creating new devices.",
    flaws: "His inventions often malfunction spectacularly.",
    questConnections: [],
  },
  {
    name: "Alfonse 'Big Al' Kalazorn",
    race: "Human",
    role: "Ally",
    description: "Retired sheriff of Triboar who now runs Butterskull Ranch. Currently held prisoner by orcs after defending his ranch.",
    personality: "Tough, brave, and no-nonsense. Used to being in charge.",
    ideals: "Justice and protecting what's his. Hard work and self-reliance.",
    bonds: "His ranch and his prized cow Petunia. Former lawman of Triboar.",
    flaws: "Stubborn. Sometimes underestimates threats.",
    statsBlock: {
      ac: 16,
      hp: 58,
      abilities: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 13 },
      specialAbilities: ["Multiattack", "Longsword", "Heavy Crossbow", "Second Wind"]
    },
    questConnections: [],
  },
  {
    name: "Tibor Wester",
    race: "Human",
    role: "Ally",
    description: "Harbin Wester's half-brother who runs the Loggers' Camp in Neverwinter Wood.",
    personality: "Practical, hardworking, and much braver than his brother.",
    ideals: "Hard work and self-sufficiency.",
    bonds: "His logging operation and his workers. Half-brother to Harbin.",
    flaws: "Can be too focused on work and profit.",
    questConnections: [],
  },
  {
    name: "Falcon",
    race: "Human",
    role: "Ally",
    description: "A retired veteran of many wars who runs Falcon's Hunting Lodge. Offers sanctuary to travelers in exchange for wine.",
    personality: "Gruff but hospitable. Loves good wine and war stories.",
    ideals: "Honor among warriors. Protecting the innocent.",
    bonds: "His lodge and the sanctuary it provides. Old military comrades.",
    flaws: "Drinks too much. Can be overly proud of past exploits.",
    statsBlock: {
      ac: 17,
      hp: 58,
      abilities: { STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 13 },
      specialAbilities: ["Multiattack", "Longsword", "Crossbow", "Action Surge"]
    },
    questConnections: [],
  },
  {
    name: "Elmar Barthen",
    race: "Human",
    role: "Merchant",
    description: "Owner of Barthen's Provisions in Phandalin. A lean, balding man of fifty years.",
    personality: "Friendly, businesslike, and fair in his dealings.",
    ideals: "Honest trade and community support.",
    bonds: "His store and the town of Phandalin. His young clerks Ander and Thistle.",
    flaws: "Can be overly cautious with credit and loans.",
    questConnections: [],
  },
  {
    name: "Linene Graywind",
    race: "Human",
    role: "Merchant",
    description: "Sharp-tongued master of the Lionshield Coster trading post. Sells weapons and armor.",
    personality: "Sharp-tongued, no-nonsense, and protective of the town.",
    ideals: "Profit through fair trade, but won't sell to troublemakers.",
    bonds: "The Lionshield merchant company and Phandalin's safety.",
    flaws: "Quick to judge others. Sometimes too suspicious.",
    questConnections: [],
  },
  {
    name: "Halia Thornton",
    race: "Human",
    role: "Merchant",
    description: "Calculating guildmaster of the Phandalin Miner's Exchange. Secret agent of the Zhentarim.",
    personality: "Calculating, ambitious, and manipulative. Always playing political games.",
    ideals: "Power and control through wealth and influence.",
    bonds: "The Zhentarim organization. Her growing influence in Phandalin.",
    flaws: "Ruthless ambition. Will betray others for power.",
    questConnections: [],
  },
  {
    name: "Sister Garaele",
    race: "Elf",
    role: "Ally",
    description: "Zealous elf acolyte of Tymora who tends the Shrine of Luck. Harper agent. Currently away in Neverwinter during the adventure.",
    personality: "Zealous, dedicated, and secretive about her Harper connections.",
    ideals: "Luck, fortune, and opposing tyranny. Gathering information for the Harpers.",
    bonds: "The Harpers organization. The Shrine of Luck in Phandalin.",
    flaws: "Sometimes prioritizes Harper missions over local concerns.",
    questConnections: [],
  },
  
  // Villains and Monsters
  {
    name: "Cryovain",
    race: "Dragon",
    role: "Villain",
    description: "A young white dragon driven south by more powerful dragons. Claims the Sword Mountains as its territory, hunting and terrorizing the region.",
    personality: "Dim-witted and cruel, typical of white dragons. Territorial and aggressive.",
    ideals: "Conquest through fear. Hoarding treasure and establishing dominance.",
    bonds: "Its lair at Icespire Hold and the surrounding territory.",
    flaws: "Dim-witted for a dragon. Cruel and impulsive rather than cunning.",
    statsBlock: {
      ac: 17,
      hp: 133,
      speed: "40 ft., burrow 20 ft., fly 80 ft., swim 40 ft.",
      abilities: { STR: 18, DEX: 10, CON: 18, INT: 6, WIS: 11, CHA: 12 },
      specialAbilities: [
        "Ice Walk",
        "Cold Breath (15-ft. cone, DC 15 Con save, 45 cold damage)",
        "Multiattack (Bite and 2 Claws)",
        "Legendary Resistance (limited)",
        "Frightful Presence"
      ]
    },
    questConnections: [],
  },
  {
    name: "Moesko",
    race: "Sea Hag",
    role: "Villain",
    description: "An ancient sea hag who lairs in the Tower of Storms with her harpy servants.",
    personality: "Cruel, cunning, and delights in causing suffering.",
    ideals: "Spreading misery and corruption.",
    bonds: "Her harpy servants and the Tower of Storms.",
    flaws: "Overconfident in her abilities. Cruel rather than strategic.",
    statsBlock: {
      ac: 14,
      hp: 52,
      abilities: { STR: 16, DEX: 13, CON: 16, INT: 12, WIS: 12, CHA: 13 },
      specialAbilities: [
        "Horrific Appearance",
        "Death Glare",
        "Amphibious",
        "Claws"
      ]
    },
    questConnections: [],
  },
  {
    name: "Don-Jon Raskin",
    race: "Human (Anvilwraith)",
    role: "Villain",
    description: "The supposed new overseer of Mountain's Toe Gold Mine is actually a disguise. The real villain at Axeholm is the anvilwraith Don-Jon Raskin.",
    personality: "Bitter, vengeful, and obsessed with crafting.",
    ideals: "Perfect craftsmanship above all else.",
    bonds: "The forge and his craft. His unfinished works.",
    flaws: "Obsessive perfectionism led to his undeath.",
    statsBlock: {
      ac: 14,
      hp: 82,
      abilities: { STR: 18, DEX: 10, CON: 16, INT: 12, WIS: 10, CHA: 8 },
      specialAbilities: [
        "Heated Body (5 fire damage on touch)",
        "Multiattack",
        "Slam attack",
        "Heat Metal ability"
      ]
    },
    questConnections: [],
  },
  {
    name: "Vyldara",
    race: "Elf (Banshee)",
    role: "Villain",
    description: "The vengeful spirit of a moon elf ambassador who haunts Axeholm. Killed while trying to escape imprisonment.",
    personality: "Vengeful, sorrowful, and filled with rage at her fate.",
    ideals: "Vengeance against all who enter her domain.",
    bonds: "Bound to Axeholm by her violent death.",
    flaws: "Consumed by hatred. Cannot be reasoned with.",
    statsBlock: {
      ac: 12,
      hp: 58,
      abilities: { STR: 1, DEX: 14, CON: 10, INT: 12, WIS: 11, CHA: 17 },
      specialAbilities: [
        "Detect Life",
        "Incorporeal Movement",
        "Horrifying Visage",
        "Wail (deadly sonic attack)"
      ]
    },
    questConnections: [],
  },
  {
    name: "Anchorites of Talos",
    race: "Half-Orc",
    role: "Villain",
    description: "Evil half-orc spellcasters who worship Talos, god of storms. They advise and bless the orcs, dwelling in the Woodland Manse.",
    personality: "Zealous, destructive, and devoted to chaos.",
    ideals: "Destruction and chaos in service to Talos.",
    bonds: "Their god Talos and the Circle of Thunder ritual site.",
    flaws: "Fanaticism leads to reckless behavior.",
    statsBlock: {
      ac: 13,
      hp: 22,
      abilities: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 16, CHA: 11 },
      specialAbilities: [
        "Spellcasting (Cleric)",
        "Storm spells (thunderwave, call lightning)",
        "Channel Divinity: Destructive Wrath"
      ]
    },
    questConnections: [],
  },
  {
    name: "Gorthok the Thunder Boar",
    race: "Primal Beast",
    role: "Villain",
    description: "A massive primal boar that serves Talos. Summoned by the anchorites during storms at the Circle of Thunder.",
    personality: "Primal rage incarnate. Delights in destruction.",
    ideals: "Destruction for its own sake.",
    bonds: "Bound to serve Talos and his followers.",
    flaws: "Mindless destruction. No strategy or cunning.",
    statsBlock: {
      ac: 13,
      hp: 73,
      abilities: { STR: 20, DEX: 11, CON: 16, INT: 2, WIS: 10, CHA: 5 },
      specialAbilities: [
        "Charge (extra damage on charge)",
        "Relentless (doesn't die easily)",
        "Tusks (powerful gore attack)",
        "Thunder aura"
      ]
    },
    questConnections: [],
  },
  {
    name: "Zombie Minotaur",
    race: "Undead",
    role: "Villain",
    description: "An undead minotaur guardian protecting the warrior's tomb in Dragon Barrow.",
    personality: "Mindless, relentless guardian.",
    ideals: "Protect the tomb at all costs.",
    bonds: "Bound to guard the dragon slayer's resting place.",
    flaws: "Mindless. Cannot be reasoned with.",
    statsBlock: {
      ac: 11,
      hp: 97,
      abilities: { STR: 18, DEX: 6, CON: 16, INT: 3, WIS: 6, CHA: 5 },
      specialAbilities: [
        "Undead Fortitude",
        "Greataxe attack",
        "Gore attack",
        "Charge"
      ]
    },
    questConnections: [],
  },
  {
    name: "Manticore",
    race: "Monster",
    role: "Villain",
    description: "A manticore driven from its mountain lair by Cryovain. Now threatens Umbrage Hill but can be befriended by Adabra.",
    personality: "Cunning, cruel, but capable of gratitude if shown kindness.",
    ideals: "Survival and finding a new territory.",
    bonds: "Driven from its lair by the dragon. Grateful to those who help it.",
    flaws: "Naturally cruel and aggressive.",
    statsBlock: {
      ac: 14,
      hp: 68,
      abilities: { STR: 17, DEX: 16, CON: 17, INT: 7, WIS: 12, CHA: 8 },
      specialAbilities: [
        "Tail Spike Volley",
        "Multiattack (Bite and Claws)",
        "Flight"
      ]
    },
    questConnections: [],
  },
];

// =============================================================================
// Quests
// =============================================================================

export const quests: Omit<InsertAdventureQuest, "adventureId" | "chapterId" | "questGiverId">[] = [
  // Starting Quests
  {
    name: "Dwarven Excavation",
    description: "Dwarf prospectors discovered ancient dwarven ruins in the mountains. Warn them about the white dragon and help with any threats.",
    objectives: [
      "Travel to the Dwarven Excavation",
      "Warn Norbus and Gwyn about the dragon",
      "Deal with the ochre jelly threat",
      "Help defend against orc attack (if it occurs)",
      "Return to Harbin Wester for reward"
    ],
    rewards: {
      xp: 300,
      gold: 50,
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Gnomengarde",
    description: "Seek out the reclusive rock gnomes of Gnomengarde and acquire magical items or knowledge to help defeat the dragon.",
    objectives: [
      "Find Gnomengarde hidden behind a waterfall",
      "Gain audience with Kings Korboz and Gnerkli",
      "Complete a task for the gnomes",
      "Acquire magical items or aid",
      "Return to Harbin Wester"
    ],
    rewards: {
      xp: 300,
      gold: 50,
      items: ["Possible gnomish inventions or magic items"],
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Umbrage Hill",
    description: "The midwife Adabra Gwynn lives alone at Umbrage Hill. Urge her to return to Phandalin for safety, or help her deal with the manticore threat.",
    objectives: [
      "Travel to Umbrage Hill windmill",
      "Meet Adabra Gwynn",
      "Deal with the manticore (fight or befriend)",
      "Convince Adabra to seek safety (or accept her decision to stay)",
      "Return to Harbin Wester"
    ],
    rewards: {
      xp: 200,
      gold: 25,
      other: ["Access to potions of healing from Adabra"]
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  
  // Follow-Up Quests (Wave 1)
  {
    name: "Butterskull Ranch",
    description: "Orcs attacked Butterskull Ranch, burning buildings and capturing owner Big Al Kalazorn. Assess the damage and rescue him if possible.",
    objectives: [
      "Travel to Butterskull Ranch",
      "Assess the damage from orc attack",
      "Rescue Alfonse 'Big Al' Kalazorn",
      "Defeat or drive off the orcs",
      "Help Big Al find his cow Petunia",
      "Return to Harbin with report"
    ],
    rewards: {
      xp: 500,
      gold: 100,
      other: ["Big Al's reward for finding Petunia"]
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Loggers' Camp",
    description: "Deliver supplies to Tibor Wester's logging camp in Neverwinter Wood and help deal with ankheg threat.",
    objectives: [
      "Pick up supplies from Barthen's Provisions",
      "Travel to the Loggers' Camp",
      "Deliver supplies to Tibor Wester",
      "Deal with ankheg infestation",
      "Get signed delivery notice",
      "Return to Harbin Wester"
    ],
    rewards: {
      xp: 500,
      gold: 100,
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Mountain's Toe Gold Mine",
    description: "Escort the new overseer Don-Jon Raskin from Phandalin to the Mountain's Toe Gold Mine. Deal with wererat infestation.",
    objectives: [
      "Meet Don-Jon Raskin in Phandalin",
      "Escort him safely to the mine",
      "Deal with wererat threat in the mine",
      "Ensure the mine is safe for operation",
      "Return to Harbin Wester"
    ],
    rewards: {
      xp: 500,
      gold: 100,
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  
  // Follow-Up Quests (Wave 2)
  {
    name: "Axeholm",
    description: "Open the sealed dwarven fortress of Axeholm and clear it of monsters so it can serve as a refuge for Phandalin if the dragon attacks.",
    objectives: [
      "Travel to Axeholm",
      "Find a way to enter the sealed fortress",
      "Deal with the ghoul infestation",
      "Confront and defeat/drive off Vyldara the banshee",
      "Secure the fortress as a safe haven",
      "Return to Harbin Wester"
    ],
    rewards: {
      xp: 800,
      gold: 250,
      items: ["Magic items from dwarven vault"],
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Dragon Barrow",
    description: "Retrieve the legendary dragon-slaying sword from the warrior's tomb in Dragon Barrow.",
    objectives: [
      "Locate Dragon Barrow",
      "Enter the burial mound",
      "Defeat the zombie minotaur guardian",
      "Retrieve the dragon-slaying sword",
      "Keep the sword as your reward"
    ],
    rewards: {
      xp: 700,
      items: ["Dragon-slaying longsword +1"],
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Woodland Manse",
    description: "Make a preemptive strike against the evil spellcasters manipulating the orcs. Destroy the anchorites of Talos in the Woodland Manse.",
    objectives: [
      "Visit Falcon's Hunting Lodge for information",
      "Travel to the Woodland Manse",
      "Fight through twig blight defenders",
      "Defeat the anchorites of Talos",
      "Disrupt their evil shrine",
      "Report success to Falcon"
    ],
    rewards: {
      xp: 800,
      gold: 0,
      other: ["Falcon's gratitude and future aid"]
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Tower of Storms",
    description: "Brave the Tower of Storms lighthouse to defeat the sea hag Moesko and her harpies. Claim the Charm of the Storm.",
    objectives: [
      "Travel to the coastal Tower of Storms",
      "Navigate the treacherous cliffs",
      "Fight or avoid the harpies",
      "Confront Moesko the sea hag",
      "Claim the Charm of the Storm",
      "Escape the tower"
    ],
    rewards: {
      xp: 700,
      items: ["Charm of the Storm (grants lightning resistance)"],
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  {
    name: "Circle of Thunder",
    description: "Disrupt the anchorites' ritual site at the Circle of Thunder and prevent the summoning of Gorthok the Thunder Boar.",
    objectives: [
      "Travel to the Circle of Thunder",
      "Confront the anchorites at the stone circle",
      "Prevent or survive Gorthok's summoning",
      "Defeat the anchorites and/or Gorthok",
      "Desecrate the ritual site"
    ],
    rewards: {
      xp: 800,
      gold: 0,
    },
    isMainQuest: false,
    prerequisiteQuestIds: [],
  },
  
  // Main Quest - Dragon Confrontation
  {
    name: "Icespire Hold",
    description: "Climb Icespire Peak and invade Cryovain's lair at Icespire Hold. Defeat the white dragon and end its reign of terror.",
    objectives: [
      "Prepare for the dragon confrontation",
      "Travel to Icespire Peak",
      "Climb the mountain to Icespire Hold",
      "Infiltrate the frozen fortress",
      "Confront Cryovain in battle",
      "Defeat the white dragon",
      "Claim the dragon's hoard",
      "Return as heroes to Phandalin"
    ],
    rewards: {
      xp: 2000,
      gold: 0,
      items: ["Dragon's treasure hoard"],
      other: ["Hero status in Phandalin", "Safety for the region"]
    },
    isMainQuest: true,
    prerequisiteQuestIds: [],
  },
];

// =============================================================================
// Encounters
// =============================================================================

export const encounters: Omit<InsertAdventureEncounter, "adventureId" | "locationId">[] = [
  // Starting Quest Encounters
  {
    name: "Ochre Jelly at Dwarven Excavation",
    type: "combat",
    difficulty: "medium",
    description: "A dangerous ochre jelly has oozed into the excavation site, threatening the dwarf prospectors.",
    enemies: [
      { 
        name: "Ochre Jelly", 
        count: 1, 
        hp: 45, 
        ac: 8, 
        specialAbilities: ["Amorphous", "Spider Climb", "Split when damaged by slashing/lightning", "Pseudopod (acid damage)"] 
      }
    ],
    xpReward: 450,
    treasure: [
      { item: "Gold pieces", quantity: 25, description: "Found in the jelly's mass" }
    ],
    triggerCondition: "Exploring the underground chambers of the excavation",
  },
  {
    name: "Orc Attack on Excavation",
    type: "combat",
    difficulty: "medium",
    description: "Orcs displaced by the dragon attack the Dwarven Excavation, seeking to drive out the miners.",
    enemies: [
      { name: "Orc", count: 4, hp: 15, ac: 13, specialAbilities: ["Greataxe", "Aggressive (bonus action move)"] },
      { name: "Orc Eye of Gruumsh", count: 1, hp: 45, ac: 16, specialAbilities: ["Spellcasting", "Spear", "Aggressive"] }
    ],
    xpReward: 500,
    treasure: [],
    triggerCondition: "Random encounter during or after visiting the excavation",
  },
  {
    name: "Mimic in Gnomengarde",
    type: "combat",
    difficulty: "medium",
    description: "A mimic has infiltrated Gnomengarde, disguising itself as a chest. The paranoid gnomes are terrified.",
    enemies: [
      { name: "Mimic", count: 1, hp: 58, ac: 12, specialAbilities: ["Shapechanger", "Adhesive", "False Appearance", "Bite"] }
    ],
    xpReward: 450,
    treasure: [
      { item: "Gnomish inventions", quantity: 1, description: "Random magical trinkets from the kings" }
    ],
    triggerCondition: "Completing a task for the gnome kings",
  },
  {
    name: "Manticore at Umbrage Hill",
    type: "combat",
    difficulty: "medium",
    description: "A manticore driven from its lair by Cryovain threatens Umbrage Hill. It can be fought or potentially befriended.",
    enemies: [
      { name: "Manticore", count: 1, hp: 68, ac: 14, specialAbilities: ["Tail Spike Volley", "Multiattack", "Flight"] }
    ],
    xpReward: 450,
    treasure: [],
    triggerCondition: "Arriving at Umbrage Hill",
  },
  
  // Follow-Up Quest Encounters
  {
    name: "Orc Raiders at Butterskull Ranch",
    type: "combat",
    difficulty: "hard",
    description: "A band of orcs has taken over the ranch, holding Big Al prisoner and occupying the buildings.",
    enemies: [
      { name: "Orc", count: 6, hp: 15, ac: 13, specialAbilities: ["Greataxe", "Aggressive"] },
      { name: "Orc War Chief", count: 1, hp: 93, ac: 16, specialAbilities: ["Multiattack", "Greataxe", "Spear", "Battle Cry"] }
    ],
    xpReward: 800,
    treasure: [
      { item: "Stolen ranch goods", quantity: 1, description: "Can be returned to Big Al" }
    ],
    triggerCondition: "Arriving at Butterskull Ranch",
  },
  {
    name: "Ankhegs at Loggers' Camp",
    type: "combat",
    difficulty: "hard",
    description: "Giant insectoid ankhegs burrow up from underground, attacking loggers and threatening the camp.",
    enemies: [
      { name: "Ankheg", count: 3, hp: 39, ac: 14, specialAbilities: ["Burrow", "Bite", "Acid Spray"] }
    ],
    xpReward: 600,
    treasure: [
      { item: "Ankheg chitin", quantity: 3, description: "Can be used for armor crafting" }
    ],
    triggerCondition: "Delivering supplies to the camp",
  },
  {
    name: "Wererats at Mountain's Toe Mine",
    type: "combat",
    difficulty: "hard",
    description: "Wererats have infested the gold mine, attacking miners and hoarding gold.",
    enemies: [
      { name: "Wererat", count: 4, hp: 33, ac: 12, specialAbilities: ["Shapechanger", "Bite (curse)", "Shortsword", "Keen Smell"] },
      { name: "Giant Rat", count: 8, hp: 7, ac: 12, specialAbilities: ["Pack Tactics", "Bite"] }
    ],
    xpReward: 900,
    treasure: [
      { item: "Gold nuggets", quantity: 100, description: "Stolen from the mine" }
    ],
    triggerCondition: "Exploring the mine tunnels",
  },
  {
    name: "Ghoul Infestation at Axeholm",
    type: "combat",
    difficulty: "hard",
    description: "Dwarf ghouls prowl the halls of Axeholm, the cursed remains of the fortress's former garrison.",
    enemies: [
      { name: "Ghoul", count: 8, hp: 22, ac: 12, specialAbilities: ["Paralyzing Touch", "Bite", "Claws"] }
    ],
    xpReward: 800,
    treasure: [],
    triggerCondition: "Entering Axeholm's halls",
  },
  {
    name: "Vyldara the Banshee",
    type: "combat",
    difficulty: "deadly",
    description: "The vengeful spirit of Vyldara haunts the upper halls of Axeholm, her wail capable of killing the living.",
    enemies: [
      { name: "Banshee", count: 1, hp: 58, ac: 12, specialAbilities: ["Incorporeal Movement", "Horrifying Visage", "Wail (deadly)"] }
    ],
    xpReward: 1100,
    treasure: [
      { item: "Platinum amulet of Moradin", quantity: 1, description: "Holy symbol worth 250 gp" }
    ],
    triggerCondition: "Reaching the haunted halls of Axeholm",
  },
  {
    name: "Zombie Minotaur Guardian",
    type: "combat",
    difficulty: "hard",
    description: "An undead minotaur guards the warrior's tomb in Dragon Barrow, attacking any who would disturb the grave.",
    enemies: [
      { name: "Zombie Minotaur", count: 1, hp: 97, ac: 11, specialAbilities: ["Undead Fortitude", "Greataxe", "Gore", "Charge"] }
    ],
    xpReward: 700,
    treasure: [
      { item: "Dragon-slaying longsword +1", quantity: 1, description: "The legendary blade" }
    ],
    triggerCondition: "Entering the burial chamber",
  },
  {
    name: "Twig Blights at Woodland Manse",
    type: "combat",
    difficulty: "medium",
    description: "Twig blights infest the overgrown manse, serving the anchorites of Talos.",
    enemies: [
      { name: "Twig Blight", count: 12, hp: 4, ac: 13, specialAbilities: ["False Appearance", "Claws"] }
    ],
    xpReward: 300,
    treasure: [],
    triggerCondition: "Approaching the Woodland Manse",
  },
  {
    name: "Anchorites of Talos",
    type: "combat",
    difficulty: "hard",
    description: "Evil half-orc spellcasters who worship Talos confront the party at the Woodland Manse.",
    enemies: [
      { name: "Anchorite of Talos", count: 3, hp: 22, ac: 13, specialAbilities: ["Spellcasting (Cleric)", "Thunderwave", "Call Lightning", "Destructive Wrath"] },
      { name: "Orc", count: 4, hp: 15, ac: 13, specialAbilities: ["Greataxe", "Aggressive"] }
    ],
    xpReward: 900,
    treasure: [
      { item: "Unholy symbols of Talos", quantity: 3, description: "Each worth 50 gp" }
    ],
    triggerCondition: "Infiltrating the Woodland Manse",
  },
  {
    name: "Harpies at Tower of Storms",
    type: "combat",
    difficulty: "medium",
    description: "Harpies nest in the tower, serving the sea hag Moesko and luring victims with their songs.",
    enemies: [
      { name: "Harpy", count: 4, hp: 38, ac: 11, specialAbilities: ["Luring Song", "Multiattack", "Claws", "Flight"] }
    ],
    xpReward: 800,
    treasure: [],
    triggerCondition: "Climbing the Tower of Storms",
  },
  {
    name: "Moesko the Sea Hag",
    type: "combat",
    difficulty: "hard",
    description: "The ancient sea hag Moesko defends her lair at the top of the Tower of Storms.",
    enemies: [
      { name: "Sea Hag", count: 1, hp: 52, ac: 14, specialAbilities: ["Horrific Appearance", "Death Glare", "Amphibious", "Claws"] }
    ],
    xpReward: 700,
    treasure: [
      { item: "Charm of the Storm", quantity: 1, description: "Grants lightning resistance" },
      { item: "Coins and trinkets", quantity: 1, description: "150 gp worth of treasure" }
    ],
    triggerCondition: "Reaching the top of the tower",
  },
  {
    name: "Gorthok the Thunder Boar",
    type: "combat",
    difficulty: "deadly",
    description: "The primal beast Gorthok is summoned during a storm at the Circle of Thunder, bringing destruction.",
    enemies: [
      { name: "Gorthok the Thunder Boar", count: 1, hp: 73, ac: 13, specialAbilities: ["Charge", "Relentless", "Tusks", "Thunder Aura"] },
      { name: "Anchorite of Talos", count: 2, hp: 22, ac: 13, specialAbilities: ["Spellcasting", "Storm magic"] }
    ],
    xpReward: 1500,
    treasure: [
      { item: "Storm-touched items", quantity: 1, description: "Magical residue from the ritual" }
    ],
    triggerCondition: "Interrupting the ritual at the Circle of Thunder",
  },
  
  // Dragon Encounters
  {
    name: "Cryovain's Ambush",
    type: "combat",
    difficulty: "deadly",
    description: "The white dragon Cryovain attacks from the sky, swooping down to freeze and devour victims.",
    enemies: [
      { name: "Cryovain (Young White Dragon)", count: 1, hp: 133, ac: 17, specialAbilities: ["Cold Breath", "Multiattack", "Flight", "Ice Walk", "Frightful Presence"] }
    ],
    xpReward: 2300,
    treasure: [],
    triggerCondition: "Random encounter at various locations (see Dragon's Location table)",
  },
  {
    name: "Final Battle at Icespire Hold",
    type: "combat",
    difficulty: "deadly",
    description: "The climactic confrontation with Cryovain in its lair atop Icespire Peak. The dragon fights to the death here.",
    enemies: [
      { name: "Cryovain (Young White Dragon)", count: 1, hp: 133, ac: 17, specialAbilities: ["Cold Breath", "Multiattack", "Flight", "Ice Walk", "Frightful Presence", "Lair Actions"] }
    ],
    xpReward: 2300,
    treasure: [
      { item: "Dragon's hoard", quantity: 1, description: "2000 gp, gems worth 500 gp, magic items" },
      { item: "Orc war chief's treasure", quantity: 1, description: "300 gp in coins and jewelry" },
      { item: "Random magic item", quantity: 1, description: "DM's choice appropriate for level 5-6 party" }
    ],
    triggerCondition: "Confronting Cryovain at Icespire Hold",
  },
];

export const dragonPeakData = {
  adventure,
  chapters,
  locations,
  npcs,
  quests,
  encounters,
};

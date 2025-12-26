/**
 * NPC Stat Blocks for D&D 5e
 * 
 * This file contains stat blocks for common humanoid NPCs from the SRD/Basic Rules.
 * These are used when the bestiary doesn't contain a matching monster.
 * Stats are sourced from the official D&D 5e SRD Appendix B: Nonplayer Characters.
 */

export interface NpcStatBlock {
  name: string
  size: string
  type: string
  alignment: string
  ac: number
  hp: number
  speed: string
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
  skills?: Record<string, number>
  savingThrows?: Record<string, number>
  senses: string
  languages: string
  cr: string
  xp: number
  traits: { name: string; description: string }[]
  actions: { name: string; description: string }[]
  reactions?: { name: string; description: string }[]
}

/**
 * Common humanoid NPC stat blocks
 * Keyed by lowercase name for case-insensitive lookup
 */
export const NPC_STAT_BLOCKS: Record<string, NpcStatBlock> = {
  'acolyte': {
    name: 'Acolyte',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 10,
    hp: 9,
    speed: '30 ft.',
    str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 11,
    skills: { Medicine: 4, Religion: 2 },
    senses: 'passive Perception 12',
    languages: 'any one language (usually Common)',
    cr: '1/4',
    xp: 50,
    traits: [
      { name: 'Spellcasting', description: '1st-level spellcaster. Wisdom-based (DC 12, +4 to hit). Cantrips: light, sacred flame, thaumaturgy. 1st level (3 slots): bless, cure wounds, sanctuary.' }
    ],
    actions: [
      { name: 'Club', description: 'Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.' }
    ]
  },

  'archmage': {
    name: 'Archmage',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 12,
    hp: 99,
    speed: '30 ft.',
    str: 10, dex: 14, con: 12, int: 20, wis: 15, cha: 16,
    savingThrows: { Int: 9, Wis: 6 },
    skills: { Arcana: 13, History: 13 },
    senses: 'passive Perception 12',
    languages: 'any six languages',
    cr: '12',
    xp: 8400,
    traits: [
      { name: 'Magic Resistance', description: 'The archmage has advantage on saving throws against spells and other magical effects.' },
      { name: 'Spellcasting', description: '18th-level spellcaster. Intelligence-based (DC 17, +9 to hit). Cantrips: fire bolt, light, mage hand, prestidigitation, shocking grasp. 1st level (4 slots): detect magic, identify, mage armor, magic missile. 2nd level (3 slots): detect thoughts, mirror image, misty step. 3rd level (3 slots): counterspell, fly, lightning bolt. 4th level (3 slots): banishment, fire shield, stoneskin. 5th level (3 slots): cone of cold, scrying, wall of force. 6th level (1 slot): globe of invulnerability. 7th level (1 slot): teleport. 8th level (1 slot): mind blank. 9th level (1 slot): time stop.' }
    ],
    actions: [
      { name: 'Dagger', description: 'Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.' }
    ]
  },

  'assassin': {
    name: 'Assassin',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any non-good alignment',
    ac: 15,
    hp: 78,
    speed: '30 ft.',
    str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10,
    savingThrows: { Dex: 6, Int: 4 },
    skills: { Acrobatics: 6, Deception: 3, Perception: 3, Stealth: 9 },
    senses: 'passive Perception 13',
    languages: 'Thieves\' cant plus any two languages',
    cr: '8',
    xp: 3900,
    traits: [
      { name: 'Assassinate', description: 'During its first turn, the assassin has advantage on attack rolls against any creature that hasn\'t taken a turn. Any hit against a surprised creature is a critical hit.' },
      { name: 'Evasion', description: 'If subjected to an effect allowing a Dexterity save for half damage, takes no damage on success and half on failure.' },
      { name: 'Sneak Attack', description: 'Once per turn, deals extra 14 (4d6) damage when hitting with advantage or when target is within 5 ft. of an ally.' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The assassin makes two shortsword attacks.' },
      { name: 'Shortsword', description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage. The target must make a DC 15 Constitution saving throw, taking 24 (7d6) poison damage on a failed save, or half on success.' },
      { name: 'Light Crossbow', description: 'Ranged Weapon Attack: +6 to hit, range 80/320 ft., one target. Hit: 7 (1d8 + 3) piercing damage. The target must make a DC 15 Constitution saving throw, taking 24 (7d6) poison damage on a failed save, or half on success.' }
    ]
  },

  'bandit': {
    name: 'Bandit',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any non-lawful alignment',
    ac: 12,
    hp: 11,
    speed: '30 ft.',
    str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10,
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '1/8',
    xp: 25,
    traits: [],
    actions: [
      { name: 'Scimitar', description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.' },
      { name: 'Light Crossbow', description: 'Ranged Weapon Attack: +3 to hit, range 80/320 ft., one target. Hit: 5 (1d8 + 1) piercing damage.' }
    ]
  },

  'bandit captain': {
    name: 'Bandit Captain',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any non-lawful alignment',
    ac: 15,
    hp: 65,
    speed: '30 ft.',
    str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14,
    savingThrows: { Str: 4, Dex: 5, Wis: 2 },
    skills: { Athletics: 4, Deception: 4 },
    senses: 'passive Perception 10',
    languages: 'any two languages',
    cr: '2',
    xp: 450,
    traits: [],
    actions: [
      { name: 'Multiattack', description: 'The captain makes three melee attacks: two with its scimitar and one with its dagger. Or makes two ranged attacks with daggers.' },
      { name: 'Scimitar', description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.' },
      { name: 'Dagger', description: 'Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d4 + 3) piercing damage.' }
    ],
    reactions: [
      { name: 'Parry', description: 'The captain adds 2 to its AC against one melee attack that would hit it. Must see attacker and be wielding a melee weapon.' }
    ]
  },

  'berserker': {
    name: 'Berserker',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any chaotic alignment',
    ac: 13,
    hp: 67,
    speed: '30 ft.',
    str: 16, dex: 12, con: 17, int: 9, wis: 11, cha: 9,
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '2',
    xp: 450,
    traits: [
      { name: 'Reckless', description: 'At the start of its turn, gains advantage on all melee weapon attack rolls, but attack rolls against it have advantage until its next turn.' }
    ],
    actions: [
      { name: 'Greataxe', description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.' }
    ]
  },

  'commoner': {
    name: 'Commoner',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 10,
    hp: 4,
    speed: '30 ft.',
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '0',
    xp: 10,
    traits: [],
    actions: [
      { name: 'Club', description: 'Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.' }
    ]
  },

  'cultist': {
    name: 'Cultist',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any non-good alignment',
    ac: 12,
    hp: 9,
    speed: '30 ft.',
    str: 11, dex: 12, con: 10, int: 10, wis: 11, cha: 10,
    skills: { Deception: 2, Religion: 2 },
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '1/8',
    xp: 25,
    traits: [
      { name: 'Dark Devotion', description: 'The cultist has advantage on saving throws against being charmed or frightened.' }
    ],
    actions: [
      { name: 'Scimitar', description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 4 (1d6 + 1) slashing damage.' }
    ]
  },

  'cult fanatic': {
    name: 'Cult Fanatic',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any non-good alignment',
    ac: 13,
    hp: 33,
    speed: '30 ft.',
    str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14,
    skills: { Deception: 4, Persuasion: 4, Religion: 2 },
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '2',
    xp: 450,
    traits: [
      { name: 'Dark Devotion', description: 'The fanatic has advantage on saving throws against being charmed or frightened.' },
      { name: 'Spellcasting', description: '4th-level spellcaster. Wisdom-based (DC 11, +3 to hit). Cantrips: light, sacred flame, thaumaturgy. 1st level (4 slots): command, inflict wounds, shield of faith. 2nd level (3 slots): hold person, spiritual weapon.' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The fanatic makes two melee attacks.' },
      { name: 'Dagger', description: 'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one creature. Hit: 4 (1d4 + 2) piercing damage.' }
    ]
  },

  'druid': {
    name: 'Druid',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 11,
    hp: 27,
    speed: '30 ft.',
    str: 10, dex: 12, con: 13, int: 12, wis: 15, cha: 11,
    skills: { Medicine: 4, Nature: 3, Perception: 4 },
    senses: 'passive Perception 14',
    languages: 'Druidic plus any two languages',
    cr: '2',
    xp: 450,
    traits: [
      { name: 'Spellcasting', description: '4th-level spellcaster. Wisdom-based (DC 12, +4 to hit). Cantrips: druidcraft, produce flame, shillelagh. 1st level (4 slots): entangle, longstrider, speak with animals, thunderwave. 2nd level (3 slots): animal messenger, barkskin.' }
    ],
    actions: [
      { name: 'Quarterstaff', description: 'Melee Weapon Attack: +2 to hit (+4 with shillelagh), reach 5 ft., one target. Hit: 3 (1d6) bludgeoning damage, or 4 (1d8) bludgeoning damage with shillelagh or if wielded with two hands.' }
    ]
  },

  'gladiator': {
    name: 'Gladiator',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 16,
    hp: 112,
    speed: '30 ft.',
    str: 18, dex: 15, con: 16, int: 10, wis: 12, cha: 15,
    savingThrows: { Str: 7, Dex: 5, Con: 6 },
    skills: { Athletics: 10, Intimidation: 5 },
    senses: 'passive Perception 11',
    languages: 'any one language (usually Common)',
    cr: '5',
    xp: 1800,
    traits: [
      { name: 'Brave', description: 'The gladiator has advantage on saving throws against being frightened.' },
      { name: 'Brute', description: 'A melee weapon deals one extra die of its damage when the gladiator hits with it (included in the attack).' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The gladiator makes three melee attacks or two ranged attacks.' },
      { name: 'Spear', description: 'Melee or Ranged Weapon Attack: +7 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 11 (2d6 + 4) piercing damage, or 13 (2d8 + 4) piercing damage if used with two hands.' },
      { name: 'Shield Bash', description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 9 (2d4 + 4) bludgeoning damage. Target must succeed DC 15 Strength save or be knocked prone.' }
    ],
    reactions: [
      { name: 'Parry', description: 'The gladiator adds 3 to its AC against one melee attack that would hit it. Must see attacker and be wielding a melee weapon.' }
    ]
  },

  'guard': {
    name: 'Guard',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 16,
    hp: 11,
    speed: '30 ft.',
    str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10,
    skills: { Perception: 2 },
    senses: 'passive Perception 12',
    languages: 'any one language (usually Common)',
    cr: '1/8',
    xp: 25,
    traits: [],
    actions: [
      { name: 'Spear', description: 'Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage.' }
    ]
  },

  'knight': {
    name: 'Knight',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 18,
    hp: 52,
    speed: '30 ft.',
    str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15,
    savingThrows: { Con: 4, Wis: 2 },
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '3',
    xp: 700,
    traits: [
      { name: 'Brave', description: 'The knight has advantage on saving throws against being frightened.' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The knight makes two melee attacks.' },
      { name: 'Greatsword', description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.' },
      { name: 'Heavy Crossbow', description: 'Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.' },
      { name: 'Leadership (Recharges after a Short or Long Rest)', description: 'For 1 minute, the knight can utter a command or warning whenever a nonhostile creature within 30 ft. makes an attack roll or saving throw. The creature can add a d4 to its roll.' }
    ],
    reactions: [
      { name: 'Parry', description: 'The knight adds 2 to its AC against one melee attack that would hit it. Must see attacker and be wielding a melee weapon.' }
    ]
  },

  'mage': {
    name: 'Mage',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 12,
    hp: 40,
    speed: '30 ft.',
    str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11,
    savingThrows: { Int: 6, Wis: 4 },
    skills: { Arcana: 6, History: 6 },
    senses: 'passive Perception 11',
    languages: 'any four languages',
    cr: '6',
    xp: 2300,
    traits: [
      { name: 'Spellcasting', description: '9th-level spellcaster. Intelligence-based (DC 14, +6 to hit). Cantrips: fire bolt, light, mage hand, prestidigitation. 1st level (4 slots): detect magic, mage armor, magic missile, shield. 2nd level (3 slots): misty step, suggestion. 3rd level (3 slots): counterspell, fireball, fly. 4th level (3 slots): greater invisibility, ice storm. 5th level (1 slot): cone of cold.' }
    ],
    actions: [
      { name: 'Dagger', description: 'Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.' }
    ]
  },

  'noble': {
    name: 'Noble',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 15,
    hp: 9,
    speed: '30 ft.',
    str: 11, dex: 12, con: 11, int: 12, wis: 14, cha: 16,
    skills: { Deception: 5, Insight: 4, Persuasion: 5 },
    senses: 'passive Perception 10',
    languages: 'any two languages',
    cr: '1/8',
    xp: 25,
    traits: [],
    actions: [
      { name: 'Rapier', description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) piercing damage.' }
    ],
    reactions: [
      { name: 'Parry', description: 'The noble adds 2 to its AC against one melee attack that would hit it. Must see attacker and be wielding a melee weapon.' }
    ]
  },

  'priest': {
    name: 'Priest',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 13,
    hp: 27,
    speed: '25 ft.',
    str: 10, dex: 10, con: 12, int: 13, wis: 16, cha: 13,
    skills: { Medicine: 7, Persuasion: 3, Religion: 4 },
    senses: 'passive Perception 13',
    languages: 'any two languages',
    cr: '2',
    xp: 450,
    traits: [
      { name: 'Divine Eminence', description: 'As a bonus action, can expend a spell slot to cause melee weapon attacks to deal extra 10 (3d6) radiant damage for the turn. Increases by 1d6 per slot level above 1st.' },
      { name: 'Spellcasting', description: '5th-level spellcaster. Wisdom-based (DC 13, +5 to hit). Cantrips: light, sacred flame, thaumaturgy. 1st level (4 slots): cure wounds, guiding bolt, sanctuary. 2nd level (3 slots): lesser restoration, spiritual weapon. 3rd level (2 slots): dispel magic, spirit guardians.' }
    ],
    actions: [
      { name: 'Mace', description: 'Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 3 (1d6) bludgeoning damage.' }
    ]
  },

  'scout': {
    name: 'Scout',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 13,
    hp: 16,
    speed: '30 ft.',
    str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11,
    skills: { Nature: 4, Perception: 5, Stealth: 6, Survival: 5 },
    senses: 'passive Perception 15',
    languages: 'any one language (usually Common)',
    cr: '1/2',
    xp: 100,
    traits: [
      { name: 'Keen Hearing and Sight', description: 'The scout has advantage on Wisdom (Perception) checks that rely on hearing or sight.' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The scout makes two melee attacks or two ranged attacks.' },
      { name: 'Shortsword', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.' },
      { name: 'Longbow', description: 'Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage.' }
    ]
  },

  'spy': {
    name: 'Spy',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 12,
    hp: 27,
    speed: '30 ft.',
    str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16,
    skills: { Deception: 5, Insight: 4, Investigation: 5, Perception: 6, Persuasion: 5, 'Sleight of Hand': 4, Stealth: 4 },
    senses: 'passive Perception 16',
    languages: 'any two languages',
    cr: '1',
    xp: 200,
    traits: [
      { name: 'Cunning Action', description: 'On each of its turns, the spy can use a bonus action to take the Dash, Disengage, or Hide action.' },
      { name: 'Sneak Attack (1/Turn)', description: 'Deals extra 7 (2d6) damage when hitting with advantage, or when target is within 5 ft. of an ally and the spy doesn\'t have disadvantage.' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The spy makes two melee attacks.' },
      { name: 'Shortsword', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.' },
      { name: 'Hand Crossbow', description: 'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage.' }
    ]
  },

  'thug': {
    name: 'Thug',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any non-good alignment',
    ac: 11,
    hp: 32,
    speed: '30 ft.',
    str: 15, dex: 11, con: 14, int: 10, wis: 10, cha: 11,
    skills: { Intimidation: 2 },
    senses: 'passive Perception 10',
    languages: 'any one language (usually Common)',
    cr: '1/2',
    xp: 100,
    traits: [
      { name: 'Pack Tactics', description: 'The thug has advantage on an attack roll against a creature if at least one of the thug\'s allies is within 5 ft. of the creature and the ally isn\'t incapacitated.' }
    ],
    actions: [
      { name: 'Multiattack', description: 'The thug makes two melee attacks.' },
      { name: 'Mace', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.' },
      { name: 'Heavy Crossbow', description: 'Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.' }
    ]
  },

  'tribal warrior': {
    name: 'Tribal Warrior',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 12,
    hp: 11,
    speed: '30 ft.',
    str: 13, dex: 11, con: 12, int: 8, wis: 11, cha: 8,
    senses: 'passive Perception 10',
    languages: 'any one language',
    cr: '1/8',
    xp: 25,
    traits: [
      { name: 'Pack Tactics', description: 'The warrior has advantage on an attack roll against a creature if at least one of the warrior\'s allies is within 5 ft. of the creature and the ally isn\'t incapacitated.' }
    ],
    actions: [
      { name: 'Spear', description: 'Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage, or 5 (1d8 + 1) piercing damage if used with two hands.' }
    ]
  },

  'veteran': {
    name: 'Veteran',
    size: 'Medium',
    type: 'humanoid (any race)',
    alignment: 'any alignment',
    ac: 17,
    hp: 58,
    speed: '30 ft.',
    str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10,
    skills: { Athletics: 5, Perception: 2 },
    senses: 'passive Perception 12',
    languages: 'any one language (usually Common)',
    cr: '3',
    xp: 700,
    traits: [],
    actions: [
      { name: 'Multiattack', description: 'The veteran makes two longsword attacks. If it has a shortsword drawn, it can also make a shortsword attack.' },
      { name: 'Longsword', description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.' },
      { name: 'Shortsword', description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.' },
      { name: 'Heavy Crossbow', description: 'Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.' }
    ]
  }
}

/**
 * Look up an NPC by name (case-insensitive)
 * @param name The NPC name to look up
 * @returns The NPC stat block or undefined if not found
 */
export function getNpcStatBlock(name: string): NpcStatBlock | undefined {
  const normalizedName = name.toLowerCase().trim()
  
  // Direct lookup
  if (NPC_STAT_BLOCKS[normalizedName]) {
    return NPC_STAT_BLOCKS[normalizedName]
  }
  
  // Try with common prefixes/suffixes removed
  const prefixesToRemove = ['ragged', 'old', 'young', 'grizzled', 'scarred', 'hooded', 'masked', 'dark', 'shadowy']
  for (const prefix of prefixesToRemove) {
    if (normalizedName.startsWith(prefix + ' ')) {
      const baseNpc = normalizedName.slice(prefix.length + 1)
      if (NPC_STAT_BLOCKS[baseNpc]) {
        return NPC_STAT_BLOCKS[baseNpc]
      }
    }
  }
  
  // Try singular forms
  if (normalizedName.endsWith('s') && normalizedName.length > 3) {
    const singular = normalizedName.slice(0, -1)
    if (NPC_STAT_BLOCKS[singular]) {
      return NPC_STAT_BLOCKS[singular]
    }
  }
  
  return undefined
}

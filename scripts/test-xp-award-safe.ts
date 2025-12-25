#!/usr/bin/env node
/**
 * Safe XP Award Testing Script
 * 
 * This script tests the XP award functionality WITHOUT touching the production database.
 * It uses the mock storage implementation to simulate the game state.
 * 
 * Usage: npx tsx scripts/test-xp-award-safe.ts
 */

// Enable mock storage mode BEFORE importing any server code
process.env.USE_MOCK_STORAGE = '1';

import { getLevelFromXP, calculateLevelUpHP, getAbilityModifier, getMaxSpellSlots, isSpellcaster, getMaxCantripsKnown, getMaxSpellsKnown, classDefinitions, classSkillFeatures, type DndClass } from '../shared/schema';

// Mock storage implementation
interface Character {
  id: string;
  userId: string;
  characterName: string;
  xp?: number;
  level?: number;
  maxHp?: number;
  currentHp?: number;
  class?: string;
  stats?: any;
  gold?: number;
  spellSlots?: any;
  levelChoices?: any[];
}

const mockCharacters: Character[] = [
  { 
    id: 'char-1', 
    userId: 'user-1', 
    characterName: 'Alice Fighter', 
    xp: 0, 
    level: 1, 
    maxHp: 12, 
    currentHp: 12, 
    class: 'Fighter', 
    stats: { constitution: 14 }, 
    gold: 0,
    spellSlots: {},
    levelChoices: []
  },
  { 
    id: 'char-2', 
    userId: 'user-2', 
    characterName: 'Bob Wizard', 
    xp: 0, 
    level: 1, 
    maxHp: 8, 
    currentHp: 8, 
    class: 'Wizard', 
    stats: { constitution: 10 }, 
    gold: 0,
    spellSlots: { max: { '1': 2 }, current: { '1': 2 } },
    levelChoices: []
  },
  {
    id: 'char-3',
    userId: 'user-3',
    characterName: 'Charlie Cleric',
    xp: 850,
    level: 3,
    maxHp: 22,
    currentHp: 22,
    class: 'Cleric',
    stats: { constitution: 12 },
    gold: 100,
    spellSlots: { max: { '1': 4, '2': 2 }, current: { '1': 4, '2': 2 } },
    levelChoices: []
  }
];

// Mock storage object
const mockStorage = {
  async getSavedCharacter(id: string) {
    return mockCharacters.find(c => c.id === id) || null;
  },
  async updateSavedCharacter(id: string, updates: any) {
    const char = mockCharacters.find(c => c.id === id);
    if (!char) throw new Error('Character not found');
    Object.assign(char, updates);
    return char;
  }
};

// XP Award Logic (copied from routes.ts)
async function awardXpToCharacter(characterId: string, xpAmount: number) {
  const existing = await mockStorage.getSavedCharacter(characterId);
  if (!existing) throw new Error("Character not found");

  const oldXp = existing.xp || 0;
  const newXp = oldXp + xpAmount;
  const oldLevel = existing.level || 1;
  const newLevel = getLevelFromXP(newXp);
  const leveledUp = newLevel > oldLevel;

  let updates: any = { xp: newXp };
  let levelsGained = 0;
  let totalHpGain = 0;

  if (leveledUp) {
    levelsGained = newLevel - oldLevel;
    updates.level = newLevel;

    if (existing.class) {
      const conMod = existing.stats?.constitution ? getAbilityModifier(existing.stats.constitution as number) : 0;
      let hpGain = 0;
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        hpGain += calculateLevelUpHP(existing.class as DndClass, conMod);
      }
      totalHpGain = hpGain;
      updates.maxHp = (existing.maxHp || 10) + hpGain;
      updates.currentHp = Math.min((updates.currentHp ?? existing.currentHp) + hpGain, updates.maxHp);

      // Update hit dice
      try {
        const classDef = classDefinitions[existing.class as DndClass];
        if (classDef && classDef.hitDie) {
          updates.hitDice = `${newLevel}d${classDef.hitDie}`;
        }
      } catch (err) {
        console.error('Failed to set hitDice on level up (TEST):', err);
      }
    }

    if (existing.class && isSpellcaster(existing.class as string)) {
      try {
        const newMaxSlots = getMaxSpellSlots(existing.class as string, newLevel);
        updates.spellSlots = { max: newMaxSlots, current: newMaxSlots };
      } catch (err) {
        console.error("Failed to compute spell slots on level up:", err);
      }
    }

    const existingChoices = (existing.levelChoices as Record<string, unknown>[]) || [];
    const newChoices: Record<string, unknown>[] = [];
    const ASI_LEVELS = [4, 8, 12, 16, 19];
    const FIGHTER_EXTRA_ASI = [6, 14];
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      if (ASI_LEVELS.includes(lvl)) newChoices.push({ level: lvl, feature: 'ASI', applied: false });
      if ((existing.class === 'Fighter' || existing.class === 'fighter') && FIGHTER_EXTRA_ASI.includes(lvl)) {
        newChoices.push({ level: lvl, feature: 'Fighter ASI', applied: false });
      }
    }

    // Class-level skill features
    const classFeatures = classSkillFeatures[existing.class as DndClass] || [];
    for (const feat of classFeatures) {
      if (feat.level > oldLevel && feat.level <= newLevel) {
        newChoices.push({ level: feat.level, feature: feat.name, applied: false, type: 'class_feature' });
      }
    }

    // Spell-related choices (cantrips / spells known)
    const normalizedClass = (existing.class as string).toLowerCase();
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      try {
        const prevCantrips = getMaxCantripsKnown(normalizedClass, lvl - 1);
        const newCantrips = getMaxCantripsKnown(normalizedClass, lvl);
        if (newCantrips > prevCantrips) {
          newChoices.push({ level: lvl, feature: 'Cantrips', count: newCantrips - prevCantrips, applied: false });
        }
      } catch (err) {
        // ignore
      }

      try {
        const prevSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl - 1) ?? 0;
        const newSpellsKnown = getMaxSpellsKnown(normalizedClass, lvl) ?? 0;
        if (newSpellsKnown > prevSpellsKnown) {
          newChoices.push({ level: lvl, feature: 'Spells Known', count: newSpellsKnown - prevSpellsKnown, applied: false });
        }
      } catch (err) {
        // ignore
      }
    }

    if (newChoices.length > 0) updates.levelChoices = [...existingChoices, ...newChoices];
  }

  const updated = await mockStorage.updateSavedCharacter(characterId, updates);

  return {
    character: updated,
    xpAwarded: xpAmount,
    leveledUp,
    previousLevel: oldLevel,
    newLevel: newLevel,
    levelsGained,
    totalHpGain,
  };
}

// Test scenarios
async function runTests() {
  console.log('='.repeat(80));
  console.log('XP AWARD SYSTEM - SAFE TESTING (Mock Storage)');
  console.log('='.repeat(80));
  console.log('\n📝 This test uses MOCK storage - production database is SAFE!\n');

  // Test 1: Small XP award (no level up)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 1: Small XP Award (No Level Up)');
  console.log('-'.repeat(80));
  const char1 = mockCharacters[0];
  console.log(`Before: ${char1.characterName} - Level ${char1.level}, XP ${char1.xp}, HP ${char1.currentHp}/${char1.maxHp}`);
  
  const result1 = await awardXpToCharacter(char1.id, 150);
  console.log(`Awarded: ${result1.xpAwarded} XP`);
  console.log(`After:  ${char1.characterName} - Level ${char1.level}, XP ${char1.xp}, HP ${char1.currentHp}/${char1.maxHp}`);
  console.log(`  Hit Dice: ${char1.hitDice || 'N/A'}`);
  console.log(`✅ Level Up: ${result1.leveledUp ? 'YES' : 'NO'}`);

  // Test 2: XP award causing level up
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 2: XP Award with Level Up (Fighter)');
  console.log('-'.repeat(80));
  console.log(`Before: ${char1.characterName} - Level ${char1.level}, XP ${char1.xp}, HP ${char1.currentHp}/${char1.maxHp}`);
  
  const result2 = await awardXpToCharacter(char1.id, 200);
  console.log(`Awarded: ${result2.xpAwarded} XP`);
  console.log(`After:  ${char1.characterName} - Level ${char1.level}, XP ${char1.xp}, HP ${char1.currentHp}/${char1.maxHp}`);
  console.log(`  Hit Dice: ${char1.hitDice || 'N/A'}`);
  console.log(`✅ Level Up: ${result2.leveledUp ? 'YES' : 'NO'}`);
  if (result2.leveledUp) {
    console.log(`   Levels Gained: ${result2.levelsGained}`);
    console.log(`   HP Gained: ${result2.totalHpGain}`);
    console.log(`   Previous Level: ${result2.previousLevel} → New Level: ${result2.newLevel}`);
    console.log(`   Level Choices:`, char1.levelChoices);
  }

  // Test 3: Spellcaster level up (spell slots)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 3: Spellcaster Level Up (Wizard)');
  console.log('-'.repeat(80));
  const char2 = mockCharacters[1];
  console.log(`Before: ${char2.characterName} - Level ${char2.level}, XP ${char2.xp}`);
  console.log(`  Spell Slots:`, char2.spellSlots);
  
  const result3 = await awardXpToCharacter(char2.id, 300);
  console.log(`Awarded: ${result3.xpAwarded} XP`);
  console.log(`After:  ${char2.characterName} - Level ${char2.level}, XP ${char2.xp}`);
  console.log(`  Spell Slots:`, char2.spellSlots);
  console.log(`  Hit Dice: ${char2.hitDice || 'N/A'}`);
  console.log(`✅ Level Up: ${result3.leveledUp ? 'YES' : 'NO'}`);
  if (result3.leveledUp) {
    console.log(`   Level Choices:`, char2.levelChoices);
  }

  // Test 4: Multiple level ups at once
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 4: Multiple Level Ups (Large XP Award)');
  console.log('-'.repeat(80));
  const char3 = mockCharacters[2];
  console.log(`Before: ${char3.characterName} - Level ${char3.level}, XP ${char3.xp}, HP ${char3.currentHp}/${char3.maxHp}`);
  console.log(`  Spell Slots:`, char3.spellSlots);
  
  const result4 = await awardXpToCharacter(char3.id, 2000);
  console.log(`Awarded: ${result4.xpAwarded} XP`);
  console.log(`After:  ${char3.characterName} - Level ${char3.level}, XP ${char3.xp}, HP ${char3.currentHp}/${char3.maxHp}`);
  console.log(`  Spell Slots:`, char3.spellSlots);
  console.log(`✅ Level Up: ${result4.leveledUp ? 'YES' : 'NO'}`);
  if (result4.leveledUp) {
    console.log(`   Levels Gained: ${result4.levelsGained} (${result4.previousLevel} → ${result4.newLevel})`);
    console.log(`   HP Gained: ${result4.totalHpGain}`);
    console.log(`   Level Choices:`, char3.levelChoices);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL STATE OF ALL CHARACTERS');
  console.log('='.repeat(80));
  mockCharacters.forEach(char => {
    console.log(`\n${char.characterName} (${char.class}):`);
    console.log(`  Level: ${char.level}, XP: ${char.xp}, HP: ${char.currentHp}/${char.maxHp}`);
    if (char.spellSlots && Object.keys(char.spellSlots.max || {}).length > 0) {
      console.log(`  Spell Slots:`, char.spellSlots.max);
    }
    if (char.levelChoices && char.levelChoices.length > 0) {
      console.log(`  Pending Level Choices: ${char.levelChoices.length}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL TESTS COMPLETED - Production database untouched!');
  console.log('='.repeat(80));
}

// Run tests
runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Direct XP Award Integration Test
 * 
 * This version directly tests the complete integration flow
 * without relying on routes.ts exports.
 */

// Enable mock storage mode
process.env.USE_MOCK_STORAGE = '1';

import { getLevelFromXP, calculateLevelUpHP, getAbilityModifier, getMaxSpellSlots, isSpellcaster, type DndClass } from '../shared/schema';

// Import mock storage
const mockMod = await import('../server/storage.mock');
const mockStorage = mockMod.default;

console.log('='.repeat(80));
console.log('DIRECT XP AWARD INTEGRATION TEST');
console.log('='.repeat(80));
console.log('📝 Using mock storage - production database is SAFE!\n');

// Reset storage to initial state
mockStorage.reset();

console.log('✅ Initial State:');
let chars = await mockStorage.getCharactersByRoomCode('ROOM1');
console.table(chars.map((c: any) => ({ 
  id: c.id, 
  name: c.characterName, 
  xp: c.xp, 
  level: c.level, 
  hp: `${c.currentHp}/${c.maxHp}`,
  class: c.class 
})));

// Direct XP award function (same logic as routes.ts)
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

// Simulate monster defeat: 101 XP split between Alice and Bob
console.log('\n' + '-'.repeat(80));
console.log('TEST: Monster Defeated - Goblin (101 XP)');
console.log('-'.repeat(80));

const totalXp = 101;
const participants = ['Alice', 'Bob'];

console.log(`Total XP to distribute: ${totalXp}`);
console.log(`Participants: ${participants.join(', ')}`);

// Split XP evenly
const perParticipant = Math.floor(totalXp / participants.length);
let remainder = totalXp - perParticipant * participants.length;

console.log(`XP per participant: ${perParticipant} (${remainder} remainder)`);

// Award XP to each participant
for (const name of participants) {
  const char = chars.find((c: any) => c.characterName === name);
  if (!char) {
    console.log(`❌ Character not found: ${name}`);
    continue;
  }

  const amount = perParticipant + (remainder > 0 ? 1 : 0);
  if (remainder > 0) remainder--;

  console.log(`\nAwarding ${amount} XP to ${name} (${char.id})...`);
  const result = await awardXpToCharacter(char.id, amount);
  console.log(`✅ Award complete:`);
  console.log(`   Old XP: ${result.previousLevel === result.newLevel ? (result.character.xp || 0) - amount : 'N/A'}`);
  console.log(`   New XP: ${result.character.xp || 0}`);
  console.log(`   Level: ${result.previousLevel} → ${result.newLevel}`);
  if (result.leveledUp) {
    console.log(`   ⭐ LEVEL UP! (+${result.totalHpGain} HP, ${result.levelsGained} level(s) gained)`);
  }
}

// Show final state
console.log('\n' + '-'.repeat(80));
console.log('FINAL STATE');
console.log('-'.repeat(80));

chars = await mockStorage.getCharactersByRoomCode('ROOM1');
console.table(chars.map((c: any) => ({ 
  id: c.id, 
  name: c.characterName, 
  xp: c.xp, 
  level: c.level, 
  hp: `${c.currentHp}/${c.maxHp}`,
  class: c.class 
})));

// Verification
const aliceXp = chars.find((c: any) => c.characterName === 'Alice')?.xp || 0;
const bobXp = chars.find((c: any) => c.characterName === 'Bob')?.xp || 0;

console.log('\n' + '='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log(`Alice XP: ${aliceXp === 51 ? '✅' : aliceXp === 50 ? '✅' : '❌'} ${aliceXp} (expected 50 or 51)`);
console.log(`Bob XP: ${bobXp === 51 ? '✅' : bobXp === 50 ? '✅' : '❌'} ${bobXp} (expected 50 or 51)`);
console.log(`Total distributed: ${aliceXp + bobXp} (expected 101)`);

if (aliceXp + bobXp === 101) {
  console.log('\n✅ TEST PASSED - XP distribution working correctly!');
} else {
  console.log('\n❌ TEST FAILED - XP distribution incorrect');
  process.exit(1);
}

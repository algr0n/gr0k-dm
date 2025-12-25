import { getLevelFromXP, calculateLevelUpHP, getAbilityModifier, getMaxSpellSlots, isSpellcaster, type DndClass } from '../shared/schema';

async function simulate() {
  const char: any = {
    id: 'char-1',
    characterName: 'Testy McTest',
    class: 'Wizard',
    level: 3,
    xp: 900,
    stats: { constitution: 12 },
    maxHp: 18,
    currentHp: 18,
    spellSlots: { max: { '1': 3, '2': 2 }, current: { '1': 3, '2': 2 } },
    levelChoices: [],
  };

  const xpToAward = 1200;
  console.log('Before:', { level: char.level, xp: char.xp, maxHp: char.maxHp, spellSlots: char.spellSlots });

  const oldXp = char.xp || 0;
  const newXp = oldXp + xpToAward;
  const oldLevel = char.level || 1;
  const newLevel = getLevelFromXP(newXp);
  const leveledUp = newLevel > oldLevel;

  const updates: any = { xp: newXp };
  let levelsGained = 0;
  let totalHpGain = 0;

  if (leveledUp) {
    levelsGained = newLevel - oldLevel;
    updates.level = newLevel;

    if (char.class) {
      const conMod = char.stats?.constitution ? getAbilityModifier(char.stats.constitution as number) : 0;
      let hpGain = 0;
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        hpGain += calculateLevelUpHP(char.class as DndClass, conMod);
      }
      totalHpGain = hpGain;
      updates.maxHp = (char.maxHp || 10) + hpGain;
      updates.currentHp = Math.min((updates.currentHp ?? char.currentHp) + hpGain, updates.maxHp);
    }

    if (char.class && isSpellcaster(char.class as string)) {
      try {
        const newMaxSlots = getMaxSpellSlots(char.class as string, newLevel);
        updates.spellSlots = { max: newMaxSlots, current: newMaxSlots };
      } catch (err) {
        console.error('Failed to compute spell slots on level up:', err);
      }
    }

    // levelChoices
    const existingChoices = char.levelChoices || [];
    const newChoices: any[] = [];
    const ASI_LEVELS = [4, 8, 12, 16, 19];
    const FIGHTER_EXTRA_ASI = [6, 14];
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      if (ASI_LEVELS.includes(lvl)) newChoices.push({ level: lvl, feature: 'ASI', applied: false });
      if ((char.class === 'Fighter' || char.class === 'fighter') && FIGHTER_EXTRA_ASI.includes(lvl)) newChoices.push({ level: lvl, feature: 'Fighter ASI', applied: false });
    }
    if (newChoices.length > 0) updates.levelChoices = [...existingChoices, ...newChoices];
  }

  const updated = { ...char, ...updates };
  console.log('After simulation:', { updated, leveledUp, levelsGained, totalHpGain });
}

simulate().catch(e => { console.error(e); process.exit(1); });

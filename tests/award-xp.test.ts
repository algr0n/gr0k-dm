import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage with the in-memory mock
vi.mock('../server/storage', async () => {
  const mod = await import('../server/storage.mock');
  return mod;
});

import { awardXpToCharacter } from '../server/routes';
import storage from '../server/storage.mock';

beforeEach(() => {
  storage.reset();
});

describe('awardXpToCharacter', () => {
  it('levels up fighter and updates HP, hitDice', async () => {
    const res = await awardXpToCharacter('c1', 350); // Fighter needs 300 to reach level 2
    expect(res.leveledUp).toBe(true);
    expect(res.character.level).toBe(2);
    expect(res.totalHpGain).toBeGreaterThan(0);
    expect(res.character.hitDice).toBe('2d10');
  });

  it('levels up wizard and updates spell slots', async () => {
    const res = await awardXpToCharacter('c2', 300); // Wizard level 2
    expect(res.leveledUp).toBe(true);
    expect(res.character.level).toBe(2);
    expect(res.character.spellSlots).toBeDefined();
    expect(res.character.spellSlots.max[1]).toBe(3);
  });
});
import { describe, test, expect } from 'vitest';
import combat, { rollInitiativesForCombat, resolveAttack } from "../server/combat";

describe("Combat engine basics", () => {
  test("rollInitiativesForCombat includes players and monsters and sorts", () => {
    const characters = [{ id: 'c1', userId: 'u1', characterName: 'Alice', initiativeModifier: 2, maxHp: 12 }];
    const players = [{ id: 'p1', name: 'Alice', userId: 'u1' }];
    const monsters = [{ id: 'm1', name: 'Goblin', ac: 15, hp: 7, stats: { dex: 14 } }];

    const initiatives = rollInitiativesForCombat(characters, players, monsters);
    expect(initiatives.length).toBe(2);
    // each entry has total
    expect(initiatives.every(i => typeof i.total === 'number')).toBe(true);
  });

  test("resolveAttack handles crits and hits", () => {
    // Since resolveAttack uses random d20, run many times to hit both paths
    let sawCrit = false;
    let sawMiss = false;
    for (let i = 0; i < 200; i++) {
      const r = resolveAttack(null, 5, 12, "1d6+2");
      if (r.isCritical) sawCrit = true;
      if (!r.hit) sawMiss = true;
      if (sawCrit && sawMiss) break;
    }
    expect(sawCrit).toBe(true);
    expect(sawMiss).toBe(true);
  });
});
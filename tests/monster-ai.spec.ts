import { describe, test, expect } from 'vitest';
import { createCombatState } from '../server/combat';
import { decideMonsterActions } from '../server/combat';

describe('Deterministic monster AI', () => {
  test('Monster targets lowest HP player', () => {
    const initiatives = [
      { id: 'm1', controller: 'monster', name: 'Gob', roll: 12, modifier: 0, total: 12, currentHp: 6, maxHp: 6, metadata: { primaryDamageExpression: '1d6' } },
      { id: 'p1', controller: 'player', name: 'Alice', roll: 15, modifier: 1, total: 16, currentHp: 10, maxHp: 10 },
      { id: 'p2', controller: 'player', name: 'Bob', roll: 10, modifier: 0, total: 10, currentHp: 3, maxHp: 10 },
    ];

    const state: any = createCombatState('roomX', initiatives as any);
    state.currentTurnIndex = 0; // monster's turn

    const decisions = decideMonsterActions(state, 1);
    expect(decisions.length).toBe(1);
    expect(decisions[0].actorId).toBe('m1');
    expect(decisions[0].action.targetId).toBe('p2');
  });
});
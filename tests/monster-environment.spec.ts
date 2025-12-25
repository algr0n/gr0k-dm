import { describe, test, expect } from 'vitest';
import { createCombatState } from '../server/combat';
import { decideMonsterActions } from '../server/combat';

describe('Environment & cover behavior', () => {
  test('Monster prefers target not behind cover for ranged attacks', () => {
    const initiatives = [
      { id: 'm1', controller: 'monster', name: 'Archer', roll: 10, modifier: 0, total: 10, currentHp: 8, metadata: { hasRangedAttack: true, rangedAttackBonus: 3, primaryDamageExpression: '1d8', position: { x: 0, y: 0 } } },
      { id: 'p1', controller: 'player', name: 'Alice', roll: 12, modifier: 0, total: 12, currentHp: 10, metadata: { position: { x: 25, y: 0 } } },
      { id: 'p2', controller: 'player', name: 'Bob', roll: 11, modifier: 0, total: 11, currentHp: 10, metadata: { position: { x: 20, y: 0 } } },
    ];

    // Place a cover object between monster and Bob so Bob is obstructed
    const state: any = createCombatState('roomC', initiatives as any);
    state.environment = [ { id: 'cover1', type: 'cover', position: { x: 22, y: 0 }, radius: 2, properties: { coverBonus: 2 } } ];
    state.currentTurnIndex = 0;

    const decisions = decideMonsterActions(state, 1);
    expect(decisions.length).toBe(1);
    const action = decisions[0].action;
    // Bob (p2) is behind cover, should prefer Alice (p1)
    expect(action.type).toBe('attack');
    expect(action.targetId).toBe('p1');
  });
});
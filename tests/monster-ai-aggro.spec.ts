import { describe, test, expect } from 'vitest';
import { createCombatState } from '../server/combat';
import { decideMonsterActions } from '../server/combat';

// Tests for aggro and movement

describe('Monster aggro & movement', () => {
  test('Monster prefers reachable target over farther low-HP target', () => {
    const initiatives = [
      { id: 'm1', controller: 'monster', name: 'Orc', roll: 10, modifier: 0, total: 10, currentHp: 15, maxHp: 15, metadata: { primaryDamageExpression: '1d8', reach: 5, position: { x: 0, y: 0 } } },
      { id: 'p1', controller: 'player', name: 'Alice', roll: 15, modifier: 1, total: 16, currentHp: 2, maxHp: 10, metadata: { position: { x: 30, y: 0 } } },
      { id: 'p2', controller: 'player', name: 'Bob', roll: 12, modifier: 0, total: 12, currentHp: 10, maxHp: 10, metadata: { position: { x: 4, y: 0 } } },
    ];

    const state: any = createCombatState('roomA', initiatives as any);
    state.currentTurnIndex = 0; // monster's turn

    const decisions = decideMonsterActions(state, 1);
    expect(decisions.length).toBe(1);
    const action = decisions[0].action;
    // Should target Bob (in melee reach), not Alice
    expect(action.type).toBe('attack');
    expect(action.targetId).toBe('p2');
  });

  test('Monster moves toward nearest target when none in range', () => {
    const initiatives = [
      { id: 'm1', controller: 'monster', name: 'Orc', roll: 10, modifier: 0, total: 10, currentHp: 15, maxHp: 15, metadata: { primaryDamageExpression: '1d8', reach: 5, speed: 6, position: { x: 0, y: 0 } } },
      { id: 'p1', controller: 'player', name: 'Alice', roll: 15, modifier: 1, total: 16, currentHp: 10, maxHp: 10, metadata: { position: { x: 40, y: 0 } } },
    ];

    const state: any = createCombatState('roomB', initiatives as any);
    state.currentTurnIndex = 0; // monster's turn

    const decisions = decideMonsterActions(state, 1);
    expect(decisions.length).toBe(1);
    const action = decisions[0].action;
    expect(action.type).toBe('move');
    expect(action.moveDistance).toBeGreaterThan(0);
    expect(action.toward).toBe('p1');
  });
});
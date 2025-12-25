import { describe, test, expect } from 'vitest';
import { createCombatState, updateThreat, decideMonsterActions } from '../server/combat';

describe('Threat-based targeting', () => {
  test('Monster prefers highest threat even if not lowest HP', () => {
    const initiatives = [
      { id: 'm1', controller: 'monster', name: 'Orc', roll: 10, modifier: 0, total: 10, currentHp: 15, metadata: { position: { x: 0, y: 0 } } },
      { id: 'p1', controller: 'player', name: 'Alice', roll: 12, modifier: 0, total: 12, currentHp: 2, metadata: { position: { x: 3, y: 0 } } },
      { id: 'p2', controller: 'player', name: 'Bob', roll: 11, modifier: 0, total: 11, currentHp: 10, metadata: { position: { x: 4, y: 0 } } },
    ];

    const state: any = createCombatState('roomT', initiatives as any);
    state.currentTurnIndex = 0;

    // Bob (p2) generated more threat by attacking earlier
    updateThreat(state, 'p2', 20);

    const decisions = decideMonsterActions(state, 1);
    expect(decisions.length).toBe(1);
    expect(decisions[0].action.type).toBe('attack');
    // Even though Alice has low HP and is nearer, Bob has higher threat => chosen
    expect(decisions[0].action.targetId).toBe('p2');
  });
});
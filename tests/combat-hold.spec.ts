import { describe, test, expect } from 'vitest';
import { createCombatState, rollInitiativesForCombat, addHold, processTrigger, advanceTurn } from "../server/combat";

describe('Combat hold/delay behavior', () => {
  test('Player holds until after another player then acts in that position', () => {
    // Create a small combat: P1,P2,M1
    const characters = [
      { id: 'c1', userId: 'u1', characterName: 'P1', initiativeModifier: 1, maxHp: 10 },
      { id: 'c2', userId: 'u2', characterName: 'P2', initiativeModifier: 1, maxHp: 10 },
    ];
    const players = [{ id: 'p1', name: 'P1', userId: 'u1' }, { id: 'p2', name: 'P2', userId: 'u2' }];
    const monsters = [{ id: 'm1', name: 'Gob', ac: 12, hp: 6 }];

    // Force deterministic initiatives by overriding roll values
    const initiatives = [
      { id: 'c1', controller: 'player', name: 'P1', roll: 18, modifier: 1, total: 19, currentHp: 10, maxHp: 10 },
      { id: 'c2', controller: 'player', name: 'P2', roll: 15, modifier: 1, total: 16, currentHp: 10, maxHp: 10 },
      { id: 'm1', controller: 'monster', name: 'Gob', roll: 12, modifier: 0, total: 12, currentHp: 6, maxHp: 6 },
    ];

    const state: any = createCombatState('room1', initiatives as any);

    // P1 decides to hold until after P2
    addHold(state, 'c1', { type: 'until', triggerActorId: 'c2' });

    // P1's turn arrives: currentTurnIndex = 0
    expect(state.initiatives[state.currentTurnIndex].id).toBe('c1');

    // P1 passes (we simulate pass by advancing turn)
    const prev = state.initiatives[state.currentTurnIndex].id;
    advanceTurn(state); // now current is c2
    expect(state.initiatives[state.currentTurnIndex].id).toBe('c2');

    // After c2 finishes, trigger held actors
    const inserted = processTrigger(state, 'c2');
    // c1 should be inserted immediately after c2
    expect(inserted).toContain('c1');

    // Find order: should be c2, c1, m1 (since c1 was moved after c2)
    expect(state.initiatives[ state.currentTurnIndex ].id).toBe('c2');
    const next = state.initiatives[ state.currentTurnIndex + 1 ].id;
    expect(next).toBe('c1');

    // Advance turn to c1
    advanceTurn(state);
    expect(state.initiatives[state.currentTurnIndex].id).toBe('c1');
  });
});
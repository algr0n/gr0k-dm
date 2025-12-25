import { describe, test, expect } from 'vitest';
import { extractTokensFromEncounter } from '../shared/ui-utils';

describe('UI helpers', () => {
  test('extractTokensFromEncounter returns tokens and features arrays', () => {
    const encounter = {
      spawns: [ { id: 's1', monsterName: 'Goblin', positionX: 3, positionY: 4, metadata: { hp: 6 } } ],
      features: [ { id: 'f1', type: 'cover', positionX: 5, positionY: 5, radius: 2, properties: { coverBonus: 2 } } ]
    };

    const { tokens, features } = extractTokensFromEncounter(encounter);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({ id: 's1', x: 3, y: 4, metadata: { hp: 6 } });
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ id: 'f1', type: 'cover', x: 5, y: 5, radius: 2 });
  });
});

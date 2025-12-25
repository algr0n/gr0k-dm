import { describe, it, expect } from 'vitest';
import { parseHitDiceString } from '../shared/race-class-bonuses';

describe('parseHitDiceString', () => {
  it('parses explicit hit dice string', () => {
    const res = parseHitDiceString('3d10', 3, 'Fighter');
    expect(res.length).toBe(1);
    expect(res[0].diceType).toBe('d10');
    expect(res[0].max).toBe(3);
    expect(res[0].current).toBe(3);
  });

  it('derives from class and level when missing', () => {
    const res = parseHitDiceString(null, 4, 'Wizard');
    expect(res.length).toBe(1);
    expect(res[0].diceType).toMatch(/^d\d+$/); // ensure we return a dice type string
    expect(res[0].max).toBe(4);
  });
});
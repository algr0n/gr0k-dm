import { describe, test, expect } from 'vitest'
import { parseNaturalLanguageToAction } from '../client/src/lib/nl-parser'

describe('NL parser heuristics', () => {
  test('parses pass', () => {
    const p = parseNaturalLanguageToAction('I will wait.', 'p1')
    expect(p).toBeDefined()
    expect(p?.type).toBe('pass')
  })

  test('parses move with coords', () => {
    const p = parseNaturalLanguageToAction('I move to 4,5', 'p1')
    expect(p).toBeDefined()
    expect(p?.type).toBe('move')
    expect(p?.to).toEqual({ x: 4, y: 5 })
  })

  test('parses loot a chest', () => {
    const p = parseNaturalLanguageToAction('I loot the chest', 'p1')
    expect(p).toBeDefined()
    expect(p?.type).toBe('loot')
    expect(p?.targetName).toBe('chest')
  })

  test('parses attack', () => {
    const p = parseNaturalLanguageToAction('I attack the goblin', 'p1')
    expect(p).toBeDefined()
    expect(p?.type).toBe('attack')
    expect(p?.targetName).toBe('goblin')
  })
})

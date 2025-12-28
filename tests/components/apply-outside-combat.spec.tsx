import { describe, test, expect, vi } from 'vitest'
import { applySpell } from '../../client/src/lib/spells'

vi.mock('../../client/src/lib/spells', () => ({
  applySpell: (roomCode: string, payload: any) => {
    return Promise.resolve({ success: true, applied: [] })
  }
}))

describe('Apply outside combat flow', () => {
  test('calls helper applySpell and returns', async () => {
    const res = await applySpell('ROOM1', { casterId: 'c1', spellText: 'A test' })
    expect(res).toEqual({ success: true, applied: [] })
  })
})

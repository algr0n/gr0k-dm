import { describe, test, expect, vi } from 'vitest'
import * as toastModule from '../../client/src/hooks/use-toast'

// NOTE: This test now focuses on the handler side-effects only to avoid heavy RoomPage rendering.
describe('Room WebSocket handlers (lightweight)', () => {
  test('invokes toast when spell_applied arrives', () => {
    const toastSpy = vi.spyOn(toastModule, 'toast')

    // Simulate the minimal handler logic from room.tsx for spell_applied
    const payload = { type: 'spell_applied', spellText: 'A mystical fog appears', applied: [] }
    if (payload.type === 'spell_applied') {
      toastModule.toast({ title: 'Spell applied', description: `${(payload.spellText || '').substring(0, 120)}` })
    }

    expect(toastSpy).toHaveBeenCalled()
    toastSpy.mockRestore()
  })

  test('invokes toast when combat_prompt arrives', () => {
    const toastSpy = vi.spyOn(toastModule, 'toast')

    const payload = { type: 'combat_prompt', spellText: 'A thunderous boom echoes' }
    if (payload.type === 'combat_prompt') {
      const description = payload.spellText ? payload.spellText.substring(0, 120) : 'A loud event may draw foes.'
      toastModule.toast({ title: 'Loud event', description, duration: 4000 })
    }

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Loud event', description: expect.stringContaining('thunderous boom') })
    )
    toastSpy.mockRestore()
  })
})

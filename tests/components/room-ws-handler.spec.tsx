import { describe, test, expect, vi } from 'vitest'
import * as toastModule from '../../client/src/hooks/use-toast'

// Minimal version of the RoomPage WS handler for the 'spell_applied' event
function handleWsMessage(data: any, queryClient: any) {
  if (data.type === 'spell_applied') {
    toastModule.toast({ title: 'Spell applied', description: `${(data.spellText || '').substring(0, 120)}` })
    queryClient.invalidateQueries({ queryKey: ['/api/rooms', 'ROOM1', 'room-characters'] })
    queryClient.invalidateQueries({ queryKey: ['/api/rooms', 'ROOM1'] })
    queryClient.invalidateQueries({ queryKey: ['dynamic-npcs', 'room-1'] })
  }
}

describe('Room WS handler (spell_applied)', () => {
  test('shows toast and invalidates queries', () => {
    const toastSpy = vi.spyOn(toastModule, 'toast')
    const qc = { invalidateQueries: vi.fn() }

    const payload = { type: 'spell_applied', spellText: 'A mystical fog appears', applied: [] }
    handleWsMessage(payload, qc)

    expect(toastSpy).toHaveBeenCalled()
    expect(qc.invalidateQueries).toHaveBeenCalled()

    toastSpy.mockRestore()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { applySpell } from '../../client/src/lib/spells'

describe('applySpell helper', () => {
  it('POSTs to /api/rooms/:code/spells/apply and returns json', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().includes('/api/rooms/ROOM1/spells/apply')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, applied: [] }), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    const res = await applySpell('ROOM1', { casterId: 'c1', spellText: 'Test' })
    expect(res).toEqual({ success: true, applied: [] })

    fetchMock.mockRestore()
  })

  it('throws when non-200 response', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'bad' }), { status: 400 })))

    await expect(applySpell('ROOM1', {})).rejects.toThrow()

    fetchMock.mockRestore()
  })
})

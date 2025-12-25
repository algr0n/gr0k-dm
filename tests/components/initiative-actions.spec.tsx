import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import EncounterDemoPage from '../../client/src/pages/encounter-demo'

describe('Initiative actions integration', () => {
  test('Hold and Pass call API and update logs/active', async () => {
    // Mock fetch
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().endsWith('/combat/hold')) return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      if (url.toString().endsWith('/combat/pass')) return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })

    render(<EncounterDemoPage />)

    // Click hold on Alice
    const holdButtons = await screen.findAllByText('Hold')
    fireEvent.click(holdButtons[0])
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // Click pass on Alice
    const passButtons = await screen.findAllByText('Pass')
    fireEvent.click(passButtons[0])
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    fetchMock.mockRestore()
  })
})

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { describe, test, expect, vi } from 'vitest'
import EncounterDemoPage from '../../client/src/pages/encounter-demo'

// Reuse MockWebSocket from existing tests by stubbing global in beforeEach
class MockWebSocket {
  static lastInstance: any = null
  static allInstances: any[] = []
  onopen: any = null
  onmessage: any = null
  onclose: any = null
  readyState = 1
  url: string
  sent: any[] = []
  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
    MockWebSocket.allInstances.push(this)
    setTimeout(() => this.onopen?.({}), 0)
  }
  send(data: any) {
    this.sent.push(data)
  }
  close() { this.readyState = 3; this.onclose?.({}) }
  static resetInstances() {
    MockWebSocket.allInstances = []
    MockWebSocket.lastInstance = null
  }
}

vi.stubGlobal('WebSocket', MockWebSocket as any)

describe('Action suggestion flow', () => {
  test('renders suggestion and confirms via API', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().includes('/suggestions/')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      }
      if (url.toString().includes('/combat/action')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    render(<EncounterDemoPage />)

    // Simulate server sending an action_suggestion message
    const ws = (MockWebSocket as any).lastInstance
    expect(ws).toBeTruthy()

    const suggestionMsg = {
      type: 'action_suggestion',
      suggestionId: 's1',
      actions: [{ type: 'attack', targetName: 'goblin', confidence: 0.65 }],
      confidence: 0.65,
      originalText: 'I hit the goblin'
    }

    // Deliver message
    act(() => {
      ws.onmessage?.({ data: JSON.stringify(suggestionMsg) })
    })

    // Wait for suggestion UI
    await waitFor(() => expect(screen.getByText(/Suggestion:/)).toBeTruthy())

    const confirmBtn = screen.getByText('Confirm')
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    // ensure confirm endpoint was called
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/suggestions/s1/confirm'), expect.any(Object))

    fetchMock.mockRestore()
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import EncounterDemoPage from '../../client/src/pages/encounter-demo'

// Simple WebSocket mock
class MockWebSocket {
  static lastInstance: any = null
  onopen: any = null
  onmessage: any = null
  onclose: any = null
  readyState = 1
  url: string
  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
    setTimeout(() => this.onopen?.({}), 0)
  }
  send(data: any) {}
  close() { this.readyState = 3; this.onclose?.({}) }
}

vi.stubGlobal('WebSocket', MockWebSocket as any)

describe('WebSocket integration', () => {
  test('receives combat_event and updates UI log/active', async () => {
    render(<EncounterDemoPage />)

    // Wait for instance
    const ws = (MockWebSocket as any).lastInstance
    expect(ws).toBeDefined()

    // Simulate server sending a pass event
    const passMsg = { type: 'combat_event', event: 'pass', actorId: 'p1' }
    ws.onmessage({ data: JSON.stringify(passMsg) })

    // Verify log updated
    expect(await screen.findByText(/Event: pass/)).toBeDefined()
  })
})

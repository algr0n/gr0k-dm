import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import EncounterDemoPage from '../../client/src/pages/encounter-demo'

// Mock WebSocket to capture sends
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

describe('Chat NL->Action behavior', () => {
  test('simple chat "I loot the chest" triggers action REST POST', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().includes('/combat/action')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    render(<EncounterDemoPage />)

    const input = await screen.findByPlaceholderText('Say something to the DM or type an action...')
    const sendButton = await screen.findByText('Send')

    fireEvent.change(input, { target: { value: 'I loot the chest' } })
    fireEvent.click(sendButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    // ensure WebSocket was not used for sending the action (chat would be sent on failure to parse)
    expect((MockWebSocket as any).lastInstance.sent.length).toBe(0)

    fetchMock.mockRestore()
  })

  test('ambiguous chat goes to WebSocket chat (no REST)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => Promise.resolve(new Response('{}', { status: 200 })))

    ;(MockWebSocket as any).resetInstances()
    render(<EncounterDemoPage />)

    const input = await screen.findByPlaceholderText('Say something to the DM or type an action...')
    const sendButton = await screen.findByText('Send')

    fireEvent.change(input, { target: { value: 'Tell me about the cave' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      const allInstances = (MockWebSocket as any).allInstances
      const totalSent = allInstances.reduce((sum: number, inst: any) => sum + inst.sent.length, 0)
      return expect(totalSent).toBeGreaterThanOrEqual(1)
    }, { timeout: 2000 })

    fetchMock.mockRestore()
  })
})

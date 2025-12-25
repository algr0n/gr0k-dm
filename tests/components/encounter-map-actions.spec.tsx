import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import EncounterDemoPage from '../../client/src/pages/encounter-demo'

beforeEach(() => {
  // ensure fetch spies don't leak
})

describe('Encounter interactions', () => {
  test('dragging a token issues a move action and shows optimistic update', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().includes('/combat/action')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    render(<EncounterDemoPage />)

    const svg = await screen.findByRole('img', { name: /Encounter map/i })
    // mock bounding rect to translate client coords -> grid
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 320 } as any)

    // find Alice token circle
    const aliceTexts = await screen.findAllByText('Alice')
    const aliceText = aliceTexts.find(n => !!n.closest('svg'))!
    const g = aliceText.closest('g')!
    const circle = g!.querySelector('circle')!

    // starting position is Alice at x=3,y=4 in sample (grid 40 -> px 120,160). We'll drag to 3,2 (px 120,80)
    fireEvent.mouseDown(circle, { clientX: 120, clientY: 160 })
    fireEvent.mouseMove(svg, { clientX: 120, clientY: 80 })
    fireEvent.mouseUp(svg, { clientX: 120, clientY: 80 })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // optimistic log entry should be present
    expect(await screen.findByText(/moves to/)).toBeDefined()

    fetchMock.mockRestore()
  })

  test('clicking one token then another triggers attack action', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().includes('/combat/action')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    render(<EncounterDemoPage />)

    const aliceTexts = await screen.findAllByText('Alice')
    const aliceText = aliceTexts.find(n => !!n.closest('svg'))!
    const gAlice = aliceText.closest('g')!
    const circleAlice = gAlice!.querySelector('circle')!

    const gobTexts = await screen.findAllByText('Goblin')
    const gobText = gobTexts.find(n => !!n.closest('svg'))!
    const gGob = gobText.closest('g')!
    const circleGob = gGob!.querySelector('circle')!

    // click Alice to select as actor, then click Goblin to attack
    fireEvent.click(circleAlice)
    fireEvent.click(circleGob)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // optimistic attack log entry
    expect(await screen.findByText(/attacks/)).toBeDefined()

    fetchMock.mockRestore()
  })

  test('move -> server broadcast reconciles token position', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any, opts: any) => {
      if (url.toString().includes('/combat/action')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    render(<EncounterDemoPage />)

    const svg = await screen.findByRole('img', { name: /Encounter map/i })
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 320 } as any)

    const aliceTexts = await screen.findAllByText('Alice')
    const aliceText = aliceTexts.find(n => !!n.closest('svg'))!
    const g = aliceText.closest('g')!
    const circle = g!.querySelector('circle')!

    // drag to 3,2
    fireEvent.mouseDown(circle, { clientX: 120, clientY: 160 })
    fireEvent.mouseMove(svg, { clientX: 120, clientY: 80 })
    fireEvent.mouseUp(svg, { clientX: 120, clientY: 80 })

    // optimistic log
    expect(await screen.findByText(/moves to/)).toBeDefined()

    // simulate server broadcast moving actor p1 to 10,2
    const gw: any = (WebSocket as any)
    // wait for an instance to be created for the demo-room
    await waitFor(() => {
      const arr = (window as any).__TEST_WEBSOCKETS || []
      expect(arr.length).toBeGreaterThan(0)
    }, { timeout: 2000 })
    const inst = (window as any).__TEST_WEBSOCKETS[(window as any).__TEST_WEBSOCKETS.length - 1]
    // send a combat_event move
    inst.onmessage({ data: JSON.stringify({ type: 'combat_event', event: 'move', actorId: 'p1', to: { x: 10, y: 2 } }) })

    // now the SVG group transform for p1 should contain translate(400,80)
    const movedAliceTexts = await screen.findAllByText('Alice')
    const movedAliceText = movedAliceTexts.find(n => !!n.closest('svg'))!
    const movedG = movedAliceText.closest('g')!
    expect(movedG!.getAttribute('transform')).toContain('translate(400, 80)')

    fetchMock.mockRestore()
  })
})
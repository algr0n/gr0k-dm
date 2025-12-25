import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import InitiativeTracker from '../../client/src/components/initiative-tracker'

describe('InitiativeTracker', () => {
  test('renders initiative list and highlights active', () => {
    const items = [ { id: 'p1', name: 'A', controller: 'player', initiative: 18, currentHp: 10, maxHp: 10 }, { id: 'm1', name: 'Gob', controller: 'monster', initiative: 12, currentHp: 7, maxHp: 7 } ]
    render(<InitiativeTracker items={items as any} activeId={'p1'} />)

    expect(screen.getByText('18')).toBeDefined()
    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('7/7')).toBeDefined()
  })
})

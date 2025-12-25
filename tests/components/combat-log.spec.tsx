import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import CombatLog from '../../client/src/components/combat-log'

describe('CombatLog', () => {
  test('renders entries', () => {
    const entries = [ { id: 'e1', text: 'Alice hits Goblin for 5', timestamp: 1600000000000 } ]
    render(<CombatLog entries={entries} />)

    expect(screen.getByText(/Alice hits Goblin/)).toBeDefined()
  })
})

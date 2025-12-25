import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import EncounterMap from '../../client/src/components/encounter-map'

describe('EncounterMap', () => {
  test('renders tokens and features', () => {
    const encounter = {
      mapMeta: { width: 8, height: 6, gridSize: 20 },
      tokens: [ { id: 't1', x: 1, y: 1, metadata: { name: 'A' } } ],
      features: [ { id: 'f1', type: 'cover', x: 2, y: 2, radius: 1 } ]
    }

    render(<EncounterMap encounter={encounter as any} />)

    // svg present
    expect(screen.getByRole('img', { name: /Encounter map/i })).toBeDefined()
    // token text
    expect(screen.getByText('A')).toBeDefined()
    // feature text
    expect(screen.getByText('cover')).toBeDefined()
  })
})

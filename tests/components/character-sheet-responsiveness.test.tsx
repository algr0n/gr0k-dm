import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
(globalThis as any).React = React;

// Mock the layout hook used by CharacterSheet integration tests
vi.mock('@/hooks/useLayoutBreakpoint', () => ({
  useLayoutBreakpoint: vi.fn(),
}));

import { useLayoutBreakpoint } from '@/hooks/useLayoutBreakpoint';
import { SkillsAccordion } from '../../client/src/components/character-sheet/SkillsAccordion';
import { InventoryAccordion } from '../../client/src/components/character-sheet/InventoryAccordion';
import { SpellsAccordion } from '../../client/src/components/character-sheet/SpellsAccordion';
import { CharacterSheet } from '../../client/src/components/character-sheet';
import { TooltipProvider } from '../../client/src/components/ui/tooltip';

const mockedUseLayoutBreakpoint = useLayoutBreakpoint as unknown as vi.Mock;

describe('Responsive Character Sheet components', () => {
  beforeEach(() => {
    mockedUseLayoutBreakpoint.mockReset();
  });

  test('SkillsAccordion is auto-expanded on desktop and shows SkillsList', () => {
    render(
      <TooltipProvider>
        <SkillsAccordion
          skills={[{ name: 'Stealth', ability: 'dexterity', bonus: 3, isProficient: true, hasExpertise: false, sources: [] }]}
          proficiencyBonus={2}
          breakpoint={'desktop'}
        />
      </TooltipProvider>
    );

    expect(screen.getByTestId('skills-list')).toBeInTheDocument();
  });

  test('SkillsAccordion is collapsed on mobile and toggles open on click', () => {
    render(
      <TooltipProvider>
        <SkillsAccordion
          skills={[{ name: 'Perception', ability: 'wisdom', bonus: 1, isProficient: false, hasExpertise: false, sources: [] }]}
          proficiencyBonus={2}
          breakpoint={'mobile'}
        />
      </TooltipProvider>
    );

    // Button should be present and not expanded by default
    const button = screen.getByRole('button', { name: /Skills/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('skills-list')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('skills-list')).toBeInTheDocument();
  });

  test('InventoryAccordion respects defaultOpen and updates on prop change', async () => {
    const inventory = [
      { id: 'item1', quantity: 1, item: { name: 'Dagger', properties: null }, equipped: false },
    ];

    const { rerender } = render(<InventoryAccordion inventory={inventory} defaultOpen={true} />);

    const button = screen.getByRole('button', { name: /Inventory/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('inventory-item-item1')).toBeInTheDocument();

    // Now collapse by changing prop
    rerender(<InventoryAccordion inventory={inventory} defaultOpen={false} />);
    const buttonAfter = screen.getByRole('button', { name: /Inventory/i });
    expect(buttonAfter).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('inventory-item-item1')).not.toBeInTheDocument();
  });

  test('SpellsAccordion respects defaultOpen and shows spells when open', () => {
    const spells = ['Magic Missile'];

    const { rerender } = render(<SpellsAccordion spells={spells} defaultOpen={true} />);

    const button = screen.getByRole('button', { name: /Spells/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('spell-0')).toBeInTheDocument();

    rerender(<SpellsAccordion spells={spells} defaultOpen={false} />);
    expect(screen.getByRole('button', { name: /Spells/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('spell-0')).not.toBeInTheDocument();
  });

  test('CharacterSheet integration: accordions follow breakpoint from hook', () => {
    // Desktop: all sections expanded
    mockedUseLayoutBreakpoint.mockReturnValue('desktop');

    const character = {
      characterName: 'Test Hero',
      race: 'Human',
      class: 'Fighter',
      level: 3,
      stats: { strength: 14, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 8 },
      skills: ['Stealth'],
      spells: ['Magic Missile'],
      hitDice: '1d10',
      currentHp: 10,
      maxHp: 12,
      ac: 15,
      speed: 30,
      initiativeModifier: 1,
      xp: 200,
      notes: 'A brave tester',
    } as any;

    const inventory = [
      { id: 'item1', quantity: 1, item: { name: 'Dagger', properties: null }, equipped: false },
    ] as any;

    const { rerender } = render(
      <TooltipProvider>
        <CharacterSheet character={character} inventory={inventory} open={true} onOpenChange={() => {}} />
      </TooltipProvider>
    );

    // Desktop should render SkillsList directly
    expect(screen.getByTestId('skills-list')).toBeInTheDocument();
    // Spells and Inventory should be open (defaultOpen true)
    expect(screen.getByTestId('spell-0')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-item-item1')).toBeInTheDocument();

    // Now simulate mobile
    mockedUseLayoutBreakpoint.mockReturnValue('mobile');
    rerender(<CharacterSheet character={character} inventory={inventory} open={true} onOpenChange={() => {}} />);

    // SkillsList should not be rendered by default on mobile
    expect(screen.queryByTestId('skills-list')).not.toBeInTheDocument();
    // Spells and Inventory should be collapsed by default
    expect(screen.queryByTestId('spell-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inventory-item-item1')).not.toBeInTheDocument();
  });
});

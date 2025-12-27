# Responsive Character Sheet Layout

This document explains the responsive character sheet implementation and how to test it at different breakpoints.

## Overview

The character sheet now uses a responsive CSS Grid layout that adapts to three device categories:

- **Mobile** (<768px): Single-column stacked layout
- **Tablet** (768-1023px): Two-column layout with sticky sidebar
- **Desktop** (≥1024px): Three-column layout with sticky left sidebar

## Layout Structure

### Desktop (≥1024px)
```
┌─────────────┬──────────────────┬─────────────┐
│  Left Col   │     Header       │  Right Col  │
│  (sticky)   ├──────────────────┤             │
│             │   Center Col     │             │
│  260px      │   fluid (min     │   360px     │
│             │   480px)         │             │
└─────────────┴──────────────────┴─────────────┘
```

**Left Column (Sticky):**
- Portrait Card
- Core Stats (AC, Speed, Initiative, Currency)
- Resources (Hit Dice, Death Saves)

**Center Column:**
- Header (Character Name, Race, Class, Level)
- HP Bar
- XP/Level Progress
- Ability Scores
- Notes

**Right Column:**
- Skills (2-column grid, auto-expanded)
- Spells (accordion, auto-expanded)
- Inventory (accordion, auto-expanded)

### Tablet (768-1023px)
```
┌─────────────┬──────────────────┐
│  Left Col   │     Header       │
│  (sticky)   ├──────────────────┤
│             │   Center Col     │
│  280px      │   fluid          │
│             │                  │
├─────────────┴──────────────────┤
│       Right Col (full width)   │
└────────────────────────────────┘
```

- Left sidebar is sticky (280px)
- Skills/Inventory/Spells are collapsed by default (accordions)
- Right column spans full width below the main content

### Mobile (<768px)
```
┌────────────────────────────────┐
│          Header                │
├────────────────────────────────┤
│         Left Col               │
├────────────────────────────────┤
│        Center Col              │
├────────────────────────────────┤
│        Right Col               │
└────────────────────────────────┘
```

- Single-column stacked layout
- All sections scroll vertically
- No sticky positioning
- Skills/Inventory/Spells are collapsed (accordions)

## Key Features

### Responsive Breakpoint Detection
The `useLayoutBreakpoint` hook uses `matchMedia` to efficiently detect the current viewport size:

```typescript
import { useLayoutBreakpoint } from '@/hooks/useLayoutBreakpoint';

function MyComponent() {
  const breakpoint = useLayoutBreakpoint(); // 'mobile' | 'tablet' | 'desktop'
  // Use breakpoint to adjust component behavior
}
```

### Automatic Accordion Behavior
- **Desktop**: Skills, Spells, and Inventory sections are auto-expanded
- **Tablet/Mobile**: Sections are collapsed by default to save space

### Accessibility Features
- All accordions use `aria-expanded` attributes
- Keyboard navigation fully supported
- Focus states visible on all interactive elements
- Sticky sidebar remains keyboard-accessible

## Testing the Layout

### Manual Testing

1. **Desktop View (≥1024px)**
   - Open the character sheet dialog
   - Verify three-column layout
   - Scroll the center/right content
   - Verify left column stays sticky at top

2. **Tablet View (768-1023px)**
   - Resize browser to ~900px width
   - Verify two-column layout
   - Check that right column appears below
   - Verify accordions are collapsed by default

3. **Mobile View (<768px)**
   - Resize browser to ~375px width
   - Verify single-column stacked layout
   - Check all sections are vertically stacked
   - Verify accordions work correctly

### Automated Testing

Run the layout breakpoint hook test:
```bash
npm test -- tests/hooks/useLayoutBreakpoint.test.ts
```

Run the new component responsiveness tests (covers Skills/Inventory/Spells accordions and CharacterSheet breakpoint-driven behavior):
```bash
npm test -- tests/components/character-sheet-responsiveness.test.tsx
```

These tests verify:
- `SkillsAccordion` auto-expands on `desktop` and is collapsed by default on `mobile` (and toggles open on user click)
- `InventoryAccordion` and `SpellsAccordion` respect the `defaultOpen` prop and update when it changes
- `CharacterSheet` integration: accordions receive breakpoint from `useLayoutBreakpoint` and the UI shows/hides sections accordingly

### Browser DevTools Testing

1. Open Chrome/Firefox DevTools
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select different device presets:
   - iPhone SE (375px) - Mobile
   - iPad (768px) - Tablet
   - Desktop (1440px) - Desktop

## Files Modified/Created

### New Components
- `client/src/hooks/useLayoutBreakpoint.ts` - Breakpoint detection hook
- `client/src/components/character-sheet/CharacterSheet.module.css` - Responsive CSS
- `client/src/components/character-sheet/HPBar.tsx` - HP progress bar
- `client/src/components/character-sheet/XPLevelCard.tsx` - XP/Level progress
- `client/src/components/character-sheet/CoreStatsCard.tsx` - AC, Speed, Initiative, Currency
- `client/src/components/character-sheet/PortraitCard.tsx` - Character portrait
- `client/src/components/character-sheet/SkillsAccordion.tsx` - Skills with responsive accordion
- `client/src/components/character-sheet/InventoryAccordion.tsx` - Inventory accordion
- `client/src/components/character-sheet/SpellsAccordion.tsx` - Spells accordion

### Modified Components
- `client/src/components/character-sheet.tsx` - Main character sheet with responsive grid

### Tests
- `tests/hooks/useLayoutBreakpoint.test.ts` - Hook tests

## CSS Variables & Theming

The layout uses existing CSS custom properties from the design system:

- Colors: `--card`, `--border`, `--primary`, `--muted`, etc.
- Spacing: Tailwind spacing scale (1rem = 16px)
- Border radius: `--radius`
- Fonts: `--font-serif`, `--font-sans`, `--font-mono`

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid support required
- `matchMedia` API required for breakpoint detection
- Tested on Chrome 120+, Firefox 121+, Safari 17+

## Future Improvements

- Add animation transitions when switching layouts
- Implement drag-and-drop for inventory items
- Add print-friendly stylesheet
- Consider saving user's accordion preferences to localStorage

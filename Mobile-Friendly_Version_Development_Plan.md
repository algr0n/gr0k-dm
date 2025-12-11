# Mobile-Friendly Version Development Plan

## Overview

This document outlines the strategy for developing a mobile-friendly version of Grok DM in parallel on GitHub. The current application is responsive to some degree but optimized primarily for desktop use. The goal is to deliver a true **mobile-first** experience without disrupting the existing `main` branch or current users.

**Approach**: Perform a comprehensive mobile-first responsive redesign in a dedicated GitHub branch, then merge back to `main` when complete.

**Key Benefits**:
- Zero risk to production
- Dramatically improved mobile experience
- Cleaner, more maintainable codebase
- Future-proof for tablets and varying screen sizes
- Aligns with the "Mobile Optimization" improvement opportunity listed in the original design document

**Target Outcome**: A single codebase that delivers an excellent experience on both mobile and desktop (progressive enhancement).

## GitHub Parallel Development Strategy

1. **Create a dedicated feature branch**
   ```bash
   git checkout main
   git pull
   git checkout -b feature/mobile-first-redesign
   ```
   All mobile work will live here until ready for merge.

2. **Branch protection & workflow**
   - Require pull request reviews before merging to `main`
   - Use GitHub Issues or Projects to track mobile-specific tasks
   - Regularly rebase or merge from `main` to stay up-to-date

## Core Principles: Mobile-First Design

- **Default styles** = mobile-optimized (single column, stacked layout)
- Use Tailwind's `md:`, `lg:`, etc., only for desktop enhancements
- Prioritize touch-friendly interactions (min 44px tap targets)
- Embrace bottom sheets, drawers, and modals over floating/draggable panels

## High-Impact Changes

### 1. Room Page Layout (`client/src/pages/room.tsx`)

**Current Issue**: Multi-panel desktop layout with floating elements  
**Mobile Solution**: Single-column view with tabbed/drawer navigation

**Proposed Mobile Layout**:
- Bottom-fixed chat input bar (like messaging apps)
- Floating Action Button (FAB) or bottom tab bar for quick access to:
  - Character Sheet
  - Combat Tracker
  - Inventory / Spells
  - Party Overview
  - DM Controls (for host)
- Main view defaults to Chat / Activity Feed
- Swipe gestures where appropriate

### 2. Replace Floating Panels with Bottom Sheets/Drawers

| Current Component               | Mobile Replacement                  | Component Library Support |
|---------------------------------|-------------------------------------|---------------------------|
| `FloatingCharacterPanel`        | Bottom Sheet / Drawer               | shadcn/ui Sheet           |
| `DMControlsPanel`               | Collapsible bottom drawer           | shadcn/ui Sheet           |
| Spell Browser / Inventory       | Full-screen modal or drawer         | shadcn/ui Dialog or Sheet |
| Initiative Tracker              | Collapsible drawer or dedicated tab | Custom list in Sheet      |

### 3. Responsive Detection Hook

Create a reusable hook:
```ts
// client/src/hooks/use-mobile.ts
import { useMediaQuery } from '@react-hook/media-query'

export const useMobile = () => useMediaQuery('(max-width: 768px)')
export const useTablet = () => useMediaQuery('(max-width: 1024px)')
```

Use in components:
```tsx
const isMobile = useMobile()
return isMobile ? <MobileCharacterSheet /> : <DesktopCharacterPanel />
```

### 4. Key Components to Refactor (Priority Order)

| Priority | Component                        | Changes Needed                              | Estimated Effort |
|----------|----------------------------------|---------------------------------------------|------------------|
| High     | Room page layout                 | Full restructure to tabs/drawers            | 4-6 days         |
| High     | FloatingCharacterPanel           | Convert to bottom sheet drawer              | 3-4 days         |
| High     | Chat input & message list        | Bottom-fixed bar, better touch targets      | 1-2 days         |
| Medium   | DMControlsPanel                  | Mobile-friendly drawer                      | 2-3 days         |
| Medium   | Dice roller                      | Large touch-friendly modal                  | 2-3 days         |
| Medium   | Combat/Initiative tracker        | Collapsible list or drawer                  | 2-3 days         |
| Medium   | SpellBrowser / Inventory         | Modal/drawer with search                    | 2-3 days         |
| Low      | Dashboard & Character Creation   | Stack forms vertically, larger inputs       | 2-4 days         |

### 5. Progressive Web App (PWA) Enhancement

- Add `manifest.json`
- Register service worker
- Enable "Add to Home Screen"
- Provides app-like feel on mobile devices

## Testing Strategy

- Chrome DevTools device toolbar for initial testing
- Real device testing (iOS Safari + Android Chrome)
- Focus on:
  - Touch target sizes
  - Keyboard avoidance (chat input)
  - Swipe gestures
  - WebSocket reconnection on network changes
  - Performance on mid-range devices

## Merge Strategy

1. When mobile experience is production-quality:
   - Open PR from `feature/mobile-first-redesign` → `main`
2. Review changes thoroughly (desktop experience should be preserved or improved)
3. Merge and deploy
4. Monitor user feedback post-launch

## Estimated Timeline (Solo Developer)

| Week | Focus                                      |
|------|--------------------------------------------|
| 1    | Core layout, bottom sheets, chat input     |
| 2    | Character sheet drawer, combat tracker     |
| 3    | DM tools, dice roller, inventory/spells    |
| 4    | Polish, PWA setup, real-device testing     |

Total: ~4 weeks for a solid mobile experience

## Conclusion

The current stack (React + Tailwind + shadcn/ui) is ideally suited for this transformation. A mobile-first responsive redesign in a parallel branch is the safest, most effective path forward. This approach will significantly improve accessibility for mobile users while maintaining (and potentially enhancing) the desktop experience.

Start with the branch and tackle the Room page layout first — the impact will be immediate and motivating.

**Branch Name**: `feature/mobile-first-redesign`  
**Start Date**: As soon as ready  
**Target Merge**: When mobile experience meets or exceeds desktop quality

This plan positions Grok DM as a truly cross-platform TTRPG experience.

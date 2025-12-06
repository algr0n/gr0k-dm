# Design Guidelines: Discord TTRPG Bot with Grok AI

## Design Approach

**System**: Material Design with fantasy/gaming aesthetic overlay
**Rationale**: Utility-focused application requiring clear information hierarchy for game state management, character stats, and storytelling elements. Material Design provides the structured foundation while custom theming adds TTRPG atmosphere.

## Core Design Elements

### Typography
- **Primary Font**: Cinzel (Google Fonts) - fantasy-themed serif for headers and titles
- **Body Font**: Inter (Google Fonts) - clean, readable sans-serif for content
- **Monospace**: JetBrains Mono - for code snippets, dice rolls, stats

**Hierarchy**:
- Page Titles: Cinzel, 3xl/4xl, font-bold
- Section Headers: Cinzel, 2xl, font-semibold
- Body Text: Inter, base/lg, font-normal
- Stats/Numbers: JetBrains Mono, sm/base, font-medium

### Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-8
- Section spacing: py-12 to py-16
- Card gaps: gap-4 to gap-6
- Container max-width: max-w-7xl

**Grid Patterns**:
- Dashboard: 3-column grid (lg:grid-cols-3) for stats/campaigns/characters
- Character sheets: 2-column (lg:grid-cols-2) for attributes and inventory
- Mobile: Always stack to single column

### Component Library

#### Navigation
- **Top Bar**: Fixed position with bot status indicator, campaign selector, settings
- **Sidebar** (desktop): Campaign list, character quick-access, dice roller shortcut
- **Mobile Nav**: Bottom tab bar with Dashboard, Characters, Campaigns, Settings

#### Dashboard Cards
- **Campaign Overview**: Title, player count, session tracker, quick actions
- **Active Character**: Portrait placeholder, key stats (HP, AC, Level), quick dice roll
- **Recent Activity**: Timeline of bot interactions, story moments, dice rolls
- **Quick Actions**: Start session, create character, roll dice buttons

#### Character Sheet Components
- **Header**: Character name (Cinzel, large), race/class/level
- **Stat Block**: Grid of attribute scores in bordered containers
- **Health Bar**: Progress bar visualization with current/max HP
- **Inventory**: Expandable list with item icons and descriptions
- **Skills & Abilities**: Accordion sections with proficiency indicators

#### Dice Roller
- **Visual Display**: Large 3D-style dice icon representations
- **Roll History**: Scrollable log with timestamp, character, result
- **Quick Rolls**: Preset buttons (d20, d12, d6, etc.) with modifiers

#### Story/Chat Interface
- **Message Cards**: Discord-style chat bubbles
- **DM Messages**: Distinct styling with fantasy border treatment
- **Player Actions**: Highlighted with action indicators
- **Narrative Blocks**: Italicized story text in slightly larger font

#### Forms & Inputs
- **Character Creator**: Multi-step wizard with progress indicator
- **Input Fields**: Material Design outlined style with floating labels
- **Dropdown Menus**: Fantasy-themed select boxes with custom arrows
- **Toggle Switches**: For campaign settings and bot configuration

#### Data Displays
- **Campaign Table**: Sortable list with session count, players, last active
- **Character Grid**: Card layout with portrait, name, level
- **Stat Comparisons**: Side-by-side tables for character comparison

#### Overlays & Modals
- **Character Sheet Modal**: Full-screen overlay with close button
- **Dice Roll Animation**: Brief modal showing dice roll with result
- **Confirmation Dialogs**: Standard Material Design alerts
- **Settings Panel**: Slide-out drawer from right edge

### Animations

Use sparingly:
- Dice roll: Brief shake/rotate animation on result display
- Navigation transitions: Simple fade-in for content changes
- Loading states: Subtle spinner for API calls
- No scroll-triggered animations

## Page-Specific Layouts

### Dashboard (Landing After Login)
- Hero section: Campaign banner with background gradient, session counter, start session CTA
- 3-column grid: Active campaigns, favorite characters, recent rolls
- Activity feed: Bottom section with scrollable history

### Character Management
- Header: Create character button (primary CTA)
- Grid view: 2-3 columns of character cards with filter/sort
- Character detail: Modal overlay with full sheet

### Campaign Setup
- Form layout: Single column with clear sections
- Bot configuration: API settings, personality controls, storytelling preferences
- Discord channel selector: Integration status and channel permissions

### Game Session View (Optional Dashboard)
- Split layout: Story/chat on left (60%), character stats on right (40%)
- Sticky dice roller: Fixed bottom bar
- Collapsible sidebar: Full party overview

## Images

**Character Portraits**: Placeholder avatars (generated or user-uploaded), circular with border treatment
**Campaign Banners**: Fantasy-themed backgrounds (optional user upload), displayed in header areas with gradient overlay
**Dice Icons**: SVG representations for each die type (d4, d6, d8, d10, d12, d20)

No large hero images needed - this is a utility application focused on functionality over marketing visuals.

## Accessibility

- Consistent form input styling across all pages
- Clear focus states on interactive elements
- Sufficient contrast ratios for text readability
- Keyboard navigation support for all actions
- Screen reader labels for icons and visual-only elements
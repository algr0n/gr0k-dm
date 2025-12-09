# Grok DM - Feature Roadmap

> **Strategic planning document** for prioritizing improvements and new features.

---

## Current Version: v1.0 (Foundation Release)

**Status**: Production-ready with comprehensive D&D 5e support

**Core Capabilities**:
- ✅ AI Dungeon Master (xAI Grok)
- ✅ Real-time multiplayer (WebSocket)
- ✅ Complete D&D 5e implementation
- ✅ Character creation & management
- ✅ Inventory & spell systems
- ✅ Combat with initiative tracking
- ✅ User authentication & profiles
- ✅ Item & spell compendiums

---

## Roadmap Overview

### Phase 1: Stability & Security (Q1 2026)
**Focus**: Production hardening, security, and technical debt  
**Duration**: 4-6 weeks  
**Effort**: 2-3 developers

### Phase 2: Mobile & UX (Q2 2026)
**Focus**: Mobile optimization and user experience improvements  
**Duration**: 6-8 weeks  
**Effort**: 2 developers + 1 designer

### Phase 3: Game Systems (Q2-Q3 2026)
**Focus**: Additional game systems and expanded content  
**Duration**: 8-12 weeks  
**Effort**: 2-3 developers

### Phase 4: Social & Multiplayer (Q3 2026)
**Focus**: Social features and enhanced multiplayer tools  
**Duration**: 6-8 weeks  
**Effort**: 2 developers

### Phase 5: Advanced Features (Q4 2026+)
**Focus**: Battle maps, voice, and premium features  
**Duration**: Ongoing  
**Effort**: Variable

---

## Phase 1: Stability & Security (Priority: CRITICAL)

### Objective
Ensure the application is production-ready with proper security, testing, and monitoring.

### Features

#### 1.1 Security Hardening (Week 1-2)
- [ ] **Password Security Audit** (4 hours)
  - Verify bcrypt implementation in `server/auth.ts`
  - Ensure salt rounds ≥ 10
  - Add password strength requirements
  
- [ ] **Rate Limiting** (8 hours)
  - Install `express-rate-limit`
  - Apply to API endpoints (100 req/15min per IP)
  - Apply to AI endpoints (10 req/min per user)
  - Apply to auth endpoints (5 req/5min per IP)
  
- [ ] **CSRF Protection** (4 hours)
  - Add `csurf` middleware
  - Update frontend to include CSRF tokens
  
- [ ] **Input Sanitization** (4 hours)
  - XSS protection for AI-generated content
  - Validate all file uploads
  - Sanitize markdown/HTML in messages

**Deliverable**: Security audit report + hardened endpoints

#### 1.2 Database Migration (Week 2-3) ✅ COMPLETED
- [x] **SQLite Type Migration** (16 hours)
  - Convert `pgTable` → `sqliteTable`
  - Convert `pgEnum` → text-based enums
  - Update all schema references
  - Test all queries
  - Generate new migration
  
- [x] **Migration Management** (8 hours)
  - Set up versioned migrations
  - Add rollback capability
  - Document migration process

**Deliverable**: Clean SQLite schema + migration scripts ✅ COMPLETED (Dec 9, 2025)

#### 1.3 Testing Infrastructure (Week 3-4)
- [ ] **Unit Tests** (24 hours)
  - Dice engine (100% coverage)
  - Game mechanics (stat calculations, spell slots)
  - Utility functions
  
- [ ] **Integration Tests** (16 hours)
  - API endpoints (rooms, characters, auth)
  - WebSocket messaging
  - AI response parsing
  
- [ ] **E2E Tests** (16 hours)
  - User registration → login → create character → host game
  - Join game → chat → roll dice → combat

**Tools**: Vitest, React Testing Library, Playwright  
**Deliverable**: 60%+ code coverage, CI pipeline

#### 1.4 Error Handling & Monitoring (Week 4-5)
- [ ] **Centralized Error Handler** (8 hours)
  - Global error middleware
  - Consistent error response format
  - Error logging
  
- [ ] **Structured Logging** (8 hours)
  - Replace `console.log` with Pino/Winston
  - Log levels (debug, info, warn, error)
  - Request ID tracking
  
- [ ] **Monitoring** (8 hours)
  - Sentry integration for error tracking
  - Performance monitoring
  - AI token usage alerts

**Deliverable**: Production-grade error handling + monitoring dashboard

#### 1.5 CI/CD Pipeline (Week 5-6)
- [ ] **GitHub Actions** (16 hours)
  - Automated testing on PR
  - Automated deployments to staging
  - Database migration automation
  - Bundle size monitoring
  
- [ ] **Deployment Scripts** (8 hours)
  - Production deployment checklist
  - Rollback procedures
  - Health check endpoints

**Deliverable**: Automated CI/CD pipeline

### Success Metrics
- ✅ Zero security vulnerabilities (critical/high)
- ✅ 60%+ test coverage
- ✅ < 1% error rate in production
- ✅ Automated deployments with zero downtime

---

## Phase 2: Mobile & UX (Priority: HIGH)

### Objective
Make Grok DM mobile-friendly and improve overall user experience.

### Features

#### 2.1 Mobile Optimization (Week 1-3)
- [ ] **Responsive Layout Refactor** (24 hours)
  - Mobile-first room layout (single column)
  - Swipeable character sheet drawer
  - Bottom navigation bar
  - Touch-friendly dice roller
  
- [ ] **Mobile Combat Tracker** (16 hours)
  - Simplified initiative list
  - Quick HP adjustment controls
  - Mobile-optimized status effects
  
- [ ] **PWA Support** (16 hours)
  - Service worker for offline access
  - App manifest
  - Install prompt
  - Push notifications (future)

**Deliverable**: Fully functional mobile experience

#### 2.2 Character Builder UX (Week 4-6)
- [ ] **Visual Class Selection** (16 hours)
  - Class cards with images and descriptions
  - Hover tooltips for abilities
  - Recommended builds
  
- [ ] **Guided Spell Selection** (16 hours)
  - Filter by class and level
  - Recommended starter spells
  - Spell slot preview
  
- [ ] **Equipment Packages** (8 hours)
  - Pre-built equipment packs by class
  - "Standard Adventurer Kit"
  - "Wizard Starter Pack", etc.
  
- [ ] **Background Builder** (8 hours)
  - Background selection UI
  - Personality traits generator
  - Backstory templates

**Deliverable**: Intuitive character creation wizard

#### 2.3 WebSocket Improvements (Week 6-7)
- [ ] **Auto-Reconnection** (8 hours)
  - Exponential backoff
  - Connection status indicator
  - Message queue during disconnect
  
- [ ] **Typing Indicators** (4 hours)
  - Show "Player is typing..."
  - Show "DM is thinking..." during AI generation

**Deliverable**: Robust real-time communication

#### 2.4 UI Polish (Week 7-8)
- [ ] **Dice Roll Animations** (16 hours)
  - 3D dice physics (dice-box library)
  - Sound effects
  - Roll history timeline
  
- [ ] **Loading States** (8 hours)
  - Skeleton screens
  - Progress indicators
  - Optimistic updates
  
- [ ] **Accessibility** (8 hours)
  - Screen reader optimization
  - Keyboard navigation guide
  - High contrast mode

**Deliverable**: Polished, accessible UI

### Success Metrics
- ✅ 80%+ mobile traffic retention
- ✅ < 5% bounce rate on mobile
- ✅ 4.5+ star user rating
- ✅ WCAG 2.1 AA compliance

---

## Phase 3: Game Systems (Priority: MEDIUM)

### Objective
Expand to multiple game systems beyond D&D 5e.

### Features

#### 3.1 Pathfinder 2e (Week 1-6)
- [ ] **Core Rules** (40 hours)
  - 20+ classes with action economy
  - Ancestries and heritages
  - 3-action system
  - Skills and proficiency ranks
  
- [ ] **Content Import** (16 hours)
  - Spell compendium (Archives of Nethys)
  - Item compendium
  - Feat database
  
- [ ] **Character Builder** (24 hours)
  - Pathfinder-specific wizard
  - Feat selection UI
  - Archetype support

**Deliverable**: Complete Pathfinder 2e system

#### 3.2 Call of Cthulhu (Week 7-10)
- [ ] **Core Rules** (32 hours)
  - Skill-based system
  - Sanity mechanics
  - Luck points
  - Phobias and disorders
  
- [ ] **Investigator Creation** (16 hours)
  - Occupation-based skills
  - Backstory generator
  - Equipment by occupation

**Deliverable**: Complete Call of Cthulhu system

#### 3.3 Custom Game System Builder (Week 11-12)
- [ ] **System Editor** (24 hours)
  - Define custom stats
  - Define custom mechanics
  - Dice notation customization
  
- [ ] **AI Prompt Builder** (16 hours)
  - Custom DM personality
  - Custom world-building prompts
  - Custom rules interpretation

**Deliverable**: Homebrew system support

### Success Metrics
- ✅ 3+ game systems available
- ✅ 30%+ users try non-D&D systems
- ✅ Custom system usage > 100 games

---

## Phase 4: Social & Multiplayer (Priority: MEDIUM)

### Objective
Build community features and enhance multiplayer experience.

### Features

#### 4.1 Social Features (Week 1-3)
- [ ] **Friend System** (16 hours)
  - Add/remove friends
  - Friend activity feed
  - Direct invitations
  
- [ ] **Campaign Sharing** (16 hours)
  - Public campaign gallery
  - Campaign search and discovery
  - Join public campaigns
  
- [ ] **Player Profiles** (8 hours)
  - Public profile pages
  - Character showcase
  - Play history

**Deliverable**: Social network foundation

#### 4.2 Enhanced Multiplayer Tools (Week 3-5)
- [ ] **NPC & Monster Management** (24 hours)
  - Monster compendium (D&D 5e SRD)
  - Stat blocks with CR
  - Auto-roll initiative for monsters
  - Monster HP tracking
  
- [ ] **Scene Management** (16 hours)
  - Multi-scene campaigns
  - Scene templates (dungeon, tavern, etc.)
  - Scene history timeline
  
- [ ] **Quest Tracking** (16 hours)
  - Quest log UI
  - Quest completion tracking
  - AI integration for quest updates

**Deliverable**: Advanced DM tools

#### 4.3 Discord Integration (Week 5-6)
- [ ] **Webhook Notifications** (8 hours)
  - Send game updates to Discord channel
  - Combat start/end notifications
  - Player join/leave alerts
  
- [ ] **Discord Bot** (optional, 24 hours)
  - Basic commands (/roll, /hp, /status)
  - Link Discord users to Grok DM accounts

**Deliverable**: Discord connectivity

### Success Metrics
- ✅ 40%+ users have friends
- ✅ 20%+ public campaigns
- ✅ 10%+ Discord integrations

---

## Phase 5: Advanced Features (Priority: LOW)

### Objective
Premium features and advanced tools for power users.

### Features

#### 5.1 Battle Map (8-12 weeks)
- [ ] **Grid-Based Map** (40 hours)
  - Canvas or SVG-based grid
  - Zoom and pan
  - Fog of war
  
- [ ] **Token Management** (32 hours)
  - Player tokens
  - Monster tokens
  - Token placement and movement
  
- [ ] **Tactical Tools** (24 hours)
  - Distance and range calculations
  - Area of effect visualizations
  - Line of sight calculations

**Deliverable**: Virtual tabletop battle map

#### 5.2 Voice Integration (4-6 weeks)
- [ ] **Text-to-Speech** (24 hours)
  - ElevenLabs API integration
  - Voice selection for NPCs
  - DM narration audio
  
- [ ] **Voice-to-Text** (16 hours)
  - Web Speech API
  - Dictation for player input
  
- [ ] **Voice Changers** (optional, 16 hours)
  - NPC voice effects
  - Ambient sound effects

**Deliverable**: Voice-enhanced gameplay

#### 5.3 AI Enhancements (Ongoing)
- [ ] **Multi-Model Support** (16 hours)
  - GPT-4 option
  - Claude option
  - Local LLM option (Ollama)
  
- [ ] **Advanced Prompts** (8 hours)
  - DM personality customization
  - Story tone controls
  - Difficulty settings
  
- [ ] **Image Generation** (16 hours)
  - DALL-E/Midjourney for scenes
  - Character portrait generation
  - Item illustrations

**Deliverable**: AI customization options

#### 5.4 Premium Features (Future)
- [ ] **Cloud Saves & Sync**
- [ ] **Premium Tiers** (ad-free, advanced AI, priority support)
- [ ] **Campaign Marketplace** (buy/sell pre-made campaigns)
- [ ] **Analytics Dashboard** (player insights, engagement metrics)

### Success Metrics
- ✅ 5%+ premium conversions (if monetized)
- ✅ 80%+ user satisfaction with advanced features

---

## Technical Debt Backlog

### Ongoing Maintenance
- Regular dependency updates (monthly)
- Performance optimization (quarterly)
- Security audits (quarterly)
- Database optimization (as needed)

### Known Issues
1. **PostgreSQL types in SQLite schema** (Phase 1 - Critical)
2. **No automated testing** (Phase 1 - Critical)
3. **Limited error handling** (Phase 1 - High)
4. **Memory-based sessions** (Phase 1 - High)
5. **No rate limiting** (Phase 1 - High)

---

## Community Requests (Tracked)

Based on user feedback and GitHub issues:

1. **Dice macros** - Save frequently-used rolls (e.g., "Greatsword Attack")
2. **Character templates** - Pre-made characters for quick start
3. **Session summaries** - AI-generated recap of session
4. **Map uploads** - Upload custom battle maps
5. **Music integration** - Spotify/YouTube ambient music
6. **Character portraits** - AI-generated or uploaded images
7. **Loot tables** - Random loot generation
8. **Weather system** - Dynamic weather effects
9. **Time tracking** - In-game calendar and time
10. **Homebrew content** - User-created items, spells, monsters

---

## Long-Term Vision (2027+)

### Dream Features
- **3D virtual tabletop** (Three.js)
- **VR support** (Quest, PSVR)
- **AI-generated maps** (procedural dungeons)
- **Multi-campaign campaigns** (shared worlds)
- **Streaming integration** (Twitch, YouTube)
- **Mobile app** (native iOS/Android)
- **Marketplace** (buy assets, campaigns, mods)
- **Plugin system** (community extensions)

### Monetization Strategy (Optional)
- **Free Tier**: Basic features, public rooms, 1 character
- **Premium Tier** ($9.99/month): Unlimited characters, private rooms, advanced AI
- **Pro Tier** ($19.99/month): Battle maps, voice, premium support
- **Enterprise**: Custom deployments, white-label, API access

---

## Contributing to Roadmap

Want to influence the roadmap? Here's how:

1. **Vote on features** - Star issues on GitHub
2. **Submit requests** - Open an issue with "[Feature Request]" tag
3. **Discuss priorities** - Join Discord/forum discussions
4. **Contribute code** - Submit PRs for roadmap features

---

## Roadmap Updates

This roadmap is a living document and will be updated quarterly based on:
- User feedback and feature requests
- Technical priorities
- Resource availability
- Market trends

**Last Updated**: December 8, 2025  
**Next Review**: March 2026

---

**For detailed implementation plans**, see [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) Section 9.

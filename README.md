# Grok DM - AI-Powered TTRPG Platform

> A browser-based tabletop role-playing game platform powered by xAI's Grok, bringing intelligent AI Dungeon Mastering to your games.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

Grok DM is a real-time multiplayer TTRPG platform that runs entirely in your browser. Create or join game rooms, roll dice, manage characters, and let Grok AI serve as your intelligent Dungeon Master—narrating stories, managing combat, and bringing your adventures to life.

**Current Status**: Production-ready with comprehensive D&D 5e support ✅

## Features

- 🎲 **AI Dungeon Master** - Powered by xAI Grok for intelligent narrative responses
- 🌐 **Real-time Multiplayer** - WebSocket-based chat and game updates
- 🎭 **Multiple Game Systems** - D&D 5e, Cyberpunk RED (with more planned)
- 👤 **Character Management** - Create, save, and manage characters with full stat tracking
- 🎒 **Inventory & Spell Systems** - Complete item and spell management
- ⚔️ **Combat Tracking** - Initiative tracking, HP management, and status effects
- 🔐 **User Authentication** - Secure user accounts and profiles
- 📚 **Item & Spell Compendiums** - Comprehensive D&D 5e SRD content

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Turso database account (free tier available)
- xAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/algr0n/gr0k-dm.git
cd gr0k-dm

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials:
#   - TURSO_DATABASE_URL
#   - TURSO_AUTH_TOKEN
#   - XAI_API_KEY
#   - SESSION_SECRET
```

### Database Setup

```bash
# Push database schema
npm run db:push

# Seed adventure modules (optional but recommended)
npm run seed:adventures
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Open http://localhost:5000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend**: Express.js, WebSocket (ws library)
- **Database**: Turso (libSQL/SQLite) with Drizzle ORM
- **AI**: xAI Grok API (OpenAI-compatible client)
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation

## Project Structure

```
gr0k-dm/
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # Reusable components
│   │   └── lib/         # Client utilities
│   └── index.html
├── server/              # Express backend
│   ├── index.ts         # Main server
│   ├── routes.ts        # API routes
│   ├── grok.ts          # AI integration
│   ├── dice.ts          # Dice rolling engine
│   └── auth.ts          # Authentication
├── shared/              # Shared code
│   └── schema.ts        # Database schema
├── migrations/          # Database migrations
└── docs/                # Documentation
```

## Documentation

- **[Design Document](DESIGN_DOCUMENT.md)** - Complete architecture and design details
- **[Quick Reference](QUICK_REFERENCE.md)** - Quick overview and environment setup
- **[Design Guidelines](design_guidelines.md)** - UI/UX design specifications
- **[Testing Guide](TESTING_GUIDE.md)** - Testing strategies and best practices
- **[Database Setup Guide](DATABASE_SETUP.md)** - Database setup, migrations, and schema management
- **[Adventure System](ADVENTURE_SYSTEM.md)** - Pre-made adventure modules and implementation
- **[Roadmap](ROADMAP.md)** - Feature roadmap and development plans

## Environment Variables

Required environment variables (see `.env.example` for details):

- `TURSO_DATABASE_URL` - Turso database connection URL
- `TURSO_AUTH_TOKEN` - Turso authentication token
- `XAI_API_KEY` - xAI Grok API key
- `SESSION_SECRET` - Express session secret (random string)
- `GCP_SERVICE_ACCOUNT_KEY` - Google Cloud Storage credentials (optional)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)

## Scripts

```bash
npm run dev          # Start development server with HMR
npm run build        # Build for production
npm start            # Run production build
npm run check        # TypeScript type checking
npm run db:push      # Push database schema changes
npm run db:generate  # Generate database migrations
npm run seed:adventures  # Seed adventure modules
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Run `npm run check` to verify TypeScript types
5. Test your changes thoroughly
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

See [Design Guidelines](design_guidelines.md) for UI/UX standards and [DESIGN_DOCUMENT.md](DESIGN_DOCUMENT.md) for architecture details.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for detailed feature plans and development phases:

- **Phase 1**: Stability & Security (database migration ✅ COMPLETED, security hardening, testing infrastructure) ⚠️ In Progress
- **Phase 2**: Mobile & UX (mobile optimization, PWA support)
- **Phase 3**: Game Systems (Pathfinder 2e, Call of Cthulhu)
- **Phase 4**: Social & Multiplayer (friends, campaigns, Discord integration)
- **Phase 5**: Advanced Features (battle maps, voice, premium features)

## Known Issues & Limitations

- SQLite write contention possible for high-concurrency scenarios (mitigated by Turso's edge replication)
- Limited automated testing infrastructure (Phase 1 priority)
- Mobile experience can be improved (Phase 2)
- Currently supports D&D 5e (comprehensive) and Cyberpunk RED (basic) game systems
- Some TypeScript compilation warnings exist and are being addressed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [xAI Grok](https://x.ai/) for AI-powered Dungeon Mastering
- Uses [Turso](https://turso.tech/) for edge database hosting
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- D&D 5e content from the [System Reference Document (SRD)](https://dnd.wizards.com/resources/systems-reference-document)

## Support

- **Issues**: [GitHub Issues](https://github.com/algr0n/gr0k-dm/issues)
- **Documentation**: See the `/docs` directory
- **Questions**: Open a discussion on GitHub

---

**Made with ❤️ for tabletop RPG enthusiasts**

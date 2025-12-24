# Developer Onboarding Guide

> Quick start guide for new developers joining the Grok DM project

## Welcome!

Grok DM is a browser-based AI-powered Dungeon Master platform for tabletop RPGs. This guide will get you up and running quickly.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm** or **pnpm** - Comes with Node.js
- **Git** - For version control
- **Code editor** - VS Code recommended with TypeScript extension
- **Turso account** - [Sign up free](https://turso.tech/)
- **xAI API key** - [Get from xAI dashboard](https://console.x.ai/)

## Quick Start (5 minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/algr0n/gr0k-dm.git
cd gr0k-dm
```

### 2. Install Dependencies

```bash
npm install
```

This installs ~630 packages and takes about 30-60 seconds.

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
XAI_API_KEY=your-xai-api-key
SESSION_SECRET=any-random-string-here

# Optional
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
PORT=5000
NODE_ENV=development
```

**Getting Turso Credentials**:
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create a database
turso db create grok-dm-dev

# Get credentials
turso db show grok-dm-dev
turso db tokens create grok-dm-dev
```

### 4. Initialize Database

```bash
# Push schema to database
npm run db:push

# Seed adventure data (optional but recommended)
npm run seed:adventures
```

### 5. Start Development Server

```bash
npm run dev
```

Server starts at **http://localhost:5000** with hot module reloading.

## Project Structure Overview

```
gr0k-dm/
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/       # Route pages (Landing, Dashboard, Room, Characters)
│   │   ├── components/  # Reusable UI components (60+)
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Client utilities
│   └── index.html
│
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API endpoints + WebSocket (3000+ lines)
│   ├── grok.ts          # AI integration main entry
│   ├── prompts/         # Game system prompts
│   ├── generators/      # AI response generators
│   ├── context/         # Context building for AI
│   ├── cache/           # Response caching
│   ├── utils/           # Token tracking, summaries
│   ├── auth.ts          # Passport.js authentication
│   ├── dice.ts          # Dice rolling engine
│   ├── db.ts            # Database connection
│   └── storage.ts       # Database operations
│
├── shared/              # Shared types and schema
│   └── schema.ts        # Database schema (Drizzle ORM)
│
├── migrations/          # Database migrations
│   └── meta/
│
└── docs/                # Documentation
    ├── README.md
    ├── AI_DM_GUIDE.md
    ├── DATABASE_SETUP.md
    └── ...
```

## Common Development Tasks

### Running the Application

```bash
# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Database Operations

```bash
# Push schema changes (development)
npm run db:push

# Generate migration from schema changes (production)
npm run db:generate

# Apply migrations
npm run migrate:prod

# Seed adventure modules
npm run seed:adventures
```

### Type Checking

```bash
# Check TypeScript types
npm run check
```

## Key Technologies

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (super fast!)
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **shadcn/ui** - Component library (built on Radix UI)
- **Tailwind CSS** - Utility-first styling

### Backend
- **Express.js** - HTTP server
- **WebSocket (ws)** - Real-time communication
- **Drizzle ORM** - Type-safe database queries
- **Passport.js** - Authentication
- **OpenAI SDK** - xAI Grok API client

### Database
- **Turso** - Serverless SQLite (libSQL)
- **SQLite** - Database engine
- **Drizzle Kit** - Migration tool

## Making Your First Change

Let's add a simple feature to get familiar with the codebase.

### Example: Add a Welcome Message to Dashboard

1. **Open the dashboard page**:
   ```bash
   code client/src/pages/dashboard.tsx
   ```

2. **Add a welcome banner** after line 10:
   ```tsx
   <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg mb-4">
     <p className="text-blue-800 dark:text-blue-200">
       Welcome to Grok DM! Ready for an adventure?
     </p>
   </div>
   ```

3. **Save the file** - Vite automatically reloads the page

4. **Check the browser** - You should see the new banner

### Example: Add a New API Endpoint

1. **Open routes file**:
   ```bash
   code server/routes.ts
   ```

2. **Add a simple endpoint** around line 200:
   ```typescript
   app.get("/api/hello", (req, res) => {
     res.json({ message: "Hello from Grok DM!" });
   });
   ```

3. **Test it**:
   ```bash
   curl http://localhost:5000/api/hello
   ```

## Understanding the Code Flow

### User Creates a Room

1. **Frontend**: `client/src/pages/landing.tsx` - User fills form
2. **API Request**: POST to `/api/rooms`
3. **Backend**: `server/routes.ts` - Validates, creates room in database
4. **WebSocket**: Establishes connection for real-time updates
5. **Database**: Room stored in `rooms` table

### AI DM Responds to Player

1. **Frontend**: Player types message in `client/src/pages/room.tsx`
2. **WebSocket**: Message sent to server
3. **Message Batching**: Server waits 1.5s for more messages
4. **Context Building**: `server/context/context-builder.ts` builds AI context
5. **AI API Call**: `server/generators/` sends to Grok API
6. **Response Parsing**: `server/routes.ts` parses AI tags (HP, items, etc.)
7. **Database Update**: Game state updated
8. **Broadcast**: All players receive update via WebSocket

### Character Creation

1. **Frontend**: `client/src/pages/characters.tsx` - Character creation wizard
2. **API Request**: POST to `/api/characters`
3. **Backend**: Validates, creates character in `unifiedCharacters` table
4. **Starting Items**: `server/routes.ts` grants class-appropriate starting items
5. **Response**: Character ID returned to frontend

## Debugging Tips

### Frontend Debugging

**React DevTools**:
```bash
# Install browser extension
# Chrome: React Developer Tools
# Firefox: React Developer Tools
```

**Inspect TanStack Query**:
```bash
# Install TanStack Query DevTools extension
# Or use built-in devtools in browser console
```

**Check Network Tab**:
- API requests to `/api/*`
- WebSocket connections to `ws://localhost:5000`

### Backend Debugging

**Server Logs**:
All logs go to console with timestamps:
```
2024-12-24 03:55:00 [server] Server running on port 5000
2024-12-24 03:55:05 [routes] POST /api/rooms - Creating room
```

**Database Queries**:
Enable Drizzle logging in `server/db.ts` (already enabled):
```typescript
export const db = drizzle(client, { 
  schema,
  logger: true  // Shows SQL queries
});
```

**WebSocket Debugging**:
```typescript
// In server/routes.ts, all WebSocket events are logged:
console.log("[WebSocket] Client connected:", userId);
console.log("[WebSocket] Message received:", message);
```

## Coding Standards

### TypeScript

- **Strict mode enabled** - No implicit `any`
- **Use explicit types** for function parameters and returns
- **Prefer interfaces** for object shapes
- **Use Zod** for runtime validation

### React

- **Functional components** with hooks
- **Use TypeScript interfaces** for props
- **TanStack Query** for server state (not useState)
- **Destructure props** in function signature

### Code Style

- **No semicolons** (project convention)
- **Use `const`** over `let` when possible
- **Use template literals** for strings with variables
- **Async/await** over promise chains
- **2 spaces** for indentation

### Naming

- **Components**: PascalCase (`CharacterList.tsx`)
- **Files**: kebab-case (`dice-roller.ts`)
- **Functions**: camelCase (`rollDice`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PLAYERS`)
- **Database tables**: snake_case (`unified_characters`)

## Common Gotchas

### 1. "Module not found" errors

**Solution**: Install dependencies
```bash
npm install
```

### 2. "Cannot connect to database"

**Solution**: Check environment variables
```bash
cat .env  # Verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
```

### 3. "XAI_API_KEY not set"

**Solution**: Add API key to `.env`
```bash
echo "XAI_API_KEY=your-key-here" >> .env
```

### 4. WebSocket connection fails

**Solution**: Restart dev server (Ctrl+C, then `npm run dev`)

### 5. TypeScript errors in editor

**Solution**: Restart TypeScript server
- VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

## Testing Your Changes

### Manual Testing

1. **Start dev server**: `npm run dev`
2. **Open browser**: http://localhost:5000
3. **Test flow**:
   - Create account
   - Create character
   - Host a game
   - Send messages
   - Test AI responses

### Type Checking

```bash
npm run check
```

### Build Test

```bash
npm run build
```

Should complete without errors (warnings are okay for now).

## Git Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/my-awesome-feature
```

### Making Commits

```bash
git add .
git commit -m "feat: add awesome feature"
```

Use conventional commit format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `style:` - Code style changes
- `test:` - Adding tests

### Pushing Changes

```bash
git push origin feature/my-awesome-feature
```

### Creating a Pull Request

1. Go to GitHub repository
2. Click "Pull Request"
3. Fill in description
4. Wait for review

## Getting Help

### Documentation

- **[README.md](README.md)** - Project overview
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference
- **[DESIGN_DOCUMENT.md](DESIGN_DOCUMENT.md)** - Architecture details
- **[AI_DM_GUIDE.md](AI_DM_GUIDE.md)** - AI system guide
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Database guide

### Community

- **GitHub Issues** - Report bugs or ask questions
- **GitHub Discussions** - General discussions
- **Code Comments** - Read inline documentation

### Best Practices

1. **Read existing code** - See how things are done
2. **Start small** - Make incremental changes
3. **Test your changes** - Manually test before committing
4. **Ask questions** - Open an issue if stuck
5. **Document your code** - Add comments for complex logic

## Next Steps

Now that you're set up:

1. **Explore the codebase** - Read through key files
2. **Run the application** - See how it works
3. **Pick a small task** - Check GitHub issues for "good first issue"
4. **Make your first PR** - Contribute back!

## Helpful VS Code Extensions

Recommended for this project:

- **ES7+ React/Redux/React-Native snippets** - React snippets
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **ESLint** - Linting
- **Prettier** - Code formatting
- **GitLens** - Git blame and history
- **Error Lens** - Inline error display

## Common Commands Cheat Sheet

```bash
# Development
npm run dev              # Start dev server
npm run check            # Type check
npm run build            # Build for production

# Database
npm run db:push          # Push schema changes
npm run db:generate      # Generate migration
npm run seed:adventures  # Seed adventure data

# Git
git status              # Check changes
git add .               # Stage changes
git commit -m "msg"     # Commit changes
git push                # Push to GitHub
```

## Questions?

If you're stuck or have questions:

1. Check the docs in this repository
2. Read code comments in relevant files
3. Open an issue on GitHub
4. Ask in GitHub Discussions

**Welcome to the team! Happy coding! 🚀**

---

**Last Updated**: December 24, 2024  
**Maintained By**: Development Team

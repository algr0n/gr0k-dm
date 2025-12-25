# Grok DM — Handoff Template for Next Agent ✅

**Short context:** Grok DM is a browser-based TTRPG where xAI Grok acts as the DM. Combat is server-authoritative and deterministic; LLMs are used only for generation/decision tasks. The goal is to minimize LLM token usage, finish UI action wiring, and add robust tests and DM tooling.

---

## 1) Quick Summary (1–2 lines)
- **Completed:** deterministic combat engine, persistent encounter storage, deterministic monster AI, WebSocket server & client, UI demo components (map, initiative, log), client NL→action heuristics (avoid Grok for simple actions).
- **Next priority:** finish player action UI (attack/move), confirm NL→action flow + DM suggestion flow, add encounter versioning/history & telemetry.

---

## 2) What to verify first (commands & checks) ✅
- Install dependencies:
  - npm i
- Run tests:
  - npx vitest run --dir . --run --reporter verbose
  - Expect all tests to pass locally (~19 tests currently).
- Start dev server:
  - npm run dev
  - Open the demo page and verify the `encounter-demo` page works using `demo-room`.
- Sanity checks:
  - Ensure the `server/grok` module does not attempt real LLM calls during tests (it is safe if `XAI_API_KEY` is absent).

---

## 3) Completed work (high-level) ✅
- Server
  - Deterministic combat engine: `server/combat.ts`
  - Combat endpoints & hold/pass: `server/routes.ts`
  - WebSocket handling & broadcast: `server/routes.ts`
  - LLM integration (safe initialization) & stage generator: `server/grok.ts`, `server/generators/stage.ts`
  - Persistence: `server/storage.ts`, DB additions in `shared/adventure-schema.ts`
- Client
  - Components: `client/src/components/encounter-map.tsx`, `initiative-tracker.tsx`, `combat-log.tsx`
  - Demo page + fixtures: `client/src/pages/encounter-demo.tsx`, `client/src/fixtures/encounter-sample.json`
  - WebSocket: `client/src/lib/ws.ts`, `client/src/hooks/useRoomSocket.ts`
  - NL heuristic parser (client): `client/src/lib/nl-parser.ts` (threshold 0.8 for auto-action)
  - API helpers: `client/src/lib/combat-api.ts`
- Tests & infra
  - Unit + integration tests under `tests/` (monster AI, parser, WS, UI actions)
  - `vitest.config.ts` for jsdom + path aliases

---

## 4) Files to inspect first (priority) 🔎
- Server: `server/combat.ts`, `server/routes.ts`, `server/grok.ts`
- Storage & schema: `server/storage.ts`, `shared/adventure-schema.ts`
- Client: `client/src/pages/encounter-demo.tsx`, `client/src/components/*`, `client/src/lib/nl-parser.ts`
- WebSocket: `client/src/lib/ws.ts`, and relevant sections in `server/routes.ts`
- Tests: `tests/*` (especially chat-actions, websocket, monster-ai)

---

## 5) Immediate high-priority tasks (do in this order) 🔜
1. **Attack & Move wiring:** Wire Attack & Drag-to-Move on `EncounterMap` to send structured action messages (WS or POST `/api/rooms/:code/combat/action`) with optimistic UI; add unit & E2E tests.
2. **NL→Action confirm flow:** Implement server `action_suggestion` responses and client Confirm/Edit/Cancel UI for ambiguous parses.
3. **Versioning & DM Editor:** Store encounter versions, provide list/rollback endpoints, and DM accept/reject UI.
4. **Pathfinding:** Add A* pathfinding around features / obstacles (with tests).
5. **Telemetry & batching:** Track LLM token usage per room and implement prompt batching to reduce calls.

---

## 6) Message & API contracts (examples) 📨
- Client WS chat: `{ type: "chat", content: "I loot the chest" }`
- Server suggestion: `{ type: "action_suggestion", suggestionId, actions: [...], confidence }`
- Action message (WS or REST body): `{ action: { actorId, type: "move"|"attack"|"loot"|"pass"|"hold", targetId?, to?: {x,y} } }`
- Server broadcasts: `combat_result`, `combat_event`, `combat_update`, `encounter:updated`

---

## 7) Must-add tests (priority)
- E2E: chat "I loot the chest" → heuristic parse → REST action → server validation → broadcast `combat_event` → UI update.
- E2E: drag token → move action → server `combat_event` move → map coords update.
- AI tests: multi-monster coordination & reactions.
- Telemetry tests: ensure token counts and batching work.

---

## 8) Acceptance criteria for next PRs ✅
- All unit tests pass and new E2E tests are included.
- Demo supports click/drag attack & move and reconciles with server broadcasts.
- NL flow: high-confidence parses do not call LLM; ambiguous messages are suggested for confirm or forwarded to the LLM.
- Encounter versions stored and can be rolled back by DM.

---

## 9) Environment & secrets
- `XAI_API_KEY` — only required for actual LLM calls; server handles missing keys for tests.
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — database persistence.
- `SESSION_SECRET` — for authenticated WebSocket upgrades in prod.

---

## 10) Quick-run checklist (copy/paste)
- git checkout main && git pull
- npm i
- npx vitest run --dir . --run --reporter verbose
- npm run dev (open demo page) — use `encounter-demo` and `demo-room` for local testing

---

If you want, I can generate issue templates and create the first PR scaffolding for **Attack & Move wiring** (with tests). Reply `PR` to have me open a scaffolded PR, or `ISSUES` to create issues with checklists for the top tasks.

---

*File created by: GitHub Copilot*

# Encounter Stage UI Plan

📅 Last updated: 2025-12-25

---

## Purpose

Document a clear plan for the visual representation of persisted combat stages ("encounters") and the UX/API work needed to integrate them with the server-side combat engine and persistent encounter storage.

This doc is intended to be a practical, actionable blueprint for front-end and back-end work, QA, and rollout.

---

## Goals ✅
- Render persisted encounters (map, tokens, features) consistently across clients.
- Provide player interactions (move/attack/hold/pass) that map 1:1 to server-authoritative actions.
- Give DMs tools to review and modify LLM-generated stages before they are made authoritative (versioning/accept/reject).
- Minimize LLM token usage by keeping deterministic resolution on the server and only using LLM for narration/optional strategy.

## Non-goals ❌
- Full-featured pathfinding (A*) and advanced physics in phase 1.
- High-fidelity grid editor or campaign map editor (out-of-scope for MVP).

---

## Key Concepts
- **Encounter (Stage)**: Persisted DB object representing an encounter in a location. Includes features, spawns, initiative, currentTurnIndex, turnHistory, version metadata.
- **Server authority**: The server is the single source of truth. Clients send requested actions; server validates, resolves, persists, and broadcasts resulting state.
- **LLM role**: generation and optional DM decisions only (decision-only prompts + short tokens). All deterministic resolution (rolls, hits, damage) happens server-side.

---

## Data model (summary)
- encounter: { id, locationId, version, seed, createdBy, summary }
- features: [{ id, type, x, y, width, height, props }]
- spawns: [{ id, actorId, actorType, token, pos:{x,y}, hp, maxHp, stats }]
- initiativeOrder: [{ actorId, initiative, held, ready, orderIndex }]
- currentTurnIndex: integer
- turnHistory: [{ actorId, action, result, timestamp }]
- mapMeta: { width, height, gridSize, backgroundImageUrl? }

Reference: server schema additions in `shared/adventure-schema.ts` (combat_encounters / combat_spawns / combat_environment_features).

---

## Visual components (MVP)
1. **EncounterMap** 🔷
   - SVG or canvas grid, token rendering, simple path overlay, click-to-move.
   - Draw features (cover, obstacles), AoE overlays, and token highlight.
2. **InitiativeTracker** 🔷
   - Ordered actor list, active actor highlight, hold/ready/pass controls, HP display.
3. **CombatControlsPanel** 🔷
   - Contextual actions for selected actor: Move, Attack, Cast, Hold, Pass, End Turn.
4. **CombatLog** 🔷
   - Scrollable server-driven log of actions, dice results, and narration.
5. **EncounterEditor / DM Panel** 🔷
   - Inspect generated stage, accept/reject LLM-generated changes, edit spawns/features, and save versions.
6. **ActorCard** 🔷
   - Popup showing stats and quick DM edits (HP adjust, status apply).

---

## Interactions & flows
- Load: Client fetches `GET /api/locations/:locationId/encounter` → server returns persisted encounter; client subscribes to WS room events.
- Start Combat: POST `/api/rooms/:code/combat/start` (server will load or generate encounter, persist, and broadcast `encounter:created`).
- Action: Client sends `POST /api/rooms/:code/combat/action` with structured payload; server validates, applies rules, persists, and broadcasts `combat:actionApplied` + `encounter:updated`.
- DM Edit: DM requests `POST /api/encounters/:id/generate-edit` → server sends decision-only prompt to LLM → returns structured edit → DM reviews and calls `PUT /api/encounters/:id` to accept (new version created).

WebSocket event examples:
- `encounter:updated` { encounter }
- `combat:turnAdvanced` { currentTurnIndex, activeActorId }
- `combat:log` { entry }
- `encounter:versionUpdated` { encounterId, version }

---

## Acceptance criteria (MVP)
- Persisted encounter loads and renders in the map component with tokens in correct positions.
- InitiativeTracker shows all actors in order; active actor is highlighted.
- Player can submit Move and Pass actions; UI optimistically updates then reconciles with server broadcast.
- DM can view LLM-generated stage summary and accept/reject edits; accepted edits create a new version.
- All combat actions that change state are stored in `turnHistory` and visible in `CombatLog`.

---

## Milestones & tasks (recommended)
Phase 0 — Preparation
- [ ] Add a small encounter fixtures endpoint for local dev (read-only) to facilitate frontend prototyping.
- [ ] Create lightweight JSON fixtures for a few map sizes.

Phase 1 — Viewer & Sync (2–3 days)
- [ ] Implement `EncounterMap` (read-only rendering from REST payload).
- [ ] Implement `InitiativeTracker` (read-only with highlighting).
- [ ] Wire websocket subscription to `encounter:updated` and `combat:log` events.
- [ ] Unit tests for event handling and rendering logic.

Phase 2 — Player Interaction (3–5 days)
- [ ] Implement `CombatControlsPanel` and action button flows (Move, Pass).
- [ ] Implement client-side optimistic updates and reconciliation.
- [ ] E2E test for a simple move → server apply → broadcast cycle.

Phase 3 — DM Tools & Versioning (3–5 days)
- [ ] Implement `EncounterEditor` UI for edit review and save-as-new-version.
- [ ] Add endpoints for listing versions and rolling back.
- [ ] Tests covering the DM acceptance flow.

Phase 4 — Polish & Monitoring (ongoing)
- [ ] Add AoE editor, pathfinding improvements, mobile optimizations.
- [ ] Instrument metrics: encounter creations, LLM tokens per encounter, actions per session, WS event rates.

---

## Testing & QA
- Unit tests for UI logic and event handling (Vitest + React Testing Library).
- Integration tests for the main flows (start combat, action apply, log entries).
- Manual QA checklist for visual correctness (token layering, highlight, mobile layout).

---

## Metrics & rollout
- Key metrics: LLM token usage per encounter, actions/sec, encounter save rate, error rate on action apply.
- Rollout strategy: feature-flagged release to subset of hosts, collect metrics and feedback, then full release.

---

## Security & Permissions
- Server validates DM-only operations and version edits.
- Client must check roles locally for UI but enforce server-side checks for all state-changing routes.

---

## References
- Server combat logic: `server/combat.ts`
- Encounter generator: `server/generators/stage.ts`
- Persistence: `server/storage.ts`, schema `shared/adventure-schema.ts`

---

## Notes / Next steps
- Decide acceptance criteria for version history (how many versions to store, retention policy).
- Prioritize the TODO list: deterministic monster AI / UI scaffolding / token reduction. If you'd like, I can start on the prioritized item you pick.

---

*File created by: GitHub Copilot*

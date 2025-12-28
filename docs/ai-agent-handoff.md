# AI Agent Handoff: Non-Combat Spell Effects

## Current State
- Implemented room-level status effects table `room_status_effects` and storage helpers.
- Added HTTP endpoint `POST /api/rooms/:code/spells/apply` to apply spell effects outside combat; broadcasts `spell_applied` WS event.
- Client combat panel can toggle "Apply outside combat" to hit the new endpoint; room page listens for `spell_applied` and refetches data.
- Inference uses `shared/spell-text.ts` to auto-detect save ability/onSuccess/damage/tags.
- Type checks pass (`npm run check`).

## Key Files
- [shared/schema.ts](shared/schema.ts#L604-L647): `room_status_effects` table and insert schema.
- [server/storage.ts](server/storage.ts#L520-L566): room status effect CRUD helpers.
- [server/storage.mock.ts](server/storage.mock.ts#L40-L80): mock implementations for tests.
- [server/routes.ts](server/routes.ts#L5195-L5285): `POST /api/rooms/:code/spells/apply` handler and WS broadcast.
- [shared/spell-text.ts](shared/spell-text.ts): spell text inference.
- [client/src/components/combat/DnD5eCombatPanel.tsx](client/src/components/combat/DnD5eCombatPanel.tsx#L500-L575): apply-outside-combat toggle + mutation to new endpoint.
- [client/src/pages/room.tsx](client/src/pages/room.tsx#L1045-L1065): handles `spell_applied` WS event, toasts, refetches.
- [docs/non-combat-spells.md](docs/non-combat-spells.md): quick doc of the flow.

## Pending / High Priority
1) **Add DB migration** for `room_status_effects` (not yet created); ensure `migrations/016_add_room_status_effects.sql` (or next number) matches schema.
2) **Tests**
   - Server: unit/integration for `/api/rooms/:code/spells/apply` (character target, room target, bad params, permission check).
   - Client: mutation happy-path and WS handling (Vitest + React Testing Library with mocked fetch/WS).
3) **Object/NPC support**
   - Allow passing object/NPC IDs from client; persist in `metadata` with richer tags (e.g., `manipulation`, `buff`, `debuff`).
4) **UI surfacing**
   - Display active room effects (and allow DM removal/expiry); consider filtering by tags.
5) **Optional loudness → combat**
   - If `isLoud` true, optionally trigger combat start or DM prompt; decide policy.
6) **Expiry/cleanup**
   - Add scheduled cleanup or on-fetch filtering using `expiresAt`; consider migrations for indexes if needed.

## Notes / Risks
- **Schema mismatch risk**: production DB will miss `room_status_effects` until migration is added and run.
- `spellText` is free-form; inference is best-effort. Consider adding optional `spellId` to fetch canonical text.
- Endpoint currently allows any authenticated user; ensure room membership checks are sufficient for your threat model.

## Quick Commands
- Type check: `npm run check`
- Run all SQL migrations (Turso): `node scripts/run-all-migrations.js` (uses TURSO_DATABASE_URL/TURSO_AUTH_TOKEN)
- After authoring the new room_status_effects migration, run the script above; prefer the JS migration hook if needed.

## Suggested Next Steps
- Author migration for `room_status_effects`, run locally, commit.
- Add tests (server + client) and wire object/NPC targeting.
- Extend UI to show active room effects and support removals/expiry.

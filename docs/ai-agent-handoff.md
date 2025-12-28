# AI Agent Handoff: Non-Combat Spell Effects

## Current State
- Migration 016 adds the `room_status_effects` table plus storage helpers and mock reset.
- `POST /api/rooms/:code/spells/apply` supports character/object/npc/room targets, merges tags/metadata, and broadcasts `spell_applied` (WS handler refetches).
- Room info and `/api/rooms/:code/status-effects` return active room status effects; expired rows are purged on fetch; `DELETE /api/rooms/:code/status-effects/:effectId` lets the DM remove and broadcasts `room_status_effect_removed`.
- Room page shows a Room Effects card (tags/targets/duration/expiry) with DM removal; listens for `spell_applied` and `room_status_effect_removed` to invalidate queries.
- Loud spells emit a `combat_prompt` WS event so the DM gets nudged to start combat; UI toasts for hosts.
- Background cleanup interval purges expired room effects (env: `ROOM_EFFECT_CLEANUP_MS`, default 5m) in addition to fetch-time purge.
- Room Effects card now shows friendly NPC names for NPC targets.
- Latest targeted tests passing: `CI=1 npx vitest run tests/server/spells-apply.spec.ts tests/components/room-spell-ws.spec.tsx tests/components/room-ws-handler.spec.tsx tests/lib/spells.spec.ts --reporter dot`.

## Key Files
- [shared/schema.ts](shared/schema.ts#L604-L647): `room_status_effects` table and insert schema.
- [server/storage.ts](server/storage.ts#L520-L544): room status effect CRUD helpers.
- [server/storage.mock.ts](server/storage.mock.ts#L28-L86): in-memory effects plus reset for tests.
- [server/routes.ts](server/routes.ts#L4915-L5003): active-effect fetch/cleanup helper, GET status-effects, room info includes `roomStatusEffects`, and DM delete + broadcast.
- [server/handlers/spells.ts](server/handlers/spells.ts#L1-L120): apply handler writing room/object/npc effects with metadata/tags.
- [client/src/pages/room.tsx](client/src/pages/room.tsx#L1654-L1708): Room Effects card with tags/targets/expiry and DM removal; [WebSocket handling](client/src/pages/room.tsx#L1098-L1107) for apply/remove events.
- [client/src/components/combat/DnD5eCombatPanel.tsx](client/src/components/combat/DnD5eCombatPanel.tsx#L500-L575): apply-outside-combat toggle + mutation to new endpoint.
- [docs/non-combat-spells.md](docs/non-combat-spells.md): quick doc of the flow.

## Pending / High Priority
- None for this feature set. Optional items have been addressed (combat prompt, background cleanup, NPC labels).

## Notes / Risks
- DELETE `/api/rooms/:code/status-effects/:effectId` now checks the authenticated user is the room host (players.isHost) instead of trusting `hostName` from the client.
- Expired effects are purged on fetch/list; stale rows remain until a fetch occurs.
- `spellText` is free-form; consider adding optional `spellId` to fetch canonical text.

## Quick Commands
- Type check: `npm run check`
- Targeted tests: `CI=1 npx vitest run tests/server/spells-apply.spec.ts tests/components/room-spell-ws.spec.tsx tests/components/room-ws-handler.spec.tsx tests/lib/spells.spec.ts --reporter dot`

## Suggested Next Steps
- Tighten auth for room effect deletion (user-bound host check vs `hostName`).
- Add object/scene label resolution for non-NPC targets if/when objects have names in state.
- Extend tests to cover `combat_prompt` path and cleanup interval (mock time) if desired.

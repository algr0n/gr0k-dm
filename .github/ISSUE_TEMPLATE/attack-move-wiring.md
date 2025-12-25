---
name: 'Feature: Attack & Move UI wiring'
about: "Wire Attack and Drag-to-Move on the EncounterMap to send actions to the server and add E2E tests"
labels: ['feature','frontend','combat']
assignees: []
---

## Summary
Implement Attack and Drag-to-Move interactions in the `EncounterMap` and wire them to the server's combat action endpoints/WS messages with optimistic UI and reconciliation.

## Acceptance criteria ✅
- [ ] Player can click a token to select it and click an enemy token to **attack**. This sends a structured action via WS or REST (`/api/rooms/:code/combat/action`).
- [ ] Player can drag a token to a grid position to **move**; action is sent and the UI shows optimistic movement until server broadcast.
- [ ] Server responds with `combat_event`/`combat_result` and the client reconciles (final position, HP changes).
- [ ] Unit tests for map action handlers exist.
- [ ] E2E test that simulates move/attack roundtrip (client -> server stub -> broadcast -> UI update).

## Implementation notes 🔧
- Files to modify: `client/src/components/encounter-map.tsx`, `client/src/pages/encounter-demo.tsx`, `client/src/lib/combat-api.ts` (add helper if required).
- Use `submitAction` from `client/src/lib/combat-api.ts` to POST actions for now; WebSocket `send` may also be used for low-latency experiments.
- Use token/feature resolution to map user-friendly names to `targetId` where possible.

## Tests
- Add tests under `tests/components/` and `tests/e2e/` (if E2E infra exists) to validate optimistic UI and reconciliation.

## Estimated effort
- 1–2 days

---

Add any notes or blockers below:

- 

---
name: 'Feature: NL → Action confirmation flow'
about: 'Implement server action_suggestion flow and client Confirm/Edit/Cancel UI for ambiguous natural language inputs'
labels: ['feature','ai','ux']
assignees: []
---

## Summary
Allow players to speak naturally; the system parses and, when ambiguous, returns `action_suggestion` to the originating client for explicit confirm/edit/cancel.

## Acceptance criteria ✅
- [ ] Client sends raw chat as `{ type: 'chat', content }` over WS when not auto-submitting.
- [ ] Server runs heuristics; if low-confidence, calls decision-only LLM and returns `action_suggestion` JSON to the player.
- [ ] Client displays an in-place confirmation bubble: **Parsed action** with `Confirm | Edit | Cancel` buttons.
- [ ] `Confirm` sends the authoritative action to `/api/rooms/:code/combat/action` (or WS action) and shows optimistic UI; server validates and broadcasts the result.
- [ ] `Edit` opens a minimal form to tweak target/parameters and resubmit; `Cancel` discards.
- [ ] Telemetry records how many messages are auto-submitted vs suggested (parser hit/miss rate).

## Notes 🔍
- Heuristic threshold currently: 0.8 (client-side `client/src/lib/nl-parser.ts`); adjust after experiments.
- Keep LLM requests brief (decision-only, JSON-only, small max_tokens). Cache frequent patterns.

## Tests
- Unit tests for heuristic parser behavior and server parsing fallback.
- Integration tests covering ambiguous chat -> server suggestion -> user confirm -> server apply -> broadcast.

## Estimated effort
- 2–3 days

---

Add notes or blockers:

- 

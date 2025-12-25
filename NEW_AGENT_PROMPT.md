# Prompt for the Incoming AI Agent

Use this exact prompt as the starting instruction for the next agent. Paste it into the agent's input and run it with access to the repository and the shell (if available).

---

You are the new AI engineering agent for the Grok DM project (repo root: /workspaces/gr0k-dm).
Your job is to complete high-priority UI & server features and tests listed in the HANDOFF_TEMPLATE_FOR_AGENT.md.

Start tasks (do these in order):

1. Run the test suite and verify everything is green:
   - npm i
   - npx vitest run --dir . --run --reporter verbose
   - If any tests fail, fix them before proceeding. Document failures and your fixes in the PR description.

2. Implement the Attack & Move wiring:
   - Inspect `client/src/components/encounter-map.tsx` and `client/src/pages/encounter-demo.tsx`.
   - Implement click-to-attack and drag-to-move UI interactions.
   - Use `client/src/lib/combat-api.ts` `submitAction` to send actions, or WS `send` when low-latency desired.
   - Add optimistic UI updates and reconciliation logic for server broadcasts (`combat_event`, `combat_result`).
   - Add unit tests and an integration/E2E test demonstrating client -> server -> broadcast flow.

3. Implement NL→Action confirm flow (if time permits):
   - Implement server-side `action_suggestion` responses (if not yet implemented) in `server/routes.ts`.
   - Add client Confirm/Edit/Cancel UI where ambiguous NL messages are suggested as actions.
   - Add tests for this flow.

4. Open PR(s) with clear description, tests, and acceptance criteria. Use the PR template at `.github/PULL_REQUEST_TEMPLATE.md`.

Diagnostics & resources:
- Main files to read: `server/combat.ts`, `server/routes.ts`, `client/src/pages/encounter-demo.tsx`, `client/src/components/encounter-map.tsx`, `client/src/lib/nl-parser.ts`.
- Handoff doc: `HANDOFF_TEMPLATE_FOR_AGENT.md`
- Issue templates for context: `.github/ISSUE_TEMPLATE/*`
- Test harness: Vitest config in `vitest.config.ts` (jsdom enabled), tests located in `tests/`.

When you finish each task, create a concise PR and ask for a lightweight review. If you encounter an ambiguous implementation detail, add a short issue with options and recommended choice, then proceed with the chosen option.

Constraints & design choices to respect:
- Keep LLM usage minimal: simple actions should **not** trigger Grok calls.
- Server must be authoritative; client-side heuristics can be optimistic but must always reconcile with server broadcasts.
- Security: server-side must validate ownership, turns, and privileges for actions.

Deliverables:
- Passing test suite.
- PR(s) implementing Attack & Move wiring with tests and demo page verification steps.
- New or updated tests for NL→Action behavior if implemented.

Good luck — begin by running the test suite and reporting the results.

---

*Place this prompt into the new agent’s input box and begin.*

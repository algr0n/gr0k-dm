# Combat Engine Design & API Contract

## Goals
- Run D&D 5e style combat deterministically on the server.
- Include all participants (players + monsters) in a single initiative order.
- Provide hold/delay/pass/ready semantics so players can delay and act after others.
- Resolve dice, hits, damage, HP, status effects server-side to avoid LLM token usage.
- Use the LLM only for short narration or decision-only guidance (small prompts + caching).

---

## Core Concepts

Combatant
- id: string (characterId or dynamicNpcId or monsterId prefixed)
- name: string
- controller: 'player' | 'monster' | 'dm'
- initiativeRoll: number (1-20)
- initiativeMod: number
- initiativeTotal: number
- ac: number
- currentHp: number
- maxHp: number
- statusEffects: Array<{ name: string; duration?: string }>
- held?: { type: 'until', triggerActorId?: string } | { type: 'endOfRound' }
- metadata: any (attack definitions, statblock, CR, legendaryActions)

CombatState
- roomCode: string
- isActive: boolean
- roundNumber: number
- currentTurnIndex: number
- combatants: Combatant[]
- actionHistory: Array<CombatActionResult>
- environment: EnvironmentFeature[] // terrain features, cover, difficult terrain, high ground

EnvironmentFeature
- id: string
- type: 'cover' | 'difficult' | 'high_ground' | 'hazard'
- position: { x: number; y: number }
- radius: number // area of effect / size
- properties: { coverBonus?: number; concealment?: number; movementCostMultiplier?: number }

Notes:
- Environment features are stored in the `CombatState.environment` array and used by the combat engine for line-of-sight, cover checks, movement cost calculations, and AI decision making.
- The AI DM can propose or auto-generate a `combat stage` (e.g., forest with fallen logs, ruined wall, wide river), which is translated into `EnvironmentFeature` items. The server uses these features deterministically (no LLM needed to evaluate cover or movement), and the LLM is only used to suggest or narrate stage details (decision-only, low tokens).

Action model (client -> server)
- { type: 'attack' | 'cast' | 'move' | 'ready' | 'hold' | 'pass', actorId, targetIds?, payload? }

Action result (server -> clients)
- { type: 'combat_result', actorId, targetId?, attackRoll?: number, attackTotal?: number, hit: boolean, damageRolls?: number[], damageTotal?: number, newHp?: number, narration?: string }

---

## Initiative rules
- Roll d20 + initiativeMod for all combatants (players and monsters).
- Sort by initiativeTotal desc.
- Tie-breaks: higher dex > higher level/CR > random tie-breaker.
- Store base initiative order and allow temporary reordering for held/delayed actions.

Hold/Delay/Pass/Ready semantics
- Hold (delay) until another actor's turn or until end of round: stored as `held` with trigger.
- When trigger occurs, held actor is inserted immediately after the trigger actor for remainder of round.
- Pass = end actor's turn for this round.
- Ready = define a trigger (e.g., "when Goblin enters melee range"), server resolves the trigger and executes the ready action.

---

## LLM usage (minimal)
- Narration: describe results in 1-2 short sentences. Use small prompts with low `max_tokens` and cache outputs.
- Decision-only: for bosses or complex NPCs, ask LLM for an action label (not dice or resolution). Server performs rolls.
- Avoid: LLM rolling dice or applying damage, HP, or state changes.
- Batch narration per round (aggregate N turns before calling LLM for a short summary) where possible.

---

## API Contract (server <-> clients)

POST /api/rooms/:code/combat/start
- Body: optional { monsters?: [{ name, count?, templateId? }], encounterOptions?: {...} }
- Server: populates combatants (players + monsters), rolls initiative, stores CombatState, broadcasts init order and starting scene.
- Response: { success: true, initiatives: [ { id, name, controller, initiativeTotal } ] }

POST /api/rooms/:code/combat/action
- Body: { action: Action }
- Server: validates it's actor's turn (or a ready/trigger), resolves action deterministically, updates CombatState, broadcasts CombatActionResult objects to listeners.

POST /api/rooms/:code/combat/hold
- Body: { actorId, holdType: 'until'|'endOfRound', triggerActorId?: string }
- Server: mark actor as held with trigger.

POST /api/rooms/:code/combat/pass
- Body: { actorId }
- Server: end actor's turn; advance to next active combatant.

GET /api/rooms/:code/combat/state
- Response: current CombatState for UI (sanitize secrets).

POST /api/rooms/:code/combat/ai-strategy (optional)
- Body: { roomCode, maxActions?: number }
- Server: asks LLM for decision-only plan for monsters (low tokens). Returns action labels.

---

## Acceptance Criteria
- Initiative includes all combatants and is deterministic with tie-breaks.
- Players can hold/delay and act at the specified trigger point.
- Server resolves hp, damage, and status effects without LLM involvement.
- LLM is used only for short narration or decision-only strategy calls with caching and low token counts.
- Unit / integration tests demonstrate deterministic behavior.

---

## Migration notes
- Update `/api/rooms/:code/combat/start` to call engine functions that produce `CombatState`.
- Add `/api/rooms/:code/combat/action` and other control endpoints.
- Feature-flag the new engine so we can roll out gradually while monitoring token usage.

---

## Appendix - Example Turn Flow
1. Player A's turn starts (server broadcasts). UI shows End/Pass/Hold.
2. Player A chooses to Hold until after Player B -> server marks Player A as held.
3. A couple of NPCs act, then Player B acts.
4. When Player B's turn ends, server detects triggers and inserts Player A immediately after Player B for the remaining of the round.


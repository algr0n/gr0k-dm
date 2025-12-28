# Non-Combat Spell Effects (Room/Objects/NPCs)

This document describes the new non-combat spell effect flow implemented to allow spells to apply status effects, buffs, or utility interactions without forcing the room into combat.

## Server

Endpoint: `POST /api/rooms/:code/spells/apply`

Request body:
- `casterId` (optional) - saved character id of the caster
- `spellText` (string, required) - spell description or name (used for inference)
- `targets` (optional array) - list of targets, each with `type` (`character`|`object`|`room`) and `ids` (for `character`)
- `duration` (optional) - human-readable duration string
- `isLoud` (optional boolean) - if true, DM may optionally start combat

Behavior:
- Parses `spellText` with `inferSpellEffects` to detect save requirements, tags, or inferred damage
- Applies status effects to characters via `character_status_effects`
- Applies environment/object/room-level effects via `room_status_effects`
- Broadcasts `spell_applied` WS message to room to notify clients
- Does NOT start combat automatically unless explicitly flagged (e.g., `isLoud`)

## Client

- In the Cast Spell dialog you can check **Apply outside combat** to apply a spell to a target without starting combat
- If a target is selected, the spell will be applied to that character; otherwise it will default to room-level effects
- Clients listen for `spell_applied` WS events to refresh relevant data (characters, NPCs, room) and display a toast

## Notes & Next Steps
- The basic inference engine (`shared/spell-text.ts`) provides `saveAbility`, `onSuccess`, `damageExpression`, and `tags` which we persist as `metadata` on room effects
- Future work: support object manipulation (Mage Hand) with object IDs and richer metadata, add optional auto-combat triggering for loud spells, and add automated expiry of timed room effects

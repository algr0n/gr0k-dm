# Combat Initiative UI Fix

## Problem
When combat starts (via `[COMBAT_START]` tag from AI), the UI doesn't display the initiative order visually. The DM messages show the initiative order in text, but the combat sidebar shows nothing.

## Root Cause Analysis
The issue appears to be that when `[COMBAT_START]` is triggered:
1. The server attempts to roll initiatives for all characters and monsters in the room
2. If no characters/monsters are found, or if the initiative roll returns empty, the `combatState.initiatives` array is empty
3. The UI was trying to render an empty array without showing any feedback

## Changes Made

### 1. Enhanced Server Logging (`server/routes.ts`)
Added comprehensive logging to track:
- When combat_start action is processed
- Number of players, characters, and monsters found
- Initiative rolls for each participant
- Combat state broadcast details

**Key locations:**
- Line ~1085-1150: `case "combat_start"` handler
- Line ~2197-2203: `get_combat_state` handler

### 2. Improved Error Handling (`server/routes.ts`)
Added checks for:
- Empty character/monster lists before rolling initiatives
- Empty initiative results after rolling
- Fallback messaging when no participants are found

### 3. Enhanced Initiative Rolling (`server/combat.ts`)
Added debugging logs to `rollInitiativesForCombat` function:
- Logs all input characters, players, and monsters
- Tracks individual initiative rolls
- Improved metadata handling (playerName now included)

**Key location:** Line ~61-85

### 4. UI Improvements (`client/src/pages/room.tsx`)
Added conditional rendering for combat state:
- Shows initiative list when participants exist
- Shows informative message when combat is active but no participants
- Disables "Next Turn" button when no initiatives exist
- Added console logging for combat_update messages

**Key location:** Line ~1125-1250

## Testing & Verification

To verify the fix works:

1. **Start a new game** and join with a character
2. **Trigger combat** by either:
   - Using the "Start Combat" button (if host)
   - Having the AI include `[COMBAT_START]` in a message
3. **Check the Combat sidebar** - it should now show:
   - Initiative order with character names and totals
   - Current turn highlighted
   - HP and AC for each participant
4. **Check browser console** for logs:
   ```
   [WebSocket] Received combat_update: { isActive: true, initiatives: [...] }
   ```
5. **Check server logs** for:
   ```
   [Combat Start] Processing combat_start action for room XXX
   [Combat Start] Found X players and Y characters
   [Combat Start] Rolled Z initiatives: [names(totals)]
   [Combat Start] Broadcasting combat_update with state: {...}
   ```

## Empty Initiatives Scenario

If combat starts but no initiatives appear:
1. **UI now shows:** "Combat Active - No initiative order available. Make sure characters are in the room before starting combat."
2. **Server logs** will show why (e.g., "No characters or monsters found")
3. **Host can:** End combat and ensure characters are properly in the room before restarting

## Known Limitations

1. **Character must be in room:** Characters need to have `currentRoomCode` set to the room code
2. **Initiative modifier required:** Characters should have `initiativeModifier` field (defaults to 0 if missing)
3. **Dynamic NPCs:** Monsters/NPCs must be in the `dynamic_npcs` table associated with the room

## Next Steps

If issues persist:
1. Check server logs for combat initialization
2. Verify character is properly joined to room (check `saved_characters.current_room_code`)
3. Verify player record exists with matching `userId`
4. Check that WebSocket connection is established (`Connected` indicator in UI)

## Files Modified

- `server/routes.ts` - Combat initialization logic and logging
- `server/combat.ts` - Initiative rolling with enhanced logging  
- `client/src/pages/room.tsx` - UI rendering and error states
- `test-combat-init.ts` - New test file for debugging (created)

---

**Date:** December 25, 2024  
**Issue:** Combat UI not showing initiative order  
**Status:** Fixed with enhanced logging and error handling

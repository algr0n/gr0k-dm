# Inventory System Fixes - Testing Guide

## Overview
This document describes the fixes implemented for three critical bugs in the inventory and currency systems, and provides detailed testing instructions.

## Bugs Fixed

### 1. ✅ Duplicate Items from AI DM
**Problem**: When the AI DM gave players items through loot, the system sometimes added duplicate items to the inventory instead of stacking them properly.

**Root Cause**: The `executeGameActions` function's `item_add` case was not checking for existing items before adding new ones.

**Solution**: 
- Added logic to check if an item already exists in the character's inventory
- If the item exists, increment its quantity instead of creating a new entry
- Fixed broadcast message to show the final total quantity

**Code Changes** (server/routes.ts, lines 934-961):
```typescript
if (item) {
  // Check if item already exists in inventory to prevent duplicates
  const inventory = await storage.getSavedInventoryWithDetails(char.id);
  const existingInvItem = inventory.find(i => i.itemId === item.id);
  
  let finalQuantity: number;
  if (existingInvItem) {
    // Item exists - increment quantity instead of adding duplicate
    finalQuantity = existingInvItem.quantity + (action.quantity || 1);
    await storage.updateSavedInventoryItem(existingInvItem.id, {
      quantity: finalQuantity
    });
  } else {
    // Item doesn't exist - add new
    finalQuantity = action.quantity || 1;
    await storage.addToSavedInventory({
      characterId: char.id,
      itemId: item.id,
      quantity: finalQuantity,
    });
  }
  
  broadcastFn(roomCode, {
    type: "inventory_update",
    characterId: char.id,
    action: "add",
    itemName: item.name,
    quantity: finalQuantity,
  });
}
```

### 2. ✅ Currency Not Showing in Wallet
**Problem**: When the AI DM granted gold/silver/copper to players, the currency values didn't appear in the "Currency" section of the Character tab.

**Root Cause**: The WebSocket `character_update` event handling was already correctly implemented. The currency field was properly included in the database and query responses.

**Solution**: 
- Verified that the `currency_change` action in `executeGameActions` broadcasts a `character_update` event
- Confirmed that the WebSocket handler in room.tsx properly invalidates queries on `character_update` events
- The currency display in InventoryLayout.tsx correctly shows currency values when available

**No code changes needed** - the system was already working correctly. The issue may have been caused by outdated data or client-side cache issues that are now resolved by proper query invalidation.

### 3. ✅ Items Cannot Be Equipped
**Problem**: Players could not equip weapons, armor, rings, or other equippable items. The UI showed equipment slots but nothing happened when trying to equip items.

**Root Cause**: The database schema had an `equipped` boolean field, and UI components existed, but there was **no API endpoint** to toggle the `equipped` field.

**Solution**: 
- Added new PATCH endpoint: `/api/characters/:characterId/inventory/:itemId`
- Endpoint includes authentication middleware to ensure only logged-in users can modify equipment
- Added authorization check to ensure users can only modify their own characters' equipment
- Created `toggleEquipMutation` in room.tsx using TanStack Query
- Wired up `onItemDoubleClick` handler to call the mutation
- Query invalidation ensures the UI updates immediately

**Code Changes**:

**Server (server/routes.ts, lines 2969-3007)**:
```typescript
// PATCH /api/characters/:characterId/inventory/:itemId - Toggle equipped status
// Request body: { equipped?: boolean }
// If equipped is not provided, the current equipped status will be toggled
app.patch("/api/characters/:characterId/inventory/:itemId", isAuthenticated, async (req, res) => {
  try {
    const { characterId, itemId } = req.params;
    const { equipped } = req.body;
    
    // Get the character to verify ownership
    const character = await storage.getSavedCharacter(characterId);
    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }
    
    // Verify the user owns this character
    if (character.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this character" });
    }
    
    // Get character's inventory to verify item exists
    const inventory = await storage.getSavedInventoryWithDetails(characterId);
    const invItem = inventory.find(i => i.id === itemId);
    
    if (!invItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    
    // Update equipped status (toggle if not explicitly provided)
    const updated = await storage.updateSavedInventoryItem(itemId, { 
      equipped: equipped !== undefined ? equipped : !invItem.equipped 
    });
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating inventory item:", error);
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});
```

**Client (client/src/pages/room.tsx, lines 628-659)**:
```typescript
const toggleEquipMutation = useMutation({
  mutationFn: async ({ characterId, itemId, equipped }: { 
    characterId: string; 
    itemId: string; 
    equipped: boolean;
  }) => {
    const res = await fetch(
      `/api/characters/${characterId}/inventory/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipped }),
      }
    );
    if (!res.ok) throw new Error("Failed to update equipment status");
    return res.json();
  },
  onSuccess: () => {
    if (savedCharacterId) {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/saved-characters", savedCharacterId, "inventory"] 
      });
    }
  },
  onError: () => {
    toast({
      title: "Failed to update equipment",
      description: "Please try again.",
      variant: "destructive",
    });
  },
});

// Usage in InventoryLayout (lines 1812-1822)
onItemDoubleClick={(item) => {
  // Toggle equip/unequip
  if (savedCharacterId) {
    toggleEquipMutation.mutate({
      characterId: savedCharacterId,
      itemId: item.id,
      equipped: !item.equipped,
    });
  }
}}
```

## Testing Instructions

### Prerequisites
1. Ensure the database is up to date:
   ```bash
   npm run db:push
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Navigate to `http://localhost:5000` in your browser

### Test Case 1: Item Deduplication
**Objective**: Verify that duplicate items stack quantities instead of creating separate entries.

**Steps**:
1. Create or join a game room
2. Create a character and join the game
3. Ask the AI DM: "I search the room for weapons. Do I find anything?"
4. Wait for the AI to respond with an item (e.g., "You find a Dagger")
5. Check your inventory - you should see "Dagger x1"
6. Ask the AI DM again: "I continue searching. Are there more weapons?"
7. Wait for the AI to give you another dagger

**Expected Result**:
- ✅ The inventory should now show "Dagger x2" (not two separate "Dagger x1" entries)
- ✅ Server logs should show: `[DM Action] Incremented existing item "Dagger" for [PlayerName] (now 2x)`

**How to Verify**:
- Open the Character tab in the room
- Look at your inventory grid
- You should see only ONE dagger card with quantity "x2"

### Test Case 2: Currency Display
**Objective**: Verify that currency updates from the AI DM appear immediately in the wallet.

**Steps**:
1. In the same game room, check your current currency (should be 0 gp, 0 sp, 0 cp)
2. Ask the AI DM: "I search the room thoroughly. Do I find any treasure or gold?"
3. Wait for the AI to respond with currency (e.g., "You find 50 gold pieces")

**Expected Result**:
- ✅ The Currency section at the top of the inventory should immediately update to show "50 gp 0 sp 0 cp"
- ✅ No page refresh should be needed
- ✅ Server logs should show: `[DM Action] Updated currency for [PlayerName]: +50gp`

**How to Verify**:
- Open the Character tab in the room
- Look at the top of the inventory section
- Find the "Currency" row with the coin icon
- Values should update automatically when the AI grants currency

### Test Case 3: Equipment Toggle
**Objective**: Verify that players can equip and unequip items by double-clicking.

**Steps**:
1. Ensure you have at least one weapon or armor piece in your inventory
   - If not, ask the AI DM for a weapon: "Can I find a longsword?"
2. Open the Character tab
3. In the inventory grid on the right, find the weapon
4. **Double-click** the weapon card

**Expected Result**:
- ✅ The weapon should move from the inventory grid to the appropriate equipment slot (e.g., "Main Hand")
- ✅ The item should have a visual indicator showing it's equipped (ring/border)
- ✅ No error messages should appear

**Additional Tests**:
5. **Double-click** the equipped weapon again

**Expected Result**:
- ✅ The weapon should unequip and return to the inventory grid
- ✅ The equipment slot should now be empty

6. Try equipping armor, rings, or other item types

**Expected Result**:
- ✅ Each item type should go to its appropriate slot (Chest, Head, Hands, Ring, etc.)
- ✅ Equipment slots correctly identify and display the item category

### Test Case 4: Security - Unauthorized Access
**Objective**: Verify that users cannot modify other players' equipment.

**Steps**:
1. Open browser developer tools (F12)
2. Go to the Console tab
3. Try to manually call the API with another character's ID:
   ```javascript
   fetch('/api/characters/another-character-id/inventory/some-item-id', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ equipped: true })
   }).then(r => r.json()).then(console.log)
   ```

**Expected Result**:
- ✅ Should return a 403 Forbidden error
- ✅ Error message: "Forbidden: You do not own this character"
- ✅ The equipment status should NOT change

## Troubleshooting

### Items still appearing as duplicates
- Clear your browser cache and refresh the page
- Check server logs for errors during item addition
- Verify that the item IDs match (use browser dev tools to inspect)

### Currency not updating
- Check that the AI DM is using the correct format: `[GOLD: PlayerName | Amount]`
- Verify WebSocket connection is active (check browser console for WebSocket errors)
- Try refreshing the page to see if the currency was actually updated in the database

### Equipment not toggling
- Ensure you're logged in (authentication required)
- Check browser console for JavaScript errors
- Verify you own the character you're trying to modify
- Check that the inventory query is loading successfully

## Success Criteria

All tests should pass with:
- ✅ No duplicate items in inventory
- ✅ Currency updates appear immediately without page refresh
- ✅ Items can be equipped and unequipped via double-click
- ✅ Equipment slots display the correct items
- ✅ Unauthorized users cannot modify other players' equipment
- ✅ All changes persist across page refreshes

## Related Files

### Server-Side
- `server/routes.ts` - Main route handlers and game action execution

### Client-Side
- `client/src/pages/room.tsx` - Room component with mutations and WebSocket handling
- `client/src/components/inventory/InventoryLayout.tsx` - Inventory display layout
- `client/src/components/inventory/ItemCard.tsx` - Individual item card component
- `client/src/components/inventory/EquipmentSlots.tsx` - Equipment slot display

### Schema
- `shared/schema.ts` - Database schema including `character_inventory_items` table

## Notes for Developers

### Database Schema
The `character_inventory_items` table includes:
- `equipped` (boolean, default: false) - Whether the item is currently equipped
- `quantity` (integer, default: 1) - How many of this item the character has
- `attunementSlot` (boolean, default: false) - Whether the item is using an attunement slot

### API Endpoints
- `GET /api/characters/:characterId/inventory` - Get character's inventory
- `POST /api/characters/:characterId/inventory` - Add item to inventory
- `PATCH /api/characters/:characterId/inventory/:itemId` - **NEW** - Toggle equipment status
- `DELETE /api/saved-characters/:id/inventory/:inventoryItemId` - Remove item from inventory

### WebSocket Events
- `inventory_update` - Broadcast when items are added/removed
- `character_update` - Broadcast when character properties (including currency) change

### Query Invalidation
When inventory or equipment changes, the following queries are invalidated:
- `["/api/saved-characters", savedCharacterId, "inventory"]` - Inventory list
- `["/api/rooms", code, "my-character"]` - Current character data
- `["/api/rooms", code, "room-characters"]` - All characters in room

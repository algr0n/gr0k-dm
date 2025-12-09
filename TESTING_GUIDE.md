# Manual Testing Guide for Inventory System Fix

## Prerequisites

1. Database must be initialized with schema:
   ```bash
   npm run db:push
   ```

2. Starting items must be seeded:
   ```bash
   npx tsx server/seed-starting-items.ts
   ```

## Test Cases

### Test 1: Verify Starting Items Seed

**Objective**: Ensure all required starting items exist in the database.

**Steps**:
1. Run the seed script:
   ```bash
   npx tsx server/seed-starting-items.ts
   ```

2. **Expected Output**:
   ```
   Seeding core D&D starting items...
   ✓ Seeded 17 starting items (0 already existed)
   Core starting items are now available for character creation!
   Seed completed successfully
   ```

3. Run it again to test idempotency:
   ```bash
   npx tsx server/seed-starting-items.ts
   ```

4. **Expected Output** (second run):
   ```
   Seeding core D&D starting items...
   ✓ Seeded 0 starting items (17 already existed)
   Core starting items are now available for character creation!
   Seed completed successfully
   ```

### Test 2: Create Character with Starting Items (Success Case)

**Objective**: Verify that character creation grants starting items successfully.

**Steps**:
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5000` in your browser

3. Log in or create an account

4. Navigate to the Characters page

5. Click "Create New Character"

6. Fill in character details:
   - Name: "Test Wizard"
   - Class: "Wizard"
   - Race: "Human"
   - Level: 1

7. Submit the character creation form

**Expected Behavior**:
- Character is created successfully
- Server logs show:
  ```
  [grantStartingItems] Granting starting items { savedCharacterId: '...', gameSystem: 'dnd', characterClass: 'wizard', itemCount: 7 }
  [addToSavedInventory] Adding new inventory item { characterId: '...', characterName: 'Test Wizard', itemId: 'quarterstaff', itemName: 'Quarterstaff', quantity: 1 }
  [addToSavedInventory] Adding new inventory item { characterId: '...', characterName: 'Test Wizard', itemId: 'dagger', itemName: 'Dagger', quantity: 1 }
  ...
  ```
- Character inventory contains:
  - Quarterstaff (1)
  - Dagger (1)
  - Backpack (1)
  - Component Pouch (1)
  - Rations (5)
  - Waterskin (1)
  - Torch (5)

### Test 3: Missing Item Error (Failure Case)

**Objective**: Verify error handling when an item is missing from the database.

**Steps**:
1. Manually remove an item from the database (or modify dndStartingItems to reference a non-existent item):
   ```sql
   DELETE FROM items WHERE id = 'backpack';
   ```

2. Try to create a new character (e.g., Fighter)

**Expected Behavior**:
- Character creation fails gracefully
- Server logs show clear error:
  ```
  [addToSavedInventory] Item not found in items table: backpack {
    characterId: '...',
    characterName: 'Test Fighter',
    itemId: 'backpack',
    quantity: 1
  }
  [grantStartingItems] Failed to add starting item {
    savedCharacterId: '...',
    characterClass: 'fighter',
    itemId: 'backpack',
    quantity: 1,
    error: 'Item not found in items table: backpack'
  }
  ```
- Error message is clear and actionable
- Character may be created but missing the item (depending on transaction handling)

### Test 4: Invalid Character ID (Failure Case)

**Objective**: Verify error handling when characterId doesn't exist.

**Steps**:
1. In the browser console or via API, attempt to add an item to a non-existent character:
   ```javascript
   fetch('/api/characters/nonexistent-id-123/inventory', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ itemId: 'dagger', quantity: 1 })
   })
   ```

**Expected Behavior**:
- Request fails with appropriate HTTP status (404 or 400)
- Server logs show:
  ```
  [addToSavedInventory] Character not found: nonexistent-id-123 {
    characterId: 'nonexistent-id-123',
    itemId: 'dagger',
    quantity: 1
  }
  ```

### Test 5: Duplicate Item Quantity Increment

**Objective**: Verify that adding an item that already exists increments the quantity.

**Steps**:
1. Create a character with starting items
2. Manually add an item that the character already has (e.g., add another dagger)

**Expected Behavior**:
- Server logs show:
  ```
  [addToSavedInventory] Incrementing existing inventory item {
    characterId: '...',
    characterName: 'Test Wizard',
    itemId: 'dagger',
    itemName: 'Dagger',
    previousQuantity: 1,
    addedQuantity: 1,
    newQuantity: 2
  }
  ```
- Character inventory shows Dagger (2)

## Success Criteria

All tests should pass with:
- ✅ Clear, structured logging in all cases
- ✅ Descriptive error messages that identify the problem
- ✅ No foreign key constraint errors
- ✅ Proper quantity increments for duplicate items
- ✅ Idempotent seed script

## Troubleshooting

### "Item not found in items table" errors

**Solution**: Run the starting items seed:
```bash
npx tsx server/seed-starting-items.ts
```

### "Character not found" errors

**Cause**: Race condition or invalid character ID being passed to grantStartingItems

**Solution**: Verify the character is created before calling grantStartingItems

### Foreign key constraint errors

**Cause**: Items or characters don't exist in their respective tables

**Solution**: 
1. Check that seed script has been run
2. Review server logs for detailed error context
3. Validate characterId and itemId exist before calling addToSavedInventory

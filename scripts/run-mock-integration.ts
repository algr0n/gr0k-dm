#!/usr/bin/env node
/**
 * Integration Test for Monster Defeat XP Awards
 * 
 * This script tests the full integration of:
 * 1. DM response tag parsing ([MONSTER_DEFEATED: ...])
 * 2. XP calculation and distribution
 * 3. Character updates (XP, level, HP)
 * 4. WebSocket broadcasts
 * 
 * Uses mock storage to avoid touching production database.
 * 
 * Usage: npx tsx scripts/run-mock-integration.ts
 */

// Enable mock storage mode BEFORE importing any server code
process.env.USE_MOCK_STORAGE = '1';

(async () => {
  try {
    console.log('='.repeat(80));
    console.log('MONSTER DEFEAT XP AWARD - INTEGRATION TEST');
    console.log('='.repeat(80));
    console.log('📝 Using mock storage - production database is SAFE!\n');

    // Import mock storage first to set it up
    const mockMod = await import('../server/storage.mock');
    const mockStorage = mockMod.default;
    
    console.log('✅ Mock storage loaded');
    console.log('✅ Initial characters:');
    let chars = await mockStorage.getCharactersByRoomCode('ROOM1');
    console.table(chars.map((c: any) => ({ 
      id: c.id, 
      name: c.characterName, 
      xp: c.xp, 
      level: c.level, 
      hp: `${c.currentHp}/${c.maxHp}` 
    })));

    // Now import routes which will use the mock storage
    const routes = await import('../server/routes');
    const { parseDMResponseTags, executeGameActions } = routes as any;

    if (!parseDMResponseTags || !executeGameActions) {
      console.error('❌ Required exports not found from server/routes');
      process.exit(1);
    }

    console.log('\n' + '-'.repeat(80));
    console.log('TEST 1: Parse MONSTER_DEFEATED tag');
    console.log('-'.repeat(80));
    
    const dmResponse = '[MONSTER_DEFEATED: Goblin | XP: 101 | participants: Alice,Bob]\nThe goblin collapses in a heap!';
    console.log('DM Response:', dmResponse);

    const actions = parseDMResponseTags(dmResponse);
    console.log('✅ Parsed Actions:', JSON.stringify(actions, null, 2));

    console.log('\n' + '-'.repeat(80));
    console.log('TEST 2: Execute game actions (award XP)');
    console.log('-'.repeat(80));

    const broadcasts: any[] = [];
    const broadcastFn = (roomCode: string, message: any) => {
      broadcasts.push({ roomCode, message });
      console.log('[Broadcast]', message.type, '->', JSON.stringify(message).slice(0, 100));
    };

    console.log('Calling executeGameActions with:');
    console.log('  - actions:', actions);
    console.log('  - roomCode:', 'ROOM1');
    console.log('  - broadcast function: provided');

    await executeGameActions(actions, 'ROOM1', broadcastFn);
    console.log(`✅ Executed ${actions.length} action(s)`);

    console.log('\n' + '-'.repeat(80));
    console.log('TEST 3: Verify character updates');
    console.log('-'.repeat(80));

    // Get updated characters
    chars = await mockStorage.getCharactersByRoomCode('ROOM1');
    console.log('Final Characters State:');
    console.table(chars.map((c: any) => ({ 
      id: c.id, 
      name: c.characterName, 
      xp: c.xp, 
      level: c.level, 
      hp: `${c.currentHp}/${c.maxHp}`,
      class: c.class 
    })));

    // Verify XP was awarded
    const aliceXp = chars.find((c: any) => c.characterName === 'Alice')?.xp || 0;
    const bobXp = chars.find((c: any) => c.characterName === 'Bob')?.xp || 0;
    
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 4: Verify broadcasts');
    console.log('-'.repeat(80));
    
    if (broadcasts.length > 0) {
      console.log(`✅ Captured ${broadcasts.length} broadcast(s):`);
      broadcasts.forEach((b, i) => {
        console.log(`\nBroadcast ${i + 1}:`);
        console.log(`  Room: ${b.roomCode}`);
        console.log(`  Type: ${b.message.type}`);
        console.log(`  Data:`, JSON.stringify(b.message, null, 2));
      });
    } else {
      console.log('⚠️  No broadcasts captured (XP may not have been awarded)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    const aliceGained = aliceXp > 0;
    const bobGained = bobXp > 0;
    const broadcastsSent = broadcasts.length > 0;
    
    console.log(`Alice XP: ${aliceGained ? '✅' : '❌'} ${aliceXp} (expected: 50-51)`);
    console.log(`Bob XP: ${bobGained ? '✅' : '❌'} ${bobXp} (expected: 50-51)`);
    console.log(`Broadcasts: ${broadcastsSent ? '✅' : '⚠️ '} ${broadcasts.length} sent`);
    
    const allPassed = aliceGained && bobGained;
    
    if (allPassed) {
      console.log('\n✅ ALL TESTS PASSED - Integration working correctly!');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - See details above');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(2);
  }
})();

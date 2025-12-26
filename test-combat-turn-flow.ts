/**
 * Test Combat Turn Flow (No DB)
 * 
 * This test simulates the combat turn logic to identify issues with NPC turn advancement.
 */

// Mock combat state structure
interface InitiativeEntry {
  id: string;
  name: string;
  initMod: number;
  roll: number;
  total: number;
  controller: 'player' | 'monster';
  ac?: number;
  currentHp?: number;
  maxHp?: number;
  metadata?: {
    attackBonus?: number;
    damageExpression?: string;
  };
}

interface CombatState {
  isActive: boolean;
  currentTurnIndex: number;
  roundNumber: number;
  initiatives: InitiativeEntry[];
}

// Mock advanceTurn function (copied from combat.ts)
function advanceTurn(state: CombatState): string | null {
  if (!state) return null;
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.initiatives.length;
  if (state.currentTurnIndex === 0) {
    state.roundNumber = (state.roundNumber || 1) + 1;
  }
  return state.initiatives[state.currentTurnIndex]?.id;
}

// Mock NPC turn processing
const npcTurnProcessing = new Set<string>();
const processingLog: string[] = [];

async function triggerNpcTurnIfNeeded(roomCode: string, state: CombatState, depth = 0): Promise<void> {
  if (depth > 10) {
    processingLog.push(`[ERROR] Max recursion depth reached!`);
    return;
  }

  if (!state || !state.isActive) {
    processingLog.push(`[${roomCode}] Combat not active, skipping`);
    return;
  }

  const currentActor = state.initiatives[state.currentTurnIndex];
  if (!currentActor) {
    processingLog.push(`[${roomCode}] No current actor, skipping`);
    return;
  }

  processingLog.push(`[${roomCode}] Current turn: ${currentActor.name} (${currentActor.controller}), index: ${state.currentTurnIndex}`);

  // Check if current actor is a monster/NPC
  if (currentActor.controller === 'monster') {
    // Prevent concurrent execution
    if (npcTurnProcessing.has(roomCode)) {
      processingLog.push(`[${roomCode}] NPC turn already processing, skipping`);
      return;
    }

    npcTurnProcessing.add(roomCode);
    processingLog.push(`[${roomCode}] Processing NPC turn: ${currentActor.name}`);

    try {
      // Simulate NPC action
      processingLog.push(`[${roomCode}] ${currentActor.name} attacks!`);

      // Simulate the setTimeout delay
      await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 2000ms for testing

      // Check if still the same NPC's turn
      const currentState = state;
      if (!currentState || !currentState.isActive) {
        processingLog.push(`[${roomCode}] Combat ended during NPC turn`);
        npcTurnProcessing.delete(roomCode);
        return;
      }

      const actor = currentState.initiatives[currentState.currentTurnIndex];
      if (actor && actor.id === currentActor.id) {
        processingLog.push(`[${roomCode}] Advancing turn from ${currentActor.name}`);
        
        // Still the same NPC's turn, advance it
        const prevActorId = actor.id;
        const nextActorId = advanceTurn(currentState);
        
        processingLog.push(`[${roomCode}] Advanced to index ${currentState.currentTurnIndex}, next actor: ${state.initiatives[state.currentTurnIndex]?.name}`);

        // Clear processing flag BEFORE recursive call
        npcTurnProcessing.delete(roomCode);
        processingLog.push(`[${roomCode}] Cleared processing flag for ${currentActor.name}`);

        // Check if next actor is also an NPC (recursive call)
        await triggerNpcTurnIfNeeded(roomCode, currentState, depth + 1);
      } else {
        processingLog.push(`[${roomCode}] Turn changed externally, not advancing`);
        npcTurnProcessing.delete(roomCode);
      }
    } catch (err) {
      processingLog.push(`[${roomCode}] ERROR: ${err}`);
      npcTurnProcessing.delete(roomCode);
      
      // Auto-advance even on error
      advanceTurn(state);
      await triggerNpcTurnIfNeeded(roomCode, state, depth + 1);
    }
  } else {
    processingLog.push(`[${roomCode}] Current actor is player (${currentActor.name}), waiting for player action`);
  }
}

// Test function
async function testCombatFlow() {
  console.log('\n=== COMBAT TURN FLOW TEST ===\n');

  // Create test combat state matching your scenario
  const combatState: CombatState = {
    isActive: true,
    currentTurnIndex: 0,
    roundNumber: 1,
    initiatives: [
      {
        id: 'npc1',
        name: 'Snarling Bandit 1',
        initMod: 2,
        roll: 19,
        total: 21,
        controller: 'monster',
        ac: 13,
        currentHp: 8,
        maxHp: 11,
        metadata: {
          attackBonus: 3,
          damageExpression: '1d6+1'
        }
      },
      {
        id: 'player1',
        name: 'tes',
        initMod: 0,
        roll: 12,
        total: 12,
        controller: 'player',
        ac: 10,
        currentHp: 2,
        maxHp: 7
      },
      {
        id: 'npc2',
        name: 'Snarling Bandit 2',
        initMod: 2,
        roll: 0,
        total: 2,
        controller: 'monster',
        ac: 13,
        currentHp: 11,
        maxHp: 11,
        metadata: {
          attackBonus: 3,
          damageExpression: '1d6+1'
        }
      }
    ]
  };

  console.log('Initial state:');
  console.log(JSON.stringify(combatState, null, 2));
  console.log('\n--- Starting Combat Simulation ---\n');

  // Simulate combat start - NPC 1 goes first
  await triggerNpcTurnIfNeeded('TEST_ROOM', combatState);
  
  console.log('\n--- After NPC 1 Turn ---');
  console.log(`Current turn index: ${combatState.currentTurnIndex}`);
  console.log(`Current actor: ${combatState.initiatives[combatState.currentTurnIndex].name}`);

  // Simulate player action
  console.log('\n--- Player Takes Turn ---');
  processingLog.push('[TEST_ROOM] Player action received');
  advanceTurn(combatState);
  processingLog.push(`[TEST_ROOM] Advanced to ${combatState.initiatives[combatState.currentTurnIndex].name}`);
  
  console.log(`Current turn index: ${combatState.currentTurnIndex}`);
  console.log(`Current actor: ${combatState.initiatives[combatState.currentTurnIndex].name}`);

  // Trigger NPC 2 turn
  console.log('\n--- Triggering NPC 2 Turn ---');
  await triggerNpcTurnIfNeeded('TEST_ROOM', combatState);

  console.log('\n--- Final State ---');
  console.log(`Current turn index: ${combatState.currentTurnIndex}`);
  console.log(`Current actor: ${combatState.initiatives[combatState.currentTurnIndex].name}`);
  console.log(`Round: ${combatState.roundNumber}`);

  // Print full log
  console.log('\n=== FULL PROCESSING LOG ===\n');
  processingLog.forEach(log => console.log(log));

  // Check for issues
  console.log('\n=== DIAGNOSTICS ===\n');
  const processingCount = npcTurnProcessing.size;
  if (processingCount > 0) {
    console.log(`⚠️  WARNING: ${processingCount} room(s) still marked as processing!`);
    console.log('Rooms:', Array.from(npcTurnProcessing));
  } else {
    console.log('✅ All processing flags cleared correctly');
  }

  const recursionLogs = processingLog.filter(log => log.includes('Triggering NPC') || log.includes('Processing NPC'));
  console.log(`\nNPC turn triggers: ${recursionLogs.length}`);
  
  const advanceLogs = processingLog.filter(log => log.includes('Advancing turn') || log.includes('Advanced to'));
  console.log(`Turn advances: ${advanceLogs.length}`);
}

// Run test
testCombatFlow().then(() => {
  console.log('\n=== TEST COMPLETE ===\n');
}).catch(err => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
});

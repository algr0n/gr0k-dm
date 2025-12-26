/**
 * Test Combat Error Handling
 * 
 * This test simulates error scenarios that might cause NPC turns to hang.
 */

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

function advanceTurn(state: CombatState): string | null {
  if (!state) return null;
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.initiatives.length;
  if (state.currentTurnIndex === 0) {
    state.roundNumber = (state.roundNumber || 1) + 1;
  }
  return state.initiatives[state.currentTurnIndex]?.id;
}

const npcTurnProcessing = new Set<string>();
const processingLog: string[] = [];

// Simulate different error scenarios
const errorScenarios = {
  roomLookupFails: false,
  aiGenerationFails: false,
  attackResolutionFails: false,
};

async function triggerNpcTurnIfNeeded(
  roomCode: string,
  state: CombatState,
  getRoomByCode: (code: string) => Promise<any>,
  depth = 0
): Promise<void> {
  if (depth > 10) {
    processingLog.push(`[ERROR] Max recursion depth reached!`);
    return;
  }

  if (!state || !state.isActive) {
    processingLog.push(`[${roomCode}] No active combat`);
    return;
  }

  const currentActor = state.initiatives[state.currentTurnIndex];
  if (!currentActor) {
    processingLog.push(`[${roomCode}] No current actor at index ${state.currentTurnIndex}`);
    return;
  }

  processingLog.push(`[${roomCode}] Checking turn: ${currentActor.name} (${currentActor.controller}), index: ${state.currentTurnIndex}`);

  if (currentActor.controller === 'monster') {
    if (npcTurnProcessing.has(roomCode)) {
      processingLog.push(`[${roomCode}] NPC turn already processing, skipping`);
      return;
    }

    npcTurnProcessing.add(roomCode);
    processingLog.push(`[${roomCode}] Processing NPC turn: ${currentActor.name}`);

    try {
      // Simulate room lookup
      const room = await getRoomByCode(roomCode);
      if (!room) {
        processingLog.push(`[${roomCode}] ERROR: Room not found!`);
        npcTurnProcessing.delete(roomCode); // CRITICAL: Must clear flag
        return;
      }

      // Simulate attack resolution
      if (errorScenarios.attackResolutionFails) {
        throw new Error('Attack resolution failed');
      }

      const playerTargets = state.initiatives.filter((i: any) => i.controller === 'player');
      
      if (playerTargets.length > 0) {
        const randomTarget = playerTargets[Math.floor(Math.random() * playerTargets.length)];
        
        try {
          // Simulate successful attack
          processingLog.push(`[${roomCode}] ${currentActor.name} attacks ${randomTarget.name}!`);
          
          // Update HP
          if (randomTarget.currentHp !== undefined) {
            randomTarget.currentHp = Math.max(0, randomTarget.currentHp - 3);
          }
        } catch (attackErr) {
          processingLog.push(`[${roomCode}] Attack failed, falling back to AI`);
          
          // Fallback: Generate AI narration
          if (errorScenarios.aiGenerationFails) {
            throw new Error('AI generation failed');
          }
          
          processingLog.push(`[${roomCode}] AI narration: ${currentActor.name} attacks!`);
        }
      } else {
        processingLog.push(`[${roomCode}] No player targets, using AI narration`);
        
        if (errorScenarios.aiGenerationFails) {
          throw new Error('AI generation failed');
        }
      }

      // Auto-advance after delay
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentState = state;
      if (!currentState || !currentState.isActive) {
        processingLog.push(`[${roomCode}] Combat ended during NPC turn`);
        npcTurnProcessing.delete(roomCode);
        return;
      }

      const actor = currentState.initiatives[currentState.currentTurnIndex];
      if (actor && actor.id === currentActor.id) {
        processingLog.push(`[${roomCode}] Advancing turn from ${currentActor.name}`);
        
        advanceTurn(currentState);
        processingLog.push(`[${roomCode}] Advanced to index ${currentState.currentTurnIndex}, next: ${state.initiatives[state.currentTurnIndex]?.name}`);

        // CRITICAL: Clear processing flag BEFORE recursive call
        npcTurnProcessing.delete(roomCode);
        processingLog.push(`[${roomCode}] Cleared processing flag`);

        // Recursive call for next NPC
        await triggerNpcTurnIfNeeded(roomCode, currentState, getRoomByCode, depth + 1);
      } else {
        processingLog.push(`[${roomCode}] Turn changed externally`);
        npcTurnProcessing.delete(roomCode);
      }
    } catch (err) {
      processingLog.push(`[${roomCode}] ERROR: ${err}`);
      npcTurnProcessing.delete(roomCode); // CRITICAL: Must clear flag on error
      
      // Auto-advance even on error
      processingLog.push(`[${roomCode}] Auto-advancing due to error`);
      advanceTurn(state);
      await triggerNpcTurnIfNeeded(roomCode, state, getRoomByCode, depth + 1);
    }
  } else {
    processingLog.push(`[${roomCode}] Current actor is player (${currentActor.name})`);
  }
}

async function runTest(scenario: string, setupErrors: Partial<typeof errorScenarios>) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST SCENARIO: ${scenario}`);
  console.log('='.repeat(60));
  
  // Reset state
  npcTurnProcessing.clear();
  processingLog.length = 0;
  Object.assign(errorScenarios, {
    roomLookupFails: false,
    aiGenerationFails: false,
    attackResolutionFails: false,
    ...setupErrors,
  });

  const combatState: CombatState = {
    isActive: true,
    currentTurnIndex: 0,
    roundNumber: 1,
    initiatives: [
      {
        id: 'npc1',
        name: 'Bandit 1',
        initMod: 2,
        roll: 19,
        total: 21,
        controller: 'monster',
        ac: 13,
        currentHp: 11,
        maxHp: 11,
      },
      {
        id: 'player1',
        name: 'Hero',
        initMod: 0,
        roll: 12,
        total: 12,
        controller: 'player',
        ac: 15,
        currentHp: 10,
        maxHp: 10,
      },
      {
        id: 'npc2',
        name: 'Bandit 2',
        initMod: 2,
        roll: 0,
        total: 2,
        controller: 'monster',
        ac: 13,
        currentHp: 11,
        maxHp: 11,
      },
    ],
  };

  // Mock room lookup
  const getRoomByCode = async (code: string) => {
    if (errorScenarios.roomLookupFails) {
      return null;
    }
    return { id: 'test-room', code, gameSystem: 'dnd' };
  };

  // Start combat
  await triggerNpcTurnIfNeeded('TEST_ROOM', combatState, getRoomByCode);
  
  // Player action
  processingLog.push('[TEST_ROOM] Player takes action');
  advanceTurn(combatState);
  processingLog.push(`[TEST_ROOM] Advanced to ${combatState.initiatives[combatState.currentTurnIndex].name}`);
  
  // Trigger NPC 2
  await triggerNpcTurnIfNeeded('TEST_ROOM', combatState, getRoomByCode);

  // Results
  console.log('\n--- Processing Log ---');
  processingLog.forEach(log => console.log(log));
  
  console.log('\n--- Final State ---');
  console.log(`Current turn index: ${combatState.currentTurnIndex}`);
  console.log(`Current actor: ${combatState.initiatives[combatState.currentTurnIndex].name}`);
  console.log(`Round: ${combatState.roundNumber}`);
  
  console.log('\n--- Diagnostics ---');
  if (npcTurnProcessing.size > 0) {
    console.log(`⚠️  HUNG: ${npcTurnProcessing.size} room(s) still processing!`);
    console.log('Rooms:', Array.from(npcTurnProcessing));
  } else {
    console.log('✅ All processing flags cleared');
  }
}

// Run all test scenarios
async function runAllTests() {
  await runTest('Normal Flow (No Errors)', {});
  
  await runTest('Room Lookup Fails', {
    roomLookupFails: true,
  });
  
  await runTest('AI Generation Fails', {
    aiGenerationFails: true,
  });
  
  await runTest('Attack Resolution Fails', {
    attackResolutionFails: true,
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('ALL TESTS COMPLETE');
  console.log('='.repeat(60));
}

runAllTests().catch(err => {
  console.error('\n=== TESTS FAILED ===');
  console.error(err);
});

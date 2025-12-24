/**
 * Test Quest Detection Utility
 * 
 * Tests quest detection patterns and AI extraction with sample narratives
 */

import { containsQuestLanguage, extractQuestFromNarrative } from './server/utils/quest-detection';

const TEST_NARRATIVES = [
  {
    name: "Direct Quest Assignment",
    text: `The village elder steps forward, his weathered face grave. "Please, you must help us. Goblins have been raiding our farms for weeks. They've taken several of our people prisoner and are holed up in the old Cragmaw Cave to the east. Will you help rescue our people and stop these raids once and for all? We can offer 50 gold pieces as reward."`,
    expected: true,
  },
  {
    name: "NPC Request with Problem",
    text: `Sildar Hallwinter greets you warmly. "I'm glad to see friendly faces. I need your help with something urgent. My friend Gundren Rockseeker has gone missing - he was heading to Wave Echo Cave with a map. Can you find him and bring him back safely? I fear the Crag maw goblins may have captured him."`,
    expected: true,
  },
  {
    name: "Reward-Based Hook",
    text: `A mysterious hooded figure approaches you in the tavern. "I'll pay handsomely - 100 gold pieces - if you can retrieve the Emerald Eye from the Temple of Shadows. It's a dangerous place, but you look capable. The temple lies three days north of here, beyond the Whispering Woods."`,
    expected: true,
  },
  {
    name: "Problem Statement",
    text: `The guard captain looks worried. "We have a serious problem. A dragon has been spotted near the mountain pass, and travelers are too afraid to use the road. Our trade routes are suffering. Something needs to be done about this beast before the winter supplies can't get through."`,
    expected: true,
  },
  {
    name: "Regular Combat Narrative (No Quest)",
    text: `The goblin lunges at you with its rusty sword! Roll initiative! The cave echoes with the sounds of combat as you strike back. With a mighty blow, you defeat the goblin, and it falls to the ground with a thud.`,
    expected: false,
  },
  {
    name: "Location Description (No Quest)",
    text: `You enter a grand hall with towering columns. Sunlight streams through stained glass windows, casting colorful patterns on the marble floor. Ancient tapestries line the walls, depicting battles from long ago.`,
    expected: false,
  },
];

async function runTests() {
  console.log('🧪 Testing Quest Detection Patterns\n');
  console.log('='.repeat(80));
  
  let passed = 0;
  let failed = 0;

  for (const test of TEST_NARRATIVES) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`Text: "${test.text.substring(0, 100)}..."`);
    
    const detected = containsQuestLanguage(test.text);
    const result = detected === test.expected ? '✅ PASS' : '❌ FAIL';
    
    if (detected === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`Expected: ${test.expected ? 'Quest' : 'No Quest'} | Detected: ${detected ? 'Quest' : 'No Quest'} | ${result}`);
    
    // If quest detected, test AI extraction
    if (detected && test.expected) {
      console.log('  → Testing AI extraction...');
      try {
        const extracted = await extractQuestFromNarrative(
          test.text,
          'test-room-id',
          {
            currentLocation: 'Test Village',
            recentNpcs: ['Village Elder', 'Sildar Hallwinter'],
            gameSystem: 'dnd',
          }
        );
        
        if (extracted) {
          console.log(`  ✅ Extracted Quest: "${extracted.title}"`);
          console.log(`  📋 Objectives: ${extracted.objectives.length} total`);
          extracted.objectives.forEach((obj, i) => {
            console.log(`     ${i + 1}. ${obj}`);
          });
          console.log(`  🎁 Rewards: ${extracted.rewards || 'None specified'}`);
          console.log(`  ⚡ Urgency: ${extracted.urgency}`);
          console.log(`  👤 Quest Giver: ${extracted.questGiver}`);
        } else {
          console.log('  ⚠️  AI did not extract a quest (might be a false positive)');
        }
      } catch (error: any) {
        console.log(`  ❌ AI extraction error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${Math.round(passed / TEST_NARRATIVES.length * 100)}% accuracy)\n`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Review detection patterns.');
  }
}

// Run tests
runTests().catch(console.error);

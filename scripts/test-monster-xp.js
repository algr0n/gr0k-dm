// Quick smoke test for MONSTER_DEFEATED parsing and XP splitting logic
const response = '[MONSTER_DEFEATED: Goblin | XP: 101 | participants: Alice,Bob,Carol]';

const monsterDefeatPattern = /\[MONSTER_DEFEATED:\s*([^|\]]+?)\s*(?:\|\s*XP:\s*(\d+)\s*)?(?:\|\s*participants:\s*([^\]]+?)\s*)?\]/gi;
let match;
if ((match = monsterDefeatPattern.exec(response)) !== null) {
  const monsterName = match[1].trim();
  const xpAmount = match[2] ? parseInt(match[2], 10) : undefined;
  const participants = match[3] ? match[3].split(',').map(s => s.trim()).filter(Boolean) : [];
  console.log('Parsed:', { monsterName, xpAmount, participants });

  const xpTotal = xpAmount || 0;
  const per = Math.floor(xpTotal / participants.length);
  let remainder = xpTotal - per * participants.length;
  const distribution = {};
  for (const p of participants) {
    distribution[p] = per + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }
  console.log('Distribution:', distribution);
} else {
  console.error('No match');
}

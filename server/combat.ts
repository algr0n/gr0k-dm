import { parseDiceExpression } from "./dice";
import { randomUUID } from "crypto";

export interface InitiativeEntry {
  id: string;
  controller: "player" | "monster" | "dm";
  name: string;
  roll: number;
  modifier: number;
  total: number;
  ac?: number;
  currentHp?: number;
  maxHp?: number;
  metadata?: any;
}

export interface EnvironmentFeature {
  id: string;
  type: 'cover' | 'difficult' | 'high_ground' | 'hazard';
  position: { x: number; y: number };
  radius: number;
  properties?: { coverBonus?: number; concealment?: number; movementCostMultiplier?: number };
}

export interface CombatState {
  isActive: boolean;
  roomCode: string;
  roundNumber: number;
  currentTurnIndex: number;
  initiatives: InitiativeEntry[];
  actionHistory: any[];
  environment?: EnvironmentFeature[];
  heldActors?: Record<string, any>;
}

/**
 * Roll a d20 and return the roll (1-20)
 */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Helper to compute initiative modifier for a monster (fallbacks)
 */
export function initiativeModFromMonster(monster: any): number {
  // monster could have dex or initiativeModifier
  if (typeof monster.initiativeModifier === "number") return monster.initiativeModifier;
  if (monster.stats && typeof monster.stats.dex === "number") {
    return Math.floor((monster.stats.dex - 10) / 2);
  }
  if (monster.dex) {
    return Math.floor((monster.dex - 10) / 2);
  }
  return 0;
}

/**
 * Roll initiatives for characters and monsters and return a sorted list
 */
export function rollInitiativesForCombat(characters: any[], players: any[], monsters: any[]): InitiativeEntry[] {
  const initiatives: InitiativeEntry[] = [];
  
  console.log(`[rollInitiativesForCombat] Processing ${characters.length} characters, ${players.length} players, ${monsters.length} monsters`);
  console.log(`[rollInitiativesForCombat] Characters:`, characters.map(c => ({ id: c.id, userId: c.userId, name: c.characterName, initMod: c.initiativeModifier })));
  console.log(`[rollInitiativesForCombat] Players:`, players.map(p => ({ id: p.id, userId: p.userId, name: p.name })));

  for (const char of characters) {
    const player = players.find((p: any) => p.userId === char.userId) || { id: char.userId, name: 'Unknown' };
    const roll = rollD20();
    const modifier = typeof char.initiativeModifier === "number" ? char.initiativeModifier : 0;
    
    console.log(`[rollInitiativesForCombat] Character ${char.characterName}: roll=${roll}, modifier=${modifier}, total=${roll + modifier}`);
    
    initiatives.push({
      id: char.id || randomUUID(),
      controller: "player",
      name: char.characterName || `Player ${player.name || player.id}`,
      roll,
      modifier,
      total: roll + modifier,
      ac: char.ac ?? 10,
      currentHp: char.currentHp ?? char.maxHp ?? 1,
      maxHp: char.maxHp ?? 1,
      metadata: { userId: player.id || char.userId, playerName: player.name },
    });
  }

  for (const m of monsters) {
    const roll = rollD20();
    const modifier = initiativeModFromMonster(m);
    initiatives.push({
      id: m.id || `monster:${m.name}:${randomUUID()}`,
      controller: "monster",
      name: m.name || "Monster",
      roll,
      modifier,
      total: roll + modifier,
      ac: m.ac ?? (m.stats?.ac ?? 10),
      currentHp: m.hp ?? (m.stats?.hp ?? 10),
      maxHp: m.hp ?? (m.stats?.hp ?? 10),
      metadata: m,
    });
  }

  // Tie-break: higher dex -> higher maxHp -> random
  initiatives.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const aDex = a.metadata?.stats?.dex ?? 0;
    const bDex = b.metadata?.stats?.dex ?? 0;
    if (bDex !== aDex) return bDex - aDex;
    const aHp = a.maxHp ?? 0;
    const bHp = b.maxHp ?? 0;
    if (bHp !== aHp) return bHp - aHp;
    return Math.random() > 0.5 ? 1 : -1;
  });

  return initiatives;
}

export function createCombatState(roomCode: string, initiatives: InitiativeEntry[]): CombatState {
  return {
    isActive: true,
    roomCode,
    roundNumber: 1,
    currentTurnIndex: 0,
    initiatives,
    actionHistory: [],
    heldActors: {},
    environment: [],
    threats: {},
  } as any;
}

/**
 * Place actor into held map
 */
export function addHold(state: any, actorId: string, hold: any) {
  if (!state.heldActors) state.heldActors = {};
  state.heldActors[actorId] = hold;
}

/**
 * Process trigger: if any held actor is waiting for triggerActorId, insert them immediately after trigger actor
 */
export function processTrigger(state: any, triggerActorId: string) {
  if (!state.heldActors) return [];
  const inserted: string[] = [];
  const triggerIdx = state.initiatives.findIndex((i: any) => i.id === triggerActorId);
  if (triggerIdx === -1) return [];

  // Remember current actor id so we can re-align currentTurnIndex after reordering
  const currentActorId = state.initiatives[state.currentTurnIndex]?.id;

  // Find held actors whose hold.triggerActorId === triggerActorId in FIFO order
  for (const [actorId, hold] of Object.entries(state.heldActors)) {
    if ((hold as any).type === 'until' && (hold as any).triggerActorId === triggerActorId) {
      const currentPos = state.initiatives.findIndex((i: any) => i.id === actorId);
      // If actor is not found among initiatives, skip
      if (currentPos === -1) continue;
      // Remove actor from current position
      const [actorEntry] = state.initiatives.splice(currentPos, 1);
      // Insert actor immediately after trigger position (note: if we removed an earlier index, adjust)
      let insertPos = state.initiatives.findIndex((i: any) => i.id === triggerActorId);
      if (insertPos === -1) insertPos = triggerIdx; // fallback
      state.initiatives.splice(insertPos + 1, 0, actorEntry);
      // Mark as no longer held for this round
      delete state.heldActors[actorId];
      inserted.push(actorId);
    }
  }

  // Recompute currentTurnIndex so it still points to the actor who was active before triggers
  if (currentActorId) {
    const newIndex = state.initiatives.findIndex((i: any) => i.id === currentActorId);
    if (newIndex !== -1) {
      state.currentTurnIndex = newIndex;
    }
  }

  return inserted;
}

/**
 * Advance turn index and return new current combatant id
 */
export function advanceTurn(state: any) {
  if (!state) return null;
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.initiatives.length;
  if (state.currentTurnIndex === 0) state.roundNumber = (state.roundNumber || 1) + 1;
  return state.initiatives[state.currentTurnIndex]?.id;
}

// Basic attack resolution utility (deterministic)
export function resolveAttack(attackRollExpression: string | null, attackBonus: number, targetAc: number, damageExpression: string | null) {
  // attackRollExpression can be null (we'll roll a d20), damageExpression like "1d8+2"
  const d20 = rollD20();
  const attackTotal = d20 + attackBonus;
  const isCritical = d20 === 20;
  const isFumble = d20 === 1;
  const hit = !isFumble && (isCritical || attackTotal >= targetAc);

  let damageRolls: number[] = [];
  let damageTotal = 0;
  if (hit && damageExpression) {
    const parsed = parseDiceExpression(damageExpression);
    if (parsed) {
      const rolls = parsed.rolls;
      if (isCritical) {
        // double dice: roll again the dice portion
        const parsed2 = parseDiceExpression(parsed.expression);
        if (parsed2) {
          damageRolls = [...parsed.rolls, ...parsed2.rolls];
        } else {
          damageRolls = parsed.rolls;
        }
      } else {
        damageRolls = parsed.rolls;
      }
      damageTotal = damageRolls.reduce((a, b) => a + b, 0) + parsed.modifier;
    }
  }

  return { d20, attackTotal, isCritical, isFumble, hit, damageRolls, damageTotal };
}

export function updateThreat(state: any, actorId: string, amount: number) {
  if (!state.threats) state.threats = {};
  state.threats[actorId] = (state.threats[actorId] || 0) + amount;
}

export function getThreat(state: any, actorId: string) {
  return (state.threats && state.threats[actorId]) || 0;
}

export function isFlanked(target: any, state: any) {
  if (!target?.metadata?.position) return false;
  const allies = state.initiatives.filter((i: any) => i.controller === 'monster' && i.id !== target.id && i.metadata?.position);
  if (allies.length < 2) return false;
  // Check if two allies are roughly on opposite sides relative to target
  for (let i = 0; i < allies.length; i++) {
    for (let j = i + 1; j < allies.length; j++) {
      const a = allies[i].metadata.position;
      const b = allies[j].metadata.position;
      const tx = target.metadata.position.x;
      const ty = target.metadata.position.y;
      const vax = a.x - tx, vay = a.y - ty;
      const vbx = b.x - tx, vby = b.y - ty;
      const dot = (vax * vbx + vay * vby);
      const magA = Math.sqrt(vax * vax + vay * vay);
      const magB = Math.sqrt(vbx * vbx + vby * vby);
      if (magA === 0 || magB === 0) continue;
      const cos = dot / (magA * magB);
      // cos < -0.5 roughly corresponds to angle > 120deg (opposite sides)
      if (cos < -0.5) return true;
    }
  }
  return false;
}

export function decideMonsterActions(state: any, maxActions = 1) {
  const results: any[] = [];
  if (!state || !state.initiatives) return results;

  // Helper: distance (Euclidean)
  function distance(a: any, b: any) {
    if (!a?.metadata?.position || !b?.metadata?.position) return Infinity;
    const ax = a.metadata.position.x;
    const ay = a.metadata.position.y;
    const bx = b.metadata.position.x;
    const by = b.metadata.position.y;
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Environment helpers
  function pointInFeature(pt: {x:number,y:number}, f: EnvironmentFeature) {
    const dx = pt.x - f.position.x;
    const dy = pt.y - f.position.y;
    return Math.sqrt(dx*dx+dy*dy) <= (f.radius ?? 0);
  }

  function isInCover(target: any, env: EnvironmentFeature[] | undefined) {
    if (!env || !target?.metadata?.position) return null;
    for (const f of env) {
      if (f.type === 'cover' && pointInFeature(target.metadata.position, f)) return f;
    }
    return null;
  }

  function blocksLineOfSight(a:any, b:any, env: EnvironmentFeature[] | undefined) {
    // Very simple LOS: if line between a and b passes through a 'cover' feature, return true (obstructed)
    if (!env || !a?.metadata?.position || !b?.metadata?.position) return false;
    const ax = a.metadata.position.x, ay = a.metadata.position.y;
    const bx = b.metadata.position.x, by = b.metadata.position.y;
    for (const f of env) {
      if (f.type !== 'cover') continue;
      // distance from center of feature to segment ab
      const vx = bx - ax, vy = by - ay;
      const wx = f.position.x - ax, wy = f.position.y - ay;
      const c1 = (wx*vx + wy*vy);
      const c2 = (vx*vx + vy*vy);
      if (c2 === 0) continue;
      const t = Math.max(0, Math.min(1, c1 / c2));
      const px = ax + t*vx, py = ay + t*vy;
      const dx = px - f.position.x, dy = py - f.position.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (dist <= f.radius) return true;
    }
    return false;
  }

  // collect monster IDs in initiative order starting at currentTurnIndex
  const start = state.currentTurnIndex ?? 0;
  const ordered = [] as any[];
  for (let i = 0; i < state.initiatives.length; i++) {
    const idx = (start + i) % state.initiatives.length;
    ordered.push(state.initiatives[idx]);
  }

  for (const entry of ordered) {
    if (results.length >= maxActions) break;
    if (entry.controller !== 'monster') continue;

    const monster = entry;
    // find candidate player targets with hp>0
    const players = state.initiatives.filter((e: any) => e.controller === 'player' && (e.currentHp ?? 0) > 0);
    if (players.length === 0) continue;

    const meleeReach = monster.metadata?.reach ?? 5; // default 5 ft
    const rangedRange = monster.metadata?.rangedRange ?? (monster.metadata?.hasRangedAttack ? 30 : 0);
    const hasRanged = !!monster.metadata?.hasRangedAttack;

    // Compute players in melee/reach
    const playersInMelee = players.filter((p: any) => distance(monster, p) <= meleeReach);
    const playersInRanged = players.filter((p: any) => hasRanged && distance(monster, p) <= rangedRange);

    let chosenTarget: any = null;
    let action: any = null;

    // If we don't have positional data, fallback to previous lowest-HP behavior
    const distances = players.map((p: any) => distance(monster, p));
    const hasFiniteDistance = distances.some((d: number) => Number.isFinite(d));
    if (!hasFiniteDistance) {
      // fallback: pick lowest HP
      players.sort((a: any, b: any) => (a.currentHp ?? 0) - (b.currentHp ?? 0));
      chosenTarget = players[0];
      action = {
        type: 'attack',
        targetId: chosenTarget.id,
        attackBonus: monster.metadata?.attackBonus ?? 0,
        damageExpression: monster.metadata?.primaryDamageExpression ?? (monster.metadata?.actions?.[0]?.damage ?? '1d6'),
        mode: 'melee',
      };
    } else if (playersInMelee.length > 0) {
      // Priority: melee reachable targets (prefer threat, flanked, casters, then lowest HP)
      playersInMelee.sort((a: any, b: any) => {
        const ta = getThreat(state, a.id) - getThreat(state, b.id);
        if (ta !== 0) return ta > 0 ? -1 : 1;
        const af = isFlanked(a, state) ? 1 : 0;
        const bf = isFlanked(b, state) ? 1 : 0;
        if (af !== bf) return af > bf ? -1 : 1;
        const ar = (a.metadata?.role === 'caster') ? 1 : 0;
        const br = (b.metadata?.role === 'caster') ? 1 : 0;
        if (ar !== br) return ar > br ? -1 : 1;
        const hpDiff = (a.currentHp ?? 0) - (b.currentHp ?? 0);
        return hpDiff;
      });
      chosenTarget = playersInMelee[0];
      action = {
        type: 'attack',
        targetId: chosenTarget.id,
        attackBonus: monster.metadata?.attackBonus ?? 0,
        damageExpression: monster.metadata?.primaryDamageExpression ?? (monster.metadata?.actions?.[0]?.damage ?? '1d6'),
        mode: 'melee',
      };
    } else if (playersInRanged.length > 0) {
      // If no melee target but have ranged targets, prefer ranged by threat and LOS
      playersInRanged.sort((a: any, b: any) => {
        const ta = getThreat(state, a.id) - getThreat(state, b.id);
        if (ta !== 0) return ta > 0 ? -1 : 1;
        const ar = (a.metadata?.role === 'caster') ? 1 : 0;
        const br = (b.metadata?.role === 'caster') ? 1 : 0;
        if (ar !== br) return ar > br ? -1 : 1;
        const hpDiff = (a.currentHp ?? 0) - (b.currentHp ?? 0);
        return hpDiff;
      });
      // Try to avoid targets behind cover if alternative exists
      const env = (state.environment ?? []);
      let candidate = null as any;
      for (const p of playersInRanged) {
        const obstructed = blocksLineOfSight(monster, p, env);
        if (!obstructed) { candidate = p; break; }
      }
      if (!candidate) candidate = playersInRanged[0];

      chosenTarget = candidate;
      action = {
        type: 'attack',
        targetId: chosenTarget.id,
        attackBonus: monster.metadata?.rangedAttackBonus ?? (monster.metadata?.attackBonus ?? 0),
        damageExpression: monster.metadata?.rangedDamageExpression ?? monster.metadata?.primaryDamageExpression ?? (monster.metadata?.actions?.[0]?.damage ?? '1d6'),
        mode: 'ranged',
      };
    } else {
      // No targets in range: move towards nearest target
      // Choose nearest player
      players.sort((a: any, b: any) => distance(monster, a) - distance(monster, b));
      chosenTarget = players[0];

      // Movement: move up to speed (feet) toward target, but stop at reach distance
      const monsterSpeed = monster.metadata?.speed ?? 6; // default 6 (approx 30ft/round broken into grid units)
      const dist = distance(monster, chosenTarget);
      let moveDistance = Math.min(monsterSpeed, Math.max(0, dist - meleeReach));

      // Compute destination point along the line from monster to target
      let dest = null;
      if (monster.metadata?.position && chosenTarget.metadata?.position) {
        const sx = monster.metadata.position.x;
        const sy = monster.metadata.position.y;
        const tx = chosenTarget.metadata.position.x;
        const ty = chosenTarget.metadata.position.y;
        if (dist > 0) {
          const ratio = moveDistance / dist;
          const nx = sx + (tx - sx) * ratio;
          const ny = sy + (ty - sy) * ratio;
          dest = { x: nx, y: ny };
        }
      }

      action = { type: 'move', actorId: monster.id, to: dest, toward: chosenTarget.id, moveDistance };
    }

    if (action) {
      results.push({ actorId: monster.id, action });
    }
  }

  return results;
}

/**
 * Apply a move action to the state: updates actor position and returns new pos
 */
export function applyMoveAction(state: any, action: any) {
  const actor = state.initiatives.find((i: any) => i.id === action.actorId);
  if (!actor) return null;
  if (!action.to) return null;

  // Movement cost multiplier from environment
  let moveAllowed = action.moveDistance ?? 0;
  // Check terrain along straight line (simple check: if destination is inside difficult terrain, multiply cost)
  const env = state.environment ?? [];
  for (const f of env) {
    // Check if point is within feature (simple circular check)
    const dx = action.to.x - f.position.x;
    const dy = action.to.y - f.position.y;
    const distSquared = dx * dx + dy * dy;
    const inFeature = distSquared <= f.radius * f.radius;
    
    if (f.type === 'difficult' && inFeature) {
      moveAllowed = moveAllowed / (f.properties?.movementCostMultiplier ?? 2);
    }
  }

  // Update position to the destination (simple movement)
  actor.metadata = actor.metadata || {};
  actor.metadata.position = action.to;

  // Record action
  state.actionHistory = state.actionHistory || [];
  state.actionHistory.push({ actorId: actor.id, type: 'move', to: action.to, moved: moveAllowed, timestamp: Date.now() });

  return actor.metadata.position;
}

export default {
  rollD20,
  rollInitiativesForCombat,
  createCombatState,
  resolveAttack,
  decideMonsterActions,
};

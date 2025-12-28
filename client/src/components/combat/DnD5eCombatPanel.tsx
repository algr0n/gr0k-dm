import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sword, Shield, Clock, SkipForward, Zap, Sparkles, 
  Footprints, Heart, Target, ChevronRight, Flame
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { inferSpellEffects } from "@shared/spell-text";

// D&D 5e Spell data structure
interface SpellData {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: { verbal: boolean; somatic: boolean; material: string | null };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels: string | null;
  classes: string[];
  damage?: string; // Damage expression if applicable
}

interface CombatParticipant {
  id: string;
  name: string;
  currentHp?: number;
  maxHp?: number;
  ac?: number;
  controller?: string;
}

// D&D 5e action economy tracking
interface ActionEconomy {
  action: boolean;        // Standard action available
  bonusAction: boolean;   // Bonus action available
  reaction: boolean;      // Reaction available
  movement: number;       // Movement remaining (feet)
  maxMovement: number;    // Max movement per turn
}

// Class-specific bonus actions with level requirements
interface BonusAction {
  name: string;
  description: string;
  type: string;
  minLevel: number;
}

const CLASS_BONUS_ACTIONS: Record<string, BonusAction[]> = {
  rogue: [
    { name: "Cunning Action: Dash", description: "Double your movement for this turn", type: "dash", minLevel: 2 },
    { name: "Cunning Action: Disengage", description: "Your movement doesn't provoke opportunity attacks", type: "disengage", minLevel: 2 },
    { name: "Cunning Action: Hide", description: "Make a Stealth check to hide", type: "hide", minLevel: 2 },
  ],
  monk: [
    { name: "Flurry of Blows", description: "Make two unarmed strikes (1 ki point)", type: "flurry", minLevel: 2 },
    { name: "Patient Defense", description: "Take the Dodge action (1 ki point)", type: "dodge", minLevel: 2 },
    { name: "Step of the Wind", description: "Disengage or Dash + double jump (1 ki point)", type: "step", minLevel: 2 },
  ],
  fighter: [
    { name: "Second Wind", description: "Regain 1d10 + level HP (once per short rest)", type: "second_wind", minLevel: 1 },
    { name: "Action Surge", description: "Take an additional action (once per short rest)", type: "action_surge", minLevel: 2 },
  ],
  barbarian: [
    { name: "Rage", description: "Enter rage for bonus damage and resistance", type: "rage", minLevel: 1 },
  ],
  paladin: [],
  cleric: [
    { name: "Channel Divinity", description: "Use your Channel Divinity feature", type: "channel", minLevel: 2 },
  ],
  wizard: [],
  sorcerer: [
    { name: "Quickened Spell", description: "Cast a spell as a bonus action (2 sorcery points)", type: "quicken", minLevel: 2 },
  ],
  warlock: [
    { name: "Hex (Move)", description: "Move your Hex curse to a new target", type: "hex_move", minLevel: 1 },
  ],
  bard: [
    { name: "Bardic Inspiration", description: "Grant an ally a Bardic Inspiration die", type: "inspiration", minLevel: 1 },
  ],
  druid: [
    { name: "Wild Shape", description: "Transform into a beast form", type: "wild_shape", minLevel: 2 },
  ],
  ranger: [
    { name: "Hunter's Mark (Move)", description: "Move Hunter's Mark to a new target", type: "hunters_mark", minLevel: 1 },
  ],
};

// Spells that can be cast as bonus actions
const BONUS_ACTION_SPELLS = [
  "healing word", "misty step", "spiritual weapon", "hex", "hunter's mark",
  "shield of faith", "expeditious retreat", "magic weapon", "flame blade",
  "shillelagh", "divine favor", "compelled duel", "ensnaring strike",
  "hail of thorns", "searing smite", "thunderous smite", "wrathful smite",
  "branding smite", "swift quiver", "holy weapon"
];

// Determine spell targeting type based on spell properties
function getSpellTargeting(spell: SpellData): { 
  isAOE: boolean; 
  requiresTarget: boolean; 
  aoeType?: "cone" | "sphere" | "line" | "cube" | "cylinder";
  aoeSize?: string;
} {
  const name = spell.name.toLowerCase();
  const range = spell.range.toLowerCase();
  const desc = spell.description.toLowerCase();
  
  // Self-target spells
  if (range === "self" || range.includes("self (")) {
    const aoeMatch = range.match(/\((\d+)-foot (cone|sphere|radius|line|cube|cylinder)\)/i);
    if (aoeMatch) {
      return {
        isAOE: true,
        requiresTarget: false,
        aoeType: aoeMatch[2] as any,
        aoeSize: aoeMatch[1] + " ft"
      };
    }
    return { isAOE: false, requiresTarget: false };
  }
  
  // Known AOE spells by name
  const aoeSpells: Record<string, { type: string; size: string }> = {
    "fireball": { type: "sphere", size: "20 ft" },
    "lightning bolt": { type: "line", size: "100 ft" },
    "burning hands": { type: "cone", size: "15 ft" },
    "thunderwave": { type: "cube", size: "15 ft" },
    "ice storm": { type: "cylinder", size: "20 ft" },
    "cone of cold": { type: "cone", size: "60 ft" },
    "shatter": { type: "sphere", size: "10 ft" },
    "spirit guardians": { type: "sphere", size: "15 ft" },
    "moonbeam": { type: "cylinder", size: "5 ft" },
    "flame strike": { type: "cylinder", size: "10 ft" },
  };
  
  for (const [spellName, aoeInfo] of Object.entries(aoeSpells)) {
    if (name.includes(spellName)) {
      return {
        isAOE: true,
        requiresTarget: true, // Requires point/location
        aoeType: aoeInfo.type as any,
        aoeSize: aoeInfo.size
      };
    }
  }
  
  // Check description for AOE keywords
  if (desc.match(/(each creature|all creatures|creatures of your choice).*(within|in a|in the)/i) ||
      desc.match(/(\d+)-foot (cone|sphere|radius|line|cube|cylinder)/i)) {
    const aoeMatch = desc.match(/(\d+)-foot (cone|sphere|radius|line|cube|cylinder)/i);
    return {
      isAOE: true,
      requiresTarget: true,
      aoeType: aoeMatch ? aoeMatch[2] as any : undefined,
      aoeSize: aoeMatch ? aoeMatch[1] + " ft" : undefined
    };
  }
  
  // Default: single target spell
  return { isAOE: false, requiresTarget: true };
}

// Get spell damage expression based on spell
function getSpellDamage(spell: SpellData, casterLevel: number): string | null {
  const name = spell.name.toLowerCase();
  
  // Common damage cantrips scale with level
  if (spell.level === 0) {
    const cantripDice = casterLevel >= 17 ? 4 : casterLevel >= 11 ? 3 : casterLevel >= 5 ? 2 : 1;
    if (name.includes("fire bolt")) return `${cantripDice}d10`;
    if (name.includes("eldritch blast")) return `${cantripDice}d10`;
    if (name.includes("sacred flame")) return `${cantripDice}d8`;
    if (name.includes("toll the dead")) return `${cantripDice}d8`;
    if (name.includes("chill touch")) return `${cantripDice}d8`;
    if (name.includes("ray of frost")) return `${cantripDice}d8`;
    if (name.includes("shocking grasp")) return `${cantripDice}d8`;
    if (name.includes("acid splash")) return `${cantripDice}d6`;
    if (name.includes("poison spray")) return `${cantripDice}d12`;
    if (name.includes("vicious mockery")) return `${cantripDice}d4`;
  }
  
  // Level 1 spells
  if (spell.level === 1) {
    if (name.includes("magic missile")) return "3d4+3";
    if (name.includes("burning hands")) return "3d6";
    if (name.includes("chromatic orb")) return "3d8";
    if (name.includes("guiding bolt")) return "4d6";
    if (name.includes("inflict wounds")) return "3d10";
    if (name.includes("thunderwave")) return "2d8";
    if (name.includes("witch bolt")) return "1d12";
    if (name.includes("ice knife")) return "2d6";
  }
  
  // Level 2 spells
  if (spell.level === 2) {
    if (name.includes("scorching ray")) return "6d6";
    if (name.includes("shatter")) return "3d8";
    if (name.includes("moonbeam")) return "2d10";
    if (name.includes("flame blade")) return "3d6";
    if (name.includes("spiritual weapon")) return "1d8+3";
  }
  
  // Level 3 spells
  if (spell.level === 3) {
    if (name.includes("fireball")) return "8d6";
    if (name.includes("lightning bolt")) return "8d6";
    if (name.includes("vampiric touch")) return "3d6";
    if (name.includes("spirit guardians")) return "3d8";
  }
  
  // Higher level spells
  if (spell.level >= 4) {
    if (name.includes("blight")) return "8d8";
    if (name.includes("ice storm")) return "2d8+4d6";
    if (name.includes("flame strike")) return "4d6+4d6";
    if (name.includes("cone of cold")) return "8d8";
    if (name.includes("disintegrate")) return "10d6+40";
    if (name.includes("finger of death")) return "7d8+30";
    if (name.includes("meteor swarm")) return "40d6";
  }
  
  return null;
}

interface DnD5eCombatPanelProps {
  roomCode: string;
  myActorId: string;
  isMyTurn: boolean;
  participants: CombatParticipant[];
  characterData: {
    class?: string;
    level?: number;
    stats?: Record<string, number>;
    spells?: string[];
    spellSlots?: { current: number[]; max: number[] };
    speed?: number;
  };
  allSpells: SpellData[];
  compact?: boolean;
  externalTargets?: Array<{ type: 'npc' | 'object' | 'room'; id?: string; tags?: string[]; metadata?: Record<string, unknown> }>;
}

export function DnD5eCombatPanel({
  roomCode,
  myActorId,
  isMyTurn,
  participants,
  characterData,
  allSpells,
  compact = false,
  externalTargets = [],
}: DnD5eCombatPanelProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedSpell, setSelectedSpell] = useState<SpellData | null>(null);
  const [spellDialogOpen, setSpellDialogOpen] = useState(false);
  const [useSaveMode, setUseSaveMode] = useState(false);
  const [saveAbility, setSaveAbility] = useState<"str" | "dex" | "con" | "int" | "wis" | "cha">("dex");
  const [saveOnSuccess, setSaveOnSuccess] = useState<"half" | "none">("half");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [applyOutsideCombat, setApplyOutsideCombat] = useState(false);

  const myParticipant = participants.find(p => p.id === myActorId);
  const isDown = (myParticipant?.currentHp ?? 0) <= 0;

  // Action economy state (resets each turn)
  const [actionEconomy, setActionEconomy] = useState<ActionEconomy>({
    action: true,
    bonusAction: true,
    reaction: true,
    movement: characterData.speed || 30,
    maxMovement: characterData.speed || 30,
  });

  // Track if we've ended our turn and are waiting for the server to advance/combine NPC turns
  const [waitingForTurn, setWaitingForTurn] = useState(false);

  // Ensure action economy resets when it becomes *your* turn (covers server-driven turn advances)
  useEffect(() => {
    if (isMyTurn) {
      // Clear waiting flag and reset economy now that the server says it's your turn
      setWaitingForTurn(false);
      setActionEconomy({
        action: true,
        bonusAction: true,
        reaction: true,
        movement: characterData.speed || 30,
        maxMovement: characterData.speed || 30,
      });
    }
  }, [isMyTurn, characterData.speed, myActorId]);

  // Get character's known spells with full data
  // Only show spells that are explicitly in the character's spells array (known/prepared)
  const knownSpells = useMemo(() => {
    const prepared = characterData.spells || [];
    if (prepared.length === 0) return [];
    
    const preparedSet = new Set(prepared.map((s) => s.toLowerCase()));

    // Only include spells explicitly in the character's prepared/known list
    return allSpells.filter(
      (spell) => preparedSet.has(spell.name.toLowerCase()) || preparedSet.has(spell.id.toLowerCase())
    );
  }, [characterData.spells, allSpells]);

  // Group spells by level
  const spellsByLevel = useMemo(() => {
    const grouped: Record<number, SpellData[]> = {};
    for (const spell of knownSpells) {
      if (!grouped[spell.level]) grouped[spell.level] = [];
      grouped[spell.level].push(spell);
    }
    return grouped;
  }, [knownSpells]);

  // Get available spell slot levels
  const availableSlots = useMemo(() => {
    if (!characterData.spellSlots) return [];
    return characterData.spellSlots.current
      .map((count, level) => ({ level, count, max: characterData.spellSlots?.max[level] || 0 }))
      .filter(slot => slot.level > 0 && slot.count > 0);
  }, [characterData.spellSlots]);

  // Get class-specific bonus actions filtered by level
  const classBonusActions = useMemo(() => {
    const charClass = (characterData.class || "").toLowerCase();
    const charLevel = characterData.level || 1;
    const allActions = CLASS_BONUS_ACTIONS[charClass] || [];
    return allActions.filter(action => charLevel >= action.minLevel);
  }, [characterData.class, characterData.level]);

  // Filter targets
  const validTargets = participants.filter(
    (p) => p.id !== myActorId && (p.currentHp ?? 0) > 0
  );

  // Calculate attack bonus and spell attack bonus
  const strMod = characterData.stats?.str ? Math.floor((characterData.stats.str - 10) / 2) : 0;
  const dexMod = characterData.stats?.dex ? Math.floor((characterData.stats.dex - 10) / 2) : 0;
  const intMod = characterData.stats?.int ? Math.floor((characterData.stats.int - 10) / 2) : 0;
  const wisMod = characterData.stats?.wis ? Math.floor((characterData.stats.wis - 10) / 2) : 0;
  const chaMod = characterData.stats?.cha ? Math.floor((characterData.stats.cha - 10) / 2) : 0;
  const profBonus = Math.floor(((characterData.level || 1) - 1) / 4) + 2;

  // Determine spellcasting ability modifier
  const charClass = (characterData.class || "").toLowerCase();
  let spellMod = 0;
  if (["wizard"].includes(charClass)) spellMod = intMod;
  else if (["cleric", "druid", "ranger"].includes(charClass)) spellMod = wisMod;
  else if (["bard", "paladin", "sorcerer", "warlock"].includes(charClass)) spellMod = chaMod;
  
  const spellAttackBonus = spellMod + profBonus;
  const attackBonus = Math.max(strMod, dexMod) + profBonus;
  const spellSaveDc = 8 + profBonus + spellMod;

  // Mutations
  const combatActionMutation = useMutation({
    mutationFn: async (action: any) => {
      const res = await fetch(`/api/rooms/${roomCode}/combat/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Combat action failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      // Update action economy based on action type
      if (variables.actionType === "action") {
        setActionEconomy(prev => ({ ...prev, action: false }));
      } else if (variables.actionType === "bonus") {
        setActionEconomy(prev => ({ ...prev, bonusAction: false }));
      } else if (variables.actionType === "reaction") {
        setActionEconomy(prev => ({ ...prev, reaction: false }));
      }
      setSelectedTargetId("");
      setSelectedSpell(null);
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode] });
    },
    onError: (error: Error) => {
      // If the server rejected because it's not your turn, stop further attempts and refresh combat state
      if (error.message?.toLowerCase().includes("not actor")) {
        setWaitingForTurn(true);
        setActionEconomy(prev => ({ ...prev, action: false, bonusAction: false }));
        queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode] });
      }
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const passTurnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${roomCode}/combat/pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actorId: myActorId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Pass turn failed");
      }
      return res.json();
    },
    onMutate: () => {
      // Optimistically mark that we've ended our turn so UI can't send further actions
      setWaitingForTurn(true);
      setActionEconomy({ action: false, bonusAction: false, reaction: false, movement: 0, maxMovement: characterData.speed || 30 });
    },
    onSuccess: () => {
      // Keep waitingForTurn true until the server sends a combat update that makes isMyTurn true
      // (we'll clear waitingForTurn in the isMyTurn useEffect when it becomes our turn again)
      setWaitingForTurn(true);
    },
    onError: (error: Error) => {
      // Revert optimistic change on error
      setWaitingForTurn(false);
      setActionEconomy({
        action: true,
        bonusAction: true,
        reaction: true,
        movement: characterData.speed || 30,
        maxMovement: characterData.speed || 30,
      });
      toast({ title: "Pass Failed", description: error.message, variant: "destructive" });
    },
  });

  // Handlers
  const handleDeathSave = () => {
    combatActionMutation.mutate({
      actorId: myActorId,
      type: "death_save",
    });
  };

  const handleAttack = () => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You must roll a death save.", variant: "destructive" });
      return;
    }
    if (!selectedTargetId) {
      toast({ title: "No Target", description: "Select a target first", variant: "destructive" });
      return;
    }
    if (!actionEconomy.action) {
      toast({ title: "No Action", description: "You've already used your action this turn", variant: "destructive" });
      return;
    }

    const damageExpression = charClass === "barbarian" ? "1d12" :
      ["fighter", "paladin"].includes(charClass) ? "1d8" :
      charClass === "rogue" ? "1d6" : "1d6";

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "attack",
      targetId: selectedTargetId,
      attackBonus,
      damageExpression,
      actionType: "action",
    });
  };

  const applySpellMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Use shared helper for easier testing
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { applySpell } = require('@/lib/spells');
      return await applySpell(roomCode, payload);
    },
    onSuccess: () => {
      toast({ title: 'Spell applied', description: 'Effect applied outside combat', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['room', roomCode] });
    },
  });

  const handleApplyOutsideCombatSpell = (spell: SpellData) => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't cast while at 0 HP.", variant: "destructive" });
      return;
    }

    const targeting = getSpellTargeting(spell);
    if (targeting.requiresTarget && !selectedTargetId) {
      const targetDesc = targeting.isAOE 
        ? `Select a target point for the ${targeting.aoeType || "area"} effect` 
        : "Select a target first";
      toast({ title: "No Target", description: targetDesc, variant: "destructive" });
      return;
    }

    // Build targets payload
    const payloadTargets: any[] = [];
    if (selectedTargetId) {
      payloadTargets.push({ type: 'character', ids: [selectedTargetId] });
    }

    // Allow callers to pass NPC/object/room targets explicitly
    if (externalTargets && externalTargets.length > 0) {
      payloadTargets.push(...externalTargets);
    }

    applySpellMutation.mutate({
      casterId: myActorId,
      spellText: spell.description || spell.name,
      targets: payloadTargets.length > 0 ? payloadTargets : undefined,
      duration: spell.duration,
    });

    setSpellDialogOpen(false);
  };

  const handleCastSpell = (spell: SpellData, slotLevel?: number) => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't cast while at 0 HP.", variant: "destructive" });
      return;
    }
    
    // Check targeting requirements for the spell
    const targeting = getSpellTargeting(spell);
    if (targeting.requiresTarget && !selectedTargetId) {
      const targetDesc = targeting.isAOE 
        ? `Select a target point for the ${targeting.aoeType || "area"} effect` 
        : "Select a target first";
      toast({ title: "No Target", description: targetDesc, variant: "destructive" });
      return;
    }

    // Allow outside-combat application if selected
    if (applyOutsideCombat) {
      handleApplyOutsideCombatSpell(spell);
      return;
    }

    const isBonusActionSpell = BONUS_ACTION_SPELLS.includes(spell.name.toLowerCase()) ||
      spell.castingTime.toLowerCase().includes("bonus");
    
    const actionType = isBonusActionSpell ? "bonus" : "action";
    
    if (actionType === "action" && !actionEconomy.action) {
      toast({ title: "No Action", description: "You've already used your action this turn", variant: "destructive" });
      return;
    }
    if (actionType === "bonus" && !actionEconomy.bonusAction) {
      toast({ title: "No Bonus Action", description: "You've already used your bonus action", variant: "destructive" });
      return;
    }

    // Check spell slots for non-cantrips
    if (spell.level > 0) {
      const useSlot = slotLevel || spell.level;
      const slotCount = characterData.spellSlots?.current[useSlot] || 0;
      if (slotCount <= 0) {
        toast({ title: "No Spell Slots", description: `No ${useSlot}${getOrdinal(useSlot)} level slots remaining`, variant: "destructive" });
        return;
      }
    }

    const damage = getSpellDamage(spell, characterData.level || 1);

    const inferred = inferSpellEffects({ description: spell.description, name: spell.name } as any);
    const savePayload = useSaveMode
      ? {
          ability: saveAbility,
          dc: spellSaveDc,
          onSuccess: saveOnSuccess,
        }
      : inferred.saveAbility
        ? {
            ability: inferred.saveAbility,
            dc: spellSaveDc,
            onSuccess: inferred.onSuccess || "half",
          }
        : undefined;

    const resolvedDamage = (damage && damage !== "0")
      ? damage
      : (inferred.damageExpression || "0");

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "spell",
      targetId: selectedTargetId || myActorId,
      attackBonus: spellAttackBonus,
      damageExpression: resolvedDamage,
      spellName: spell.name,
      spellLevel: spell.level,
      slotUsed: spell.level > 0 ? (slotLevel || spell.level) : 0,
      actionType,
      isAOE: targeting.isAOE,
      aoeType: targeting.aoeType,
      aoeSize: targeting.aoeSize,
      save: savePayload,
    });

    setSpellDialogOpen(false);
  };

  const handleBonusAction = (bonusAction: { name: string; type: string }) => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't take actions at 0 HP.", variant: "destructive" });
      return;
    }
    if (!actionEconomy.bonusAction) {
      toast({ title: "No Bonus Action", description: "You've already used your bonus action", variant: "destructive" });
      return;
    }

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "bonus_action",
      bonusActionType: bonusAction.type,
      bonusActionName: bonusAction.name,
      targetId: selectedTargetId || myActorId,
      actionType: "bonus",
    });
  };

  const handleDodge = () => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't take actions at 0 HP.", variant: "destructive" });
      return;
    }
    if (!actionEconomy.action) {
      toast({ title: "No Action", description: "You've already used your action this turn", variant: "destructive" });
      return;
    }

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "dodge",
      actionType: "action",
    });
    
    toast({ title: "Dodging", description: "Attacks against you have disadvantage until your next turn" });
  };

  const handleDash = () => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't take actions at 0 HP.", variant: "destructive" });
      return;
    }
    if (!actionEconomy.action) {
      toast({ title: "No Action", description: "You've already used your action this turn", variant: "destructive" });
      return;
    }

    setActionEconomy(prev => ({
      ...prev,
      action: false,
      movement: prev.movement + prev.maxMovement,
    }));
    
    toast({ title: "Dash", description: `Movement increased to ${actionEconomy.movement + actionEconomy.maxMovement} ft` });
  };

  const handleDisengage = () => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't take actions at 0 HP.", variant: "destructive" });
      return;
    }
    if (!actionEconomy.action) {
      toast({ title: "No Action", description: "You've already used your action this turn", variant: "destructive" });
      return;
    }

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "disengage",
      actionType: "action",
    });
    
    toast({ title: "Disengage", description: "You won't provoke opportunity attacks this turn" });
  };

  // Waiting for turn display
  if (!isMyTurn) {
    return (
      <Card className={`${compact ? 'p-2' : 'p-3'} bg-black border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/20 font-mono`}>
        <div className={`${compact ? 'text-xs' : 'text-sm'} text-yellow-500/70 text-center`}>
          <Clock className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} inline mr-2 animate-pulse`} />
          <span className="tracking-wider">WAITING_FOR_TURN...</span>
          {actionEconomy.reaction && (
            <Badge className="ml-2 bg-yellow-900/50 text-yellow-400 border-yellow-500/50">REACTION_READY</Badge>
          )}
        </div>
      </Card>
    );
  }

  if (isDown) {
    return (
      <Card className={`${compact ? 'p-2' : 'p-3'} border-2 border-red-500/50 bg-black shadow-lg shadow-red-500/20 font-mono`}>
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-red-500 animate-pulse" />
          <span className={`${compact ? 'text-sm' : 'font-semibold'} text-red-400 tracking-wider`}>SYSTEM_FAILURE</span>
          <Badge className="ml-auto bg-red-900/50 text-red-400 border-red-500/50">0_HP</Badge>
        </div>
        <div className="text-sm text-red-500/70 mb-3">CRITICAL: Roll death_save();</div>
        <Button
          onClick={handleDeathSave}
          disabled={combatActionMutation.isPending}
          className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/50"
        >
          ROLL_DEATH_SAVE
        </Button>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={`${compact ? 'p-2' : 'p-3'} bg-black border-2 border-green-500/30 shadow-lg shadow-green-500/20 font-mono`}>
        {/* Header with action economy */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-green-500/30">
          <div className="flex items-center gap-2">
            <span className="text-green-400">$</span>
            <span className={`${compact ? 'text-sm' : 'text-base'} text-green-400`}>COMBAT.SYS</span>
            <span className="text-green-500/50 text-xs">[ACTIVE]</span>
          </div>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger>
                <Badge className={`text-xs ${actionEconomy.action ? 'bg-green-900/50 text-green-400 border-green-500/50' : 'bg-gray-900 text-gray-600 border-gray-700'}`}>
                  A
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-green-500/50 text-green-400">Action {actionEconomy.action ? "Available" : "Used"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Badge className={`text-xs ${actionEconomy.bonusAction ? 'bg-green-900/50 text-green-400 border-green-500/50' : 'bg-gray-900 text-gray-600 border-gray-700'}`}>
                  B
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-green-500/50 text-green-400">Bonus Action {actionEconomy.bonusAction ? "Available" : "Used"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Badge className={`text-xs ${actionEconomy.reaction ? 'bg-green-900/50 text-green-400 border-green-500/50' : 'bg-gray-900 text-gray-600 border-gray-700'}`}>
                  R
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-green-500/50 text-green-400">Reaction {actionEconomy.reaction ? "Ready" : "Used"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Badge className="text-xs bg-green-900/50 text-green-400 border-green-500/50">
                  <Footprints className="h-3 w-3 mr-1" />
                  {actionEconomy.movement}ft
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-green-500/50 text-green-400">Movement remaining</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Target selector */}
        {validTargets.length > 0 && (
          <div className="mb-2">
            <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
              <SelectTrigger className={`${compact ? 'h-8 text-xs' : ''} bg-black border-green-500/50 text-green-400`}>
                <SelectValue placeholder="&gt; SELECT TARGET..." />
              </SelectTrigger>
              <SelectContent>
                {validTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      <span>{target.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {target.currentHp}/{target.maxHp} HP • AC {target.ac}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-green-500 mb-1 tracking-wider">&gt; PRIMARY_ACTIONS</div>
          <div className="grid grid-cols-2 gap-2">

            <Button
              onClick={handleAttack}
              disabled={!selectedTargetId || !actionEconomy.action || combatActionMutation.isPending || waitingForTurn || passTurnMutation.isPending}
              size="sm"
              className="w-full bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
            >
              <Sword className="h-4 w-4 mr-1" />
              ATTACK
            </Button>
            
            <Dialog open={spellDialogOpen} onOpenChange={setSpellDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={!actionEconomy.action && !actionEconomy.bonusAction || waitingForTurn || passTurnMutation.isPending}
                  className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  CAST_SPELL
                  {knownSpells.length > 0 && <Badge className="ml-auto text-xs bg-cyan-900/50 text-cyan-300 border-cyan-500/50">{knownSpells.length}</Badge>}
                </Button>
              </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Cast a Spell</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 mb-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={useSaveMode}
                        onChange={(e) => setUseSaveMode(e.target.checked)}
                      />
                      <span className="text-sm">Resolve with saving throw</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={applyOutsideCombat}
                        onChange={(e) => setApplyOutsideCombat(e.target.checked)}
                      />
                      <span className="text-sm">Apply outside combat (affects room/NPCs without starting combat)</span>
                    </label>
                    {useSaveMode && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <Select value={saveAbility} onValueChange={(v) => setSaveAbility(v as any)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Ability" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dex">DEX</SelectItem>
                              <SelectItem value="con">CON</SelectItem>
                              <SelectItem value="wis">WIS</SelectItem>
                              <SelectItem value="int">INT</SelectItem>
                              <SelectItem value="cha">CHA</SelectItem>
                              <SelectItem value="str">STR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1">
                          <Select value={saveOnSuccess} onValueChange={(v) => setSaveOnSuccess(v as any)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="On success" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="half">Half damage</SelectItem>
                              <SelectItem value="none">No damage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 flex items-center text-muted-foreground justify-end pr-1">
                          DC {spellSaveDc}
                        </div>
                      </div>
                    )}
                  </div>
                  {knownSpells.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      {Object.entries(spellsByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, spells]) => (
                        <div key={level} className="mb-4">
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            {level === "0" ? "Cantrips" : `Level ${level}`}
                            {Number(level) > 0 && characterData.spellSlots && (
                              <Badge variant="outline" className="text-xs">
                                {characterData.spellSlots.current[Number(level)] || 0}/{characterData.spellSlots.max[Number(level)] || 0}
                              </Badge>
                            )}
                          </h4>
                          <div className="space-y-1">
                            {spells.map((spell) => {
                              const isBonusAction = BONUS_ACTION_SPELLS.includes(spell.name.toLowerCase());
                              const damage = getSpellDamage(spell, characterData.level || 1);
                              const inferred = inferSpellEffects({ description: spell.description, name: spell.name } as any);
                              const autoSave = inferred.saveAbility;
                              const targeting = getSpellTargeting(spell);
                              return (
                                <Button
                                  key={spell.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-left h-auto py-2"
                                  disabled={
                                    (isBonusAction && !actionEconomy.bonusAction) ||
                                    (!isBonusAction && !actionEconomy.action) ||
                                    (spell.level > 0 && (characterData.spellSlots?.current[spell.level] || 0) <= 0) ||
                                    waitingForTurn || passTurnMutation.isPending
                                  }
                                  onClick={() => {
                                    // Auto-enable save mode for save-based spells, otherwise keep manual toggle
                                    if (autoSave) {
                                      setUseSaveMode(true);
                                      setSaveAbility(autoSave);
                                      setSaveOnSuccess(inferred.onSuccess === "none" ? "none" : "half");
                                    }
                                    handleCastSpell(spell);
                                  }}
                                >
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2 w-full">
                                      <Flame className="h-3 w-3 text-orange-500" />
                                      <span className="font-medium">{spell.name}</span>
                                      <div className="flex gap-1 ml-auto">
                                        {isBonusAction && (
                                          <Badge variant="secondary" className="text-xs">Bonus</Badge>
                                        )}
                                        {targeting.isAOE && (
                                          <Badge variant="destructive" className="text-xs">
                                            AOE {targeting.aoeType ? `(${targeting.aoeSize})` : ""}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {spell.school} • {spell.castingTime} • {spell.range}
                                      {damage && <span className="text-red-400 ml-2">⚔ {damage}</span>}
                                    </div>
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  ) : (
                    <div className="space-y-2 py-3 text-sm text-muted-foreground">
                      <p>No known spells for this character.</p>
                      <p className="text-xs text-muted-foreground/80">
                        Add spells from the Spell Browser on your sheet to cast them here.
                      </p>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
          </div>

          {/* Utility Actions */}
          <div className="text-xs font-medium text-amber-500 mb-1 mt-3 tracking-wider">&gt; MOVEMENT_&_DEFENSE</div>
          <div className="grid grid-cols-3 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleDodge}
                  disabled={!actionEconomy.action || waitingForTurn || passTurnMutation.isPending}
                  className="text-xs h-7 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
                >
                  <Shield className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-amber-500/50 text-amber-400">Dodge (disadvantage on attacks)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleDash}
                  disabled={!actionEconomy.action || waitingForTurn || passTurnMutation.isPending}
                  className="text-xs h-7 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
                >
                  <Footprints className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-amber-500/50 text-amber-400">Dash (double movement)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleDisengage}
                  disabled={!actionEconomy.action || waitingForTurn || passTurnMutation.isPending}
                  className="text-xs h-7 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
                >
                  <SkipForward className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-amber-500/50 text-amber-400">Disengage (no opportunity attacks)</TooltipContent>
            </Tooltip>
          </div>

          {/* Class bonus actions */}
          {classBonusActions.length > 0 && actionEconomy.bonusAction && (
            <div className="mt-3">
              <div className="text-xs font-medium text-purple-500 mb-1 tracking-wider">&gt; BONUS_ACTIONS</div>
              <div className="space-y-1">
                {classBonusActions.map((ba) => (
                  <Tooltip key={ba.type}>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="w-full justify-start text-xs h-7 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 border border-purple-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
                        onClick={() => handleBonusAction(ba)}
                        disabled={!actionEconomy.bonusAction || waitingForTurn || passTurnMutation.isPending}
                      >
                        <ChevronRight className="h-3 w-3 mr-1" />
                        {ba.name.toUpperCase()}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-black border-purple-500/50 text-purple-400">{ba.description}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* End Turn Button */}
          <Button
            size="sm"
            className="w-full text-xs mt-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/50 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
            onClick={() => passTurnMutation.mutate()}
            disabled={passTurnMutation.isPending || waitingForTurn}
          >
            <Clock className="h-3 w-3 mr-1" />
            END_TURN
          </Button>
        </div>

        {/* Attack/spell stats footer */}
        <div className="mt-2 pt-2 border-t border-green-500/30 text-xs text-green-500/70 flex justify-between">
          <span>ATK: <span className="text-green-400">+{attackBonus}</span></span>
          {knownSpells.length > 0 && <span>SPL: <span className="text-cyan-400">+{spellAttackBonus}</span></span>}
          <span>AC: <span className="text-amber-400">{participants.find(p => p.id === myActorId)?.ac || "?"}</span></span>
        </div>
      </Card>
    </TooltipProvider>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
}

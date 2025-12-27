import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
}

export function DnD5eCombatPanel({
  roomCode,
  myActorId,
  isMyTurn,
  participants,
  characterData,
  allSpells,
  compact = false,
}: DnD5eCombatPanelProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedSpell, setSelectedSpell] = useState<SpellData | null>(null);
  const [spellDialogOpen, setSpellDialogOpen] = useState(false);
  const [customSpellName, setCustomSpellName] = useState("Magic Missile");
  const [customSpellDamage, setCustomSpellDamage] = useState("1d6");
  const [customSpellIsBonus, setCustomSpellIsBonus] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Get character's known spells with full data
  const knownSpells = useMemo(() => {
    const prepared = characterData.spells || [];
    const preparedSet = new Set(prepared.map((s) => s.toLowerCase()));
    const charClassNormalized = (characterData.class || "").toLowerCase();

    // Spells explicitly prepared/known on the character
    const preparedSpells = allSpells.filter(
      (spell) => preparedSet.has(spell.name.toLowerCase()) || preparedSet.has(spell.id.toLowerCase())
    );

    // Cantrips are always available for classes that get them, even if not prepared
    const classCantrips = allSpells.filter(
      (spell) =>
        spell.level === 0 &&
        spell.classes.some((c) => c.toLowerCase() === charClassNormalized)
    );

    const merged = new Map<string, SpellData>();
    preparedSpells.forEach((spell) => merged.set(spell.id, spell));
    classCantrips.forEach((spell) => merged.set(spell.id, spell));

    return Array.from(merged.values());
  }, [characterData.class, characterData.spells, allSpells]);

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
      if (error.message?.toLowerCase().includes("not actor")) {
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
    onSuccess: () => {
      // Reset action economy for next turn
      setActionEconomy({
        action: true,
        bonusAction: true,
        reaction: true,
        movement: characterData.speed || 30,
        maxMovement: characterData.speed || 30,
      });
    },
    onError: (error: Error) => {
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

  const handleCastSpell = (spell: SpellData, slotLevel?: number) => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't cast while at 0 HP.", variant: "destructive" });
      return;
    }
    if (!selectedTargetId && spell.range !== "Self") {
      toast({ title: "No Target", description: "Select a target first", variant: "destructive" });
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

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "spell",
      targetId: selectedTargetId || myActorId,
      attackBonus: spellAttackBonus,
      damageExpression: damage || "0",
      spellName: spell.name,
      spellLevel: spell.level,
      slotUsed: spell.level > 0 ? (slotLevel || spell.level) : 0,
      actionType,
    });

    setSpellDialogOpen(false);
  };

  const handleCastCustomSpell = () => {
    if (isDown) {
      toast({ title: "Unconscious", description: "You can't cast while at 0 HP.", variant: "destructive" });
      return;
    }

    if (!selectedTargetId) {
      toast({ title: "No Target", description: "Select a target first", variant: "destructive" });
      return;
    }

    const actionType = customSpellIsBonus ? "bonus" : "action";
    if (actionType === "action" && !actionEconomy.action) {
      toast({ title: "No Action", description: "You've already used your action this turn", variant: "destructive" });
      return;
    }
    if (actionType === "bonus" && !actionEconomy.bonusAction) {
      toast({ title: "No Bonus Action", description: "You've already used your bonus action", variant: "destructive" });
      return;
    }

    const damageExpression = customSpellDamage || "0";

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "spell",
      targetId: selectedTargetId,
      attackBonus: spellAttackBonus,
      damageExpression,
      spellName: customSpellName || "Custom Spell",
      spellLevel: 0,
      slotUsed: 0,
      actionType,
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
      <Card className={`${compact ? 'p-2' : 'p-3'} bg-muted/50`}>
        <div className={`${compact ? 'text-xs' : 'text-sm'} text-muted-foreground text-center`}>
          <Clock className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} inline mr-2`} />
          Waiting for your turn...
          {actionEconomy.reaction && (
            <Badge variant="outline" className="ml-2">Reaction Ready</Badge>
          )}
        </div>
      </Card>
    );
  }

  if (isDown) {
    return (
      <Card className={`${compact ? 'p-2' : 'p-3'} border-destructive/50 bg-destructive/5`}>
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-destructive" />
          <span className={`${compact ? 'text-sm' : 'font-semibold'}`}>You are unconscious</span>
          <Badge variant="destructive" className="ml-auto">0 HP</Badge>
        </div>
        <div className="text-sm text-muted-foreground mb-3">Roll a death saving throw.</div>
        <Button
          onClick={handleDeathSave}
          disabled={combatActionMutation.isPending}
          className="w-full"
        >
          Roll Death Save
        </Button>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={`${compact ? 'p-2' : 'p-3'} border-primary/50 bg-primary/5`}>
        {/* Header with action economy */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className={`${compact ? 'text-sm' : 'font-semibold'}`}>Your Turn</span>
          </div>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger>
                <Badge variant={actionEconomy.action ? "default" : "secondary"} className="text-xs">
                  A
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Action {actionEconomy.action ? "Available" : "Used"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant={actionEconomy.bonusAction ? "default" : "secondary"} className="text-xs">
                  B
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Bonus Action {actionEconomy.bonusAction ? "Available" : "Used"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant={actionEconomy.reaction ? "outline" : "secondary"} className="text-xs">
                  R
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Reaction {actionEconomy.reaction ? "Ready" : "Used"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  <Footprints className="h-3 w-3 mr-1" />
                  {actionEconomy.movement}ft
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Movement remaining</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Target selector */}
        {validTargets.length > 0 && (
          <div className="mb-2">
            <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
              <SelectTrigger className={compact ? "h-8 text-xs" : ""}>
                <SelectValue placeholder="Select target..." />
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

        <Tabs defaultValue="actions" className="w-full">
          <TabsList className={`grid w-full ${knownSpells.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} ${compact ? 'h-7' : ''}`}>
            <TabsTrigger value="actions" className={compact ? "text-xs py-1" : ""}>Actions</TabsTrigger>
            <TabsTrigger value="spells" className={compact ? "text-xs py-1" : ""}>
              Spells {knownSpells.length > 0 ? `(${knownSpells.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="other" className={compact ? "text-xs py-1" : ""}>Other</TabsTrigger>
          </TabsList>

          {/* Main Actions Tab */}
          <TabsContent value="actions" className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-1">
              <Button
                onClick={handleAttack}
                disabled={!selectedTargetId || !actionEconomy.action || combatActionMutation.isPending}
                size={compact ? "sm" : "default"}
                className="w-full"
              >
                <Sword className="h-4 w-4 mr-1" />
                Attack
              </Button>
              
              <Dialog open={spellDialogOpen} onOpenChange={setSpellDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    size={compact ? "sm" : "default"}
                    disabled={!actionEconomy.action && !actionEconomy.bonusAction}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Cast Spell
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>{knownSpells.length > 0 ? "Cast a Spell" : "Cast a Custom Spell"}</DialogTitle>
                  </DialogHeader>
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
                              return (
                                <Button
                                  key={spell.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-left h-auto py-2"
                                  disabled={
                                    (isBonusAction && !actionEconomy.bonusAction) ||
                                    (!isBonusAction && !actionEconomy.action) ||
                                    (spell.level > 0 && (characterData.spellSlots?.current[spell.level] || 0) <= 0)
                                  }
                                  onClick={() => handleCastSpell(spell)}
                                >
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2 w-full">
                                      <Flame className="h-3 w-3 text-orange-500" />
                                      <span className="font-medium">{spell.name}</span>
                                      {isBonusAction && (
                                        <Badge variant="secondary" className="text-xs ml-auto">Bonus</Badge>
                                      )}
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
                    <div className="space-y-3">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Spell Name</label>
                        <input
                          className="w-full rounded border bg-background px-3 py-2 text-sm"
                          value={customSpellName}
                          onChange={(e) => setCustomSpellName(e.target.value)}
                          placeholder="Magic Missile"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Damage Expression (e.g. 2d6+1)</label>
                        <input
                          className="w-full rounded border bg-background px-3 py-2 text-sm"
                          value={customSpellDamage}
                          onChange={(e) => setCustomSpellDamage(e.target.value)}
                          placeholder="1d6"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={customSpellIsBonus}
                          onChange={(e) => setCustomSpellIsBonus(e.target.checked)}
                        />
                        <span className="text-sm">Cast as bonus action</span>
                      </div>
                      <Button onClick={handleCastCustomSpell} className="w-full">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Cast Custom Spell
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            {/* Class bonus actions */}
            {classBonusActions.length > 0 && actionEconomy.bonusAction && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">Bonus Actions:</div>
                <div className="grid grid-cols-1 gap-1">
                  {classBonusActions.map((ba) => (
                    <Tooltip key={ba.type}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => handleBonusAction(ba)}
                          disabled={!actionEconomy.bonusAction}
                        >
                          <ChevronRight className="h-3 w-3 mr-1" />
                          {ba.name}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{ba.description}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Spells Tab */}
          <TabsContent value="spells" className="mt-2">
            {knownSpells.length > 0 ? (
              <ScrollArea className="h-[150px]">
                {Object.entries(spellsByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, spells]) => (
                  <div key={level} className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {level === "0" ? "Cantrips" : `Lvl ${level}`}
                      {Number(level) > 0 && ` (${characterData.spellSlots?.current[Number(level)] || 0})`}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {spells.map((spell) => (
                        <Button
                          key={spell.id}
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => handleCastSpell(spell)}
                          disabled={
                            (spell.level > 0 && (characterData.spellSlots?.current[spell.level] || 0) <= 0) ||
                            (!actionEconomy.action && !BONUS_ACTION_SPELLS.includes(spell.name.toLowerCase()))
                          }
                        >
                          {spell.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">No prepared spells. Cast a custom spell:</div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Spell Name</label>
                  <input
                    className="w-full rounded border bg-background px-3 py-2 text-sm"
                    value={customSpellName}
                    onChange={(e) => setCustomSpellName(e.target.value)}
                    placeholder="Magic Missile"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Damage Expression (e.g. 2d6+1)</label>
                  <input
                    className="w-full rounded border bg-background px-3 py-2 text-sm"
                    value={customSpellDamage}
                    onChange={(e) => setCustomSpellDamage(e.target.value)}
                    placeholder="1d6"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customSpellIsBonus}
                    onChange={(e) => setCustomSpellIsBonus(e.target.checked)}
                  />
                  <span className="text-sm">Cast as bonus action</span>
                </div>
                <Button onClick={handleCastCustomSpell} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Cast Custom Spell
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Other Actions Tab */}
          <TabsContent value="other" className="mt-2 space-y-1">
            <div className="grid grid-cols-3 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDodge}
                    disabled={!actionEconomy.action}
                    className="text-xs"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Dodge
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attacks against you have disadvantage until your next turn</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDash}
                    disabled={!actionEconomy.action}
                    className="text-xs"
                  >
                    <Footprints className="h-3 w-3 mr-1" />
                    Dash
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Double your movement this turn</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisengage}
                    disabled={!actionEconomy.action}
                    className="text-xs"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Disengage
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Your movement doesn't provoke opportunity attacks</TooltipContent>
              </Tooltip>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => passTurnMutation.mutate()}
              disabled={passTurnMutation.isPending}
            >
              <Clock className="h-3 w-3 mr-1" />
              End Turn
            </Button>
          </TabsContent>
        </Tabs>

        {/* Attack/spell stats footer */}
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex justify-between">
          <span>Attack: +{attackBonus}</span>
          {knownSpells.length > 0 && <span>Spell Attack: +{spellAttackBonus}</span>}
          <span>AC: {participants.find(p => p.id === myActorId)?.ac || "?"}</span>
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

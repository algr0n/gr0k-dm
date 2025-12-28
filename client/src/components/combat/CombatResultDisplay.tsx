import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skull, Heart, Shield, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

interface CombatResult {
  type: "combat_result";
  actorId: string;
  targetId?: string;
  attackRoll?: number;
  attackTotal?: number;
  hit: boolean;
  isCritical?: boolean;
  damageRolls?: number[];
  damageTotal?: number;
  targetHp?: number;
   spellName?: string;
   saveDc?: number;
   saveAbility?: string;
   saveRoll?: number[];
   saveTotal?: number;
   saveSuccess?: boolean;
   saveBreakdown?: string;
  timestamp?: number;
}

interface CombatEvent {
  type: "combat_event";
  event: string;
  actorId?: string;
  targetId?: string;
  name?: string;
}

interface CombatResultDisplayProps {
  results: (CombatResult | CombatEvent)[];
  participants: Array<{ id: string; name: string }>;
}

export function CombatResultDisplay({
  results,
  participants,
}: CombatResultDisplayProps) {
  const [displayResults, setDisplayResults] = useState<(CombatResult | CombatEvent)[]>([]);

  useEffect(() => {
    // Keep only last 5 results
    setDisplayResults((prev) => {
      const combined = [...prev, ...results];
      return combined.slice(-5);
    });
  }, [results]);

  const getParticipantName = (id?: string) => {
    if (!id) return "Unknown";
    const participant = participants.find((p) => p.id === id);
    return participant?.name || "Unknown";
  };

  const formatAbility = (ability?: string) => {
    if (!ability) return "";
    const map: Record<string, string> = { str: "STR", strength: "STR", dex: "DEX", dexterity: "DEX", con: "CON", constitution: "CON", int: "INT", intelligence: "INT", wis: "WIS", wisdom: "WIS", cha: "CHA", charisma: "CHA" };
    return map[ability.toLowerCase()] || ability.toUpperCase();
  };

  const formatCombatResult = (result: CombatResult) => {
    const actorName = getParticipantName(result.actorId);
    const targetName = getParticipantName(result.targetId);

    // Saving throw–based spells
    if (typeof result.saveDc === "number") {
      const saveSucceeded = !!result.saveSuccess;
      const title = saveSucceeded ? "Save Succeeded" : "Save Failed";
      const icon = saveSucceeded ? Shield : Skull;
      const iconColor = saveSucceeded ? "text-blue-400" : "text-red-500";
      const damageLine = typeof result.damageTotal === "number"
        ? `Damage: ${result.damageTotal}${saveSucceeded ? " (reduced)" : ""}`
        : "Damage: -";
      const saveLine = `Save: ${formatAbility(result.saveAbility)} vs DC ${result.saveDc} (${result.saveTotal ?? "?"}${result.saveBreakdown ? ` | ${result.saveBreakdown}` : ""})`;

      return {
        icon,
        iconColor,
        title,
        description: `${actorName} casts ${result.spellName || "a spell"} on ${targetName}`,
        details: [saveLine, damageLine, `${targetName} HP: ${result.targetHp}`],
        variant: saveSucceeded ? "secondary" : "destructive",
      };
    }

    if (result.hit) {
      return {
        icon: result.isCritical ? Skull : Swords,
        iconColor: result.isCritical ? "text-red-600" : "text-orange-500",
        title: result.isCritical ? "Critical Hit!" : "Hit!",
        description: `${actorName} attacks ${targetName}`,
        details: [
          `Attack: d20(${result.attackRoll}) + bonus = ${result.attackTotal}`,
          result.damageRolls && result.damageRolls.length > 0
            ? `Damage: ${result.damageRolls.map(r => `d(${r})`).join(" + ")} = ${result.damageTotal}`
            : `Damage: ${result.damageTotal}`,
          `${targetName} HP: ${result.targetHp}`,
        ],
        variant: result.isCritical ? "destructive" : "default",
      };
    } else {
      return {
        icon: Shield,
        iconColor: "text-blue-500",
        title: "Miss",
        description: `${actorName} attacks ${targetName}`,
        details: [
          `Attack: d20(${result.attackRoll}) + bonus = ${result.attackTotal}`,
          `Failed to hit!`,
        ],
        variant: "secondary",
      };
    }
  };

  const formatCombatEvent = (event: CombatEvent) => {
    switch (event.event) {
      case "defeated":
        return {
          icon: Skull,
          iconColor: "text-red-600",
          title: "Defeated!",
          description: `${event.name || getParticipantName(event.targetId)} has been defeated`,
          details: [],
          variant: "destructive",
        };
      case "pass":
        return {
          icon: Shield,
          iconColor: "text-gray-500",
          title: "Pass",
          description: `${getParticipantName(event.actorId)} passes their turn`,
          details: [],
          variant: "secondary",
        };
      case "hold":
        return {
          icon: Shield,
          iconColor: "text-yellow-500",
          title: "Hold Action",
          description: `${getParticipantName(event.actorId)} is holding their action`,
          details: [],
          variant: "outline",
        };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-1">
      {displayResults.map((result, idx) => {
        const formatted =
          result.type === "combat_result"
            ? formatCombatResult(result)
            : result.type === "combat_event"
            ? formatCombatEvent(result)
            : null;

        if (!formatted) return null;

        const Icon = formatted.icon;

        return (
          <div
            key={idx}
            className={cn(
              "border-b border-slate-700/60 pb-2 last:border-0 text-xs text-slate-100 font-mono"
            )}
          >
            <div className="flex items-start gap-2">
              <Icon className={cn("h-4 w-4 mt-0.5", formatted.iconColor)} />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatted.title}</span>
                  <Badge variant={formatted.variant as any} className="text-[10px] uppercase tracking-wide">
                    Combat
                  </Badge>
                </div>
                <div className="text-slate-100/80">{formatted.description}</div>
                {formatted.details.length > 0 && (
                  <div className="text-[11px] text-slate-200/80 space-y-0.5 pt-1">
                    {formatted.details.map((detail, i) => (
                      <div key={i}>{detail}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

  const formatCombatResult = (result: CombatResult) => {
    const actorName = getParticipantName(result.actorId);
    const targetName = getParticipantName(result.targetId);

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
    <div className="space-y-2">
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
          <Card
            key={idx}
            className={cn(
              "p-3 animate-in slide-in-from-bottom-2 duration-300",
              formatted.variant === "destructive" && "border-destructive/50 bg-destructive/5",
              formatted.variant === "default" && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-start gap-3">
              <Icon className={cn("h-5 w-5 mt-0.5", formatted.iconColor)} />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{formatted.title}</h4>
                  <Badge variant={formatted.variant as any} className="text-xs">
                    Combat
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatted.description}
                </p>
                {formatted.details.length > 0 && (
                  <div className="text-xs text-muted-foreground font-mono space-y-0.5 pt-1">
                    {formatted.details.map((detail, i) => (
                      <div key={i}>{detail}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

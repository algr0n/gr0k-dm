import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sword, Wand2, Shield as ShieldIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attack {
  name: string;
  toHit: number;
  damage: string;
  damageType: string;
  range?: string;
  notes?: string;
}

interface Feature {
  name: string;
  description: string;
  uses?: {
    current: number;
    max: number;
  };
}

interface ActionsPanelProps {
  attacks: Attack[];
  features: Feature[];
  onAttack?: (attack: Attack) => void;
  onUseFeature?: (feature: Feature) => void;
  className?: string;
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function ActionsPanel({
  attacks,
  features,
  onAttack,
  onUseFeature,
  className,
}: ActionsPanelProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid="actions-panel">
      {/* Attacks Section */}
      <div>
        <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
          <Sword className="h-5 w-5" />
          Attacks
        </h3>
        {attacks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attacks configured
          </p>
        ) : (
          <div className="space-y-2">
            {attacks.map((attack, idx) => (
              <Card
                key={idx}
                className="p-3 border-2"
                data-testid={`attack-${idx}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{attack.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs font-mono">
                        {formatModifier(attack.toHit)} to hit
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {attack.damage} {attack.damageType}
                      </Badge>
                      {attack.range && (
                        <Badge variant="outline" className="text-xs">
                          {attack.range}
                        </Badge>
                      )}
                    </div>
                    {attack.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {attack.notes}
                      </p>
                    )}
                  </div>
                  {onAttack && (
                    <Button
                      size="sm"
                      onClick={() => onAttack(attack)}
                      data-testid={`attack-button-${idx}`}
                    >
                      <Sword className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Features & Traits Section */}
      <div>
        <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
          <ShieldIcon className="h-5 w-5" />
          Features & Traits
        </h3>
        {features.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No features available
          </p>
        ) : (
          <div className="space-y-2">
            {features.map((feature, idx) => (
              <Card
                key={idx}
                className="p-3 border-2"
                data-testid={`feature-${idx}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{feature.name}</p>
                      {feature.uses && (
                        <Badge 
                          variant={feature.uses.current > 0 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {feature.uses.current}/{feature.uses.max}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  {onUseFeature && feature.uses && feature.uses.current > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUseFeature(feature)}
                      data-testid={`feature-button-${idx}`}
                    >
                      <Wand2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

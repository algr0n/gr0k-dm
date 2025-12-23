import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, Dices, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

interface HitDice {
  diceType: string;
  current: number;
  max: number;
}

interface DeathSaves {
  successes: number;
  failures: number;
}

interface ResourcesPanelProps {
  hitDice: HitDice[];
  deathSaves: DeathSaves;
  onUseHitDice?: (diceType: string) => void;
  onRecoverHitDice?: (diceType: string) => void;
  onMarkDeathSave?: (type: "success" | "failure") => void;
  onResetDeathSaves?: () => void;
  className?: string;
}

export function ResourcesPanel({
  hitDice,
  deathSaves,
  onUseHitDice,
  onRecoverHitDice,
  onMarkDeathSave,
  onResetDeathSaves,
  className,
}: ResourcesPanelProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid="resources-panel">
      {/* Hit Dice */}
      <Card className="p-4 border-2">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Dices className="h-4 w-4" />
          Hit Dice
        </h4>
        <div className="space-y-2">
          {hitDice.map((hd) => (
            <div
              key={hd.diceType}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30"
              data-testid={`hit-dice-${hd.diceType}`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {hd.diceType}
                </Badge>
                <span className="text-sm font-mono font-bold">
                  {hd.current}/{hd.max}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUseHitDice?.(hd.diceType)}
                  disabled={hd.current === 0}
                  data-testid={`use-hit-dice-${hd.diceType}`}
                >
                  Use
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRecoverHitDice?.(hd.diceType)}
                  disabled={hd.current >= hd.max}
                  data-testid={`recover-hit-dice-${hd.diceType}`}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Death Saves */}
      <Card className="p-4 border-2 border-red-200 dark:border-red-900">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Skull className="h-4 w-4 text-red-500" />
          Death Saves
        </h4>
        
        <div className="space-y-3">
          {/* Successes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Successes</span>
              <span className="text-xs font-mono">{deathSaves.successes}/3</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <button
                  key={`success-${i}`}
                  className={cn(
                    "flex-1 h-8 rounded border-2 transition-colors",
                    i <= deathSaves.successes
                      ? "bg-green-500 border-green-600"
                      : "bg-muted border-border hover:border-green-400"
                  )}
                  onClick={() => onMarkDeathSave?.("success")}
                  data-testid={`death-save-success-${i}`}
                />
              ))}
            </div>
          </div>

          {/* Failures */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Failures</span>
              <span className="text-xs font-mono">{deathSaves.failures}/3</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <button
                  key={`failure-${i}`}
                  className={cn(
                    "flex-1 h-8 rounded border-2 transition-colors",
                    i <= deathSaves.failures
                      ? "bg-red-500 border-red-600"
                      : "bg-muted border-border hover:border-red-400"
                  )}
                  onClick={() => onMarkDeathSave?.("failure")}
                  data-testid={`death-save-failure-${i}`}
                />
              ))}
            </div>
          </div>

          {(deathSaves.successes > 0 || deathSaves.failures > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onResetDeathSaves}
              data-testid="reset-death-saves"
            >
              Reset
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

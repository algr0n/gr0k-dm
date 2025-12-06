import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dices, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { DiceRoll } from "@shared/schema";

const QUICK_DICE = [
  { label: "d4", expression: "1d4" },
  { label: "d6", expression: "1d6" },
  { label: "d8", expression: "1d8" },
  { label: "d10", expression: "1d10" },
  { label: "d12", expression: "1d12" },
  { label: "d20", expression: "1d20" },
  { label: "d100", expression: "1d100" },
  { label: "2d6", expression: "2d6" },
  { label: "4d6", expression: "4d6" },
];

export function DiceRoller() {
  const [customExpression, setCustomExpression] = useState("");
  const queryClient = useQueryClient();

  const { data: recentRolls = [] } = useQuery<DiceRoll[]>({
    queryKey: ["/api/dice/history"],
  });

  const rollMutation = useMutation({
    mutationFn: async (expression: string) => {
      const result = await apiRequest("POST", "/api/dice/roll", { expression });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dice/history"] });
    },
  });

  const handleRoll = (expression: string) => {
    if (expression.trim()) {
      rollMutation.mutate(expression);
    }
  };

  const handleCustomRoll = (e: React.FormEvent) => {
    e.preventDefault();
    handleRoll(customExpression);
    setCustomExpression("");
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Dices className="h-5 w-5" />
          <span className="font-serif">Dice Roller</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {QUICK_DICE.map((die) => (
            <Button
              key={die.expression}
              variant="outline"
              size="sm"
              onClick={() => handleRoll(die.expression)}
              disabled={rollMutation.isPending}
              data-testid={`button-roll-${die.label}`}
            >
              {die.label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleCustomRoll} className="flex gap-2">
          <Input
            placeholder="Custom roll (e.g., 2d6+3)"
            value={customExpression}
            onChange={(e) => setCustomExpression(e.target.value)}
            className="font-mono"
            data-testid="input-custom-dice"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={rollMutation.isPending || !customExpression.trim()}
            data-testid="button-custom-roll"
          >
            <RotateCcw className={`h-4 w-4 ${rollMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
        </form>

        {rollMutation.data && (
          <div className="p-4 rounded-md bg-primary/10 border border-primary/20 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {rollMutation.data.expression}
            </p>
            <p className="text-4xl font-bold font-mono text-primary" data-testid="text-roll-result">
              {rollMutation.data.total}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              [{rollMutation.data.rolls.join(", ")}]
              {rollMutation.data.modifier !== 0 && (
                <span> {rollMutation.data.modifier > 0 ? "+" : ""}{rollMutation.data.modifier}</span>
              )}
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Rolls</h4>
          <ScrollArea className="h-[150px]">
            {recentRolls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rolls yet. Roll some dice!
              </p>
            ) : (
              <div className="space-y-2">
                {recentRolls.slice(0, 10).map((roll) => (
                  <div
                    key={roll.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                    data-testid={`roll-history-${roll.id}`}
                  >
                    <span className="font-mono text-muted-foreground">{roll.expression}</span>
                    <span className="font-bold font-mono">{roll.total}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface HPBarProps {
  currentHp: number;
  maxHp: number;
  className?: string;
}

export function HPBar({ currentHp, maxHp, className }: HPBarProps) {
  const hpPercentage = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  
  const getHpColor = () => {
    if (hpPercentage > 50) return "text-green-600 dark:text-green-400";
    if (hpPercentage > 25) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className={cn("space-y-2", className)} data-testid="hp-bar">
      <div className="flex justify-between text-sm">
        <span className={cn("font-medium", getHpColor())}>
          HP: {currentHp}/{maxHp}
        </span>
        <span className="text-muted-foreground">{hpPercentage.toFixed(0)}%</span>
      </div>
      <Progress value={hpPercentage} className="h-3" />
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { xpThresholds } from "@shared/schema";

interface XPLevelCardProps {
  level: number;
  xp: number;
  className?: string;
}

export function XPLevelCard({ level, xp, className }: XPLevelCardProps) {
  const currentThreshold = xpThresholds[level] || 0;
  const nextThreshold = xpThresholds[level + 1] || xpThresholds[20];
  const xpIntoLevel = xp - currentThreshold;
  const xpForNextLevel = nextThreshold - currentThreshold;
  
  // Handle max level case (level 20)
  const isMaxLevel = level >= 20;
  const xpPercentage = isMaxLevel || xpForNextLevel === 0 
    ? 100 
    : Math.min(100, Math.max(0, (xpIntoLevel / xpForNextLevel) * 100));

  return (
    <Card className={cn("p-4 space-y-3", className)} data-testid="xp-level-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-semibold">Level {level}</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {xp.toLocaleString()} XP
        </span>
      </div>
      
      {!isMaxLevel ? (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress to Level {level + 1}</span>
            <span>{xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()}</span>
          </div>
          <Progress value={xpPercentage} className="h-2" />
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-2">
          Maximum Level Reached
        </div>
      )}
    </Card>
  );
}

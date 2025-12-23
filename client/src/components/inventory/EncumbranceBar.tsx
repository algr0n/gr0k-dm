import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface EncumbranceBarProps {
  currentWeight: number;
  maxWeight: number;
  className?: string;
}

export function EncumbranceBar({ currentWeight, maxWeight, className }: EncumbranceBarProps) {
  const percentage = Math.min(100, (currentWeight / maxWeight) * 100);
  
  const getColorClass = () => {
    if (percentage < 50) return "bg-encumbrance-light";
    if (percentage < 90) return "bg-encumbrance-medium";
    return "bg-encumbrance-heavy";
  };

  const getStatusText = () => {
    if (percentage < 50) return "Light";
    if (percentage < 90) return "Encumbered";
    return "Heavily Encumbered";
  };

  const getStatusColor = () => {
    if (percentage < 50) return "text-encumbrance-light";
    if (percentage < 90) return "text-encumbrance-medium";
    return "text-encumbrance-heavy";
  };

  return (
    <div className={cn("space-y-1", className)} data-testid="encumbrance-bar">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="font-medium">Carry Weight</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", getStatusColor())}>
            {getStatusText()}
          </span>
          <span className="text-muted-foreground">
            {currentWeight.toFixed(1)} / {maxWeight} lb
          </span>
        </div>
      </div>
      <Progress 
        value={percentage} 
        className="h-2"
        indicatorClassName={getColorClass()}
      />
    </div>
  );
}

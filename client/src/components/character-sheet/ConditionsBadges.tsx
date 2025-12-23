import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  AlertCircle, 
  CloudRain, 
  Eye, 
  Flame, 
  Shield, 
  Zap,
  Skull,
} from "lucide-react";

interface Condition {
  name: string;
  description: string;
  duration?: string;
}

interface ConditionsBadgesProps {
  conditions: Condition[];
  className?: string;
}

const conditionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Blinded: Eye,
  Poisoned: Skull,
  Frightened: AlertCircle,
  Invisible: CloudRain,
  Stunned: Zap,
  Paralyzed: Zap,
  Petrified: Shield,
  Prone: AlertCircle,
  default: Flame,
};

const conditionColors: Record<string, string> = {
  Blinded: "bg-gray-600 text-white",
  Charmed: "bg-pink-600 text-white",
  Deafened: "bg-gray-500 text-white",
  Frightened: "bg-purple-600 text-white",
  Grappled: "bg-orange-600 text-white",
  Incapacitated: "bg-red-600 text-white",
  Invisible: "bg-blue-300 text-gray-800",
  Paralyzed: "bg-yellow-600 text-white",
  Petrified: "bg-stone-600 text-white",
  Poisoned: "bg-green-700 text-white",
  Prone: "bg-brown-600 text-white",
  Restrained: "bg-amber-700 text-white",
  Stunned: "bg-indigo-600 text-white",
  Unconscious: "bg-black text-white",
  Exhaustion: "bg-red-700 text-white",
  Concentration: "bg-blue-600 text-white",
};

export function ConditionsBadges({ conditions, className }: ConditionsBadgesProps) {
  if (conditions.length === 0) return null;

  return (
    <div 
      className={cn("flex flex-wrap gap-1.5", className)} 
      data-testid="conditions-badges"
    >
      {conditions.map((condition, idx) => {
        const Icon = conditionIcons[condition.name] || conditionIcons.default;
        const colorClass = conditionColors[condition.name] || "bg-gray-600 text-white";
        
        return (
          <Badge
            key={`${condition.name}-${idx}`}
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1",
              colorClass
            )}
            data-testid={`condition-${condition.name.toLowerCase()}`}
          >
            <Icon className="h-3 w-3" />
            <span>{condition.name}</span>
            {condition.duration && (
              <span className="text-xs opacity-90">({condition.duration})</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}

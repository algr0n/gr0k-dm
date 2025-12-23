import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Heart, Shield, Zap, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterSummaryBarProps {
  characterName: string;
  race: string;
  characterClass: string;
  level: number;
  currentHp: number;
  maxHp: number;
  tempHp?: number;
  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
  className?: string;
}

export function CharacterSummaryBar({
  characterName,
  race,
  characterClass,
  level,
  currentHp,
  maxHp,
  tempHp = 0,
  armorClass,
  initiative,
  speed,
  proficiencyBonus,
  className,
}: CharacterSummaryBarProps) {
  const hpPercentage = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  
  const getHpColorClass = () => {
    if (hpPercentage > 50) return "bg-green-500";
    if (hpPercentage > 25) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card 
      className={cn("p-4 sticky top-0 z-10 bg-card/95 backdrop-blur", className)}
      data-testid="character-summary-bar"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        {/* Character Name and Identity */}
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl font-bold truncate">{characterName}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {race}
            </Badge>
            <Badge className="text-xs">
              {characterClass}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Level {level}
            </Badge>
          </div>
        </div>

        {/* HP Bar */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Hit Points</span>
          </div>
          <div className="flex items-center gap-2">
            <Progress 
              value={hpPercentage} 
              className="h-3 flex-1"
              indicatorClassName={getHpColorClass()}
            />
            <span className="text-sm font-mono font-bold min-w-[60px] text-right">
              {currentHp}/{maxHp}
            </span>
          </div>
          {tempHp > 0 && (
            <p className="text-xs text-blue-500 mt-1">
              +{tempHp} temp HP
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">AC</span>
            </div>
            <p className="text-lg font-bold font-mono">{armorClass}</p>
          </div>
          
          <Separator orientation="vertical" className="h-12" />
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Init</span>
            </div>
            <p className="text-lg font-bold font-mono">
              {initiative >= 0 ? '+' : ''}{initiative}
            </p>
          </div>
          
          <Separator orientation="vertical" className="h-12" />
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <User className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Speed</span>
            </div>
            <p className="text-lg font-bold font-mono">{speed} ft</p>
          </div>
          
          <Separator orientation="vertical" className="h-12" />
          
          <div className="text-center">
            <span className="text-xs text-muted-foreground block mb-1">Prof</span>
            <p className="text-lg font-bold font-mono">+{proficiencyBonus}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

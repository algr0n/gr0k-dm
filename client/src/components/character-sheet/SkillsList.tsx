import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Circle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Skill } from "./types";

interface SkillsListProps {
  skills: Skill[];
  proficiencyBonus: number;
  hasJackOfAllTrades?: boolean;
  hasReliableTalent?: boolean;
  className?: string;
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function SkillsList({
  skills,
  proficiencyBonus,
  hasJackOfAllTrades = false,
  hasReliableTalent = false,
  className,
}: SkillsListProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="skills-list">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">Skills</h3>
        <Badge variant="outline" className="text-xs">
          Prof +{proficiencyBonus}
        </Badge>
      </div>

      {hasJackOfAllTrades && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md">
          <Star className="h-4 w-4 text-amber-500" />
          <span>Jack of All Trades: +{Math.floor(proficiencyBonus / 2)} to non-proficient skills</span>
        </div>
      )}

      {hasReliableTalent && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>Reliable Talent: Minimum 10 on proficient skill rolls</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {skills.map((skill) => (
          <Tooltip key={skill.name}>
            <TooltipTrigger asChild>
              <Card
                className={cn(
                  "p-3 border-2 cursor-help transition-colors",
                  skill.hasExpertise
                    ? "bg-amber-50 dark:bg-amber-900/10 border-amber-400 dark:border-amber-600"
                    : skill.isProficient
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-border/50"
                )}
                data-testid={`skill-${skill.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {skill.hasExpertise ? (
                      <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    ) : skill.isProficient ? (
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm truncate",
                      skill.isProficient && "font-medium"
                    )}>
                      {skill.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {skill.sources && skill.sources.length > 0 && (
                      <div className="flex gap-1">
                        {skill.sources.map((source) => (
                          <Badge 
                            key={source} 
                            variant="secondary" 
                            className="text-xs py-0 px-1 h-5"
                          >
                            {source}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className={cn(
                      "font-mono text-sm font-bold min-w-[32px] text-right",
                      skill.bonus >= 0 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    )}>
                      {formatModifier(skill.bonus)}
                    </span>
                  </div>
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm space-y-1">
                <p className="font-medium">{skill.name}</p>
                <p className="text-muted-foreground capitalize">
                  {skill.ability} based
                  {skill.isProficient && ` + Prof (${proficiencyBonus})`}
                  {skill.hasExpertise && ` × 2 (Expertise)`}
                  {hasJackOfAllTrades && !skill.isProficient && ` + JoAT (${Math.floor(proficiencyBonus / 2)})`}
                </p>
                {hasReliableTalent && skill.isProficient && (
                  <p className="text-green-500 text-xs">
                    Reliable Talent: Treats rolls of 9 or lower as 10
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

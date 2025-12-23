import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Spell {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
}

interface SpellSlots {
  current: number[];
  max: number[];
}

interface SpellsPanelProps {
  spells: Spell[];
  spellSlots: SpellSlots;
  onCastSpell?: (spell: Spell) => void;
  onToggleSlot?: (level: number) => void;
  className?: string;
}

export function SpellsPanel({
  spells,
  spellSlots,
  onCastSpell,
  onToggleSlot,
  className,
}: SpellsPanelProps) {
  // Group spells by level
  const spellsByLevel = spells.reduce((acc, spell) => {
    const level = spell.level;
    if (!acc[level]) acc[level] = [];
    acc[level].push(spell);
    return acc;
  }, {} as Record<number, Spell[]>);

  const levels = Array.from({ length: 10 }, (_, i) => i); // 0-9 (cantrips to 9th level)

  return (
    <div className={cn("space-y-4", className)} data-testid="spells-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Spells
        </h3>
        <Badge variant="secondary" className="text-xs">
          {spells.length} Known
        </Badge>
      </div>

      {/* Spell Slots Tracker */}
      <Card className="p-3 border-2">
        <p className="text-sm font-medium mb-2">Spell Slots</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {levels.slice(1, 10).map((level) => {
            const max = spellSlots.max[level] || 0;
            const current = spellSlots.current[level] || 0;
            
            if (max === 0) return null;
            
            return (
              <div
                key={level}
                className="text-center p-2 rounded-md bg-muted/50 border cursor-pointer hover:bg-muted transition-colors"
                onClick={() => onToggleSlot?.(level)}
                data-testid={`spell-slot-level-${level}`}
              >
                <p className="text-xs text-muted-foreground">Level {level}</p>
                <p className={cn(
                  "font-mono font-bold",
                  current > 0 ? "text-primary" : "text-destructive"
                )}>
                  {current}/{max}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Spells List by Level */}
      <Tabs defaultValue="0" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          {levels.map((level) => {
            const count = spellsByLevel[level]?.length || 0;
            if (count === 0 && level > 0) return null;
            
            return (
              <TabsTrigger 
                key={level} 
                value={level.toString()}
                className="text-xs"
                data-testid={`spell-tab-${level}`}
              >
                {level === 0 ? "Cantrips" : `Level ${level}`}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {levels.map((level) => {
          const levelSpells = spellsByLevel[level] || [];
          
          return (
            <TabsContent key={level} value={level.toString()}>
              <ScrollArea className="h-[300px]">
                {levelSpells.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No spells at this level
                  </p>
                ) : (
                  <div className="space-y-2">
                    {levelSpells.map((spell, idx) => (
                      <Card
                        key={idx}
                        className="p-3 border cursor-pointer hover:shadow-md transition-all"
                        onClick={() => onCastSpell?.(spell)}
                        data-testid={`spell-${spell.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm">{spell.name}</p>
                              {spell.concentration && (
                                <Badge variant="outline" className="text-xs">
                                  C
                                </Badge>
                              )}
                              {spell.ritual && (
                                <Badge variant="secondary" className="text-xs">
                                  R
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <span>{spell.school}</span>
                              <span>•</span>
                              <span>{spell.castingTime}</span>
                              <span>•</span>
                              <span>{spell.range}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {spell.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

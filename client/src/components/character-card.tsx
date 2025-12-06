import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Heart, Sparkles, Trash2 } from "lucide-react";
import type { Character, DndStats, CyberpunkStats } from "@shared/schema";

interface CharacterCardProps {
  character: Character;
  onClick?: () => void;
  onDelete?: () => void;
}

function isDndStats(stats: DndStats | CyberpunkStats): stats is DndStats {
  return 'strength' in stats;
}

function getStatModifier(stat: number): string {
  const mod = Math.floor((stat - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const CLASS_COLORS: Record<string, string> = {
  // D&D classes
  warrior: "bg-red-500/20 text-red-700 dark:text-red-300",
  fighter: "bg-red-500/20 text-red-700 dark:text-red-300",
  mage: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  wizard: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  sorcerer: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  rogue: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  thief: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  cleric: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  paladin: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  ranger: "bg-green-500/20 text-green-700 dark:text-green-300",
  druid: "bg-green-500/20 text-green-700 dark:text-green-300",
  bard: "bg-pink-500/20 text-pink-700 dark:text-pink-300",
  warlock: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  monk: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
  barbarian: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  // Cyberpunk roles
  solo: "bg-red-500/20 text-red-700 dark:text-red-300",
  netrunner: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
  tech: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  rockerboy: "bg-pink-500/20 text-pink-700 dark:text-pink-300",
  media: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  nomad: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  fixer: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  cop: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
  exec: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  medtech: "bg-green-500/20 text-green-700 dark:text-green-300",
};

const GAME_SYSTEM_COLORS: Record<string, string> = {
  dnd: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  cyberpunk: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
};

export function CharacterCard({ character, onClick, onDelete }: CharacterCardProps) {
  const hpPercentage = (character.currentHp / character.maxHp) * 100;
  const classColor = CLASS_COLORS[character.characterClass.toLowerCase()] || "bg-muted text-muted-foreground";
  const gameSystemColor = GAME_SYSTEM_COLORS[character.gameSystem] || GAME_SYSTEM_COLORS.dnd;
  const stats = character.stats as DndStats | CyberpunkStats;
  const isCyberpunk = !isDndStats(stats);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <Card 
      className={`hover-elevate cursor-pointer transition-all ${onClick ? "" : "cursor-default"}`}
      onClick={onClick}
      data-testid={`card-character-${character.id}`}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary font-serif font-semibold">
            {getInitials(character.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <CardTitle className="font-serif text-lg truncate" data-testid="text-character-name">
            {character.name}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge className={`text-xs ${gameSystemColor}`}>
              {character.gameSystem === "cyberpunk" ? "Cyberpunk" : "D&D"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {character.race}
            </Badge>
            <Badge className={`text-xs ${classColor}`}>
              {character.characterClass}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Lv. {character.level}
            </Badge>
          </div>
        </div>
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            data-testid={`button-delete-character-${character.id}`}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            <div className="flex-1">
              <Progress 
                value={hpPercentage} 
                className="h-2"
              />
            </div>
            <span className="text-sm font-mono min-w-[60px] text-right" data-testid="text-character-hp">
              {character.currentHp}/{character.maxHp}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono" data-testid="text-character-ac">{character.armorClass}</span>
              <span className="text-muted-foreground">AC</span>
            </div>
          </div>

          {isCyberpunk ? (
            <div className="grid grid-cols-5 gap-1 text-center">
              {Object.entries(stats).map(([stat, value]) => (
                <div key={stat} className="p-1 rounded bg-muted/50">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {stat}
                  </div>
                  <div className="text-sm font-bold font-mono">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1 text-center">
              {Object.entries(stats).map(([stat, value]) => (
                <div key={stat} className="p-1 rounded bg-muted/50">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {stat.slice(0, 3)}
                  </div>
                  <div className="text-sm font-bold font-mono">{value}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {getStatModifier(value)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CharacterCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-2 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

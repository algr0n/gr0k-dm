import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AbilityScore {
  score: number;
  modifier: number;
}

interface AbilityScoresPanelProps {
  strength: AbilityScore;
  dexterity: AbilityScore;
  constitution: AbilityScore;
  intelligence: AbilityScore;
  wisdom: AbilityScore;
  charisma: AbilityScore;
  className?: string;
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function AbilityScoresPanel({
  strength,
  dexterity,
  constitution,
  intelligence,
  wisdom,
  charisma,
  className,
}: AbilityScoresPanelProps) {
  const abilities = [
    { name: "Strength", short: "STR", ...strength },
    { name: "Dexterity", short: "DEX", ...dexterity },
    { name: "Constitution", short: "CON", ...constitution },
    { name: "Intelligence", short: "INT", ...intelligence },
    { name: "Wisdom", short: "WIS", ...wisdom },
    { name: "Charisma", short: "CHA", ...charisma },
  ];

  return (
    <div className={cn("space-y-2", className)} data-testid="ability-scores-panel">
      <h3 className="font-serif text-lg font-semibold mb-3">Ability Scores</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {abilities.map((ability) => (
          <Card
            key={ability.name}
            className="p-4 text-center border-2"
            data-testid={`ability-${ability.short.toLowerCase()}`}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
              {ability.short}
            </p>
            <p className="text-3xl font-bold font-mono mb-1">
              {ability.score}
            </p>
            <div className={cn(
              "text-sm font-bold font-mono px-2 py-1 rounded-md inline-block",
              ability.modifier >= 0 
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            )}>
              {formatModifier(ability.modifier)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {ability.name}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

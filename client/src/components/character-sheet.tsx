import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Sparkles, Sword, Package, 
  User, BookOpen, Coins, Target, Star, CheckCircle2
} from "lucide-react";
import type { UnifiedCharacter, CharacterInventoryItem } from "@shared/schema";
import { 
  dndSkills, skillAbilityMap, calculateSkillBonus, 
  getProficiencyBonus, getAbilityModifier, classSkillFeatures,
  raceDefinitions, classDefinitions, type DndClass, type DndRace, type DndSkill
} from "@shared/schema";

interface CharacterSheetProps {
  character: UnifiedCharacter | null;
  inventory?: CharacterInventoryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function getSkillProficiencySources(
  skill: DndSkill,
  race: string,
  characterClass: string,
  skills: string[],
  skillSources?: Record<string, string[]>
): string[] {
  if (!skills.includes(skill)) return [];
  
  // If we have stored skillSources (new format: arrays), use that
  if (skillSources && Array.isArray(skillSources[skill])) {
    return skillSources[skill];
  }
  
  // Handle legacy format where skillSources might be a single string
  if (skillSources && typeof skillSources[skill] === 'string') {
    return [skillSources[skill] as unknown as string];
  }
  
  // Fallback to inferring from race/class definitions for older characters
  const sources: string[] = [];
  
  const raceKey = race as DndRace;
  const raceDef = raceDefinitions[raceKey];
  if (raceDef?.skillProficiencies?.includes(skill)) {
    sources.push("Race");
  }
  
  // Check class skill choices
  const classKey = characterClass as DndClass;
  const classDef = classDefinitions[classKey];
  if (classDef?.skillChoices?.includes(skill)) {
    sources.push("Class");
  }
  
  // If no sources identified, don't show any badge (avoid misleading labels)
  return sources;
}

export function CharacterSheet({ character, inventory = [], open, onOpenChange }: CharacterSheetProps) {
  if (!character) return null;

  const stats = character.stats as Record<string, number | unknown> || {};
  const race = character.race || "Unknown";
  const characterClass = character.class || "Unknown";
  const level = character.level || 1;
  const background = character.background;
  const skills = (character.skills || []) as string[];
  const levelChoices = (character.levelChoices || []) as Record<string, unknown>[];
  const skillSources = (stats.skillSources as Record<string, string[]>) || undefined;
  
  const abilityScores = {
    strength: (stats.strength as number) || 10,
    dexterity: (stats.dexterity as number) || 10,
    constitution: (stats.constitution as number) || 10,
    intelligence: (stats.intelligence as number) || 10,
    wisdom: (stats.wisdom as number) || 10,
    charisma: (stats.charisma as number) || 10,
  };
  
  const expertiseSkills: string[] = [];
  levelChoices.forEach((choice) => {
    if (choice.expertise && Array.isArray(choice.expertise)) {
      expertiseSkills.push(...(choice.expertise as string[]));
    }
  });
  
  const classFeatures = classSkillFeatures[characterClass as DndClass] || [];
  const hasJackOfAllTrades = classFeatures.some(
    f => f.type === "jack_of_all_trades" && level >= f.level
  );
  const hasReliableTalent = classFeatures.some(
    f => f.type === "reliable_talent" && level >= f.level
  );
  
  const profBonus = getProficiencyBonus(level);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" data-testid="dialog-character-sheet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-serif font-bold text-xl">
                {getInitials(character.characterName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-serif text-2xl">{character.characterName}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge variant="outline">{race}</Badge>
                <Badge>{characterClass}</Badge>
                <Badge variant="secondary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Level {level}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Character sheet for {character.characterName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="flex items-center gap-2 font-serif text-lg mb-4">
                <User className="h-5 w-5" />
                Ability Scores
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(abilityScores).map(([ability, score]) => {
                  const mod = getAbilityModifier(score);
                  return (
                    <div 
                      key={ability} 
                      className="p-3 rounded-md bg-muted/50 text-center border border-border/50"
                      data-testid={`stat-${ability}`}
                    >
                      <p className="text-xs uppercase text-muted-foreground font-medium">
                        {ability.slice(0, 3)}
                      </p>
                      <p className="text-lg font-bold font-mono">{score}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {formatModifier(mod)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="flex items-center gap-2 font-serif text-lg mb-2">
                <Target className="h-5 w-5" />
                Skills
                <Badge variant="outline" className="ml-2 text-xs">
                  Prof +{profBonus}
                </Badge>
              </h3>
              
              {hasJackOfAllTrades && (
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-amber-500" />
                  Jack of All Trades: +{Math.floor(profBonus / 2)} to non-proficient skills
                </div>
              )}
              {hasReliableTalent && (
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Reliable Talent: Minimum 10 on proficient skill rolls
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                {dndSkills.map((skill) => {
                  const ability = skillAbilityMap[skill];
                  const abilityScore = abilityScores[ability as keyof typeof abilityScores] || 10;
                  const isProficient = skills.includes(skill);
                  const hasExpertise = expertiseSkills.includes(skill);
                  
                  const bonus = calculateSkillBonus(
                    skill,
                    abilityScore,
                    level,
                    isProficient,
                    hasExpertise,
                    hasJackOfAllTrades && !isProficient
                  );
                  
                  const sources = getSkillProficiencySources(skill, race, characterClass, skills, skillSources);
                  
                  return (
                    <Tooltip key={skill}>
                      <TooltipTrigger asChild>
                        <div 
                          className={`flex items-center justify-between p-2 rounded-md border ${
                            hasExpertise 
                              ? "bg-amber-500/10 border-amber-500/30" 
                              : isProficient 
                                ? "bg-primary/10 border-primary/30" 
                                : "bg-muted/30 border-border/50"
                          }`}
                          data-testid={`skill-${skill.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-center gap-2">
                            {hasExpertise ? (
                              <Star className="h-3 w-3 text-amber-500" />
                            ) : isProficient ? (
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                            ) : (
                              <div className="h-3 w-3" />
                            )}
                            <span className={`text-sm ${isProficient ? "font-medium" : ""}`}>
                              {skill}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {sources.map((source) => (
                              <Badge key={source} variant="secondary" className="text-xs py-0">
                                {source}
                              </Badge>
                            ))}
                            <span className={`font-mono text-sm font-bold ml-1 ${
                              bonus >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            }`}>
                              {formatModifier(bonus)}
                            </span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-medium">{skill}</p>
                          <p className="text-muted-foreground">
                            {ability.charAt(0).toUpperCase() + ability.slice(1)} ({formatModifier(getAbilityModifier(abilityScore))})
                            {isProficient && ` + Prof (${profBonus})`}
                            {hasExpertise && ` x2 Expertise`}
                            {hasJackOfAllTrades && !isProficient && ` + JoAT (${Math.floor(profBonus / 2)})`}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="flex items-center gap-2 font-serif text-lg mb-4">
                <Package className="h-5 w-5" />
                Inventory
              </h3>
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items in inventory
                </p>
              ) : (
                <div className="space-y-2">
                  {inventory.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                      data-testid={`sheet-inventory-item-${item.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Item #{item.itemId}</span>
                      </div>
                      {item.quantity > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          x{item.quantity}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {character.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="flex items-center gap-2 font-serif text-lg mb-4">
                    <BookOpen className="h-5 w-5" />
                    Notes
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {character.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

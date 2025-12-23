import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";
import type { UnifiedCharacter, CharacterInventoryItemWithDetails } from "@shared/schema";
import { 
  dndSkills, skillAbilityMap, calculateSkillBonus, 
  getProficiencyBonus, getAbilityModifier, classSkillFeatures,
  raceDefinitions, classDefinitions, type DndClass, type DndRace, type DndSkill
} from "@shared/schema";

// Import new modular components
import { CharacterSummaryBar } from "./character-sheet/CharacterSummaryBar";
import { AbilityScoresPanel } from "./character-sheet/AbilityScoresPanel";
import { SkillsList } from "./character-sheet/SkillsList";
import { ConditionsBadges } from "./character-sheet/ConditionsBadges";

interface CharacterSheetProps {
  character: UnifiedCharacter | null;
  inventory?: CharacterInventoryItemWithDetails[];
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
    // Handle new format: { feature: "expertise", skills: [...] }
    if (choice.feature === "expertise" && Array.isArray(choice.skills)) {
      expertiseSkills.push(...(choice.skills as string[]));
    }
    // Handle legacy format: { expertise: [...] }
    else if (choice.expertise && Array.isArray(choice.expertise)) {
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

  // Transform skills data for SkillsList component
  const skillsData = dndSkills.map((skill) => {
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
    
    return {
      name: skill,
      ability,
      bonus,
      isProficient,
      hasExpertise,
      sources,
    };
  });

  // Transform ability scores for panel
  const abilityScoresData = {
    strength: {
      score: abilityScores.strength,
      modifier: getAbilityModifier(abilityScores.strength),
    },
    dexterity: {
      score: abilityScores.dexterity,
      modifier: getAbilityModifier(abilityScores.dexterity),
    },
    constitution: {
      score: abilityScores.constitution,
      modifier: getAbilityModifier(abilityScores.constitution),
    },
    intelligence: {
      score: abilityScores.intelligence,
      modifier: getAbilityModifier(abilityScores.intelligence),
    },
    wisdom: {
      score: abilityScores.wisdom,
      modifier: getAbilityModifier(abilityScores.wisdom),
    },
    charisma: {
      score: abilityScores.charisma,
      modifier: getAbilityModifier(abilityScores.charisma),
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-character-sheet">
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

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Ability Scores */}
            <AbilityScoresPanel {...abilityScoresData} />

            <Separator />

            {/* Skills */}
            <SkillsList
              skills={skillsData}
              proficiencyBonus={profBonus}
              hasJackOfAllTrades={hasJackOfAllTrades}
              hasReliableTalent={hasReliableTalent}
            />

            <Separator />

            {/* Inventory Section (Keep existing simple display for now) */}
            <div>
              <h3 className="font-serif text-lg font-semibold mb-3">Inventory</h3>
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items in inventory
                </p>
              ) : (
                <div className="space-y-2">
                  {inventory.map((invItem) => {
                    const props = invItem.item.properties as Record<string, unknown> | null;
                    const damage = props?.damage as { damage_dice?: string; damage_type?: { name?: string } } | undefined;
                    const armorClass = props?.armor_class as { base?: number; dex_bonus?: boolean; max_bonus?: number } | undefined;
                    
                    return (
                      <div 
                        key={invItem.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                        data-testid={`sheet-inventory-item-${invItem.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium truncate">{invItem.item.name}</span>
                          {invItem.quantity > 1 && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              x{invItem.quantity}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {damage?.damage_dice && (
                            <Badge variant="outline" className="text-xs">
                              {damage.damage_dice} {damage.damage_type?.name || ""}
                            </Badge>
                          )}
                          {armorClass?.base && (
                            <Badge variant="outline" className="text-xs">
                              AC {armorClass.base}{armorClass.dex_bonus ? (armorClass.max_bonus ? ` +Dex (max ${armorClass.max_bonus})` : " +Dex") : ""}
                            </Badge>
                          )}
                          {invItem.equipped && (
                            <Badge className="text-xs">
                              Equipped
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {character.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-3">Notes</h3>
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

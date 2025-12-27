import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sparkles } from "lucide-react";
import type { UnifiedCharacter, CharacterInventoryItemWithDetails } from "@shared/schema";
import { 
  dndSkills, skillAbilityMap, calculateSkillBonus, 
  getProficiencyBonus, getAbilityModifier, classSkillFeatures,
  raceDefinitions, classDefinitions, type DndClass, type DndRace, type DndSkill
} from "@shared/schema";
import { parseHitDiceString } from "@shared/race-class-bonuses";
import { useLayoutBreakpoint } from "@/hooks/useLayoutBreakpoint";

// Import new responsive components
import { CharacterSummaryBar } from "./character-sheet/CharacterSummaryBar";
import { AbilityScoresPanel } from "./character-sheet/AbilityScoresPanel";
import { SkillsList } from "./character-sheet/SkillsList";
import { SkillsAccordion } from "./character-sheet/SkillsAccordion";
import { ResourcesPanel } from "./character-sheet/ResourcesPanel";
import { ConditionsBadges } from "./character-sheet/ConditionsBadges";
import { PortraitCard } from "./character-sheet/PortraitCard";
import { CoreStatsCard } from "./character-sheet/CoreStatsCard";
import { HPBar } from "./character-sheet/HPBar";
import { XPLevelCard } from "./character-sheet/XPLevelCard";
import { InventoryAccordion } from "./character-sheet/InventoryAccordion";
import { SpellsAccordion } from "./character-sheet/SpellsAccordion";

// Import CSS file for responsive layout
import "./character-sheet/CharacterSheet.css";

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
  const breakpoint = useLayoutBreakpoint();
  
  if (!character) return null;

  const stats = character.stats as Record<string, number | unknown> || {};
  const race = character.race || "Unknown";
  const characterClass = character.class || "Unknown";
  const level = character.level || 1;
  const skills = (character.skills || []) as string[];
  const spells = (character.spells || []) as string[];
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

  // Transform skills data
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

  const currentHp = character.currentHp || 0;
  const maxHp = character.maxHp || 1;
  const ac = character.ac || 10;
  const speed = character.speed || 30;
  const initiative = character.initiativeModifier || 0;
  const xp = character.xp || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] p-0" data-testid="dialog-character-sheet">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="sr-only">
            Character sheet for {character.characterName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Full character details including stats, skills, inventory, and spells
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[85vh] px-6 pb-6">
          <div className="characterSheetGrid">
            {/* Header Area - Character Name and Basic Info */}
            <div className="headerArea">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <h2 className="font-serif text-3xl mb-2">{character.characterName}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{race}</Badge>
                    <Badge>{characterClass}</Badge>
                    <Badge variant="secondary">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Level {level}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Column - Portrait, Quick Stats, Resources */}
            <div className="leftColumn">
              <div className="cardSpacing">
                <PortraitCard 
                  characterName={character.characterName}
                  initials={getInitials(character.characterName)}
                />
                
                <CoreStatsCard
                  ac={ac}
                  speed={speed}
                  initiative={initiative}
                  currency={character.currency}
                />

                <ResourcesPanel
                  hitDice={parseHitDiceString(character.hitDice || null, level, characterClass || undefined)}
                  deathSaves={{ successes: 0, failures: 0 }}
                />
              </div>
            </div>

            {/* Center Column - Main Stats */}
            <div className="centerColumn">
              <div className="cardSpacing">
                <HPBar currentHp={currentHp} maxHp={maxHp} />
                
                <XPLevelCard level={level} xp={xp} />

                <AbilityScoresPanel {...abilityScoresData} />

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
            </div>

            {/* Right Column - Skills, Inventory, Spells */}
            <div className="rightColumn">
              <div className="cardSpacing">
                <SkillsAccordion
                  skills={skillsData}
                  proficiencyBonus={profBonus}
                  hasJackOfAllTrades={hasJackOfAllTrades}
                  hasReliableTalent={hasReliableTalent}
                  breakpoint={breakpoint}
                />

                <SpellsAccordion 
                  spells={spells}
                  defaultOpen={breakpoint === 'desktop'}
                />

                <InventoryAccordion 
                  inventory={inventory}
                  defaultOpen={breakpoint === 'desktop'}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

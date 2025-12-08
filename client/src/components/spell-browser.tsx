import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Search, BookOpen, Plus, Check, Loader2, Sparkles, Clock, Target, Wand2, Dice6, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: string | null;
}

interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: SpellComponents;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels: string | null;
  classes: string[];
}

interface SpellBrowserProps {
  characterClass?: string;
  knownSpells: string[];
  preparedSpells: string[];
  spellSlots?: { current: number[]; max: number[] };
  maxSpellSlots?: number[];
  onAddKnownSpell: (spellId: string) => void;
  onRemoveKnownSpell: (spellId: string) => void;
  onTogglePreparedSpell: (spellId: string) => void;
  onCastSpell?: (spell: Spell, slotLevel?: number) => void;
  onRollSpellDice?: (spell: Spell, diceExpression: string) => void;
}

const SCHOOLS = [
  "Abjuration",
  "Conjuration", 
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
];

const CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Paladin",
  "Ranger",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

const SPELL_LEVELS = [
  { value: "0", label: "Cantrip" },
  { value: "1", label: "1st Level" },
  { value: "2", label: "2nd Level" },
  { value: "3", label: "3rd Level" },
  { value: "4", label: "4th Level" },
  { value: "5", label: "5th Level" },
  { value: "6", label: "6th Level" },
  { value: "7", label: "7th Level" },
  { value: "8", label: "8th Level" },
  { value: "9", label: "9th Level" },
];


function getLevelLabel(level: number): string {
  if (level === 0) return "Cantrip";
  const suffixes = ["th", "st", "nd", "rd"];
  const suffix = level <= 3 ? suffixes[level] : suffixes[0];
  return `${level}${suffix} Level`;
}

function formatComponents(components: SpellComponents): string {
  const parts: string[] = [];
  if (components.verbal) parts.push("V");
  if (components.somatic) parts.push("S");
  if (components.material) parts.push(`M (${components.material})`);
  return parts.join(", ");
}

function extractDiceFromSpell(spell: Spell): string | null {
  const dicePattern = /(\d+d\d+(?:\s*\+\s*\d+)?)/i;
  const match = spell.description.match(dicePattern);
  return match ? match[1].replace(/\s+/g, '') : null;
}

function findLowestAvailableSlot(
  spellLevel: number,
  spellSlots?: { current: number[]; max: number[] },
  maxSpellSlots?: number[]
): number | null {
  if (spellLevel === 0) return 0;
  const currentSlots = spellSlots?.current || maxSpellSlots || [];
  for (let level = spellLevel; level <= 9; level++) {
    if ((currentSlots[level] ?? 0) > 0) {
      return level;
    }
  }
  return null;
}

export function SpellBrowser({
  characterClass,
  knownSpells,
  preparedSpells,
  spellSlots,
  maxSpellSlots,
  onAddKnownSpell,
  onRemoveKnownSpell,
  onTogglePreparedSpell,
  onCastSpell,
  onRollSpellDice,
}: SpellBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>(characterClass || "all");
  const [concentrationFilter, setConcentrationFilter] = useState(false);
  const [ritualFilter, setRitualFilter] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [showKnownOnly, setShowKnownOnly] = useState(false);

  const { data: spells = [], isLoading } = useQuery<Spell[]>({
    queryKey: ["/api/spells"],
  });

  const filteredSpells = useMemo(() => {
    return spells.filter((spell) => {
      if (searchQuery && !spell.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !spell.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (levelFilter !== "all" && spell.level !== parseInt(levelFilter)) {
        return false;
      }
      if (schoolFilter !== "all" && spell.school !== schoolFilter) {
        return false;
      }
      if (classFilter !== "all" && !spell.classes.includes(classFilter)) {
        return false;
      }
      if (concentrationFilter && !spell.concentration) {
        return false;
      }
      if (ritualFilter && !spell.ritual) {
        return false;
      }
      if (showKnownOnly && !knownSpells.includes(spell.id)) {
        return false;
      }
      return true;
    });
  }, [spells, searchQuery, levelFilter, schoolFilter, classFilter, concentrationFilter, ritualFilter, showKnownOnly, knownSpells]);

  const isSpellKnown = (spellId: string) => knownSpells.includes(spellId);
  const isSpellPrepared = (spellId: string) => preparedSpells.includes(spellId);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search spells by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-spell-search"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-spell-level">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {SPELL_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-spell-school">
              <SelectValue placeholder="School" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {SCHOOLS.map((school) => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-spell-class">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {CLASSES.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={concentrationFilter}
              onCheckedChange={(checked) => setConcentrationFilter(checked === true)}
              data-testid="checkbox-concentration"
            />
            Concentration
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={ritualFilter}
              onCheckedChange={(checked) => setRitualFilter(checked === true)}
              data-testid="checkbox-ritual"
            />
            Ritual
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showKnownOnly}
              onCheckedChange={(checked) => setShowKnownOnly(checked === true)}
              data-testid="checkbox-known-only"
            />
            Known Spells Only
          </label>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSpells.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <BookOpen className="h-8 w-8 mb-2" />
            <p>No spells found matching your criteria</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              {filteredSpells.length} spell{filteredSpells.length !== 1 ? "s" : ""} found
            </p>
            {filteredSpells.map((spell) => {
              const isKnown = isSpellKnown(spell.id);
              const availableSlot = findLowestAvailableSlot(spell.level, spellSlots, maxSpellSlots);
              const canCast = spell.level === 0 || availableSlot !== null;
              
              return (
                <Card
                  key={spell.id}
                  className={cn(
                    "cursor-pointer hover-elevate",
                    isKnown && "border-primary/50"
                  )}
                  onClick={() => setSelectedSpell(spell)}
                  data-testid={`spell-card-${spell.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{spell.name}</h4>
                          {isKnown && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Known
                            </Badge>
                          )}
                          {isSpellPrepared(spell.id) && (
                            <Badge className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Prepared
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {spell.school}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getLevelLabel(spell.level)}
                          </span>
                          {spell.concentration && (
                            <span className="text-xs text-muted-foreground">C</span>
                          )}
                          {spell.ritual && (
                            <span className="text-xs text-muted-foreground">R</span>
                          )}
                        </div>
                      </div>
                      {isKnown && onCastSpell && (
                        <Button
                          size="sm"
                          variant={canCast ? "default" : "secondary"}
                          disabled={!canCast}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canCast) {
                              onCastSpell(spell, availableSlot ?? undefined);
                            }
                          }}
                          data-testid={`button-quick-cast-${spell.id}`}
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          {spell.level === 0 ? "Cast" : canCast ? `Cast (L${availableSlot})` : "No Slots"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!selectedSpell} onOpenChange={(open) => !open && setSelectedSpell(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          {selectedSpell && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  {selectedSpell.name}
                </DialogTitle>
                <DialogDescription>
                  {getLevelLabel(selectedSpell.level)} {selectedSpell.school}
                  {selectedSpell.ritual && " (ritual)"}
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Casting Time:</span>
                      <span>{selectedSpell.castingTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Range:</span>
                      <span>{selectedSpell.range}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-muted-foreground">Components:</span>{" "}
                    {formatComponents(selectedSpell.components)}
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    {selectedSpell.duration}
                    {selectedSpell.concentration && " (Concentration)"}
                  </div>

                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm leading-relaxed">{selectedSpell.description}</p>
                  </div>
                  
                  {selectedSpell.higherLevels && (
                    <div>
                      <h4 className="font-medium mb-2">At Higher Levels</h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {selectedSpell.higherLevels}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-1">
                    <span className="text-sm text-muted-foreground mr-2">Classes:</span>
                    {selectedSpell.classes.map((cls) => (
                      <Badge key={cls} variant="outline" className="text-xs">
                        {cls}
                      </Badge>
                    ))}
                  </div>
                </div>
              </ScrollArea>
              
              <Separator className="my-4" />
              
              <div className="flex items-center gap-2 flex-wrap">
                {isSpellKnown(selectedSpell.id) ? (
                  <>
                    {onCastSpell && (() => {
                      const availableSlot = findLowestAvailableSlot(selectedSpell.level, spellSlots, maxSpellSlots);
                      const canCast = selectedSpell.level === 0 || availableSlot !== null;
                      return (
                        <Button
                          disabled={!canCast}
                          onClick={() => {
                            if (canCast) {
                              onCastSpell(selectedSpell, availableSlot ?? undefined);
                              setSelectedSpell(null);
                            }
                          }}
                          data-testid="button-cast-spell"
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          {selectedSpell.level === 0 ? "Cast Cantrip" : canCast ? `Cast (Level ${availableSlot} Slot)` : "No Slots Available"}
                        </Button>
                      );
                    })()}
                    {onRollSpellDice && extractDiceFromSpell(selectedSpell) && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const dice = extractDiceFromSpell(selectedSpell);
                          if (dice) {
                            onRollSpellDice(selectedSpell, dice);
                            setSelectedSpell(null);
                          }
                        }}
                        data-testid="button-roll-spell-dice"
                      >
                        <Dice6 className="h-4 w-4 mr-2" />
                        Roll {extractDiceFromSpell(selectedSpell)}
                      </Button>
                    )}
                    <Button
                      variant={isSpellPrepared(selectedSpell.id) ? "secondary" : "outline"}
                      onClick={() => onTogglePreparedSpell(selectedSpell.id)}
                      data-testid="button-toggle-prepared"
                    >
                      {isSpellPrepared(selectedSpell.id) ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Prepared
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Prepare Spell
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => onRemoveKnownSpell(selectedSpell.id)}
                      data-testid="button-remove-known-spell"
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => onAddKnownSpell(selectedSpell.id)}
                    data-testid="button-add-known-spell"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Known Spells
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

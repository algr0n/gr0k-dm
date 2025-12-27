import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Heart, 
  Package, 
  Sparkles, 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  X,
  User,
  Trash2,
  LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type SavedCharacter, type InventoryItem, type Item, type CharacterStatusEffect, type CharacterInventoryItemWithDetails, xpThresholds } from "@shared/schema";
import { InventoryLayout } from "./inventory/InventoryLayout";

type InventoryWithItem = InventoryItem & { item: Item };

interface CharacterData {
  roomCharacter: SavedCharacter;
  savedCharacter: SavedCharacter;
  statusEffects: CharacterStatusEffect[];
}

interface FloatingCharacterPanelProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
  currentHp?: number;
  maxHp?: number;
  onDropItem?: (item: InventoryWithItem) => void;
  isDropping?: boolean;
  useEnhancedInventory?: boolean; // New prop to enable enhanced inventory view
}

export function FloatingCharacterPanel({
  roomCode,
  isOpen,
  onClose,
  currentHp: propCurrentHp,
  maxHp: propMaxHp,
  onDropItem,
  isDropping,
  useEnhancedInventory = false,
}: FloatingCharacterPanelProps) {
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [spellsOpen, setSpellsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"simple" | "enhanced">("simple");

  const { data: myCharacterData } = useQuery<CharacterData>({
    queryKey: ["/api/rooms", roomCode, "my-character"],
    enabled: !!roomCode && isOpen,
  });

  const character = myCharacterData?.savedCharacter;
  const roomChar = myCharacterData?.roomCharacter;
  const statusEffects = myCharacterData?.statusEffects || [];

  const savedCharacterId = character?.id;
  const { data: inventoryWithDetails } = useQuery<InventoryWithItem[]>({
    queryKey: ["/api/saved-characters", savedCharacterId, "inventory"],
    enabled: !!savedCharacterId && isOpen,
  });

  const currentHp = propCurrentHp ?? roomChar?.currentHp ?? character?.currentHp ?? 0;
  const maxHp = propMaxHp ?? character?.maxHp ?? 1;
  const hpPercentage = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  // Flash indicator for HP changes (red = damage, green = heal)
  const [hpFlashColor, setHpFlashColor] = useState<null | "red" | "green">(null);
  const prevHpRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevHpRef.current;
    if (prev !== null && prev !== undefined && currentHp !== prev) {
      if (currentHp < prev) setHpFlashColor("red");
      else if (currentHp > prev) setHpFlashColor("green");
      // clear after animation
      const t = setTimeout(() => setHpFlashColor(null), 900);
      return () => clearTimeout(t);
    }
    prevHpRef.current = currentHp;
  }, [currentHp]);

  const stats = character?.stats as Record<string, number> | undefined;
  const skills = character?.skills as string[] ?? [];
  const spells = character?.spells as string[] ?? [];

  // Calculate total weight and encumbrance
  const currentWeight = inventoryWithDetails?.reduce((total, item) => {
    const weight = item.item.weight || 0;
    return total + (weight * item.quantity);
  }, 0) || 0;

  const strScore = stats?.strength || 10;
  const maxWeight = strScore * 15; // D&D 5e standard

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      data-testid="floating-character-panel"
    >
      <div className={cn(
        "w-full bg-card rounded-lg shadow-xl border border-card-border overflow-hidden",
        useEnhancedInventory && viewMode === "enhanced" ? "max-w-6xl" : "max-w-md"
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{character?.characterName || "Character"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {useEnhancedInventory && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setViewMode(viewMode === "simple" ? "enhanced" : "simple")}
                title="Toggle inventory view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {useEnhancedInventory && viewMode === "enhanced" ? (
          // Enhanced Inventory View
          <ScrollArea className="h-[80vh] px-4 py-4">
            <InventoryLayout
              items={inventoryWithDetails as CharacterInventoryItemWithDetails[] || []}
              gold={roomChar?.gold || 0}
              currency={character?.currency}
              armorClass={character?.ac || 10}
              currentWeight={currentWeight}
              maxWeight={maxWeight}
              attunedCount={inventoryWithDetails?.filter(i => i.attunementSlot).length || 0}
              maxAttunement={3}
              onItemDoubleClick={(item) => {
                // TODO: Implement equip/unequip logic
                console.log("Double clicked item:", item);
              }}
            />
          </ScrollArea>
        ) : (
          // Original Simple View
          <ScrollArea className="h-[60vh] px-4 py-4">
            {/* HP Bar */}
            <div className="mb-4">
              <div className={cn("flex justify-between text-sm mb-1 transition-all duration-300", hpFlashColor === 'red' ? 'text-destructive' : hpFlashColor === 'green' ? 'text-emerald-400' : '')}>
                <span className={cn("font-medium", hpFlashColor === 'red' ? 'text-destructive' : hpFlashColor === 'green' ? 'text-emerald-400' : '')}>HP: {currentHp}/{maxHp}</span>
                <span>{hpPercentage.toFixed(0)}%</span>
              </div>
              <div className={cn('relative', hpFlashColor === 'red' ? 'ring-2 ring-red-500/50 animate-pulse' : hpFlashColor === 'green' ? 'ring-2 ring-emerald-400/50 animate-pulse' : '')}>
                <Progress value={hpPercentage} className="h-2" />
              </div>
            </div>

            {/* Status Effects */}
            {statusEffects.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1">
                {statusEffects.map((effect) => (
                  <Badge key={effect.id} variant="secondary" className="text-xs">
                    {effect.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="font-medium">Race:</span> {character?.race || "Unknown"}
              </div>
              <div>
                <span className="font-medium">Class:</span> {character?.class || "Unknown"}
              </div>
              <div>
                <span className="font-medium">Level:</span> {character?.level || 1}
              </div>
              <div>
                <span className="font-medium">AC:</span> {character?.ac || 10}
              </div>
              <div>
                <span className="font-medium">Speed:</span> {character?.speed || 30} ft
              </div>
              <div>
                <span className="font-medium">Initiative:</span> +{character?.initiativeModifier || 0}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">XP:</span>
                  <span className="text-xs text-muted-foreground">
                    {character?.xp || 0}/{xpThresholds[(character?.level || 1) + 1] || xpThresholds[20]} to Level {(character?.level || 1) + 1}
                  </span>
                </div>
                <Progress 
                  value={(() => {
                    const currentLevel = character?.level || 1;
                    const currentXP = character?.xp || 0;
                    const currentThreshold = xpThresholds[currentLevel];
                    const nextThreshold = xpThresholds[currentLevel + 1] || xpThresholds[20];
                    const xpIntoLevel = currentXP - currentThreshold;
                    const xpForNextLevel = nextThreshold - currentThreshold;
                    return Math.min(100, Math.max(0, (xpIntoLevel / xpForNextLevel) * 100));
                  })()}
                  className="h-2"
                />
              </div>
              <div>
                <span className="font-medium">Currency:</span>{" "}
                {character?.currency ? (
                  <>
                    <span className="text-amber-600">{character.currency.gp}gp</span>{" "}
                    <span className="text-slate-400">{character.currency.sp}sp</span>{" "}
                    <span className="text-amber-700">{character.currency.cp}cp</span>
                  </>
                ) : (
                  <span>{roomChar?.gold || 0} gp</span>
                )}
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Stats</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
                    .filter(stat => typeof stats[stat] === "number")
                    .map((stat) => (
                      <div key={stat} className="flex justify-between">
                        <span className="capitalize">{stat.slice(0, 3)}:</span>
                        <span>{stats[stat]} ({Math.floor((stats[stat] - 10) / 2) >= 0 ? "+" : ""}{Math.floor((stats[stat] - 10) / 2)})</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Skills */}
            <Collapsible open={skillsOpen} onOpenChange={setSkillsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-2 h-8"
                  data-testid="button-toggle-skills"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-sm">Skills</span>
                    {skills.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {skills.length}
                      </Badge>
                    )}
                  </div>
                  {skillsOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-6 pr-2 py-2 space-y-1">
                  {skills.length > 0 ? (
                    skills.map((skill, idx) => (
                      <div
                        key={idx}
                        className="text-sm py-1"
                        data-testid={`skill-${idx}`}
                      >
                        {skill}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-1">No skills</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Spells */}
            <Collapsible open={spellsOpen} onOpenChange={setSpellsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-2 h-8"
                  data-testid="button-toggle-spells"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm">Spells</span>
                    {spells.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {spells.length}
                      </Badge>
                    )}
                  </div>
                  {spellsOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-6 pr-2 py-2 space-y-1">
                  {spells.length > 0 ? (
                    spells.map((spell, idx) => (
                      <div
                        key={idx}
                        className="text-sm py-1"
                        data-testid={`spell-${idx}`}
                      >
                        {spell}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-1">No spells</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Inventory */}
            <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 h-8">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="text-sm">Inventory</span>
                    {inventoryWithDetails && inventoryWithDetails.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {inventoryWithDetails.length}
                      </Badge>
                    )}
                  </div>
                  {inventoryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-6 pr-2 py-2 space-y-1">
                  {inventoryWithDetails && inventoryWithDetails.length > 0 ? (
                    inventoryWithDetails.map((invItem) => (
                      <div key={invItem.id} className="text-sm py-1 flex justify-between items-center">
                        <span>{invItem.item.name} {invItem.quantity > 1 && `x${invItem.quantity}`}</span>
                        <div className="flex gap-2 items-center">
                          {invItem.equipped && <Badge variant="outline">Equipped</Badge>}
                          {invItem.item.rarity !== "common" && <Badge variant="secondary">{invItem.item.rarity}</Badge>}
                          {onDropItem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onDropItem(invItem)}
                              disabled={isDropping}
                              data-testid={`button-drop-${invItem.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-1">No items</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, 
  Package, 
  Sparkles, 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  X,
  User,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type SavedCharacter, type InventoryItem, type Item, type CharacterStatusEffect } from "@shared/schema";

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
}

export function FloatingCharacterPanel({
  roomCode,
  isOpen,
  onClose,
  currentHp: propCurrentHp,
  maxHp: propMaxHp,
  onDropItem,
  isDropping,
}: FloatingCharacterPanelProps) {
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [spellsOpen, setSpellsOpen] = useState(false);

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

  const stats = character?.stats as Record<string, number> | undefined;
  const skills = character?.skills as string[] ?? [];
  const spells = character?.spells as string[] ?? [];

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
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl border border-card-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{character?.characterName || "Character"}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="h-[60vh] px-4 py-4">
          {/* HP Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>HP: {currentHp}/{maxHp}</span>
              <span>{hpPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={hpPercentage} className="h-2" />
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
            <div>
              <span className="font-medium">XP:</span> {character?.xp || 0}
            </div>
            <div>
              <span className="font-medium">Gold:</span> {roomChar?.gold || 0}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Stats</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(stats).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between">
                    <span className="capitalize">{stat}:</span>
                    <span>{value} ({Math.floor((value - 10) / 2)})</span>
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
      </div>
    </div>
  );
}

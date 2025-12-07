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
import { type Character, type InventoryItem } from "@shared/schema";

interface FloatingCharacterPanelProps {
  characterId: string | undefined;
  playerId: string;
  playerName: string;
  isOpen: boolean;
  onClose: () => void;
  currentHp?: number;
  maxHp?: number;
  onDropItem?: (item: InventoryItem) => void;
  isDropping?: boolean;
}

export function FloatingCharacterPanel({
  characterId,
  playerId,
  playerName,
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
  
  const { data: character } = useQuery<Character>({
    queryKey: ["/api/characters", characterId],
    enabled: !!characterId,
  });

  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: ["/api/characters", characterId, "inventory"],
    enabled: !!characterId,
  });

  const currentHp = propCurrentHp ?? character?.currentHp ?? 10;
  const maxHp = propMaxHp ?? character?.maxHp ?? 10;
  const hpPercentage = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
  const skills = (character?.skills as string[]) || [];
  const spells = (character?.spells as string[]) || [];

  const getHpColor = () => {
    if (hpPercentage > 66) return "bg-green-500";
    if (hpPercentage > 33) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-4 top-20 w-72 bg-card border rounded-md shadow-lg z-50 max-h-[calc(100vh-6rem)] flex flex-col"
      data-testid="floating-character-panel"
    >
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate" data-testid="text-character-name">
            {character?.name || playerName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={onClose}
          data-testid="button-close-character-panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">HP</span>
              </div>
              <span className="text-sm font-mono" data-testid="text-hp-value">
                {currentHp}/{maxHp}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-300", getHpColor())}
                style={{ width: `${Math.max(0, Math.min(100, hpPercentage))}%` }}
                data-testid="hp-bar"
              />
            </div>
          </div>

          <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-2 h-8"
                data-testid="button-toggle-inventory"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="text-sm">Inventory</span>
                  {inventory && inventory.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {inventory.length}
                    </Badge>
                  )}
                </div>
                {inventoryOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-6 pr-2 py-2 space-y-1">
                {inventory && inventory.length > 0 ? (
                  inventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm py-1 group"
                      data-testid={`inventory-item-${item.id}`}
                    >
                      <span className="truncate flex-1">{item.name}</span>
                      <div className="flex items-center gap-1">
                        {item.quantity > 1 && (
                          <Badge variant="outline" className="h-5 px-1.5 text-xs">
                            x{item.quantity}
                          </Badge>
                        )}
                        {onDropItem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onDropItem(item)}
                            disabled={isDropping}
                            data-testid={`button-drop-item-${item.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
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
        </div>
      </ScrollArea>
    </div>
  );
}

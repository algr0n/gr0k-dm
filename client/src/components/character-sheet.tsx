import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Sparkles, Sword, Package, 
  User, BookOpen, Coins
} from "lucide-react";
import type { Character, InventoryItem } from "@shared/schema";

interface CharacterSheetProps {
  character: Character | null;
  inventory?: InventoryItem[];
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

export function CharacterSheet({ character, inventory = [], open, onOpenChange }: CharacterSheetProps) {
  if (!character) return null;

  const stats = character.stats as Record<string, unknown>;
  const race = (stats.race as string) || "Unknown";
  const characterClass = (stats.class as string) || "Unknown";
  const level = (stats.level as number) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" data-testid="dialog-character-sheet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-serif font-bold text-xl">
                {getInitials(character.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-serif text-2xl">{character.name}</h2>
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
            Character sheet for {character.name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="flex items-center gap-2 font-serif text-lg mb-4">
                <User className="h-5 w-5" />
                Character Info
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(stats)
                  .filter(([key]) => !["race", "class", "level"].includes(key))
                  .map(([stat, value]) => (
                    <div 
                      key={stat} 
                      className="p-3 rounded-md bg-muted/50 text-center border border-border/50"
                    >
                      <p className="text-xs uppercase text-muted-foreground font-medium">
                        {stat}
                      </p>
                      <p className="text-lg font-bold font-mono">{String(value)}</p>
                    </div>
                  ))}
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
                        {item.name.toLowerCase().includes("gold") || item.name.toLowerCase().includes("coin") ? (
                          <Coins className="h-4 w-4 text-yellow-500" />
                        ) : item.name.toLowerCase().includes("sword") || item.name.toLowerCase().includes("weapon") ? (
                          <Sword className="h-4 w-4 text-red-500" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="text-sm text-muted-foreground">- {item.description}</span>
                        )}
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

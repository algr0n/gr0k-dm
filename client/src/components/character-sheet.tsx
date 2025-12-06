import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Shield, Heart, Sparkles, Sword, Package, 
  Scroll, User, BookOpen 
} from "lucide-react";
import type { Character } from "@shared/schema";

interface CharacterSheetProps {
  character: Character | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const STAT_NAMES: Record<string, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
};

export function CharacterSheet({ character, open, onOpenChange }: CharacterSheetProps) {
  if (!character) return null;

  const hpPercentage = (character.currentHp / character.maxHp) * 100;

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
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{character.race}</Badge>
                <Badge>{character.characterClass}</Badge>
                <Badge variant="secondary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Level {character.level}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <span className="font-medium">Hit Points</span>
                </div>
                <Progress value={hpPercentage} className="h-3" />
                <p className="text-sm text-muted-foreground font-mono text-center">
                  {character.currentHp} / {character.maxHp}
                </p>
              </div>
              <div className="flex items-center justify-center p-4 rounded-md bg-muted/50">
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-3xl font-bold font-mono mt-1">{character.armorClass}</p>
                  <p className="text-xs text-muted-foreground">Armor Class</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="flex items-center gap-2 font-serif text-lg mb-4">
                <User className="h-5 w-5" />
                Ability Scores
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(character.stats).map(([stat, value]) => (
                  <div 
                    key={stat} 
                    className="p-3 rounded-md bg-muted/50 text-center border border-border/50"
                  >
                    <p className="text-xs uppercase text-muted-foreground font-medium">
                      {STAT_NAMES[stat] || stat}
                    </p>
                    <p className="text-2xl font-bold font-mono">{value}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {getStatModifier(value)}
                    </p>
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
              {character.inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items in inventory
                </p>
              ) : (
                <div className="space-y-2">
                  {character.inventory.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        {item.type === "weapon" && <Sword className="h-4 w-4 text-red-500" />}
                        {item.type === "armor" && <Shield className="h-4 w-4 text-blue-500" />}
                        {item.type === "potion" && <Sparkles className="h-4 w-4 text-purple-500" />}
                        {item.type === "misc" && <Package className="h-4 w-4 text-muted-foreground" />}
                        {item.type === "gold" && <span className="text-yellow-500">$</span>}
                        <span className="font-medium">{item.name}</span>
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

            {character.backstory && (
              <>
                <Separator />
                <div>
                  <h3 className="flex items-center gap-2 font-serif text-lg mb-4">
                    <BookOpen className="h-5 w-5" />
                    Backstory
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {character.backstory}
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

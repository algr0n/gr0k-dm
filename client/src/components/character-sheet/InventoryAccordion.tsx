import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterInventoryItemWithDetails } from "@shared/schema";

interface InventoryAccordionProps {
  inventory: CharacterInventoryItemWithDetails[];
  defaultOpen?: boolean;
  className?: string;
}

export function InventoryAccordion({ 
  inventory, 
  defaultOpen = false, 
  className 
}: InventoryAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="inventory-accordion">
      <button
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="inventory-content"
      >
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-semibold">Inventory</span>
          {inventory.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {inventory.length}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      
      {isOpen && (
        <div id="inventory-content" className="p-4 pt-0 space-y-2">
          {inventory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items in inventory
            </p>
          ) : (
            inventory.map((invItem) => {
              const props = invItem.item.properties as Record<string, unknown> | null;
              const damage = props?.damage as { damage_dice?: string; damage_type?: { name?: string } } | undefined;
              const armorClass = props?.armor_class as { base?: number; dex_bonus?: boolean; max_bonus?: number } | undefined;
              
              return (
                <div 
                  key={invItem.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                  data-testid={`inventory-item-${invItem.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-medium truncate text-sm">{invItem.item.name}</span>
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
            })
          )}
        </div>
      )}
    </Card>
  );
}

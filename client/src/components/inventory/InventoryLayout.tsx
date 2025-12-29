import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Coins, Shield } from "lucide-react";
import { EquipmentSlots } from "./EquipmentSlots";
import { ItemGrid } from "./ItemGrid";
import { EncumbranceBar } from "./EncumbranceBar";
import type { CharacterInventoryItemWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";

interface InventoryLayoutProps {
  items: CharacterInventoryItemWithDetails[];
  gold?: number;
  currency?: { cp: number; sp: number; gp: number };
  armorClass?: number;
  currentWeight?: number;
  maxWeight?: number;
  attunedCount?: number;
  maxAttunement?: number;
  onItemClick?: (item: CharacterInventoryItemWithDetails) => void;
  onItemDoubleClick?: (item: CharacterInventoryItemWithDetails) => void;
  onItemDragStart?: (item: CharacterInventoryItemWithDetails, e: React.DragEvent) => void;
  onItemDragEnd?: (item: CharacterInventoryItemWithDetails, e: React.DragEvent) => void;
  onItemDrink?: (item: CharacterInventoryItemWithDetails) => void;
  onItemEat?: (item: CharacterInventoryItemWithDetails) => void;
  onItemUse?: (item: CharacterInventoryItemWithDetails) => void;
  onItemDrop?: (item: CharacterInventoryItemWithDetails) => void;
  onItemViewDetails?: (item: CharacterInventoryItemWithDetails) => void;
  onSlotClick?: (slot: string) => void;
  onSlotDrop?: (slot: string, e: React.DragEvent) => void;
  className?: string;
}

export function InventoryLayout({
  items,
  gold = 0,
  currency,
  armorClass = 10,
  currentWeight = 0,
  maxWeight = 150,
  attunedCount = 0,
  maxAttunement = 3,
  onItemClick,
  onItemDoubleClick,
  onItemDragStart,
  onItemDragEnd,
  onItemDrink,
  onItemEat,
  onItemUse,
  onItemDrop,
  onItemViewDetails,
  onSlotClick,
  onSlotDrop,
  className,
}: InventoryLayoutProps) {
  const equippedItems = items.filter((item) => item.equipped);

  return (
    <div className={cn("space-y-4", className)} data-testid="inventory-layout">
      {/* Top Stats Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Currency</p>
                <div className="flex items-center gap-2 font-mono font-bold">
                  {currency ? (
                    <>
                      <span className="text-amber-600">{currency.gp}<span className="text-xs text-muted-foreground ml-0.5">gp</span></span>
                      <span className="text-slate-400">{currency.sp}<span className="text-xs text-muted-foreground ml-0.5">sp</span></span>
                      <span className="text-amber-700">{currency.cp}<span className="text-xs text-muted-foreground ml-0.5">cp</span></span>
                    </>
                  ) : (
                    <span>{gold} gp</span>
                  )}
                </div>
              </div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Armor Class</p>
                <p className="font-bold font-mono">{armorClass}</p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div>
              <p className="text-xs text-muted-foreground">Attunement</p>
              <div className="flex items-center gap-1">
                <p className="font-bold font-mono">{attunedCount}/{maxAttunement}</p>
                {attunedCount >= maxAttunement && (
                  <Badge variant="destructive" className="text-xs">
                    Full
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Encumbrance Bar */}
      <Card className="p-4">
        <EncumbranceBar 
          currentWeight={currentWeight} 
          maxWeight={maxWeight}
        />
      </Card>

      {/* Main Layout: Equipment Slots (Left) + Item Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel: Equipment Slots */}
        <Card className="p-4 lg:col-span-1">
          <EquipmentSlots
            equippedItems={equippedItems}
            onSlotClick={onSlotClick}
            onSlotDrop={onSlotDrop}
          />
        </Card>

        {/* Right Panel: Item Grid with Search and Tabs */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-serif text-lg font-semibold mb-4">
            Items ({items.length})
          </h3>
          <ItemGrid
            items={items}
            onItemClick={onItemClick}
            onItemDoubleClick={onItemDoubleClick}
            onItemDragStart={onItemDragStart}
            onItemDragEnd={onItemDragEnd}
            onItemDrink={onItemDrink}
            onItemEat={onItemEat}
            onItemUse={onItemUse}
            onItemDrop={onItemDrop}
            onItemViewDetails={onItemViewDetails}
          />
        </Card>
      </div>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CharacterInventoryItemWithDetails } from "@shared/schema";
import { 
  Sword, 
  Shield, 
  ShirtIcon as Shirt, 
  HandIcon as Hand,
  WatchIcon as Boot,
  CrownIcon as Helmet,
  Circle as Ring,
} from "lucide-react";

type EquipmentSlot = 
  | "head"
  | "chest" 
  | "hands" 
  | "legs" 
  | "feet"
  | "mainHand"
  | "offHand"
  | "ring1"
  | "ring2"
  | "neck";

interface EquipmentSlotsProps {
  equippedItems: CharacterInventoryItemWithDetails[];
  onSlotClick?: (slot: EquipmentSlot) => void;
  onSlotDrop?: (slot: EquipmentSlot, e: React.DragEvent) => void;
  className?: string;
}

const slotIcons: Record<EquipmentSlot, React.ComponentType<{ className?: string }>> = {
  head: Helmet,
  chest: Shirt,
  hands: Hand,
  legs: Shirt,
  feet: Boot,
  mainHand: Sword,
  offHand: Shield,
  ring1: Ring,
  ring2: Ring,
  neck: Ring,
};

const slotLabels: Record<EquipmentSlot, string> = {
  head: "Head",
  chest: "Chest",
  hands: "Hands",
  legs: "Legs",
  feet: "Feet",
  mainHand: "Main Hand",
  offHand: "Off Hand",
  ring1: "Ring 1",
  ring2: "Ring 2",
  neck: "Neck",
};

export function EquipmentSlots({ 
  equippedItems, 
  onSlotClick, 
  onSlotDrop,
  className 
}: EquipmentSlotsProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (slot: EquipmentSlot) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSlotDrop?.(slot, e);
  };

  const getItemForSlot = (slot: EquipmentSlot): CharacterInventoryItemWithDetails | null => {
    // This is a simple implementation - in a real scenario, you'd need to map
    // item types to slots based on the item's category and properties
    return null;
  };

  const slots: EquipmentSlot[] = [
    "head",
    "neck",
    "chest",
    "hands",
    "ring1",
    "ring2",
    "legs",
    "feet",
    "mainHand",
    "offHand",
  ];

  return (
    <div className={cn("space-y-4", className)} data-testid="equipment-slots">
      <h3 className="font-serif text-lg font-semibold">Equipment</h3>
      
      {/* Character Silhouette with Equipment Slots */}
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot) => {
          const Icon = slotIcons[slot];
          const item = getItemForSlot(slot);
          const isEmpty = !item;

          return (
            <Card
              key={slot}
              className={cn(
                "p-3 cursor-pointer hover:bg-accent/50 transition-colors border-2 border-dashed",
                isEmpty ? "border-border" : "border-primary bg-primary/5"
              )}
              onClick={() => onSlotClick?.(slot)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(slot)}
              data-testid={`equipment-slot-${slot}`}
            >
              <div className="flex flex-col items-center gap-1 text-center">
                <Icon className={cn(
                  "h-6 w-6",
                  isEmpty ? "text-muted-foreground" : "text-primary"
                )} />
                <span className="text-xs font-medium text-muted-foreground">
                  {slotLabels[slot]}
                </span>
                {item && (
                  <span className="text-xs font-semibold truncate w-full">
                    {item.item.name}
                  </span>
                )}
                {isEmpty && (
                  <span className="text-xs text-muted-foreground/70">
                    Empty
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Equipped Items List (Alternative View) */}
      {equippedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {equippedItems.length} item(s) equipped
          </p>
          {equippedItems.slice(0, 3).map((invItem) => (
            <div 
              key={invItem.id}
              className="text-xs p-2 rounded-md bg-muted/30 flex items-center justify-between"
            >
              <span className="truncate">{invItem.item.name}</span>
              {invItem.attunementSlot && (
                <span className="text-primary ml-2">⚡</span>
              )}
            </div>
          ))}
          {equippedItems.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{equippedItems.length - 3} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

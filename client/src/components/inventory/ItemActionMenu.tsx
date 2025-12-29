import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wine, UtensilsCrossed, Sparkles, Trash2, Info } from "lucide-react";
import type { Item, ItemCategory } from "@shared/schema";

interface ItemActionMenuProps {
  item: Item;
  quantity: number;
  onDrink?: () => void;
  onEat?: () => void;
  onUse?: () => void;
  onDrop?: () => void;
  onViewDetails?: () => void;
  children: React.ReactNode;
}

/**
 * Determines if an item is consumable based on category and properties
 */
function isConsumable(item: Item): boolean {
  const consumableCategories: ItemCategory[] = ["potion", "scroll"];
  if (consumableCategories.includes(item.category as ItemCategory)) {
    return true;
  }
  
  // Check for food/drink in adventuring gear by name
  if (item.category === "adventuring_gear") {
    const name = item.name.toLowerCase();
    const consumableKeywords = [
      "ale", "beer", "wine", "potion", "elixir", "tonic",
      "stew", "ration", "food", "meat", "bread", "cheese",
      "water", "drink", "beverage", "meal"
    ];
    return consumableKeywords.some(keyword => name.includes(keyword));
  }
  
  return false;
}

/**
 * Determines the consumption action type based on item name and category
 */
function getConsumptionType(item: Item): "drink" | "eat" | "use" {
  const name = item.name.toLowerCase();
  
  // Beverages
  const drinkKeywords = ["ale", "beer", "wine", "potion", "elixir", "tonic", "water", "drink", "beverage"];
  if (drinkKeywords.some(keyword => name.includes(keyword))) {
    return "drink";
  }
  
  // Food items
  const foodKeywords = ["stew", "ration", "food", "meat", "bread", "cheese", "meal", "soup"];
  if (foodKeywords.some(keyword => name.includes(keyword))) {
    return "eat";
  }
  
  // Default to "use" for scrolls and other consumables
  return "use";
}

export function ItemActionMenu({
  item,
  quantity,
  onDrink,
  onEat,
  onUse,
  onDrop,
  onViewDetails,
  children,
}: ItemActionMenuProps) {
  const consumable = isConsumable(item);
  const consumptionType = consumable ? getConsumptionType(item) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* View Details */}
        {onViewDetails && (
          <>
            <DropdownMenuItem onClick={onViewDetails}>
              <Info className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Consumable Actions */}
        {consumable && consumptionType === "drink" && onDrink && (
          <DropdownMenuItem onClick={onDrink}>
            <Wine className="mr-2 h-4 w-4" />
            Drink
          </DropdownMenuItem>
        )}
        
        {consumable && consumptionType === "eat" && onEat && (
          <DropdownMenuItem onClick={onEat}>
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            Eat
          </DropdownMenuItem>
        )}
        
        {consumable && consumptionType === "use" && onUse && (
          <DropdownMenuItem onClick={onUse}>
            <Sparkles className="mr-2 h-4 w-4" />
            Use
          </DropdownMenuItem>
        )}
        
        {consumable && <DropdownMenuSeparator />}
        
        {/* Drop Item */}
        {onDrop && (
          <DropdownMenuItem onClick={onDrop} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Drop {quantity > 1 ? `(${quantity})` : ""}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

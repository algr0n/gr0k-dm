import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Item, ItemRarity } from "@shared/schema";
import { Package } from "lucide-react";

interface ItemCardProps {
  item: Item;
  quantity?: number;
  equipped?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  className?: string;
  draggable?: boolean;
}

const rarityColors: Record<ItemRarity, { text: string; border: string; bg: string }> = {
  common: { 
    text: "text-gray-500", 
    border: "border-gray-300 dark:border-gray-600", 
    bg: "bg-gray-50 dark:bg-gray-900/50" 
  },
  uncommon: { 
    text: "text-green-600 dark:text-green-400", 
    border: "border-green-400 dark:border-green-600", 
    bg: "bg-green-50 dark:bg-green-900/20" 
  },
  rare: { 
    text: "text-blue-600 dark:text-blue-400", 
    border: "border-blue-400 dark:border-blue-600", 
    bg: "bg-blue-50 dark:bg-blue-900/20" 
  },
  very_rare: { 
    text: "text-purple-600 dark:text-purple-400", 
    border: "border-purple-400 dark:border-purple-600", 
    bg: "bg-purple-50 dark:bg-purple-900/20" 
  },
  legendary: { 
    text: "text-amber-500 dark:text-amber-400", 
    border: "border-amber-400 dark:border-amber-600", 
    bg: "bg-amber-50 dark:bg-amber-900/20" 
  },
  artifact: { 
    text: "text-red-600 dark:text-red-400", 
    border: "border-red-500 dark:border-red-600", 
    bg: "bg-red-50 dark:bg-red-900/20" 
  },
  varies: { 
    text: "text-gray-500", 
    border: "border-gray-300 dark:border-gray-600", 
    bg: "bg-gray-50 dark:bg-gray-900/50" 
  },
};

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    weapon: "⚔️ Weapon",
    armor: "🛡️ Armor",
    potion: "🧪 Consumable",
    scroll: "📜 Scroll",
    wondrous_item: "✨ Wondrous",
    ring: "💍 Ring",
    rod: "🪄 Rod",
    staff: "🪄 Staff",
    wand: "🪄 Wand",
    tool: "🔧 Tool",
    adventuring_gear: "🎒 Gear",
    ammunition: "🏹 Ammo",
    other: "📦 Other",
  };
  return labels[category] || "📦 Item";
}

export function ItemCard({
  item,
  quantity = 1,
  equipped = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  className,
  draggable = true,
}: ItemCardProps) {
  const rarity = (item.rarity || "common") as ItemRarity;
  const rarityStyle = rarityColors[rarity];

  return (
    <Card
      className={cn(
        "relative p-3 cursor-pointer hover:shadow-md transition-all border-2",
        rarityStyle.border,
        rarityStyle.bg,
        equipped && "ring-2 ring-primary ring-offset-2",
        draggable && "active:opacity-50",
        className
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      draggable={draggable}
      data-testid={`item-card-${item.id}`}
    >
      <div className="flex items-start gap-2">
        <div className={cn("p-2 rounded-md", rarityStyle.bg)}>
          <Package className={cn("h-4 w-4", rarityStyle.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm truncate", rarityStyle.text)}>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {item.type}
          </p>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {/* Category Badge */}
            <Badge 
              variant="secondary" 
              className="text-xs h-5 px-1.5"
            >
              {getCategoryLabel(item.category)}
            </Badge>
            {quantity > 1 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                x{quantity}
              </Badge>
            )}
            {equipped && (
              <Badge variant="default" className="text-xs h-5 px-1.5">
                Equipped
              </Badge>
            )}
            {item.requiresAttunement && (
              <Badge variant="outline" className="text-xs h-5 px-1.5">
                Attunement
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

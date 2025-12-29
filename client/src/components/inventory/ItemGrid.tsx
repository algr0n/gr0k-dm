import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { ItemCard } from "./ItemCard";
import { ItemTooltip } from "./ItemTooltip";
import { ItemActionMenu } from "./ItemActionMenu";
import type { CharacterInventoryItemWithDetails, ItemCategory } from "@shared/schema";

interface ItemGridProps {
  items: CharacterInventoryItemWithDetails[];
  onItemClick?: (item: CharacterInventoryItemWithDetails) => void;
  onItemDoubleClick?: (item: CharacterInventoryItemWithDetails) => void;
  onItemDragStart?: (item: CharacterInventoryItemWithDetails, e: React.DragEvent) => void;
  onItemDragEnd?: (item: CharacterInventoryItemWithDetails, e: React.DragEvent) => void;
  onItemDrink?: (item: CharacterInventoryItemWithDetails) => void;
  onItemEat?: (item: CharacterInventoryItemWithDetails) => void;
  onItemUse?: (item: CharacterInventoryItemWithDetails) => void;
  onItemDrop?: (item: CharacterInventoryItemWithDetails) => void;
  onItemViewDetails?: (item: CharacterInventoryItemWithDetails) => void;
  className?: string;
}

type TabCategory = "all" | "weapons" | "armor" | "consumables" | "other";

const categoryMapping: Record<TabCategory, ItemCategory[]> = {
  all: [],
  weapons: ["weapon", "ammunition"],
  armor: ["armor"],
  consumables: ["potion", "scroll"],
  other: [
    "wondrous_item",
    "ring",
    "rod",
    "staff",
    "wand",
    "tool",
    "adventuring_gear",
    "container",
    "mount",
    "vehicle",
    "other",
  ],
};

export function ItemGrid({
  items,
  onItemClick,
  onItemDoubleClick,
  onItemDragStart,
  onItemDragEnd,
  onItemDrink,
  onItemEat,
  onItemUse,
  onItemDrop,
  onItemViewDetails,
  className,
}: ItemGridProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabCategory>("all");

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (invItem) =>
          invItem.item.name.toLowerCase().includes(searchLower) ||
          invItem.item.type.toLowerCase().includes(searchLower) ||
          invItem.item.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by category tab
    if (activeTab !== "all") {
      const categories = categoryMapping[activeTab];
      filtered = filtered.filter((invItem) =>
        categories.includes(invItem.item.category as ItemCategory)
      );
    }

    return filtered;
  }, [items, search, activeTab]);

  return (
    <div className={className} data-testid="item-grid">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabCategory)}>
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="item-search-input"
            />
          </div>

          {/* Category Tabs */}
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="weapons" data-testid="tab-weapons">
              Weapons
            </TabsTrigger>
            <TabsTrigger value="armor" data-testid="tab-armor">
              Armor
            </TabsTrigger>
            <TabsTrigger value="consumables" data-testid="tab-consumables">
              Consumables
            </TabsTrigger>
            <TabsTrigger value="other" data-testid="tab-other">
              Other
            </TabsTrigger>
          </TabsList>

          {/* Items Display */}
          <TabsContent value={activeTab} className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {search ? "No items match your search" : "No items in this category"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredItems.map((invItem) => (
                    <ItemActionMenu
                      key={invItem.id}
                      item={invItem.item}
                      quantity={invItem.quantity}
                      onDrink={() => onItemDrink?.(invItem)}
                      onEat={() => onItemEat?.(invItem)}
                      onUse={() => onItemUse?.(invItem)}
                      onDrop={() => onItemDrop?.(invItem)}
                      onViewDetails={() => onItemViewDetails?.(invItem)}
                    >
                      <ItemTooltip
                        item={invItem.item}
                        quantity={invItem.quantity}
                        equipped={invItem.equipped}
                        attunementSlot={invItem.attunementSlot || false}
                      >
                        <div>
                          <ItemCard
                            item={invItem.item}
                            quantity={invItem.quantity}
                            equipped={invItem.equipped}
                            onClick={() => onItemClick?.(invItem)}
                            onDoubleClick={() => onItemDoubleClick?.(invItem)}
                            onContextMenu={(e) => {
                              e.preventDefault(); // Prevent default context menu
                            }}
                            onDragStart={(e) => onItemDragStart?.(invItem, e)}
                            onDragEnd={(e) => onItemDragEnd?.(invItem, e)}
                          />
                        </div>
                      </ItemTooltip>
                    </ItemActionMenu>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

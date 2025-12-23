import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Item, CharacterInventoryItemWithDetails } from "@shared/schema";

interface ItemTooltipProps {
  item: Item;
  quantity?: number;
  equipped?: boolean;
  attunementSlot?: boolean;
  equippedItem?: CharacterInventoryItemWithDetails | null;
  children: React.ReactNode;
}

export function ItemTooltip({
  item,
  quantity = 1,
  equipped = false,
  attunementSlot = false,
  equippedItem = null,
  children,
}: ItemTooltipProps) {
  const props = item.properties as Record<string, unknown> | null;
  const damage = props?.damage as { damage_dice?: string; damage_type?: { name?: string } } | undefined;
  const armorClass = props?.armor_class as { base?: number; dex_bonus?: boolean; max_bonus?: number } | undefined;
  const weaponProps = props?.properties as { name?: string }[] | undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs" data-testid={`item-tooltip-${item.id}`}>
        <div className="space-y-2">
          <div>
            <p className="font-serif font-semibold text-base">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.type}
              {item.subtype && ` - ${item.subtype}`}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className="text-xs capitalize">
              {item.rarity || "common"}
            </Badge>
            {item.requiresAttunement && (
              <Badge variant="secondary" className="text-xs">
                Requires Attunement
              </Badge>
            )}
            {quantity > 1 && (
              <Badge className="text-xs">x{quantity}</Badge>
            )}
          </div>

          {(damage || armorClass) && (
            <>
              <Separator />
              <div className="space-y-1 text-sm">
                {damage && (
                  <p>
                    <span className="font-medium">Damage:</span>{" "}
                    {damage.damage_dice} {damage.damage_type?.name}
                  </p>
                )}
                {armorClass && (
                  <p>
                    <span className="font-medium">AC:</span> {armorClass.base}
                    {armorClass.dex_bonus && " + Dex"}
                    {armorClass.max_bonus !== undefined && ` (max ${armorClass.max_bonus})`}
                  </p>
                )}
                {weaponProps && weaponProps.length > 0 && (
                  <p>
                    <span className="font-medium">Properties:</span>{" "}
                    {weaponProps.map((p) => p.name).join(", ")}
                  </p>
                )}
              </div>
            </>
          )}

          {(item.weight !== null && item.weight !== undefined) && (
            <>
              <Separator />
              <p className="text-sm">
                <span className="font-medium">Weight:</span> {item.weight} lb
              </p>
            </>
          )}

          {item.cost && (
            <p className="text-sm">
              <span className="font-medium">Cost:</span> {item.cost} gp
            </p>
          )}

          <Separator />
          <p className="text-sm text-muted-foreground">{item.description}</p>

          {equippedItem && !equipped && (
            <>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Currently Equipped:</p>
                <p>{equippedItem.item.name}</p>
              </div>
            </>
          )}

          {equipped && (
            <Badge variant="default" className="text-xs mt-2">
              Currently Equipped
            </Badge>
          )}
          {attunementSlot && (
            <Badge variant="secondary" className="text-xs mt-2">
              Attuned
            </Badge>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

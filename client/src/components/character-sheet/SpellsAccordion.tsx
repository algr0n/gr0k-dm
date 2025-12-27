import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpellsAccordionProps {
  spells: string[];
  defaultOpen?: boolean;
  className?: string;
}

export function SpellsAccordion({ 
  spells, 
  defaultOpen = false, 
  className 
}: SpellsAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="spells-accordion">
      <button
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="spells-content"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-serif text-lg font-semibold">Spells</span>
          {spells.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {spells.length}
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
        <div id="spells-content" className="p-4 pt-0">
          {spells.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No spells known
            </p>
          ) : (
            <div className="space-y-1">
              {spells.map((spell, idx) => (
                <div
                  key={idx}
                  className="text-sm py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  data-testid={`spell-${idx}`}
                >
                  {spell}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

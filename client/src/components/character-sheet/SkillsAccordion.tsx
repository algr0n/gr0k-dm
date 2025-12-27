import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkillsList } from "./SkillsList";
import type { LayoutBreakpoint } from "@/hooks/useLayoutBreakpoint";
import type { Skill } from "./types";

interface SkillsAccordionProps {
  skills: Skill[];
  proficiencyBonus: number;
  hasJackOfAllTrades?: boolean;
  hasReliableTalent?: boolean;
  breakpoint: LayoutBreakpoint;
  className?: string;
}

export function SkillsAccordion({ 
  skills,
  proficiencyBonus,
  hasJackOfAllTrades = false,
  hasReliableTalent = false,
  breakpoint,
  className 
}: SkillsAccordionProps) {
  // Auto-expand on desktop, collapsed on mobile/tablet
  // Update accordion state when breakpoint changes
  const [isOpen, setIsOpen] = useState(breakpoint === 'desktop');
  
  // Update isOpen when breakpoint changes
  useEffect(() => {
    if (breakpoint === 'desktop') {
      setIsOpen(true);
    }
  }, [breakpoint]);

  // If desktop, always show expanded without accordion behavior
  if (breakpoint === 'desktop') {
    return (
      <div className={className}>
        <SkillsList
          skills={skills}
          proficiencyBonus={proficiencyBonus}
          hasJackOfAllTrades={hasJackOfAllTrades}
          hasReliableTalent={hasReliableTalent}
        />
      </div>
    );
  }

  // Mobile/tablet: use accordion
  return (
    <Card className={cn("overflow-hidden", className)} data-testid="skills-accordion">
      <button
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="skills-content"
      >
        <span className="font-serif text-lg font-semibold">Skills</span>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      
      {isOpen && (
        <div id="skills-content" className="p-4 pt-0">
          <SkillsList
            skills={skills}
            proficiencyBonus={proficiencyBonus}
            hasJackOfAllTrades={hasJackOfAllTrades}
            hasReliableTalent={hasReliableTalent}
          />
        </div>
      )}
    </Card>
  );
}

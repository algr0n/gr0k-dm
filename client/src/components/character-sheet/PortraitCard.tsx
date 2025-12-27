import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PortraitCardProps {
  characterName: string;
  initials: string;
  className?: string;
}

export function PortraitCard({ characterName, initials, className }: PortraitCardProps) {
  return (
    <Card className={cn("p-4", className)} data-testid="portrait-card">
      <Avatar className="w-full h-full aspect-square border-4 border-primary/20">
        <AvatarFallback className="bg-primary/10 text-primary font-serif font-bold text-5xl">
          {initials}
        </AvatarFallback>
      </Avatar>
      <p className="text-center mt-3 font-serif text-sm text-muted-foreground">
        {characterName}
      </p>
    </Card>
  );
}

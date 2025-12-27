import { Card } from "@/components/ui/card";
import { Shield, Zap, Footprints, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoreStatsCardProps {
  ac: number;
  speed: number;
  initiative: number;
  currency?: {
    gp?: number;
    sp?: number;
    cp?: number;
  };
  className?: string;
}

export function CoreStatsCard({ 
  ac, 
  speed, 
  initiative, 
  currency,
  className 
}: CoreStatsCardProps) {
  return (
    <Card className={cn("p-4 space-y-3", className)} data-testid="core-stats-card">
      <h3 className="font-serif text-lg font-semibold mb-3">Core Stats</h3>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Armor Class</span>
          </div>
          <span className="font-mono font-bold">{ac}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Speed</span>
          </div>
          <span className="font-mono font-bold">{speed} ft</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Initiative</span>
          </div>
          <span className="font-mono font-bold">
            {initiative >= 0 ? '+' : ''}{initiative}
          </span>
        </div>

        {currency && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Currency</span>
              </div>
            </div>
            <div className="mt-1 text-sm space-x-2">
              <span className="text-amber-600 dark:text-amber-400 font-mono">
                {currency.gp || 0}gp
              </span>
              <span className="text-slate-500 font-mono">
                {currency.sp || 0}sp
              </span>
              <span className="text-amber-700 dark:text-amber-600 font-mono">
                {currency.cp || 0}cp
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

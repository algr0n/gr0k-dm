import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Users, Gamepad2, Swords } from "lucide-react";
import type { BotStatus } from "@shared/schema";

export function BotStatusCard() {
  const { data: status, isLoading } = useQuery<BotStatus>({
    queryKey: ["/api/bot/status"],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isOnline = status?.isOnline ?? false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
        <Badge 
          variant={isOnline ? "default" : "secondary"}
          className={isOnline ? "bg-green-600 dark:bg-green-500" : ""}
          data-testid="badge-bot-status"
        >
          {isOnline ? (
            <><Wifi className="mr-1 h-3 w-3" /> Online</>
          ) : (
            <><WifiOff className="mr-1 h-3 w-3" /> Offline</>
          )}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold font-mono" data-testid="text-guilds-count">
              {status?.connectedGuilds ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">Servers</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
            <Gamepad2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold font-mono" data-testid="text-active-games">
              {status?.activeGames ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">Active Games</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
            <Swords className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold font-mono" data-testid="text-total-characters">
              {status?.totalCharacters ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">Characters</span>
          </div>
        </div>
        {status?.lastActivity && (
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Last activity: {new Date(status.lastActivity).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

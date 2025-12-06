import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Gamepad2, MessageSquare, MapPin } from "lucide-react";
import type { GameSession } from "@shared/schema";

export function GameSessions() {
  const { data: sessions = [], isLoading } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
  });

  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Gamepad2 className="h-5 w-5" />
          <span className="font-serif">Active Games</span>
        </h3>
        <Badge variant="secondary">{activeSessions.length} active</Badge>
      </div>
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-md bg-muted/50 animate-pulse">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-full bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Gamepad2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No active games</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a game in Discord with <code className="text-xs bg-muted px-1 py-0.5 rounded">!start</code>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-md bg-muted/30 hover-elevate"
                  data-testid={`session-${session.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{session.name}</h4>
                      {session.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {session.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {session.messageHistory.length}
                    </Badge>
                  </div>
                  {session.currentScene && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{session.currentScene}</span>
                    </div>
                  )}
                  {session.quests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {session.quests
                        .filter((q) => q.status === "active")
                        .slice(0, 3)
                        .map((quest) => (
                          <Badge key={quest.id} variant="secondary" className="text-xs">
                            {quest.title}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

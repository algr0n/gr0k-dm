import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, Dices, MessageSquare, User, Sparkles } from "lucide-react";
import type { DiceRollRecord, GameSession, Character } from "@shared/schema";

interface ActivityItem {
  id: string;
  type: "roll" | "message" | "character" | "session";
  title: string;
  description: string;
  timestamp: Date;
}

export function ActivityFeed() {
  const { data: rolls = [] } = useQuery<DiceRollRecord[]>({
    queryKey: ["/api/dice/history"],
  });

  const { data: sessions = [] } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: characters = [] } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
  });

  const activities: ActivityItem[] = [
    ...rolls.slice(0, 10).map((roll) => ({
      id: `roll-${roll.id}`,
      type: "roll" as const,
      title: `Rolled ${roll.expression}`,
      description: `Result: ${roll.total}${roll.purpose ? ` - ${roll.purpose}` : ""}`,
      timestamp: new Date(roll.timestamp),
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "roll":
        return <Dices className="h-4 w-4 text-purple-500" />;
      case "message":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "character":
        return <User className="h-4 w-4 text-green-500" />;
      case "session":
        return <Sparkles className="h-4 w-4 text-amber-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <span className="font-serif">Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[250px]">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No recent activity</p>
              <p className="text-sm text-muted-foreground mt-1">
                Activity will appear as you play
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-md hover-elevate"
                  data-testid={`activity-${activity.id}`}
                >
                  <div className="mt-0.5">{getIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

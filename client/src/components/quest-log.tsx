import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Scroll, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { GameSession, QuestEntry } from "@shared/schema";

export function QuestLog() {
  const { data: sessions = [], isLoading } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
  });

  const allQuests: (QuestEntry & { sessionName: string })[] = sessions.flatMap((session) =>
    session.quests.map((quest) => ({ ...quest, sessionName: session.name }))
  );

  const activeQuests = allQuests.filter((q) => q.status === "active");
  const completedQuests = allQuests.filter((q) => q.status === "completed");

  const getStatusIcon = (status: QuestEntry["status"]) => {
    switch (status) {
      case "active":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: QuestEntry["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300">Active</Badge>;
      case "completed":
        return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-700 dark:text-red-300">Failed</Badge>;
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Scroll className="h-5 w-5" />
          <span className="font-serif">Quest Log</span>
        </CardTitle>
        <div className="flex gap-2">
          <Badge variant="outline">{activeQuests.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-md bg-muted/50 animate-pulse">
                  <div className="h-4 w-40 bg-muted rounded mb-2" />
                  <div className="h-3 w-full bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : allQuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Scroll className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No quests yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Quests will appear as you adventure
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeQuests.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Active Quests</h4>
                  <div className="space-y-2">
                    {activeQuests.map((quest) => (
                      <QuestCard key={quest.id} quest={quest} />
                    ))}
                  </div>
                </div>
              )}
              {completedQuests.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Completed</h4>
                  <div className="space-y-2">
                    {completedQuests.slice(0, 5).map((quest) => (
                      <QuestCard key={quest.id} quest={quest} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function QuestCard({ quest }: { quest: QuestEntry & { sessionName: string } }) {
  return (
    <div
      className={`p-3 rounded-md ${
        quest.status === "completed" 
          ? "bg-green-500/5 border border-green-500/20" 
          : quest.status === "failed"
          ? "bg-red-500/5 border border-red-500/20"
          : "bg-muted/30"
      }`}
      data-testid={`quest-${quest.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium ${quest.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
              {quest.title}
            </h4>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {quest.description}
          </p>
        </div>
        <Badge 
          variant="secondary" 
          className={`shrink-0 text-xs ${
            quest.status === "completed" 
              ? "bg-green-500/20 text-green-700 dark:text-green-300" 
              : quest.status === "failed"
              ? "bg-red-500/20 text-red-700 dark:text-red-300"
              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
          }`}
        >
          {quest.status}
        </Badge>
      </div>
      {quest.objectives && quest.objectives.length > 0 && (
        <div className="mt-2 space-y-1">
          {quest.objectives.map((obj, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <Checkbox checked={obj.completed} disabled className="h-3 w-3" />
              <span className={obj.completed ? "line-through text-muted-foreground" : ""}>
                {obj.text}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">{quest.sessionName}</p>
    </div>
  );
}

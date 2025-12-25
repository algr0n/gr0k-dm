import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Scroll, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { GameSession, QuestEntry } from "@shared/schema";

interface RoomQuest {
  quest: {
    id: string;
    title: string;
    description: string | null;
    status: "active" | "completed" | "failed";
  };
  objectives: Array<{
    id: string;
    description: string;
    isCompleted: boolean;
  }>;
  completionPercentage: number;
}

export function QuestLog() {
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
  });

  // Fetch user's saved characters to get their active room codes
  const { data: characters = [], isLoading: charactersLoading } = useQuery<Array<{ id: string; currentRoomCode: string | null }>>({
    queryKey: ["/api/saved-characters"],
  });

  // Get unique room codes where user has active characters
  const activeRoomCodes = [...new Set(characters.filter(c => c.currentRoomCode).map(c => c.currentRoomCode))];

  // Fetch quests for each active room
  const roomQuestsQueries = useQuery({
    queryKey: ["/api/rooms/quests", activeRoomCodes],
    queryFn: async () => {
      if (activeRoomCodes.length === 0) return [];
      
      const allRoomQuests: Array<RoomQuest & { roomCode: string }> = [];
      
      for (const roomCode of activeRoomCodes) {
        try {
          const response = await fetch(`/api/rooms/${roomCode}/quests-with-progress`);
          if (response.ok) {
            const quests: RoomQuest[] = await response.json();
            allRoomQuests.push(...quests.map(q => ({ ...q, roomCode: roomCode as string })));
          }
        } catch (error) {
          console.error(`Failed to fetch quests for room ${roomCode}:`, error);
        }
      }
      
      return allRoomQuests;
    },
    enabled: activeRoomCodes.length > 0,
  });

  const isLoading = sessionsLoading || charactersLoading || roomQuestsQueries.isLoading;

  // Transform session quests to consistent format
  const sessionQuests: (QuestEntry & { sessionName: string; source: "session" })[] = sessions.flatMap((session) =>
    session.quests.map((quest) => ({ ...quest, sessionName: session.name, source: "session" as const }))
  );

  // Transform room quests to consistent format
  const roomQuests: Array<QuestEntry & { sessionName: string; source: "room" }> = (roomQuestsQueries.data || []).map(rq => ({
    id: rq.quest.id,
    title: rq.quest.title,
    description: rq.quest.description || undefined,
    objectives: rq.objectives.map(obj => ({
      text: obj.description,
      completed: obj.isCompleted
    })),
    status: rq.quest.status as "active" | "completed" | "failed" | "inactive",
    sessionName: `Room ${rq.roomCode}`,
    source: "room" as const
  }));

  // Combine all quests
  const allQuests = [...sessionQuests, ...roomQuests];
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Scroll className="h-5 w-5" />
          <span className="font-serif">Quest Log</span>
        </h3>
        <div className="flex gap-2">
          <Badge variant="outline">{activeQuests.length} active</Badge>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-[350px]">
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
      </div>
    </div>
  );
}

function QuestCard({ quest }: { quest: QuestEntry & { sessionName: string; source?: "session" | "room" } }) {
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
            {quest.source === "room" && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">Room</Badge>
            )}
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
          {quest.objectives.map((obj, idx) => {
            const objective = typeof obj === "string" ? { text: obj, completed: false } : obj as { text: string; completed?: boolean };
            return (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!objective.completed} disabled className="h-3 w-3" />
                <span className={objective.completed ? "line-through text-muted-foreground" : ""}>
                  {objective.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">{quest.sessionName}</p>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, XCircle, Clock, AlertCircle, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QuestObjective {
  id: string;
  objectiveText: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
}

interface Quest {
  id: string;
  name: string;
  description: string;
  status: "active" | "in_progress" | "completed" | "failed";
  urgency?: string;
  questGiver?: string;
  dynamicQuestGiverId?: string;
  rewards?: {
    xp?: number;
    gold?: number;
    items?: string[];
    other?: string[];
  };
  isMainQuest: boolean;
  isDynamic: boolean;
}

interface QuestWithProgress {
  quest: Quest;
  objectives: QuestObjective[];
  completionPercentage: number;
}

interface DynamicNpc {
  id: string;
  name: string;
  role?: string;
  isQuestGiver: boolean;
}

interface QuestTrackerProps {
  roomId: string;
  roomCode: string;
}

export function QuestTracker({ roomId, roomCode }: QuestTrackerProps) {
  const { data: quests, isLoading: questsLoading } = useQuery<QuestWithProgress[]>({
    queryKey: [`/api/rooms/${roomCode}/quests-with-progress`],
  });

  const { data: npcs } = useQuery<DynamicNpc[]>({
    queryKey: [`/api/rooms/${roomId}/dynamic-npcs`],
  });

  const getQuestGiverName = (quest: Quest): string | undefined => {
    if (quest.questGiver) return quest.questGiver;
    if (quest.dynamicQuestGiverId && npcs) {
      const npc = npcs.find(n => n.id === quest.dynamicQuestGiverId);
      return npc?.name;
    }
    return undefined;
  };

  const getStatusIcon = (status: Quest["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "active":
      default:
        return <Circle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: Quest["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "active":
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency?.toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  if (questsLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Quests</CardTitle>
          <CardDescription>Loading quest log...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activeQuests = quests?.filter(q => q.quest.status === "active" || q.quest.status === "in_progress") || [];
  const completedQuests = quests?.filter(q => q.quest.status === "completed") || [];
  const failedQuests = quests?.filter(q => q.quest.status === "failed") || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quest Log</span>
          <div className="flex gap-2 text-sm font-normal">
            <Badge variant="outline" className="bg-yellow-50">
              {activeQuests.length} Active
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              {completedQuests.length} Done
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>
          Track your party's quests and objectives
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {!quests || quests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No quests yet</p>
              <p className="text-sm text-muted-foreground">
                Quests will appear here as your DM creates them
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active/In Progress Quests */}
              {activeQuests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-yellow-700 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Active Quests
                  </h3>
                  <div className="space-y-3">
                    {activeQuests.map(({ quest, objectives, completionPercentage }) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        objectives={objectives}
                        completionPercentage={completionPercentage}
                        questGiverName={getQuestGiverName(quest)}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        getUrgencyColor={getUrgencyColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Quests */}
              {completedQuests.length > 0 && (
                <>
                  {activeQuests.length > 0 && <Separator className="my-4" />}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-green-700 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Completed Quests
                    </h3>
                    <div className="space-y-3">
                      {completedQuests.map(({ quest, objectives, completionPercentage }) => (
                        <QuestCard
                          key={quest.id}
                          quest={quest}
                          objectives={objectives}
                          completionPercentage={completionPercentage}
                          questGiverName={getQuestGiverName(quest)}
                          getStatusIcon={getStatusIcon}
                          getStatusColor={getStatusColor}
                          getUrgencyColor={getUrgencyColor}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Failed Quests */}
              {failedQuests.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-red-700 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Failed Quests
                    </h3>
                    <div className="space-y-3">
                      {failedQuests.map(({ quest, objectives, completionPercentage }) => (
                        <QuestCard
                          key={quest.id}
                          quest={quest}
                          objectives={objectives}
                          completionPercentage={completionPercentage}
                          questGiverName={getQuestGiverName(quest)}
                          getStatusIcon={getStatusIcon}
                          getStatusColor={getStatusColor}
                          getUrgencyColor={getUrgencyColor}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface QuestCardProps {
  quest: Quest;
  objectives: QuestObjective[];
  completionPercentage: number;
  questGiverName?: string;
  getStatusIcon: (status: Quest["status"]) => JSX.Element;
  getStatusColor: (status: Quest["status"]) => string;
  getUrgencyColor: (urgency?: string) => string;
}

function QuestCard({
  quest,
  objectives,
  completionPercentage,
  questGiverName,
  getStatusIcon,
  getStatusColor,
  getUrgencyColor,
}: QuestCardProps) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(quest.status)}
              <CardTitle className="text-base">
                {quest.name}
                {quest.isMainQuest && (
                  <Badge className="ml-2 bg-purple-100 text-purple-800 border-purple-200">
                    Main Quest
                  </Badge>
                )}
              </CardTitle>
            </div>
            {questGiverName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>Quest Giver: {questGiverName}</span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Badge variant="outline" className={getStatusColor(quest.status)}>
              {quest.status.replace("_", " ")}
            </Badge>
            {quest.urgency && (
              <Badge variant="outline" className={getUrgencyColor(quest.urgency)}>
                {quest.urgency}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-sm mt-2">
          {quest.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress Bar */}
        {objectives.length > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>
        )}

        {/* Objectives */}
        {objectives.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Objectives:</p>
            <ul className="space-y-1.5">
              {objectives.map((obj) => (
                <li key={obj.id} className="flex items-start gap-2 text-sm">
                  {obj.isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <span className={obj.isCompleted ? "line-through text-muted-foreground" : ""}>
                    {obj.objectiveText}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rewards */}
        {quest.rewards && Object.keys(quest.rewards).length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Rewards:</p>
            <div className="flex flex-wrap gap-2">
              {quest.rewards.xp && (
                <Badge variant="outline" className="bg-blue-50">
                  {quest.rewards.xp} XP
                </Badge>
              )}
              {quest.rewards.gold && (
                <Badge variant="outline" className="bg-yellow-50">
                  {quest.rewards.gold} GP
                </Badge>
              )}
              {quest.rewards.items && quest.rewards.items.length > 0 && (
                <Badge variant="outline" className="bg-purple-50">
                  {quest.rewards.items.length} item(s)
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Calendar, CheckCircle2, Swords, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { DynamicNpc } from "@shared/schema";

interface NpcReputationPanelProps {
  roomId: string;
}

interface ReputationStatus {
  status: string;
  color: string;
  bgColor: string;
  description: string;
}

function getReputationStatus(reputation: number): ReputationStatus {
  if (reputation >= 75) {
    return {
      status: "Trusted Ally",
      color: "text-blue-600",
      bgColor: "bg-blue-500",
      description: "Deeply loyal, shares secrets, offers best rewards"
    };
  } else if (reputation >= 50) {
    return {
      status: "Friend",
      color: "text-green-600",
      bgColor: "bg-green-500",
      description: "Goes out of their way to help, offers discounts"
    };
  } else if (reputation >= 25) {
    return {
      status: "Friendly",
      color: "text-lime-600",
      bgColor: "bg-lime-500",
      description: "Helpful, offers fair deals"
    };
  } else if (reputation >= -24) {
    return {
      status: "Neutral",
      color: "text-gray-600",
      bgColor: "bg-gray-500",
      description: "Indifferent, standard interactions"
    };
  } else if (reputation >= -49) {
    return {
      status: "Unfriendly",
      color: "text-yellow-600",
      bgColor: "bg-yellow-500",
      description: "Suspicious, unhelpful, may demand payment"
    };
  } else if (reputation >= -74) {
    return {
      status: "Hostile",
      color: "text-orange-600",
      bgColor: "bg-orange-500",
      description: "Will attack if provoked, refuses help"
    };
  } else {
    return {
      status: "Enemy",
      color: "text-red-600",
      bgColor: "bg-red-500",
      description: "Actively hostile, attacks on sight"
    };
  }
}

function formatLastInteraction(timestamp: Date | number | null | undefined): string {
  if (!timestamp) return "Never";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

function ReputationBar({ reputation }: { reputation: number }) {
  const repStatus = getReputationStatus(reputation);
  
  // Convert -100 to +100 scale to 0-100 percentage
  const percentage = ((reputation + 100) / 200) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-semibold", repStatus.color)}>
          {repStatus.status}
        </span>
        <span className="text-muted-foreground">
          {reputation > 0 ? "+" : ""}{reputation}
        </span>
      </div>
      <div className="relative">
        <Progress 
          value={percentage} 
          className="h-3 bg-gray-200 dark:bg-gray-800"
          indicatorClassName={repStatus.bgColor}
        />
        {/* Threshold markers */}
        <div className="absolute inset-0 flex justify-between px-[2px]">
          {[-75, -50, -25, 0, 25, 50, 75].map((threshold) => {
            const pos = ((threshold + 100) / 200) * 100;
            return (
              <div
                key={threshold}
                className="relative"
                style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-3 bg-gray-400/50" />
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        {repStatus.description}
      </p>
    </div>
  );
}

function NpcCard({ npc }: { npc: DynamicNpc }) {
  const repStatus = getReputationStatus(npc.reputation ?? 0);
  const hasStats = Boolean(npc.statsBlock);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              repStatus.bgColor,
              "text-white"
            )}>
              <User className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">{npc.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {npc.role && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {npc.role}
                  </Badge>
                )}
                {npc.isQuestGiver && (
                  <Badge variant="secondary" className="text-xs">
                    Quest Giver
                  </Badge>
                )}
                {hasStats && (
                  <Badge variant="outline" className="text-xs">
                    <Swords className="h-3 w-3 mr-1" />
                    Combat Stats
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {npc.description && (
          <p className="text-sm text-muted-foreground">{npc.description}</p>
        )}
        
        {npc.personality && (
          <p className="text-sm italic text-muted-foreground">
            "{npc.personality}"
          </p>
        )}

        <Separator />

        <ReputationBar reputation={npc.reputation ?? 0} />

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>{npc.questsCompleted ?? 0} quests completed</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatLastInteraction(npc.lastInteraction)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NpcReputationPanel({ roomId }: NpcReputationPanelProps) {
  const { data, isLoading } = useQuery<{ npcs: DynamicNpc[]; combatSpawns?: any[] } | null>({
    queryKey: ["dynamic-npcs", roomId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/rooms/${roomId}/dynamic-npcs`);
      return (await response.json()) as { npcs: DynamicNpc[]; combatSpawns?: any[] };
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Users className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  const npcs = data?.npcs ?? [];

  if (npcs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No NPCs Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          As your adventure unfolds, the NPCs you meet will appear here. 
          Your actions and choices will affect how they view your party.
        </p>
      </div>
    );
  }

  // Sort NPCs: Quest givers first, then by reputation (highest to lowest)
  const sortedNpcs = [...npcs].sort((a, b) => {
    if (a.isQuestGiver && !b.isQuestGiver) return -1;
    if (!a.isQuestGiver && b.isQuestGiver) return 1;
    return (b.reputation ?? 0) - (a.reputation ?? 0);
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            NPCs & Reputation
          </h2>
          <p className="text-sm text-muted-foreground">
            Track your relationships with the people you've met. Your actions shape their opinions of you.
          </p>
        </div>

        <div className="grid gap-4">
          {sortedNpcs.map((npc) => (
            <NpcCard key={npc.id} npc={npc} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

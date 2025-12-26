import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scroll, CheckCircle2, AlertCircle, Star, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Quest {
  id: string;
  name: string;
  description: string;
  objectives?: string[];
  rewards?: {
    xp?: number;
    gold?: number;
    items?: string[];
    other?: string[];
  };
  isMainQuest: boolean;
  questGiver?: string;
  urgency?: string;
}

interface QuestAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: Quest | null;
  roomId: string;
  characterName?: string;
}

export function QuestAcceptanceModal({
  open,
  onOpenChange,
  quest,
  roomId,
  characterName,
}: QuestAcceptanceModalProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!quest) throw new Error("No quest to accept");
      const response = await apiRequest("POST", `/api/rooms/${roomId}/quests/${quest.id}/accept`, {
        acceptedBy: characterName,
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate quest queries to refresh the quest list
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${roomId}/quests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${roomId}/available-quests`] });
      
      toast({
        title: "Quest Accepted!",
        description: `${quest?.name} has been added to your quest log.`,
      });
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept quest",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptMutation.mutateAsync();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    toast({
      title: "Quest Declined",
      description: `You can accept ${quest?.name} later from the quest log.`,
    });
    onOpenChange(false);
  };

  if (!quest) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-serif flex items-center gap-2">
                <Scroll className="h-6 w-6 text-amber-600" />
                {quest.name}
                {quest.isMainQuest && (
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                )}
              </DialogTitle>
              <DialogDescription className="mt-2">
                {quest.questGiver && (
                  <span className="text-sm font-medium">
                    Quest Giver: {quest.questGiver}
                  </span>
                )}
              </DialogDescription>
            </div>
            <div className="flex flex-col gap-2 items-end">
              {quest.isMainQuest && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  Main Quest
                </Badge>
              )}
              {quest.urgency && (
                <Badge variant="outline" className={getUrgencyColor(quest.urgency)}>
                  <Clock className="h-3 w-3 mr-1" />
                  {quest.urgency.charAt(0).toUpperCase() + quest.urgency.slice(1)}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Description */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Description
              </h3>
              <p className="text-sm leading-relaxed">{quest.description}</p>
            </div>

            {/* Objectives */}
            {quest.objectives && quest.objectives.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Objectives
                </h3>
                <ul className="space-y-2">
                  {quest.objectives.map((objective, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground mt-1">•</span>
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rewards */}
            {quest.rewards && Object.keys(quest.rewards).length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                  Rewards
                </h3>
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
                  {quest.rewards.other && quest.rewards.other.length > 0 && (
                    quest.rewards.other.map((reward, idx) => (
                      <Badge key={idx} variant="outline" className="bg-gray-50">
                        {reward}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Warning for main quests */}
            {quest.isMainQuest && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-50 border border-purple-200">
                <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-purple-900">Main Quest</p>
                  <p className="text-purple-700 mt-1">
                    This quest is part of the main storyline and may be required to progress the adventure.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isAccepting}
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
          >
            {isAccepting ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Accept Quest
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

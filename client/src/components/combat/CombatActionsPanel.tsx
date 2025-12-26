import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sword, Shield, Clock, SkipForward, Zap } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CombatParticipant {
  id: string;
  name: string;
  currentHp?: number;
  maxHp?: number;
  ac?: number;
  controller?: string;
}

interface CombatActionsPanelProps {
  roomCode: string;
  myActorId: string;
  isMyTurn: boolean;
  participants: CombatParticipant[];
  characterData?: {
    attackBonus?: number;
    primaryDamage?: string;
    class?: string;
  };
}

export function CombatActionsPanel({
  roomCode,
  myActorId,
  isMyTurn,
  participants,
  characterData,
}: CombatActionsPanelProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter out self and dead enemies for targeting
  const validTargets = participants.filter(
    (p) => p.id !== myActorId && (p.currentHp ?? 0) > 0
  );

  const combatActionMutation = useMutation({
    mutationFn: async (action: any) => {
      const res = await fetch(`/api/rooms/${roomCode}/combat/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Combat action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setSelectedTargetId("");
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode] });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const passTurnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${roomCode}/combat/pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actorId: myActorId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Pass turn failed");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Pass Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const holdTurnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${roomCode}/combat/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          actorId: myActorId,
          holdType: "end",
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Hold turn failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Held",
        description: "You'll act at the end of the round",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Hold Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAttack = () => {
    if (!selectedTargetId) {
      toast({
        title: "No Target",
        description: "Select a target first",
        variant: "destructive",
      });
      return;
    }

    const attackBonus = characterData?.attackBonus ?? 0;
    const damageExpression = characterData?.primaryDamage ?? "1d6";

    combatActionMutation.mutate({
      actorId: myActorId,
      type: "attack",
      targetId: selectedTargetId,
      attackBonus,
      damageExpression,
    });
  };

  const handlePass = () => {
    passTurnMutation.mutate();
  };

  const handleHold = () => {
    holdTurnMutation.mutate();
  };

  if (!isMyTurn) {
    return (
      <Card className="p-3 bg-muted/50">
        <div className="text-sm text-muted-foreground text-center">
          <Clock className="h-4 w-4 inline mr-2" />
          Waiting for your turn...
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-primary/50 bg-primary/5">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Turn</h3>
          <Badge variant="default" className="ml-auto">Active</Badge>
        </div>

        {/* Target Selector */}
        {validTargets.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Target</label>
            <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a target..." />
              </SelectTrigger>
              <SelectContent>
                {validTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span>{target.name}</span>
                      {target.currentHp !== undefined && target.maxHp !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {target.currentHp}/{target.maxHp} HP
                        </span>
                      )}
                      {target.ac !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          AC {target.ac}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleAttack}
            disabled={!selectedTargetId || combatActionMutation.isPending}
            className="w-full"
            variant="default"
          >
            <Sword className="h-4 w-4 mr-2" />
            Attack
          </Button>

          <Button
            onClick={handlePass}
            disabled={passTurnMutation.isPending}
            variant="outline"
            className="w-full"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Pass
          </Button>

          <Button
            onClick={handleHold}
            disabled={holdTurnMutation.isPending}
            variant="outline"
            className="w-full col-span-2"
          >
            <Shield className="h-4 w-4 mr-2" />
            Hold (End of Round)
          </Button>
        </div>

        {characterData && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div className="flex justify-between">
              <span>Attack Bonus:</span>
              <span className="font-mono">+{characterData.attackBonus ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Damage:</span>
              <span className="font-mono">{characterData.primaryDamage ?? "1d6"}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

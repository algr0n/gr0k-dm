import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Heart, Shield, Coins, Sparkles, Plus, X, Skull, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type SavedCharacter, type UnifiedCharacter, type CharacterStatusEffect, statusEffectDefinitions, type GameSystem } from "@shared/schema";

interface CharacterData {
  roomCharacter: UnifiedCharacter & { playerName?: string };
  savedCharacter: UnifiedCharacter;
  statusEffects: CharacterStatusEffect[];
  playerName?: string;
}

interface DMControlsPanelProps {
  roomCode: string;
  hostName: string;
  gameSystem: GameSystem;
}

export function DMControlsPanel({ roomCode, hostName, gameSystem }: DMControlsPanelProps) {
  const { toast } = useToast();
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [hpChange, setHpChange] = useState("");
  const [tempHpChange, setTempHpChange] = useState("");
  const [goldChange, setGoldChange] = useState("");
  const [currencyType, setCurrencyType] = useState<"cp" | "sp" | "gp">("gp");
  const [xpChange, setXpChange] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<string>("");

  const { data: roomCharacters, isLoading } = useQuery<CharacterData[]>({
    queryKey: ["/api/rooms", roomCode, "room-characters"],
  });

  const selectedCharacter = roomCharacters?.find(c => c.roomCharacter.id === selectedCharacterId);
  const availableEffects = statusEffectDefinitions[gameSystem] || [];

  const updateStatsMutation = useMutation({
    mutationFn: async (updates: { currentHp?: number; temporaryHp?: number; gold?: number; currency?: { cp: number; sp: number; gp: number }; experience?: number; isAlive?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/room-characters/${selectedCharacterId}`, {
        hostName,
        roomCode,
        ...updates,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "room-characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "my-character"] });
      toast({ title: "Stats updated", description: "Character stats have been modified." });
    },
    onError: () => {
      toast({ title: "Failed to update", description: "Could not update character stats.", variant: "destructive" });
    },
  });

  const addEffectMutation = useMutation({
    mutationFn: async (effectName: string) => {
      const effectDef = availableEffects.find(e => e.name === effectName);
      const response = await apiRequest("POST", `/api/room-characters/${selectedCharacterId}/status-effects`, {
        hostName,
        roomCode,
        name: effectName,
        description: effectDef?.description || "",
        isPredefined: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "room-characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "my-character"] });
      setSelectedEffect("");
      toast({ title: "Effect applied", description: "Status effect has been added to the character." });
    },
    onError: () => {
      toast({ title: "Failed to apply", description: "Could not apply status effect.", variant: "destructive" });
    },
  });

  const removeEffectMutation = useMutation({
    mutationFn: async (effectId: string) => {
      const response = await apiRequest("DELETE", `/api/status-effects/${effectId}`, {
        hostName,
        roomCode,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "room-characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "my-character"] });
      toast({ title: "Effect removed", description: "Status effect has been removed." });
    },
    onError: () => {
      toast({ title: "Failed to remove", description: "Could not remove status effect.", variant: "destructive" });
    },
  });

  const handleHpChange = (delta: number) => {
    if (!selectedCharacter) return;
    const currentHp = selectedCharacter.roomCharacter.currentHp;
    const maxHp = selectedCharacter.savedCharacter.maxHp;
    const newHp = Math.max(0, Math.min(maxHp, currentHp + delta));
    updateStatsMutation.mutate({ currentHp: newHp, isAlive: newHp > 0 });
    setHpChange("");
  };

  const handleTempHpChange = (delta: number) => {
    if (!selectedCharacter) return;
    const current = selectedCharacter.roomCharacter.temporaryHp || 0;
    const newVal = Math.max(0, current + delta);
    updateStatsMutation.mutate({ temporaryHp: newVal });
    setTempHpChange("");
  };

  const handleGoldChange = (delta: number) => {
    if (!selectedCharacter) return;
    
    // Get current currency or fallback to old gold field
    const currentCurrency = selectedCharacter.savedCharacter.currency || {
      cp: 0,
      sp: 0,
      gp: selectedCharacter.roomCharacter.gold || 0
    };
    
    // Apply change to the selected currency type
    const newCurrency = { ...currentCurrency };
    newCurrency[currencyType] = Math.max(0, currentCurrency[currencyType] + delta);
    
    // Apply automatic conversion
    if (newCurrency.cp >= 100) {
      newCurrency.sp += Math.floor(newCurrency.cp / 100);
      newCurrency.cp = newCurrency.cp % 100;
    }
    if (newCurrency.sp >= 100) {
      newCurrency.gp += Math.floor(newCurrency.sp / 100);
      newCurrency.sp = newCurrency.sp % 100;
    }
    
    updateStatsMutation.mutate({ currency: newCurrency });
    setGoldChange("");
  };

  const awardXpMutation = useMutation({
    mutationFn: async (xpAmount: number) => {
      const savedCharId = selectedCharacter?.savedCharacter.id;
      if (!savedCharId) throw new Error("No saved character");
      const response = await apiRequest("POST", `/api/saved-characters/${savedCharId}/award-xp`, {
        xpAmount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "room-characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomCode, "my-character"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters"] });
      
      if (data.leveledUp) {
        toast({ 
          title: "Level Up!", 
          description: `${selectedCharacter?.savedCharacter.characterName} leveled up to Level ${data.level}! HP increased.`,
        });
      } else {
        toast({ title: "XP Awarded", description: `${data.xpAwarded} XP has been awarded.` });
      }
    },
    onError: () => {
      toast({ title: "Failed to award XP", description: "Could not award experience points.", variant: "destructive" });
    },
  });

  const handleXpChange = (delta: number) => {
    if (!selectedCharacter || delta <= 0) return;
    awardXpMutation.mutate(delta);
    setXpChange("");
  };

  const handleKillCharacter = () => {
    if (!selectedCharacter) return;
    updateStatsMutation.mutate({ currentHp: 0, isAlive: false });
  };

  const handleReviveCharacter = () => {
    if (!selectedCharacter) return;
    updateStatsMutation.mutate({ currentHp: 1, isAlive: true });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            DM Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading characters...</p>
        </CardContent>
      </Card>
    );
  }

  if (!roomCharacters || roomCharacters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            DM Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No characters in this room yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          DM Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Select Character</Label>
          <Select value={selectedCharacterId || ""} onValueChange={setSelectedCharacterId}>
            <SelectTrigger data-testid="select-dm-character">
              <SelectValue placeholder="Choose a character..." />
            </SelectTrigger>
            <SelectContent>
              {roomCharacters.map((char) => (
                <SelectItem key={char.roomCharacter.id} value={char.roomCharacter.id}>
                  <span className="flex items-center gap-2">
                    {char.savedCharacter.characterName}
                    {!char.roomCharacter.isAlive && <Skull className="h-4 w-4 text-destructive" />}
                    <span className="text-muted-foreground text-sm">
                      ({char.roomCharacter.playerName})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCharacter && (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={selectedCharacter.roomCharacter.isAlive ? "default" : "destructive"}>
                  {selectedCharacter.roomCharacter.isAlive ? "Alive" : "Dead"}
                </Badge>
                <Badge variant="outline">
                  Lv {selectedCharacter.savedCharacter.level} {selectedCharacter.savedCharacter.class}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="font-medium">HP:</span>
                  <span>
                    {selectedCharacter.roomCharacter.currentHp} / {selectedCharacter.savedCharacter.maxHp}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={hpChange}
                    onChange={(e) => setHpChange(e.target.value)}
                    className="w-24"
                    data-testid="input-hp-change"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleHpChange(parseInt(hpChange) || 0)}
                    disabled={!hpChange || updateStatsMutation.isPending}
                    data-testid="button-heal"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Heal
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleHpChange(-(parseInt(hpChange) || 0))}
                    disabled={!hpChange || updateStatsMutation.isPending}
                    data-testid="button-damage"
                  >
                    <X className="h-4 w-4 mr-1" /> Damage
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Temp HP:</span>
                  <span>{selectedCharacter.roomCharacter.temporaryHp || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={tempHpChange}
                    onChange={(e) => setTempHpChange(e.target.value)}
                    className="w-24"
                    data-testid="input-temp-hp"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTempHpChange(parseInt(tempHpChange) || 0)}
                    disabled={!tempHpChange || updateStatsMutation.isPending}
                    data-testid="button-add-temp-hp"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTempHpChange(-(parseInt(tempHpChange) || 0))}
                    disabled={!tempHpChange || updateStatsMutation.isPending}
                    data-testid="button-remove-temp-hp"
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Currency:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600">{selectedCharacter.savedCharacter.currency?.gp || selectedCharacter.roomCharacter.gold || 0}gp</span>
                    <span className="text-slate-400">{selectedCharacter.savedCharacter.currency?.sp || 0}sp</span>
                    <span className="text-amber-700">{selectedCharacter.savedCharacter.currency?.cp || 0}cp</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={currencyType} onValueChange={(v: "cp" | "sp" | "gp") => setCurrencyType(v)}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cp">cp</SelectItem>
                      <SelectItem value="sp">sp</SelectItem>
                      <SelectItem value="gp">gp</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={goldChange}
                    onChange={(e) => setGoldChange(e.target.value)}
                    className="w-24"
                    data-testid="input-gold"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGoldChange(parseInt(goldChange) || 0)}
                    disabled={!goldChange || updateStatsMutation.isPending}
                    data-testid="button-add-gold"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Give
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGoldChange(-(parseInt(goldChange) || 0))}
                    disabled={!goldChange || updateStatsMutation.isPending}
                    data-testid="button-remove-gold"
                  >
                    <X className="h-4 w-4 mr-1" /> Take
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">XP:</span>
                  <span>{selectedCharacter.savedCharacter.xp || 0}</span>
                  <Badge variant="outline" className="ml-2">Lv {selectedCharacter.savedCharacter.level || 1}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={xpChange}
                    onChange={(e) => setXpChange(e.target.value)}
                    className="w-24"
                    data-testid="input-xp"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleXpChange(parseInt(xpChange) || 0)}
                    disabled={!xpChange || parseInt(xpChange) <= 0 || awardXpMutation.isPending}
                    data-testid="button-add-xp"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Award
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Status Effects
                </Label>
                
                <div className="flex flex-wrap gap-1">
                  {selectedCharacter.statusEffects.map((effect) => (
                    <Badge
                      key={effect.id}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeEffectMutation.mutate(effect.id)}
                      data-testid={`badge-effect-${effect.id}`}
                    >
                      {effect.name}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  {selectedCharacter.statusEffects.length === 0 && (
                    <span className="text-muted-foreground text-sm">No active effects</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={selectedEffect} onValueChange={setSelectedEffect}>
                    <SelectTrigger className="flex-1" data-testid="select-effect">
                      <SelectValue placeholder="Add effect..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEffects.map((effect) => (
                        <SelectItem key={effect.name} value={effect.name}>
                          {effect.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => selectedEffect && addEffectMutation.mutate(selectedEffect)}
                    disabled={!selectedEffect || addEffectMutation.isPending}
                    data-testid="button-add-effect"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                {selectedCharacter.roomCharacter.isAlive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleKillCharacter}
                    disabled={updateStatsMutation.isPending}
                    data-testid="button-kill-character"
                  >
                    <Skull className="h-4 w-4 mr-1" />
                    Kill Character
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleReviveCharacter}
                    disabled={updateStatsMutation.isPending}
                    data-testid="button-revive-character"
                  >
                    <Heart className="h-4 w-4 mr-1" />
                    Revive (1 HP)
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

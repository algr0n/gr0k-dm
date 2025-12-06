
import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Dice6, Users, Copy, Check, Loader2, MessageSquare, User, XCircle, Save, Eye, Package, Trash2, LogOut, Plus, Sparkles, Swords } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Message, type Room, type Player, type Character, type InventoryItem, gameSystemLabels, type GameSystem } from "@shared/schema";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [gameEnded, setGameEnded] = useState(false);
  
  // View other player's character state
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);
  
  // Character form state
  const [characterName, setCharacterName] = useState("");
  const [characterStats, setCharacterStats] = useState<Record<string, any>>({});
  const [characterNotes, setCharacterNotes] = useState("");
  
  // Player info from session storage (read reactively to handle navigation timing)
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem("playerName") || "Anonymous");
  const [playerId, setPlayerId] = useState(() => sessionStorage.getItem("playerId") || "");
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Re-read session storage on mount to catch values written during navigation
  useEffect(() => {
    const storedPlayerName = sessionStorage.getItem("playerName");
    const storedPlayerId = sessionStorage.getItem("playerId");
    if (storedPlayerName && storedPlayerName !== playerName) {
      setPlayerName(storedPlayerName);
    }
    if (storedPlayerId && storedPlayerId !== playerId) {
      setPlayerId(storedPlayerId);
    }
  }, []);

  const { data: roomData, isLoading, error } = useQuery<Room & { players: Player[] }>({
    queryKey: ["/api/rooms", code],
    enabled: !!code,
  });

  // Fetch existing character data
  const { data: existingCharacter } = useQuery<Character>({
    queryKey: ["/api/rooms", code, "characters", playerId],
    enabled: !!code && !!playerId,
  });

  // Fetch character data for viewed player
  const viewingPlayer = players.find(p => p.id === viewingPlayerId);
  const { data: viewedCharacter, isLoading: isLoadingViewedCharacter } = useQuery<Character>({
    queryKey: ["/api/rooms", code, "characters", viewingPlayerId],
    enabled: !!code && !!viewingPlayerId,
  });

  // Fetch inventory for current character
  const { data: inventory, isLoading: isLoadingInventory, refetch: refetchInventory } = useQuery<InventoryItem[]>({
    queryKey: ["/api/characters", existingCharacter?.id, "inventory"],
    enabled: !!existingCharacter?.id,
  });

  // Load character data when it exists
  useEffect(() => {
    if (existingCharacter) {
      setCharacterName(existingCharacter.name);
      setCharacterStats(existingCharacter.stats || {});
      setCharacterNotes(existingCharacter.notes || "");
    }
  }, [existingCharacter]);

  const saveCharacterMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rooms/${code}/characters`, {
        playerId,
        name: characterName,
        stats: characterStats,
        notes: characterNotes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", code, "characters", playerId] });
      toast({
        title: "Character saved",
        description: "Your character has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save character",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const isHost = roomData?.hostName === playerName;

  const deleteInventoryItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("DELETE", `/api/inventory/${itemId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", existingCharacter?.id, "inventory"] });
      toast({
        title: "Item removed",
        description: "The item has been removed from your inventory.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to remove item",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  const addInventoryItemMutation = useMutation({
    mutationFn: async (data: { name: string; quantity: number }) => {
      const response = await apiRequest("POST", `/api/characters/${existingCharacter?.id}/inventory`, {
        name: data.name,
        quantity: data.quantity,
        grantedBy: playerName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", existingCharacter?.id, "inventory"] });
      toast({
        title: "Item added",
        description: "The item has been added to your inventory.",
      });
      setNewItemName("");
      setNewItemQuantity(1);
      setShowAddItemForm(false);
    },
    onError: () => {
      toast({
        title: "Failed to add item",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const endGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rooms/${code}/end`, { hostName: playerName });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Game ended",
        description: "The game has been closed.",
      });
      sessionStorage.removeItem("lastRoomCode");
      sessionStorage.removeItem("playerName");
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Failed to end game",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const leaveGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rooms/${code}/leave`, { playerId, playerName });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Left game",
        description: "You have left the game.",
      });
      sessionStorage.removeItem("lastRoomCode");
      sessionStorage.removeItem("playerName");
      sessionStorage.removeItem("playerId");
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Failed to leave game",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (roomData) {
      setMessages(roomData.messageHistory || []);
      setPlayers(roomData.players || []);
      setGameEnded(!roomData.isActive);
      sessionStorage.setItem("lastRoomCode", code || "");
    }
  }, [roomData, code]);

  useEffect(() => {
    if (!code || !playerName) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${code}&player=${encodeURIComponent(playerName)}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "message") {
        setMessages((prev) => [...prev, data.message]);
      } else if (data.type === "player_joined") {
        setPlayers((prev) => [...prev, data.player]);
      } else if (data.type === "game_ended") {
        setGameEnded(true);
        toast({
          title: "Game ended",
          description: "The host has ended this game session.",
        });
      } else if (data.type === "inventory_update") {
        // Refetch inventory when items are granted to our character
        // Check if the playerId in the update matches our playerId
        if (data.playerId === playerId && existingCharacter?.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/characters", existingCharacter.id, "inventory"] });
        }
      } else if (data.type === "player_left") {
        setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      } else if (data.type === "error") {
        toast({
          title: "Error",
          description: data.content,
          variant: "destructive",
        });
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
      toast({
        title: "Connection error",
        description: "Failed to connect to the game room.",
        variant: "destructive",
      });
    };

    return () => {
      ws.close();
    };
  }, [code, playerName, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || gameEnded) return;

    const isAction = inputValue.startsWith("*") && inputValue.endsWith("*");
    
    wsRef.current.send(JSON.stringify({
      type: isAction ? "action" : "chat",
      content: inputValue,
    }));
    
    setInputValue("");
  };

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Room code copied",
      description: "Share this code with your players!",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !roomData) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Room not found</h2>
        <p className="text-muted-foreground">The room code may be invalid or the game has ended.</p>
        <Button onClick={() => setLocation("/")} data-testid="button-back-home">
          Back to Home
        </Button>
      </div>
    );
  }

  const getMessageStyle = (type: Message["type"]) => {
    switch (type) {
      case "dm":
        return "bg-primary/10 border-l-4 border-primary";
      case "system":
        return "bg-muted text-muted-foreground text-sm italic text-center";
      case "roll":
        return "bg-accent/30";
      case "action":
        return "italic";
      default:
        return "";
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      <aside className="w-64 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h2 className="font-bold font-serif text-lg truncate" data-testid="text-room-name">
            {roomData.name}
          </h2>
          <Badge variant="secondary" className="mt-1">
            {gameSystemLabels[roomData.gameSystem as GameSystem]}
          </Badge>
          {gameEnded && (
            <Badge variant="destructive" className="mt-1 ml-2">
              Ended
            </Badge>
          )}
        </div>
        
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Room Code</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyRoomCode}
              className="font-mono"
              data-testid="button-copy-code"
            >
              {code}
              {copied ? <Check className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Players ({players.length})</span>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`player-${player.id}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("px-2 py-1 h-auto", player.name === playerName && "font-medium")}
                    onClick={() => setViewingPlayerId(player.id)}
                    data-testid={`button-view-player-${player.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {player.name}
                  </Button>
                  {player.isHost && <Badge variant="outline">Host</Badge>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-muted-foreground">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          
          {isHost && !gameEnded && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => endGameMutation.mutate()}
              disabled={endGameMutation.isPending}
              data-testid="button-end-game"
            >
              {endGameMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              End Game
            </Button>
          )}
          
          {!isHost && !gameEnded && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => leaveGameMutation.mutate()}
              disabled={leaveGameMutation.isPending}
              data-testid="button-leave-game"
            >
              {leaveGameMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Leave Game
            </Button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="sticky top-0 z-50 border-b px-4 bg-background">
            <TabsList className="h-12">
              <TabsTrigger value="chat" className="gap-2" data-testid="tab-chat">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="character" className="gap-2" data-testid="tab-character">
                <User className="h-4 w-4" />
                Character
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2" data-testid="tab-inventory">
                <Package className="h-4 w-4" />
                Inventory
              </TabsTrigger>
              {roomData?.gameSystem === "dnd" && (
                <TabsTrigger value="skills" className="gap-2" data-testid="tab-skills">
                  <Swords className="h-4 w-4" />
                  Skills & Spells
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "p-3 rounded-md",
                      getMessageStyle(message.type)
                    )}
                    data-testid={`message-${message.id}`}
                  >
                    {message.type !== "system" && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "font-medium text-sm",
                          message.type === "dm" && "text-primary font-serif"
                        )}>
                          {message.playerName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.diceResult && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Dice6 className="h-4 w-4" />
                        <span className="font-mono">
                          {message.diceResult.expression}: [{message.diceResult.rolls.join(", ")}]
                          {message.diceResult.modifier !== 0 && (
                            <span>
                              {message.diceResult.modifier > 0 ? " + " : " - "}
                              {Math.abs(message.diceResult.modifier)}
                            </span>
                          )}
                          {" = "}
                          <strong>{message.diceResult.total}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />

            <form onSubmit={sendMessage} className="p-4 flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={gameEnded ? "Game has ended" : "Type a message... (use /roll 2d6+3 for dice, *asterisks* for actions)"}
                disabled={!isConnected || gameEnded}
                data-testid="input-chat-message"
              />
              <Button 
                type="submit" 
                disabled={!isConnected || !inputValue.trim() || gameEnded}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="character" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
            <div className="max-w-2xl mx-auto space-y-4 p-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif">Character Sheet</CardTitle>
                    <p className="text-sm text-muted-foreground">Your character data is saved to the server.</p>
                  </div>
                  <Button 
                    onClick={() => saveCharacterMutation.mutate()}
                    disabled={saveCharacterMutation.isPending || !characterName.trim()}
                    data-testid="button-save-character"
                  >
                    {saveCharacterMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Character Name</label>
                      <Input 
                        placeholder="Enter character name" 
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        data-testid="input-character-name" 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Player</label>
                      <Input value={playerName} disabled data-testid="input-player-name-display" />
                    </div>
                  </div>
                  
                  {roomData.gameSystem === "dnd" && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Class {existingCharacter && "(Locked)"}</label>
                          <Select 
                            value={characterStats.class || ""} 
                            onValueChange={(value) => {
                              const hitDiceByClass: Record<string, number> = {
                                Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8,
                                Fighter: 10, Monk: 8, Paladin: 10, Ranger: 10,
                                Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
                              };
                              const hitDie = hitDiceByClass[value] || 8;
                              const conMod = Math.floor(((characterStats.con || 10) - 10) / 2);
                              const startingHp = hitDie + conMod;
                              setCharacterStats(prev => ({ 
                                ...prev, 
                                class: value,
                                maxHp: startingHp,
                                currentHp: startingHp,
                              }));
                              toast({
                                title: `Class: ${value}`,
                                description: `Starting HP set to ${startingHp} (d${hitDie} max + CON mod ${conMod >= 0 ? '+' : ''}${conMod})`,
                              });
                            }}
                            disabled={!!existingCharacter}
                          >
                            <SelectTrigger data-testid="select-dnd-class">
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Barbarian">Barbarian</SelectItem>
                              <SelectItem value="Bard">Bard</SelectItem>
                              <SelectItem value="Cleric">Cleric</SelectItem>
                              <SelectItem value="Druid">Druid</SelectItem>
                              <SelectItem value="Fighter">Fighter</SelectItem>
                              <SelectItem value="Monk">Monk</SelectItem>
                              <SelectItem value="Paladin">Paladin</SelectItem>
                              <SelectItem value="Ranger">Ranger</SelectItem>
                              <SelectItem value="Rogue">Rogue</SelectItem>
                              <SelectItem value="Sorcerer">Sorcerer</SelectItem>
                              <SelectItem value="Warlock">Warlock</SelectItem>
                              <SelectItem value="Wizard">Wizard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Race {existingCharacter && "(Locked)"}</label>
                          <Select 
                            value={characterStats.race || ""} 
                            onValueChange={(value) => {
                              const racialBonuses: Record<string, { stats: Record<string, number>; desc: string }> = {
                                Dragonborn: { stats: { str: 2, cha: 1 }, desc: "+2 STR, +1 CHA" },
                                Dwarf: { stats: { con: 2 }, desc: "+2 CON" },
                                Elf: { stats: { dex: 2 }, desc: "+2 DEX" },
                                Gnome: { stats: { int: 2 }, desc: "+2 INT" },
                                "Half-Elf": { stats: { cha: 2 }, desc: "+2 CHA" },
                                "Half-Orc": { stats: { str: 2, con: 1 }, desc: "+2 STR, +1 CON" },
                                Halfling: { stats: { dex: 2 }, desc: "+2 DEX" },
                                Human: { stats: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, desc: "+1 to all" },
                                Tiefling: { stats: { cha: 2, int: 1 }, desc: "+2 CHA, +1 INT" },
                              };
                              const bonus = racialBonuses[value];
                              const abilityStats = ["str", "dex", "con", "int", "wis", "cha"];
                              const newStats: Record<string, any> = { ...characterStats, race: value };
                              
                              // Store base stats if not already stored (first time setting abilities)
                              if (!characterStats.baseStats) {
                                const baseStats: Record<string, number> = {};
                                abilityStats.forEach(stat => {
                                  baseStats[stat] = characterStats[stat] || 10;
                                });
                                newStats.baseStats = baseStats;
                              }
                              
                              // Reset to base stats before applying new bonuses
                              const baseStats = newStats.baseStats || {};
                              abilityStats.forEach(stat => {
                                newStats[stat] = baseStats[stat] || 10;
                              });
                              
                              // Apply new racial bonuses
                              if (bonus) {
                                Object.entries(bonus.stats).forEach(([stat, mod]) => {
                                  newStats[stat] = (newStats[stat] || 10) + mod;
                                });
                                setCharacterStats(newStats);
                                toast({
                                  title: `Race: ${value}`,
                                  description: `Applied racial bonuses: ${bonus.desc}`,
                                });
                              } else {
                                setCharacterStats(newStats);
                              }
                            }}
                            disabled={!!existingCharacter}
                          >
                            <SelectTrigger data-testid="select-dnd-race">
                              <SelectValue placeholder="Select race" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Dragonborn">Dragonborn</SelectItem>
                              <SelectItem value="Dwarf">Dwarf</SelectItem>
                              <SelectItem value="Elf">Elf</SelectItem>
                              <SelectItem value="Gnome">Gnome</SelectItem>
                              <SelectItem value="Half-Elf">Half-Elf</SelectItem>
                              <SelectItem value="Half-Orc">Half-Orc</SelectItem>
                              <SelectItem value="Halfling">Halfling</SelectItem>
                              <SelectItem value="Human">Human</SelectItem>
                              <SelectItem value="Tiefling">Tiefling</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Level</label>
                          <div className="flex gap-2 items-center">
                            <Input 
                              type="number" 
                              value={characterStats.level || 1}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                              min={1} 
                              max={20} 
                              data-testid="input-dnd-level" 
                            />
                            {existingCharacter && (characterStats.level || 1) < 20 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const hitDiceByClass: Record<string, number> = {
                                    Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8,
                                    Fighter: 10, Monk: 8, Paladin: 10, Ranger: 10,
                                    Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
                                  };
                                  const hitDie = hitDiceByClass[characterStats.class] || 8;
                                  const roll = Math.floor(Math.random() * hitDie) + 1;
                                  const conMod = Math.floor(((characterStats.con || 10) - 10) / 2);
                                  const hpIncrease = Math.max(1, roll + conMod);
                                  const newLevel = (characterStats.level || 1) + 1;
                                  const newMaxHp = (characterStats.maxHp || 0) + hpIncrease;
                                  const newCurrentHp = (characterStats.currentHp || 0) + hpIncrease;
                                  setCharacterStats(prev => ({
                                    ...prev,
                                    level: newLevel,
                                    maxHp: newMaxHp,
                                    currentHp: newCurrentHp,
                                  }));
                                  toast({
                                    title: `Level Up! Now Level ${newLevel}`,
                                    description: `Rolled 1d${hitDie} (${roll}) + CON mod (${conMod >= 0 ? '+' : ''}${conMod}) = +${hpIncrease} HP`,
                                  });
                                }}
                                data-testid="button-level-up"
                              >
                                Level Up
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Hit Points & Armor</label>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center">
                            <label className="text-xs text-muted-foreground">Current HP</label>
                            <Input 
                              type="number" 
                              value={characterStats.currentHp || 0}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, currentHp: parseInt(e.target.value) || 0 }))}
                              min={0}
                              className="text-center"
                              data-testid="input-dnd-current-hp"
                            />
                          </div>
                          <div className="text-center">
                            <label className="text-xs text-muted-foreground">Max HP</label>
                            <Input 
                              type="number" 
                              value={characterStats.maxHp || 0}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, maxHp: parseInt(e.target.value) || 0 }))}
                              min={0}
                              className="text-center"
                              data-testid="input-dnd-max-hp"
                            />
                          </div>
                          <div className="text-center">
                            <label className="text-xs text-muted-foreground">Temp HP</label>
                            <Input 
                              type="number" 
                              value={characterStats.tempHp || 0}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, tempHp: parseInt(e.target.value) || 0 }))}
                              min={0}
                              className="text-center"
                              data-testid="input-dnd-temp-hp"
                            />
                          </div>
                          <div className="text-center">
                            <label className="text-xs text-muted-foreground">AC</label>
                            <Input 
                              type="number" 
                              value={characterStats.armorClass || 10}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, armorClass: parseInt(e.target.value) || 10 }))}
                              min={0}
                              className="text-center"
                              data-testid="input-dnd-ac"
                            />
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Spell Slots (Used / Total)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                            <div key={level} className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground w-8">Lvl {level}</span>
                              <Input 
                                type="number" 
                                value={characterStats[`spellSlots${level}Used`] || 0}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [`spellSlots${level}Used`]: parseInt(e.target.value) || 0 }))}
                                min={0}
                                max={characterStats[`spellSlots${level}Total`] || 0}
                                className="text-center w-12"
                                data-testid={`input-dnd-spell-used-${level}`}
                              />
                              <span className="text-xs text-muted-foreground">/</span>
                              <Input 
                                type="number" 
                                value={characterStats[`spellSlots${level}Total`] || 0}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [`spellSlots${level}Total`]: parseInt(e.target.value) || 0 }))}
                                min={0}
                                className="text-center w-12"
                                data-testid={`input-dnd-spell-total-${level}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label className="text-sm text-muted-foreground">Ability Scores</label>
                          {!existingCharacter && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const rollStat = () => {
                                  const rolls = [
                                    Math.floor(Math.random() * 6) + 1,
                                    Math.floor(Math.random() * 6) + 1,
                                    Math.floor(Math.random() * 6) + 1,
                                    Math.floor(Math.random() * 6) + 1,
                                  ];
                                  rolls.sort((a, b) => b - a);
                                  return rolls[0] + rolls[1] + rolls[2];
                                };
                                const newStr = rollStat();
                                const newDex = rollStat();
                                const newCon = rollStat();
                                const newInt = rollStat();
                                const newWis = rollStat();
                                const newCha = rollStat();
                                setCharacterStats(prev => ({
                                  ...prev,
                                  str: newStr,
                                  dex: newDex,
                                  con: newCon,
                                  int: newInt,
                                  wis: newWis,
                                  cha: newCha,
                                  baseStats: { str: newStr, dex: newDex, con: newCon, int: newInt, wis: newWis, cha: newCha },
                                }));
                              }}
                              data-testid="button-roll-stats"
                            >
                              <Dice6 className="h-4 w-4 mr-1" />
                              Roll Stats (4d6 drop lowest)
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((stat) => (
                            <div key={stat} className="text-center">
                              <label className="text-xs text-muted-foreground">{stat}</label>
                              <Input 
                                type="number" 
                                value={characterStats[stat.toLowerCase()] || 10}
                                onChange={(e) => {
                                  const newValue = parseInt(e.target.value) || 10;
                                  setCharacterStats(prev => ({
                                    ...prev,
                                    [stat.toLowerCase()]: newValue,
                                    baseStats: {
                                      ...(prev.baseStats || {}),
                                      [stat.toLowerCase()]: newValue,
                                    },
                                  }));
                                }}
                                min={1} 
                                max={30} 
                                className="text-center"
                                disabled={!!existingCharacter}
                                data-testid={`input-dnd-${stat.toLowerCase()}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Currency</label>
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            { key: "pp", label: "PP", tooltip: "Platinum" },
                            { key: "gp", label: "GP", tooltip: "Gold" },
                            { key: "ep", label: "EP", tooltip: "Electrum" },
                            { key: "sp", label: "SP", tooltip: "Silver" },
                            { key: "cp", label: "CP", tooltip: "Copper" },
                          ].map((coin) => (
                            <div key={coin.key} className="text-center">
                              <label className="text-xs text-muted-foreground" title={coin.tooltip}>{coin.label}</label>
                              <Input 
                                type="number" 
                                value={characterStats[coin.key] || 0}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [coin.key]: parseInt(e.target.value) || 0 }))}
                                min={0} 
                                className="text-center"
                                data-testid={`input-dnd-${coin.key}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {roomData.gameSystem === "cyberpunk" && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Role {existingCharacter && "(Locked)"}</label>
                          <Select 
                            value={characterStats.role || ""} 
                            onValueChange={(value) => setCharacterStats(prev => ({ ...prev, role: value }))}
                            disabled={!!existingCharacter}
                          >
                            <SelectTrigger data-testid="select-cyberpunk-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Exec">Exec</SelectItem>
                              <SelectItem value="Fixer">Fixer</SelectItem>
                              <SelectItem value="Lawman">Lawman</SelectItem>
                              <SelectItem value="Media">Media</SelectItem>
                              <SelectItem value="Medtech">Medtech</SelectItem>
                              <SelectItem value="Netrunner">Netrunner</SelectItem>
                              <SelectItem value="Nomad">Nomad</SelectItem>
                              <SelectItem value="Rockerboy">Rockerboy</SelectItem>
                              <SelectItem value="Solo">Solo</SelectItem>
                              <SelectItem value="Tech">Tech</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Handle</label>
                          <Input 
                            placeholder="Street name" 
                            value={characterStats.handle || ""}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, handle: e.target.value }))}
                            data-testid="input-cyberpunk-handle" 
                          />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Lifepath {existingCharacter && "(Locked)"}</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Cultural Origin</label>
                            <Select 
                              value={characterStats.culturalOrigin || ""} 
                              onValueChange={(value) => setCharacterStats(prev => ({ ...prev, culturalOrigin: value }))}
                              disabled={!!existingCharacter}
                            >
                              <SelectTrigger data-testid="select-cyberpunk-origin">
                                <SelectValue placeholder="Select origin" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="North American">North American</SelectItem>
                                <SelectItem value="South/Central American">South/Central American</SelectItem>
                                <SelectItem value="Western European">Western European</SelectItem>
                                <SelectItem value="Eastern European">Eastern European</SelectItem>
                                <SelectItem value="Middle Eastern/North African">Middle Eastern/North African</SelectItem>
                                <SelectItem value="Sub-Saharan African">Sub-Saharan African</SelectItem>
                                <SelectItem value="South Asian">South Asian</SelectItem>
                                <SelectItem value="Southeast Asian">Southeast Asian</SelectItem>
                                <SelectItem value="East Asian">East Asian</SelectItem>
                                <SelectItem value="Oceanian/Pacific Islander">Oceanian/Pacific Islander</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Family Background</label>
                            <Select 
                              value={characterStats.familyBackground || ""} 
                              onValueChange={(value) => setCharacterStats(prev => ({ ...prev, familyBackground: value }))}
                              disabled={!!existingCharacter}
                            >
                              <SelectTrigger data-testid="select-cyberpunk-family">
                                <SelectValue placeholder="Select background" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Corporate Executive">Corporate Executive</SelectItem>
                                <SelectItem value="Corporate Manager">Corporate Manager</SelectItem>
                                <SelectItem value="Corporate Worker">Corporate Worker</SelectItem>
                                <SelectItem value="Nomad Pack">Nomad Pack</SelectItem>
                                <SelectItem value="Gang Family">Gang Family</SelectItem>
                                <SelectItem value="Combat Zone Poor">Combat Zone Poor</SelectItem>
                                <SelectItem value="Urban Homeless">Urban Homeless</SelectItem>
                                <SelectItem value="Megastructure Warren">Megastructure Warren</SelectItem>
                                <SelectItem value="Reclaimers/Edgerunners">Reclaimers/Edgerunners</SelectItem>
                                <SelectItem value="Wealthy Family">Wealthy Family</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Stats</label>
                        <div className="grid grid-cols-5 gap-2">
                          {["INT", "REF", "DEX", "TECH", "COOL", "WILL", "LUCK", "MOVE", "BODY", "EMP"].map((stat) => (
                            <div key={stat} className="text-center">
                              <label className="text-xs text-muted-foreground">{stat}</label>
                              <Input 
                                type="number" 
                                value={characterStats[stat.toLowerCase()] || 5}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [stat.toLowerCase()]: parseInt(e.target.value) || 5 }))}
                                min={1} 
                                max={10} 
                                className="text-center"
                                data-testid={`input-cyberpunk-${stat.toLowerCase()}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Currency & Advancement</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Eurobucks (eb)</label>
                            <Input 
                              type="number" 
                              value={characterStats.eurobucks || 0}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, eurobucks: parseInt(e.target.value) || 0 }))}
                              min={0} 
                              data-testid="input-cyberpunk-eurobucks"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Improvement Points (IP)</label>
                            <Input 
                              type="number" 
                              value={characterStats.improvementPoints || 0}
                              onChange={(e) => setCharacterStats(prev => ({ ...prev, improvementPoints: parseInt(e.target.value) || 0 }))}
                              min={0} 
                              data-testid="input-cyberpunk-ip"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {roomData.gameSystem === "coc" && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Occupation</label>
                          <Input 
                            placeholder="e.g., Professor, Detective" 
                            value={characterStats.occupation || ""}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, occupation: e.target.value }))}
                            data-testid="input-coc-occupation" 
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Age</label>
                          <Input 
                            type="number" 
                            value={characterStats.age || 30}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, age: parseInt(e.target.value) || 30 }))}
                            data-testid="input-coc-age" 
                          />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Characteristics</label>
                        <div className="grid grid-cols-4 gap-2">
                          {["STR", "CON", "SIZ", "DEX", "APP", "INT", "POW", "EDU"].map((stat) => (
                            <div key={stat} className="text-center">
                              <label className="text-xs text-muted-foreground">{stat}</label>
                              <Input 
                                type="number" 
                                value={characterStats[stat.toLowerCase()] || 50}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [stat.toLowerCase()]: parseInt(e.target.value) || 50 }))}
                                min={1} 
                                max={100} 
                                className="text-center"
                                data-testid={`input-coc-${stat.toLowerCase()}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Sanity</label>
                          <Input 
                            type="number" 
                            value={characterStats.sanity || 50}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, sanity: parseInt(e.target.value) || 50 }))}
                            data-testid="input-coc-sanity" 
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Luck</label>
                          <Input 
                            type="number" 
                            value={characterStats.luck || 50}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, luck: parseInt(e.target.value) || 50 }))}
                            data-testid="input-coc-luck" 
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">HP</label>
                          <Input 
                            type="number" 
                            value={characterStats.hp || 10}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, hp: parseInt(e.target.value) || 10 }))}
                            data-testid="input-coc-hp" 
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {roomData.gameSystem === "daggerheart" && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Class</label>
                          <Input 
                            placeholder="e.g., Guardian, Bard" 
                            value={characterStats.class || ""}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, class: e.target.value }))}
                            data-testid="input-daggerheart-class" 
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Ancestry</label>
                          <Input 
                            placeholder="e.g., Human, Elf" 
                            value={characterStats.ancestry || ""}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, ancestry: e.target.value }))}
                            data-testid="input-daggerheart-ancestry" 
                          />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Traits</label>
                        <div className="grid grid-cols-3 gap-2">
                          {["Agility", "Strength", "Finesse", "Instinct", "Presence", "Knowledge"].map((trait) => (
                            <div key={trait} className="text-center">
                              <label className="text-xs text-muted-foreground">{trait}</label>
                              <Input 
                                type="number" 
                                value={characterStats[trait.toLowerCase()] || 0}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [trait.toLowerCase()]: parseInt(e.target.value) || 0 }))}
                                min={-2} 
                                max={4} 
                                className="text-center"
                                data-testid={`input-daggerheart-${trait.toLowerCase()}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Hope</label>
                          <Input 
                            type="number" 
                            value={characterStats.hope || 2}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, hope: parseInt(e.target.value) || 2 }))}
                            data-testid="input-daggerheart-hope" 
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">HP</label>
                          <Input 
                            type="number" 
                            value={characterStats.hp || 6}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, hp: parseInt(e.target.value) || 6 }))}
                            data-testid="input-daggerheart-hp" 
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div>
                    <label className="text-sm text-muted-foreground">Notes</label>
                    <textarea
                      className="w-full mt-1 p-2 border rounded-md bg-background min-h-[100px] text-sm"
                      placeholder="Character background, inventory, abilities..."
                      value={characterNotes}
                      onChange={(e) => setCharacterNotes(e.target.value)}
                      data-testid="textarea-notes"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
            <div className="max-w-2xl mx-auto space-y-4 p-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Inventory
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Track your items here.
                      {isHost && " Use /give @PlayerName ItemName x Quantity to grant items to players."}
                    </p>
                  </div>
                  {existingCharacter && (
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddItemForm(!showAddItemForm)}
                      data-testid="button-add-item"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {showAddItemForm && existingCharacter && (
                    <div className="mb-4 p-3 border rounded-md space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Item name"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          data-testid="input-new-item-name"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                          className="w-20"
                          data-testid="input-new-item-quantity"
                        />
                        <Button
                          onClick={() => addInventoryItemMutation.mutate({ name: newItemName, quantity: newItemQuantity })}
                          disabled={!newItemName.trim() || addInventoryItemMutation.isPending}
                          data-testid="button-submit-add-item"
                        >
                          {addInventoryItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {!existingCharacter ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Create a character first to see your inventory.</p>
                      <Button 
                        variant="outline" 
                        className="mt-2"
                        onClick={() => setActiveTab("character")}
                        data-testid="button-go-to-character"
                      >
                        Go to Character Tab
                      </Button>
                    </div>
                  ) : isLoadingInventory ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : inventory && inventory.length > 0 ? (
                    <div className="space-y-2">
                      {inventory.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-3 border rounded-md"
                          data-testid={`inventory-item-${item.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" data-testid={`text-item-name-${item.id}`}>{item.name}</span>
                              {item.quantity > 1 && (
                                <Badge variant="secondary" data-testid={`badge-quantity-${item.id}`}>
                                  x{item.quantity}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            )}
                            {item.grantedBy && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Granted by: {item.grantedBy}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteInventoryItemMutation.mutate(item.id)}
                            disabled={deleteInventoryItemMutation.isPending}
                            data-testid={`button-delete-item-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Your inventory is empty.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The DM can grant you items during the game.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {roomData?.gameSystem === "dnd" && (
            <TabsContent value="skills" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
              <div className="max-w-2xl mx-auto space-y-4 p-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Swords className="h-5 w-5" />
                      Skills
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Click "Use" to tell the AI DM you're attempting that skill check.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { name: "Acrobatics", stat: "dex" },
                        { name: "Animal Handling", stat: "wis" },
                        { name: "Arcana", stat: "int" },
                        { name: "Athletics", stat: "str" },
                        { name: "Deception", stat: "cha" },
                        { name: "History", stat: "int" },
                        { name: "Insight", stat: "wis" },
                        { name: "Intimidation", stat: "cha" },
                        { name: "Investigation", stat: "int" },
                        { name: "Medicine", stat: "wis" },
                        { name: "Nature", stat: "int" },
                        { name: "Perception", stat: "wis" },
                        { name: "Performance", stat: "cha" },
                        { name: "Persuasion", stat: "cha" },
                        { name: "Religion", stat: "int" },
                        { name: "Sleight of Hand", stat: "dex" },
                        { name: "Stealth", stat: "dex" },
                        { name: "Survival", stat: "wis" },
                      ].map((skill) => {
                        const statValue = characterStats[skill.stat] || 10;
                        const modifier = Math.floor((statValue - 10) / 2);
                        const proficiencyBonus = Math.ceil(1 + (characterStats.level || 1) / 4);
                        const isProficient = characterStats[`skill_${skill.name.replace(/\s/g, "_").toLowerCase()}`] || false;
                        const totalMod = modifier + (isProficient ? proficiencyBonus : 0);
                        return (
                          <div 
                            key={skill.name} 
                            className="flex items-center justify-between p-2 border rounded-md gap-2"
                            data-testid={`skill-${skill.name.replace(/\s/g, "-").toLowerCase()}`}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={isProficient}
                                onCheckedChange={(checked) => {
                                  setCharacterStats(prev => ({
                                    ...prev,
                                    [`skill_${skill.name.replace(/\s/g, "_").toLowerCase()}`]: checked,
                                  }));
                                }}
                                data-testid={`checkbox-skill-${skill.name.replace(/\s/g, "-").toLowerCase()}`}
                              />
                              <span className="text-sm">{skill.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {skill.stat.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {totalMod >= 0 ? "+" : ""}{totalMod}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !gameEnded) {
                                    const roll = Math.floor(Math.random() * 20) + 1;
                                    const total = roll + totalMod;
                                    wsRef.current.send(JSON.stringify({
                                      type: "action",
                                      content: `*${characterName || playerName} attempts a ${skill.name} check* (Rolled d20: ${roll} + ${totalMod} = ${total})`,
                                    }));
                                    toast({
                                      title: `${skill.name} Check`,
                                      description: `Rolled d20 (${roll}) + ${totalMod} = ${total}`,
                                    });
                                    setActiveTab("chat");
                                  }
                                }}
                                disabled={!isConnected || gameEnded}
                                data-testid={`button-use-skill-${skill.name.replace(/\s/g, "-").toLowerCase()}`}
                              >
                                Use
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Spells
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Add your known spells and cast them to notify the AI DM.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a spell..."
                        value={characterStats.newSpellInput || ""}
                        onChange={(e) => setCharacterStats(prev => ({ ...prev, newSpellInput: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && characterStats.newSpellInput?.trim()) {
                            const spells = characterStats.spellList || [];
                            setCharacterStats(prev => ({
                              ...prev,
                              spellList: [...spells, prev.newSpellInput.trim()],
                              newSpellInput: "",
                            }));
                          }
                        }}
                        data-testid="input-add-spell"
                      />
                      <Button
                        onClick={() => {
                          if (characterStats.newSpellInput?.trim()) {
                            const spells = characterStats.spellList || [];
                            setCharacterStats(prev => ({
                              ...prev,
                              spellList: [...spells, prev.newSpellInput.trim()],
                              newSpellInput: "",
                            }));
                          }
                        }}
                        disabled={!characterStats.newSpellInput?.trim()}
                        data-testid="button-add-spell"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {(characterStats.spellList && characterStats.spellList.length > 0) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {characterStats.spellList.map((spell: string, index: number) => (
                          <div 
                            key={`${spell}-${index}`}
                            className="flex items-center justify-between p-2 border rounded-md gap-2"
                            data-testid={`spell-${index}`}
                          >
                            <span className="text-sm">{spell}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !gameEnded) {
                                    wsRef.current.send(JSON.stringify({
                                      type: "action",
                                      content: `*${characterName || playerName} casts ${spell}!*`,
                                    }));
                                    toast({
                                      title: "Spell Cast",
                                      description: `You cast ${spell}`,
                                    });
                                    setActiveTab("chat");
                                  }
                                }}
                                disabled={!isConnected || gameEnded}
                                data-testid={`button-cast-spell-${index}`}
                              >
                                Cast
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const spells = [...(characterStats.spellList || [])];
                                  spells.splice(index, 1);
                                  setCharacterStats(prev => ({ ...prev, spellList: spells }));
                                }}
                                data-testid={`button-remove-spell-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No spells added yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add spells using the input above.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={viewingPlayerId !== null} onOpenChange={(open) => !open && setViewingPlayerId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <User className="h-5 w-5" />
              {viewingPlayer?.name}'s Character
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingViewedCharacter ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : viewedCharacter ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Character Name</span>
                  <p className="font-medium" data-testid="text-viewed-character-name">{viewedCharacter.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Player</span>
                  <p className="font-medium">{viewingPlayer?.name}</p>
                </div>
              </div>

              {viewedCharacter.stats && Object.keys(viewedCharacter.stats).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground mb-2 block">
                      {viewedCharacter.gameSystem === "dnd" ? "Ability Scores" : "Stats"}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(viewedCharacter.stats).map(([key, value]) => {
                        const dndLabels: Record<string, string> = {
                          strength: "STR", dexterity: "DEX", constitution: "CON",
                          intelligence: "INT", wisdom: "WIS", charisma: "CHA"
                        };
                        const cyberpunkLabels: Record<string, string> = {
                          int: "INT", ref: "REF", dex: "DEX", tech: "TECH",
                          cool: "COOL", will: "WILL", luck: "LUCK", move: "MOVE",
                          body: "BODY", emp: "EMP"
                        };
                        const label = viewedCharacter.gameSystem === "dnd" 
                          ? dndLabels[key] || key.toUpperCase()
                          : cyberpunkLabels[key] || key.toUpperCase();
                        return (
                          <div key={key} className="text-center p-2 bg-muted rounded-md" data-testid={`stat-${key}`}>
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <p className="font-mono font-bold text-lg">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {viewedCharacter.notes && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap" data-testid="text-viewed-character-notes">
                      {viewedCharacter.notes}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-character">
              This player hasn't created a character yet.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

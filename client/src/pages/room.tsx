
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
import { Send, Dice6, Users, Copy, Check, Loader2, MessageSquare, User, XCircle, Save, Eye, Package, Trash2, LogOut } from "lucide-react";
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
                          <label className="text-sm text-muted-foreground">Class</label>
                          <Select 
                            value={characterStats.class || ""} 
                            onValueChange={(value) => setCharacterStats(prev => ({ ...prev, class: value }))}
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
                          <label className="text-sm text-muted-foreground">Race</label>
                          <Select 
                            value={characterStats.race || ""} 
                            onValueChange={(value) => setCharacterStats(prev => ({ ...prev, race: value }))}
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
                          <Input 
                            type="number" 
                            value={characterStats.level || 1}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                            min={1} 
                            max={20} 
                            data-testid="input-dnd-level" 
                          />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Ability Scores</label>
                        <div className="grid grid-cols-6 gap-2">
                          {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((stat) => (
                            <div key={stat} className="text-center">
                              <label className="text-xs text-muted-foreground">{stat}</label>
                              <Input 
                                type="number" 
                                value={characterStats[stat.toLowerCase()] || 10}
                                onChange={(e) => setCharacterStats(prev => ({ ...prev, [stat.toLowerCase()]: parseInt(e.target.value) || 10 }))}
                                min={1} 
                                max={30} 
                                className="text-center"
                                data-testid={`input-dnd-${stat.toLowerCase()}`}
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
                          <label className="text-sm text-muted-foreground">Role</label>
                          <Input 
                            placeholder="e.g., Solo, Netrunner" 
                            value={characterStats.role || ""}
                            onChange={(e) => setCharacterStats(prev => ({ ...prev, role: e.target.value }))}
                            data-testid="input-cyberpunk-role" 
                          />
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
                      Items granted by the DM appear here.
                      {isHost && " Use /give @PlayerName ItemName x Quantity to grant items."}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
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

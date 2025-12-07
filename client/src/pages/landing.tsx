import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Swords, Users, Dice6, Bot, Plus, LogIn, Loader2, RotateCcw, Globe, Search, Heart, ChevronLeft, User, AlertCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import cashAppQR from "@assets/IMG_2407_1765085234277.webp";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { gameSystems, gameSystemLabels, type GameSystem, type Room, type SavedCharacter } from "@shared/schema";

interface InventoryItemWithDetails {
  id: string;
  savedCharacterId: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  notes: string | null;
  attunementSlot: number | null;
  item: {
    id: string;
    name: string;
    category: string;
    type: string | null;
    subtype: string | null;
    rarity: string;
    cost: string | null;
    weight: number | null;
    description: string;
    properties: unknown;
    requiresAttunement: boolean;
    gameSystem: string;
    source: string | null;
  };
}

type JoinStep = "details" | "character";
type HostStep = "details" | "character";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [hostDialogOpen, setHostDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [browseDialogOpen, setBrowseDialogOpen] = useState(false);
  const [gameName, setGameName] = useState("");
  const [gameSystem, setGameSystem] = useState<GameSystem>("dnd");
  const [hostName, setHostName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [browseFilter, setBrowseFilter] = useState<GameSystem | "all">("all");
  
  // Multi-step join flow
  const [joinStep, setJoinStep] = useState<JoinStep>("details");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [targetRoom, setTargetRoom] = useState<Room | null>(null);
  
  // Multi-step host flow
  const [hostStep, setHostStep] = useState<HostStep>("details");
  const [createdRoom, setCreatedRoom] = useState<(Room & { hostPlayer: { id: string } }) | null>(null);
  
  // Check for last game session with state to enable reactivity
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);
  const [lastPlayerName, setLastPlayerName] = useState<string | null>(null);
  
  useEffect(() => {
    setLastRoomCode(sessionStorage.getItem("lastRoomCode"));
    setLastPlayerName(sessionStorage.getItem("playerName"));
  }, []);
  
  const canRejoin = lastRoomCode && lastPlayerName;

  // Fetch current user for authentication check
  const { data: currentUser } = useQuery<{ id: string; username: string } | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/user");
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  // Track previous user to detect user switches
  const [prevUserId, setPrevUserId] = useState<string | null | undefined>(undefined);

  // Clear stale session data when auth user changes (including switching between users)
  useEffect(() => {
    const currentId = currentUser?.id ?? null;
    
    // Skip initial render (when prevUserId is undefined)
    if (prevUserId === undefined) {
      setPrevUserId(currentId);
      return;
    }
    
    // If user changed (different id, including null -> id, id -> null, or id -> different id)
    if (prevUserId !== currentId) {
      // Clear all session data
      sessionStorage.removeItem("playerName");
      sessionStorage.removeItem("playerId");
      sessionStorage.removeItem("lastRoomCode");
      setLastRoomCode(null);
      setLastPlayerName(null);
      setPlayerName("");
      setHostName("");
      setPrevUserId(currentId);
    }
  }, [currentUser?.id, prevUserId]);

  // Fetch saved characters for the user
  const { data: savedCharacters, isLoading: isLoadingCharacters } = useQuery<SavedCharacter[]>({
    queryKey: ["/api/saved-characters"],
    enabled: !!currentUser && (joinStep === "character" || hostStep === "character"),
  });

  // Filter characters by game system
  const availableCharacters = savedCharacters?.filter(
    (char) => char.gameSystem === (targetRoom?.gameSystem || gameSystem)
  ) || [];

  type PublicRoom = Room & { playerCount: number };
  
  const { data: publicRooms, isLoading: isLoadingPublicRooms } = useQuery<PublicRoom[]>({
    queryKey: ["/api/rooms/public"],
    queryFn: async () => {
      const response = await fetch("/api/rooms/public");
      if (!response.ok) throw new Error("Failed to fetch public rooms");
      return response.json();
    },
    enabled: browseDialogOpen,
  });

  const filteredRooms = publicRooms?.filter(room => 
    browseFilter === "all" || room.gameSystem === browseFilter
  ) || [];

  const handleJoinFromBrowser = (code: string) => {
    setRoomCode(code);
    setBrowseDialogOpen(false);
    setJoinDialogOpen(true);
  };

  // Fetch room info for join flow
  const fetchRoomMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch(`/api/rooms/${code}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Room not found");
      }
      return response.json() as Promise<Room>;
    },
    onSuccess: (room) => {
      setTargetRoom(room);
      setJoinStep("character");
    },
    onError: (error: Error) => {
      setJoinStep("details");
      toast({
        title: "Room not found",
        description: error.message || "Check the room code and try again.",
        variant: "destructive",
      });
    },
  });

  // Join room (requires authentication)
  const joinWithoutCharacterMutation = useMutation({
    mutationFn: async () => {
      const code = roomCode.toUpperCase();
      const response = await apiRequest("POST", `/api/rooms/${code}/join`, {});
      const data = await response.json();
      return { ...data, code };
    },
    onSuccess: (data) => {
      const displayName = currentUser?.username || "Player";
      sessionStorage.setItem("playerName", displayName);
      sessionStorage.setItem("playerId", data.player.id);
      sessionStorage.setItem("lastRoomCode", data.code);
      setJoinDialogOpen(false);
      resetJoinDialog();
      setLocation(`/room/${data.code}`);
    },
    onError: () => {
      toast({
        title: "Failed to join room",
        description: "Check the room code and try again.",
        variant: "destructive",
      });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rooms", {
        name: gameName,
        gameSystem,
        isPublic,
      });
      return response.json() as Promise<Room & { hostPlayer: { id: string } }>;
    },
    onSuccess: (data) => {
      setCreatedRoom(data);
      const displayName = currentUser?.username || "Host";
      setHostStep("character");
      setHostName(displayName);
    },
    onError: () => {
      toast({
        title: "Failed to create room",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async () => {
      const code = roomCode.toUpperCase();
      const charId = selectedCharacterId;
      const response = await apiRequest("POST", `/api/rooms/${code}/join`, {
        savedCharacterId: charId,
      });
      const data = await response.json();
      return { ...data, code };
    },
    onSuccess: (data) => {
      const displayName = currentUser?.username || "Player";
      sessionStorage.setItem("playerName", displayName);
      sessionStorage.setItem("playerId", data.player.id);
      sessionStorage.setItem("lastRoomCode", data.code);
      setJoinDialogOpen(false);
      resetJoinDialog();
      setLocation(`/room/${data.code}`);
    },
    onError: () => {
      toast({
        title: "Failed to join room",
        description: "Check the room code and try again.",
        variant: "destructive",
      });
    },
  });

  // Complete host flow with character selection
  const completeHostMutation = useMutation({
    mutationFn: async () => {
      if (!createdRoom) throw new Error("No room created");
      // If character selected, create room character
      if (selectedCharacterId && currentUser) {
        await apiRequest("POST", `/api/rooms/${createdRoom.code}/join-with-character`, {
          savedCharacterId: selectedCharacterId,
        });
      }
      return createdRoom;
    },
    onSuccess: (room) => {
      const displayName = currentUser?.username || "Host";
      sessionStorage.setItem("playerName", displayName);
      sessionStorage.setItem("playerId", room.hostPlayer.id);
      setHostDialogOpen(false);
      resetHostDialog();
      setLocation(`/room/${room.code}`);
    },
    onError: () => {
      toast({
        title: "Failed to assign character",
        description: "Your room was created, but the character could not be assigned. You can create a new character in the game.",
        variant: "destructive",
      });
      // Still navigate to room even if character assignment fails
      if (createdRoom) {
        const displayName = currentUser?.username || "Host";
        sessionStorage.setItem("playerName", displayName);
        sessionStorage.setItem("playerId", createdRoom.hostPlayer.id);
        setHostDialogOpen(false);
        resetHostDialog();
        setLocation(`/room/${createdRoom.code}`);
      }
    },
  });

  const resetJoinDialog = () => {
    setJoinStep("details");
    setSelectedCharacterId(null);
    setTargetRoom(null);
    setRoomCode("");
    setPlayerName("");
  };

  const resetHostDialog = () => {
    setHostStep("details");
    setSelectedCharacterId(null);
    setCreatedRoom(null);
    setGameName("");
    setHostName("");
    setIsPublic(false);
  };

  const handleHostGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a game name.",
        variant: "destructive",
      });
      return;
    }
    createRoomMutation.mutate();
  };

  const handleJoinStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a room code.",
        variant: "destructive",
      });
      return;
    }
    
    // User must be authenticated (join button is hidden otherwise)
    // Fetch room info and proceed to character selection
    const displayName = currentUser?.username || "Player";
    setPlayerName(displayName);
    fetchRoomMutation.mutate(roomCode.toUpperCase());
  };

  const handleJoinWithCharacter = () => {
    joinRoomMutation.mutate();
  };

  const handleHostComplete = () => {
    completeHostMutation.mutate();
  };

  const handleDialogClose = (open: boolean, type: "join" | "host") => {
    if (!open) {
      if (type === "join") {
        resetJoinDialog();
      } else {
        resetHostDialog();
      }
    }
    if (type === "join") {
      setJoinDialogOpen(open);
    } else {
      setHostDialogOpen(open);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-3xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight">Welcome to Grok DM</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your AI-powered Dungeon Master for tabletop adventures. Host a game room, invite friends, and let Grok guide your epic quest.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            {canRejoin && (
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setLocation(`/room/${lastRoomCode}`)}
                data-testid="button-rejoin-game"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Rejoin Last Game
              </Button>
            )}
            
            {!currentUser && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <User className="h-6 w-6" />
                <p className="text-sm">Sign in to host or join games</p>
              </div>
            )}
            
            {currentUser && (
            <>
            <Dialog open={hostDialogOpen} onOpenChange={(open) => handleDialogClose(open, "host")}>
              <DialogTrigger asChild>
                <Button size="lg" data-testid="button-host-game">
                  <Plus className="mr-2 h-5 w-5" />
                  Host a Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                {hostStep === "details" ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Create a New Game</DialogTitle>
                      <DialogDescription>
                        Set up your game room and get a shareable code for players to join.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleHostGame} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="game-name">Game Name</Label>
                        <Input
                          id="game-name"
                          placeholder="e.g., The Lost Dungeon of Xor"
                          value={gameName}
                          onChange={(e) => setGameName(e.target.value)}
                          data-testid="input-game-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="game-system">Game System</Label>
                        <Select value={gameSystem} onValueChange={(v) => setGameSystem(v as GameSystem)}>
                          <SelectTrigger id="game-system" data-testid="select-game-system">
                            <SelectValue placeholder="Select a game system" />
                          </SelectTrigger>
                          <SelectContent>
                            {gameSystems.map((system) => (
                              <SelectItem key={system} value={system} data-testid={`option-system-${system}`}>
                                {gameSystemLabels[system]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is-public"
                          checked={isPublic}
                          onCheckedChange={(checked) => setIsPublic(checked === true)}
                          data-testid="checkbox-public"
                        />
                        <Label htmlFor="is-public" className="text-sm font-normal cursor-pointer">
                          List game publicly so anyone can join
                        </Label>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createRoomMutation.isPending}
                        data-testid="button-create-room"
                      >
                        {createRoomMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Game Room"
                        )}
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Select Your Character</DialogTitle>
                      <DialogDescription>
                        Choose a character for {gameSystemLabels[gameSystem]} to start your adventure.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHostStep("details")}
                        className="mb-2"
                        data-testid="button-host-back"
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      
                      <CharacterSelectionList
                        characters={availableCharacters}
                        selectedId={selectedCharacterId}
                        onSelect={setSelectedCharacterId}
                        isLoading={isLoadingCharacters}
                        gameSystem={gameSystem}
                      />
                      
                      <Button
                        className="w-full"
                        onClick={handleHostComplete}
                        disabled={isLoadingCharacters || !selectedCharacterId || completeHostMutation.isPending}
                        data-testid="button-host-with-character"
                      >
                        {completeHostMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : isLoadingCharacters ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading characters...
                          </>
                        ) : availableCharacters.length === 0 ? (
                          "Create a Character First"
                        ) : (
                          "Start Game"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={(open) => handleDialogClose(open, "join")}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" data-testid="button-join-game">
                  <LogIn className="mr-2 h-5 w-5" />
                  Join a Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                {joinStep === "details" ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Join a Game</DialogTitle>
                      <DialogDescription>
                        Enter the room code shared by your host to join the adventure.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleJoinStep1} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="room-code">Room Code</Label>
                        <Input
                          id="room-code"
                          placeholder="e.g., ABC123"
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                          maxLength={8}
                          className="font-mono text-center text-lg tracking-widest"
                          data-testid="input-room-code"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={fetchRoomMutation.isPending}
                        data-testid="button-submit-join"
                      >
                        {fetchRoomMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Finding room...
                          </>
                        ) : (
                          "Next: Select Character"
                        )}
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Select Your Character</DialogTitle>
                      <DialogDescription>
                        Choose a character for {targetRoom ? gameSystemLabels[targetRoom.gameSystem as GameSystem] : "this game"}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setJoinStep("details")}
                        className="mb-2"
                        data-testid="button-join-back"
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      
                      <CharacterSelectionList
                        characters={availableCharacters}
                        selectedId={selectedCharacterId}
                        onSelect={setSelectedCharacterId}
                        isLoading={isLoadingCharacters}
                        gameSystem={targetRoom?.gameSystem as GameSystem}
                      />
                      
                      <Button
                        className="w-full"
                        onClick={handleJoinWithCharacter}
                        disabled={isLoadingCharacters || !selectedCharacterId || joinRoomMutation.isPending}
                        data-testid="button-join-with-character"
                      >
                        {joinRoomMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Joining...
                          </>
                        ) : isLoadingCharacters ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading characters...
                          </>
                        ) : availableCharacters.length === 0 ? (
                          "Create a Character First"
                        ) : (
                          "Join Game"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={browseDialogOpen} onOpenChange={setBrowseDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" data-testid="button-browse-games">
                  <Globe className="mr-2 h-5 w-5" />
                  Browse Games
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Public Games</DialogTitle>
                  <DialogDescription>
                    Browse and join games that are open to anyone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="browse-filter" className="shrink-0">Filter by system:</Label>
                    <Select value={browseFilter} onValueChange={(v) => setBrowseFilter(v as GameSystem | "all")}>
                      <SelectTrigger id="browse-filter" className="w-48" data-testid="select-browse-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-filter-all">All Systems</SelectItem>
                        {gameSystems.map((system) => (
                          <SelectItem key={system} value={system} data-testid={`option-filter-${system}`}>
                            {gameSystemLabels[system]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <ScrollArea className="h-64">
                    {isLoadingPublicRooms ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredRooms.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No public games available right now.</p>
                        <p className="text-sm">Try hosting one yourself!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredRooms.map((room) => (
                          <div
                            key={room.id}
                            className="flex items-center justify-between gap-4 p-3 rounded-md border hover-elevate"
                            data-testid={`room-card-${room.code}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate" data-testid={`text-room-name-${room.code}`}>
                                {room.name}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="secondary" className="shrink-0">
                                  {gameSystemLabels[room.gameSystem as GameSystem]}
                                </Badge>
                                <span className="truncate">by {room.hostName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span data-testid={`text-player-count-${room.code}`}>
                                  {room.playerCount}/{room.maxPlayers}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleJoinFromBrowser(room.code)}
                                data-testid={`button-join-room-${room.code}`}
                              >
                                Join
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
            </>
            )}
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full">
          <Card>
            <CardHeader className="pb-2">
              <Bot className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">AI Dungeon Master</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Intelligent storytelling that adapts to player choices and creates immersive narratives.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Swords className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Multiple Systems</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Support for D&D 5th Edition and Cyberpunk RED.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Share & Play</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create a room, share the code with friends, and start your adventure in seconds.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Dice6 className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Built-in Dice</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Roll dice with /roll commands and let the AI DM interpret your results.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 max-w-md w-full">
          <Card>
            <CardHeader className="text-center pb-2">
              <Heart className="h-8 w-8 text-muted-foreground mb-2 mx-auto" />
              <CardTitle className="text-lg">Support the Project</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <CardDescription className="text-center">
                If you enjoy Grok DM, consider supporting development with a donation.
              </CardDescription>
              <img 
                src={cashAppQR} 
                alt="Cash App QR Code for $joleson" 
                className="w-40 h-40 rounded-md"
                data-testid="img-cashapp-qr"
              />
              <p className="text-lg font-mono font-medium" data-testid="text-cashtag">$joleson</p>
              <Button
                variant="outline"
                asChild
                data-testid="button-donate-cashapp"
              >
                <a href="https://cash.app/$joleson" target="_blank" rel="noopener noreferrer">
                  Donate via Cash App
                </a>
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Or scan the QR code with Cash App
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="py-6 border-t text-center text-sm text-muted-foreground">
        Powered by Grok AI
      </footer>
    </div>
  );
}

// Inventory preview for selected character
function CharacterInventoryPreview({ characterId }: { characterId: string }) {
  const { data: inventory, isLoading } = useQuery<InventoryItemWithDetails[]>({
    queryKey: ["/api/saved-characters", characterId, "inventory"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading inventory...
      </div>
    );
  }

  if (!inventory || inventory.length === 0) {
    return (
      <div className="flex items-center gap-1 py-1 text-xs text-muted-foreground">
        <Package className="h-3 w-3" />
        No items
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Package className="h-3 w-3" />
        Inventory ({inventory.length} items)
      </div>
      <div className="flex flex-wrap gap-1">
        {inventory.slice(0, 4).map((invItem) => (
          <Badge
            key={invItem.id}
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
            data-testid={`inventory-preview-${invItem.id}`}
          >
            {invItem.item.name}
            {invItem.quantity > 1 && ` x${invItem.quantity}`}
          </Badge>
        ))}
        {inventory.length > 4 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            +{inventory.length - 4} more
          </Badge>
        )}
      </div>
    </div>
  );
}

// Character selection list component
function CharacterSelectionList({
  characters,
  selectedId,
  onSelect,
  isLoading,
  gameSystem,
}: {
  characters: SavedCharacter[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading: boolean;
  gameSystem?: GameSystem;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">No characters available</p>
        <p className="text-sm">
          You don't have any {gameSystem ? gameSystemLabels[gameSystem] : ""} characters yet.
        </p>
        <p className="text-sm mt-2">
          You need to create a character before joining a game.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => window.location.href = "/characters"}
          data-testid="button-go-to-characters"
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Character
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-2">
        {characters.map((char) => (
          <div
            key={char.id}
            className={`p-3 rounded-md border cursor-pointer transition-colors ${
              selectedId === char.id
                ? "border-primary bg-primary/5"
                : "hover-elevate"
            }`}
            onClick={() => onSelect(selectedId === char.id ? null : char.id)}
            data-testid={`character-option-${char.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" data-testid={`text-character-name-${char.id}`}>
                  {char.characterName}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  {char.race && <span>{char.race}</span>}
                  {char.class && <span>{char.class}</span>}
                  <Badge variant="outline" className="text-xs">
                    Lvl {char.level}
                  </Badge>
                </div>
              </div>
              {selectedId === char.id && (
                <Badge variant="default" className="shrink-0">
                  Selected
                </Badge>
              )}
            </div>
            {selectedId === char.id && (
              <CharacterInventoryPreview characterId={char.id} />
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

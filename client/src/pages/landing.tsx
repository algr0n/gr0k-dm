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
import { Swords, Users, Dice6, Bot, Plus, LogIn, Loader2, RotateCcw, Globe, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { gameSystems, gameSystemLabels, type GameSystem, type Room } from "@shared/schema";

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
  
  // Check for last game session with state to enable reactivity
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);
  const [lastPlayerName, setLastPlayerName] = useState<string | null>(null);
  
  useEffect(() => {
    setLastRoomCode(sessionStorage.getItem("lastRoomCode"));
    setLastPlayerName(sessionStorage.getItem("playerName"));
  }, []);
  
  const canRejoin = lastRoomCode && lastPlayerName;

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

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rooms", {
        name: gameName,
        gameSystem,
        hostName,
        isPublic,
      });
      return response.json() as Promise<Room & { hostPlayer: { id: string } }>;
    },
    onSuccess: (data) => {
      setHostDialogOpen(false);
      sessionStorage.setItem("playerName", hostName);
      sessionStorage.setItem("playerId", data.hostPlayer.id);
      setLocation(`/room/${data.code}`);
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
      const response = await apiRequest("POST", `/api/rooms/${roomCode.toUpperCase()}/join`, {
        playerName,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setJoinDialogOpen(false);
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("playerId", data.player.id);
      setLocation(`/room/${roomCode.toUpperCase()}`);
    },
    onError: () => {
      toast({
        title: "Failed to join room",
        description: "Check the room code and try again.",
        variant: "destructive",
      });
    },
  });

  const handleHostGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim() || !hostName.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    createRoomMutation.mutate();
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !playerName.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    joinRoomMutation.mutate();
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
            
            <Dialog open={hostDialogOpen} onOpenChange={setHostDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" data-testid="button-host-game">
                  <Plus className="mr-2 h-5 w-5" />
                  Host a Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Game</DialogTitle>
                  <DialogDescription>
                    Set up your game room and get a shareable code for players to join.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleHostGame} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="host-name">Your Name</Label>
                    <Input
                      id="host-name"
                      placeholder="Enter your display name"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      data-testid="input-host-name"
                    />
                  </div>
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
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" data-testid="button-join-game">
                  <LogIn className="mr-2 h-5 w-5" />
                  Join a Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Game</DialogTitle>
                  <DialogDescription>
                    Enter the room code shared by your host to join the adventure.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleJoinGame} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="player-name">Your Name</Label>
                    <Input
                      id="player-name"
                      placeholder="Enter your display name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      data-testid="input-player-name"
                    />
                  </div>
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
                    disabled={joinRoomMutation.isPending}
                    data-testid="button-submit-join"
                  >
                    {joinRoomMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join Game"
                    )}
                  </Button>
                </form>
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
      </div>
      <footer className="py-6 border-t text-center text-sm text-muted-foreground">
        Powered by Grok AI
      </footer>
    </div>
  );
}

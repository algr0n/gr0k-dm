import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Dice6, Users, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type Message, type Room, type Player, gameSystemLabels, type GameSystem } from "@shared/schema";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const playerName = sessionStorage.getItem("playerName") || "Anonymous";

  const { data: roomData, isLoading, error } = useQuery<Room & { players: Player[] }>({
    queryKey: ["/api/rooms", code],
    enabled: !!code,
  });

  useEffect(() => {
    if (roomData) {
      setMessages(roomData.messageHistory || []);
      setPlayers(roomData.players || []);
    }
  }, [roomData]);

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
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

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
                  <span className={cn(player.name === playerName && "font-medium")}>
                    {player.name}
                  </span>
                  {player.isHost && <Badge variant="outline">Host</Badge>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-muted-foreground">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4">
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
            placeholder="Type a message... (use /roll 2d6+3 for dice, *asterisks* for actions)"
            disabled={!isConnected}
            data-testid="input-chat-message"
          />
          <Button 
            type="submit" 
            disabled={!isConnected || !inputValue.trim()}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}

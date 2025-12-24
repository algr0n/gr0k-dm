import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, User, Bot, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameSession, Message } from "@shared/schema";

export function SessionChat() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [username, setUsername] = useState("Web User");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    refetchInterval: 5000,
  });

  const activeSessions = sessions.filter((s) => s.isActive);

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/sessions", selectedSessionId, "messages"],
    enabled: !!selectedSessionId,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, username }: { content: string; username: string }) => {
      const response = await apiRequest("POST", `/api/sessions/${selectedSessionId}/messages`, { content, username });
      return response.json();
    },
    onSuccess: (newMessage: Message) => {
      setMessageInput("");
      queryClient.setQueryData<Message[]>(
        ["/api/sessions", selectedSessionId, "messages"],
        (old) => [...(old || []), newMessage]
      );
    },
  });

  useEffect(() => {
    if (activeSessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(activeSessions[0].id);
    }
  }, [activeSessions, selectedSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedSessionId) return;
    sendMessageMutation.mutate({ content: messageInput.trim(), username });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-serif">Game Chat</span>
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {activeSessions.length > 0 && (
            <Select value={selectedSessionId || ""} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-[180px]" data-testid="select-session">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {activeSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => refetchMessages()}
            data-testid="button-refresh-chat"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 gap-3">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          {sessionsLoading || messagesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No active game sessions</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a new adventure to begin chatting
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Chat will appear here as you play
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isAssistant = message.type === "dm";
                return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}
                  data-testid={`message-${message.id}`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      isAssistant ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {isAssistant ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 max-w-[80%] ${
                      isAssistant ? "" : "text-right"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium">
                        {isAssistant ? "Grok DM" : message.playerName || "Player"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      className={`p-3 rounded-lg ${
                        isAssistant ? "bg-muted/50" : "bg-primary/10"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </ScrollArea>

        {activeSessions.length > 0 && selectedSessionId && (
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-28"
              data-testid="input-username"
            />
            <Input
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

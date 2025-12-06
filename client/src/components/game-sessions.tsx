import type { MouseEvent } from "react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gamepad2, MessageSquare, MapPin, Trash2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdventureCreator } from "./adventure-creator";
import type { GameSession } from "@shared/schema";

export function GameSessions() {
  const { toast } = useToast();
  const [deleteSession, setDeleteSession] = useState<GameSession | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  
  const { data: sessions = [], isLoading } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
      toast({
        title: "Adventure deleted",
        description: "The game session has been removed.",
      });
      setDeleteSession(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete adventure.",
        variant: "destructive",
      });
      setDeleteSession(null);
    },
  });

  const handleDeleteClick = (e: MouseEvent, session: GameSession) => {
    e.stopPropagation();
    setDeleteSession(session);
  };

  const handleConfirmDelete = () => {
    if (deleteSession) {
      deleteMutation.mutate(deleteSession.id);
    }
  };

  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Gamepad2 className="h-5 w-5" />
            <span className="font-serif">Active Games</span>
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{activeSessions.length} active</Badge>
            <Button 
              size="sm" 
              onClick={() => setShowCreator(true)}
              data-testid="button-new-adventure"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[350px]">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-md bg-muted/50 animate-pulse">
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Gamepad2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No active games</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start a game in Discord with <code className="text-xs bg-muted px-1 py-0.5 rounded">!start</code>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-md bg-muted/30 hover-elevate group"
                    data-testid={`session-${session.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{session.name}</h4>
                          <Badge 
                            className={`text-xs ${session.gameSystem === "cyberpunk" 
                              ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" 
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"}`}
                          >
                            {session.gameSystem === "cyberpunk" ? "Cyberpunk" : "D&D"}
                          </Badge>
                        </div>
                        {session.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {session.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {session.messageHistory.length}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteClick(e, session)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-session-${session.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {session.currentScene && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{session.currentScene}</span>
                      </div>
                    )}
                    {session.quests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {session.quests
                          .filter((q) => q.status === "active")
                          .slice(0, 3)
                          .map((quest) => (
                            <Badge key={quest.id} variant="secondary" className="text-xs">
                              {quest.title}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <AlertDialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <AlertDialogContent data-testid="dialog-delete-session">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Adventure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteSession?.name}" and all its message history. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdventureCreator open={showCreator} onOpenChange={setShowCreator} />
    </>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, PlayCircle, Users, Calendar, Shield, LogIn } from "lucide-react";
import { gameSystemLabels, type GameSystem } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface RoomWithMeta {
  id: string;
  code: string;
  name: string;
  gameSystem: GameSystem;
  hostName: string;
  description: string | null;
  isActive: boolean;
  isPublic: boolean;
  maxPlayers: number;
  playerCount: number;
  isHost: boolean;
  lastActivityAt: Date;
  createdAt: Date;
}

export default function MyRooms() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  // Fetch user's rooms
  const { data: rooms, isLoading } = useQuery<RoomWithMeta[]>({
    queryKey: ["/api/my-rooms"],
    enabled: isAuthenticated,
  });

  // Delete room mutation
  const deleteMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await apiRequest("DELETE", `/api/rooms/${roomId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-rooms"] });
      toast({
        title: "Room Deleted",
        description: "The room has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete room",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>My Rooms</CardTitle>
            <CardDescription>Please log in to view your rooms</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <LogIn className="h-12 w-12 text-muted-foreground" />
            <Button onClick={() => setLocation("/auth")}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>My Rooms</CardTitle>
            <CardDescription>Loading your rooms...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeRooms = rooms?.filter(r => r.isActive) || [];
  const inactiveRooms = rooms?.filter(r => !r.isActive) || [];

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-serif mb-2">My Rooms</h1>
        <p className="text-muted-foreground">
          Manage your game sessions
        </p>
      </div>

      {/* Active Rooms */}
      {activeRooms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Rooms</h2>
          <div className="grid gap-4">
            {activeRooms.map((room) => (
              <Card key={room.id} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{room.name}</CardTitle>
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                        {room.isHost && (
                          <Badge variant="outline">
                            <Shield className="h-3 w-3 mr-1" />
                            Host
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {gameSystemLabels[room.gameSystem]} • Room Code: <span className="font-mono font-semibold">{room.code}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {room.description && (
                    <p className="text-sm text-muted-foreground mb-3">{room.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{room.playerCount}/{room.maxPlayers} players</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDistanceToNow(new Date(room.lastActivityAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLocation(`/room/${room.code}`)}
                      className="flex-1"
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Enter Room
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Rooms */}
      {inactiveRooms.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Past Rooms</h2>
          <div className="grid gap-4">
            {inactiveRooms.map((room) => (
              <Card key={room.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{room.name}</CardTitle>
                        <Badge variant="secondary">Ended</Badge>
                        {room.isHost && (
                          <Badge variant="outline">
                            <Shield className="h-3 w-3 mr-1" />
                            Host
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {gameSystemLabels[room.gameSystem]} • Room Code: <span className="font-mono font-semibold">{room.code}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {room.description && (
                    <p className="text-sm text-muted-foreground mb-3">{room.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{room.playerCount}/{room.maxPlayers} players</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Ended {formatDistanceToNow(new Date(room.lastActivityAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLocation(`/room/${room.code}`)}
                      variant="outline"
                      className="flex-1"
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      View Room
                    </Button>
                    {room.isHost && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Room?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the room "{room.name}" and all its data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(room.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {rooms && rooms.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-semibold mb-1">No Rooms Yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create or join a room to start playing
              </p>
              <Button onClick={() => setLocation("/")}>Go to Home</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

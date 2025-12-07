import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Loader2, Shield, Heart, Zap, LogIn } from "lucide-react";
import { gameSystems, gameSystemLabels, type GameSystem, type SavedCharacter } from "@shared/schema";

const races = ["Human", "Elf", "Dwarf", "Halfling", "Gnome", "Half-Elf", "Half-Orc", "Tiefling", "Dragonborn", "Other"];
const classes = ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Bard", "Druid", "Monk", "Paladin", "Ranger", "Sorcerer", "Warlock", "Artificer", "Other"];
const alignments = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"];

export default function Characters() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<SavedCharacter | null>(null);

  const [formData, setFormData] = useState({
    characterName: "",
    race: "",
    class: "",
    level: 1,
    background: "",
    alignment: "",
    maxHp: 10,
    ac: 10,
    speed: 30,
    initiativeModifier: 0,
    backstory: "",
    gameSystem: "dnd" as GameSystem,
  });

  const resetForm = () => {
    setFormData({
      characterName: "",
      race: "",
      class: "",
      level: 1,
      background: "",
      alignment: "",
      maxHp: 10,
      ac: 10,
      speed: 30,
      initiativeModifier: 0,
      backstory: "",
      gameSystem: "dnd",
    });
    setEditingCharacter(null);
  };

  const { data: characters, isLoading } = useQuery<SavedCharacter[]>({
    queryKey: ["/api/saved-characters"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/saved-characters", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Character created", description: "Your new character has been saved." });
    },
    onError: () => {
      toast({ title: "Failed to create character", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest("PATCH", `/api/saved-characters/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Character updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Failed to update character", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved-characters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters"] });
      toast({ title: "Character deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete character", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.characterName.trim()) {
      toast({ title: "Name required", description: "Please enter a character name.", variant: "destructive" });
      return;
    }
    if (editingCharacter) {
      updateMutation.mutate({ id: editingCharacter.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (character: SavedCharacter) => {
    setEditingCharacter(character);
    setFormData({
      characterName: character.characterName,
      race: character.race || "",
      class: character.class || "",
      level: character.level || 1,
      background: character.background || "",
      alignment: character.alignment || "",
      maxHp: character.maxHp,
      ac: character.ac,
      speed: character.speed,
      initiativeModifier: character.initiativeModifier,
      backstory: character.backstory || "",
      gameSystem: character.gameSystem as GameSystem,
    });
    setCreateDialogOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>
              Log in to save and manage your characters across sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-login-characters">
              <a href="/api/login">
                <LogIn className="mr-2 h-4 w-4" />
                Log in with Replit
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-serif">My Characters</h1>
          <p className="text-muted-foreground">Manage your saved characters</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-character">
              <Plus className="mr-2 h-4 w-4" />
              New Character
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingCharacter ? "Edit Character" : "Create Character"}</DialogTitle>
              <DialogDescription>
                {editingCharacter ? "Update your character details." : "Create a new character to use in your adventures."}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="characterName">Character Name *</Label>
                  <Input
                    id="characterName"
                    value={formData.characterName}
                    onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                    placeholder="Enter character name"
                    data-testid="input-character-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="race">Race</Label>
                    <Select value={formData.race} onValueChange={(v) => setFormData({ ...formData, race: v })}>
                      <SelectTrigger id="race" data-testid="select-race">
                        <SelectValue placeholder="Select race" />
                      </SelectTrigger>
                      <SelectContent>
                        {races.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class">Class</Label>
                    <Select value={formData.class} onValueChange={(v) => setFormData({ ...formData, class: v })}>
                      <SelectTrigger id="class" data-testid="select-class">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Input
                      id="level"
                      type="number"
                      min={1}
                      max={20}
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                      data-testid="input-level"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alignment">Alignment</Label>
                    <Select value={formData.alignment} onValueChange={(v) => setFormData({ ...formData, alignment: v })}>
                      <SelectTrigger id="alignment" data-testid="select-alignment">
                        <SelectValue placeholder="Select alignment" />
                      </SelectTrigger>
                      <SelectContent>
                        {alignments.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gameSystem">Game System</Label>
                  <Select value={formData.gameSystem} onValueChange={(v) => setFormData({ ...formData, gameSystem: v as GameSystem })}>
                    <SelectTrigger id="gameSystem" data-testid="select-game-system">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gameSystems.map((s) => (
                        <SelectItem key={s} value={s}>{gameSystemLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxHp">Max HP</Label>
                    <Input
                      id="maxHp"
                      type="number"
                      min={1}
                      value={formData.maxHp}
                      onChange={(e) => setFormData({ ...formData, maxHp: parseInt(e.target.value) || 10 })}
                      data-testid="input-max-hp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ac">AC</Label>
                    <Input
                      id="ac"
                      type="number"
                      min={0}
                      value={formData.ac}
                      onChange={(e) => setFormData({ ...formData, ac: parseInt(e.target.value) || 10 })}
                      data-testid="input-ac"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="speed">Speed</Label>
                    <Input
                      id="speed"
                      type="number"
                      min={0}
                      value={formData.speed}
                      onChange={(e) => setFormData({ ...formData, speed: parseInt(e.target.value) || 30 })}
                      data-testid="input-speed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initiative">Init</Label>
                    <Input
                      id="initiative"
                      type="number"
                      value={formData.initiativeModifier}
                      onChange={(e) => setFormData({ ...formData, initiativeModifier: parseInt(e.target.value) || 0 })}
                      data-testid="input-initiative"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Background</Label>
                  <Input
                    id="background"
                    value={formData.background}
                    onChange={(e) => setFormData({ ...formData, background: e.target.value })}
                    placeholder="e.g., Soldier, Noble, Outlander"
                    data-testid="input-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backstory">Backstory</Label>
                  <Textarea
                    id="backstory"
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                    placeholder="Write your character's backstory..."
                    rows={4}
                    data-testid="input-backstory"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-character"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingCharacter ? "Save Changes" : "Create Character"
                  )}
                </Button>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !characters || characters.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">You haven't created any characters yet.</p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-character">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Character
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {characters.map((character) => (
            <Card key={character.id} data-testid={`card-character-${character.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-character-name-${character.id}`}>
                      {character.characterName}
                    </CardTitle>
                    <CardDescription>
                      {character.race && character.class
                        ? `Level ${character.level} ${character.race} ${character.class}`
                        : character.class || character.race || `Level ${character.level}`}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {gameSystemLabels[character.gameSystem as GameSystem] || character.gameSystem}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    <span data-testid={`text-hp-${character.id}`}>{character.maxHp} HP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    <span data-testid={`text-ac-${character.id}`}>{character.ac} AC</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    <span data-testid={`text-speed-${character.id}`}>{character.speed} ft</span>
                  </div>
                </div>
                {character.backstory && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {character.backstory}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(character)}
                    data-testid={`button-edit-${character.id}`}
                  >
                    <Edit2 className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(character.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${character.id}`}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

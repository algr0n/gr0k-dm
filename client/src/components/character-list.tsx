import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Plus } from "lucide-react";
import { CharacterCard, CharacterCardSkeleton } from "./character-card";
import { CharacterSheet } from "./character-sheet";
import { CharacterCreator } from "./character-creator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Character } from "@shared/schema";

export function CharacterList() {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const { toast } = useToast();

  const { data: characters = [], isLoading } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/characters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "Character deleted",
        description: "The character has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete character.",
        variant: "destructive",
      });
    },
  });

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
    setSheetOpen(true);
  };

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="font-serif">Characters</span>
          </CardTitle>
          <Button 
            size="sm" 
            onClick={() => setCreatorOpen(true)}
            data-testid="button-create-character"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create
          </Button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="space-y-4">
                <CharacterCardSkeleton />
                <CharacterCardSkeleton />
              </div>
            ) : characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No characters yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a character in Discord using <code className="text-xs bg-muted px-1 py-0.5 rounded">!create</code>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {characters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    onClick={() => handleCharacterClick(character)}
                    onDelete={() => deleteMutation.mutate(character.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <CharacterSheet
        character={selectedCharacter}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <CharacterCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
      />
    </>
  );
}

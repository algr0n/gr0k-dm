import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GameSystem } from "@shared/schema";

interface AdventureCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdventureCreator({ open, onOpenChange }: AdventureCreatorProps) {
  const [formData, setFormData] = useState({
    gameSystem: "dnd" as GameSystem,
    name: "",
    description: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/sessions", {
        name: formData.name,
        description: formData.description || undefined,
        gameSystem: formData.gameSystem,
      });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
      toast({
        title: "Adventure Created!",
        description: `${formData.name} is ready to begin.`,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create adventure",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      gameSystem: "dnd" as GameSystem,
      name: "",
      description: "",
    });
  };

  const canCreate = () => {
    return formData.name.trim().length > 0;
  };

  const handleCreate = () => {
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-adventure-creator">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Compass className="h-5 w-5" />
            Start New Adventure
          </DialogTitle>
          <DialogDescription>
            Create a new game session and choose your adventure type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="gameSystem">Game System</Label>
            <Select 
              value={formData.gameSystem} 
              onValueChange={(value: GameSystem) => setFormData({ ...formData, gameSystem: value })}
            >
              <SelectTrigger data-testid="select-adventure-game-system">
                <SelectValue placeholder="Choose a game system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dnd">D&D 5e</SelectItem>
                <SelectItem value="cyberpunk">Cyberpunk RED</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.gameSystem === "dnd" 
                ? "Classic fantasy adventure with magic, monsters, and medieval settings."
                : "Dark future cyberpunk with hackers, chrome, and corporate intrigue."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Adventure Name</Label>
            <Input
              id="name"
              placeholder={formData.gameSystem === "dnd" 
                ? "e.g., The Dragon's Hoard"
                : "e.g., Night City Blues"}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="input-adventure-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder={formData.gameSystem === "dnd"
                ? "A brief overview of your adventure's premise..."
                : "Set the scene for your cyberpunk story..."}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              data-testid="textarea-adventure-description"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-adventure"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate() || createMutation.isPending}
            data-testid="button-create-adventure"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Creating...
              </>
            ) : (
              "Start Adventure"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

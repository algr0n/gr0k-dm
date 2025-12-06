import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Wand2, ChevronLeft, ChevronRight, Dices, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const RACES = [
  "Human", "Elf", "Dwarf", "Halfling", "Gnome", 
  "Half-Elf", "Half-Orc", "Tiefling", "Dragonborn"
];

const CLASSES = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Ranger",
  "Paladin", "Barbarian", "Bard", "Druid", "Monk",
  "Sorcerer", "Warlock"
];

const STEPS = ["Basics", "Attributes", "Backstory"];

interface CharacterCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterCreator({ open, onOpenChange }: CharacterCreatorProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    race: "",
    characterClass: "",
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    backstory: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/characters", {
        name: formData.name,
        race: formData.race,
        characterClass: formData.characterClass,
        discordUserId: "web-user",
        discordUsername: "Web Dashboard",
        stats: {
          strength: formData.strength,
          dexterity: formData.dexterity,
          constitution: formData.constitution,
          intelligence: formData.intelligence,
          wisdom: formData.wisdom,
          charisma: formData.charisma,
        },
        backstory: formData.backstory || undefined,
      });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
      toast({
        title: "Character Created!",
        description: `${formData.name} is ready for adventure.`,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create character",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(0);
    setFormData({
      name: "",
      race: "",
      characterClass: "",
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      backstory: "",
    });
  };

  const rollStats = () => {
    const roll4d6DropLowest = () => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => b - a);
      return rolls.slice(0, 3).reduce((a, b) => a + b, 0);
    };

    setFormData((prev) => ({
      ...prev,
      strength: roll4d6DropLowest(),
      dexterity: roll4d6DropLowest(),
      constitution: roll4d6DropLowest(),
      intelligence: roll4d6DropLowest(),
      wisdom: roll4d6DropLowest(),
      charisma: roll4d6DropLowest(),
    }));
  };

  const canProceed = () => {
    if (step === 0) {
      return formData.name.trim() && formData.race && formData.characterClass;
    }
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      createMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-character-creator">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Wand2 className="h-5 w-5" />
            Create Character
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />

        <div className="space-y-4 py-4">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Character Name</Label>
                <Input
                  id="name"
                  placeholder="Enter a name for your hero"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-character-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="race">Race</Label>
                <Select 
                  value={formData.race} 
                  onValueChange={(value) => setFormData({ ...formData, race: value })}
                >
                  <SelectTrigger data-testid="select-race">
                    <SelectValue placeholder="Choose a race" />
                  </SelectTrigger>
                  <SelectContent>
                    {RACES.map((race) => (
                      <SelectItem key={race} value={race}>{race}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select 
                  value={formData.characterClass} 
                  onValueChange={(value) => setFormData({ ...formData, characterClass: value })}
                >
                  <SelectTrigger data-testid="select-class">
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Set your ability scores
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={rollStats}
                  data-testid="button-roll-stats"
                >
                  <Dices className="h-4 w-4 mr-1" />
                  Roll Stats
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const).map((stat) => (
                  <div key={stat} className="space-y-1">
                    <Label htmlFor={stat} className="text-xs uppercase">
                      {stat}
                    </Label>
                    <Input
                      id={stat}
                      type="number"
                      min={1}
                      max={30}
                      value={formData[stat]}
                      onChange={(e) => setFormData({ ...formData, [stat]: parseInt(e.target.value) || 10 })}
                      className="font-mono"
                      data-testid={`input-stat-${stat}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory (Optional)</Label>
              <Textarea
                id="backstory"
                placeholder="Tell us about your character's past, motivations, and dreams..."
                value={formData.backstory}
                onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                rows={6}
                data-testid="textarea-backstory"
              />
              <p className="text-xs text-muted-foreground">
                This will help the AI Dungeon Master create a more personalized story for your character.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || createMutation.isPending}
            data-testid="button-next"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Creating...
              </>
            ) : step < STEPS.length - 1 ? (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            ) : (
              "Create Character"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

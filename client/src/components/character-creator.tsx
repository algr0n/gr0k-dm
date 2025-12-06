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
import type { GameSystem } from "@shared/schema";

// D&D options
const DND_RACES = [
  "Human", "Elf", "Dwarf", "Halfling", "Gnome", 
  "Half-Elf", "Half-Orc", "Tiefling", "Dragonborn"
];

const DND_CLASSES = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Ranger",
  "Paladin", "Barbarian", "Bard", "Druid", "Monk",
  "Sorcerer", "Warlock"
];

// Cyberpunk options
const CYBERPUNK_BACKGROUNDS = [
  "Streetkid", "Corporate", "Nomad"
];

const CYBERPUNK_ROLES = [
  "Solo", "Netrunner", "Tech", "Rockerboy", "Media",
  "Nomad", "Fixer", "Cop", "Exec", "Medtech"
];

const STEPS = ["Basics", "Attributes", "Backstory"];

interface CharacterCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterCreator({ open, onOpenChange }: CharacterCreatorProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    gameSystem: "dnd" as GameSystem,
    name: "",
    race: "",
    characterClass: "",
    discordUsername: "",
    // D&D stats
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    // Cyberpunk stats
    int: 5,
    ref: 5,
    dex: 5,
    tech: 5,
    cool: 5,
    will: 5,
    luck: 5,
    move: 5,
    body: 5,
    emp: 5,
    backstory: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const stats = formData.gameSystem === "dnd" 
        ? {
            strength: formData.strength,
            dexterity: formData.dexterity,
            constitution: formData.constitution,
            intelligence: formData.intelligence,
            wisdom: formData.wisdom,
            charisma: formData.charisma,
          }
        : {
            int: formData.int,
            ref: formData.ref,
            dex: formData.dex,
            tech: formData.tech,
            cool: formData.cool,
            will: formData.will,
            luck: formData.luck,
            move: formData.move,
            body: formData.body,
            emp: formData.emp,
          };
      
      const result = await apiRequest("POST", "/api/characters", {
        name: formData.name,
        race: formData.race,
        characterClass: formData.characterClass,
        discordUserId: formData.discordUsername ? `username:${formData.discordUsername}` : "web-user",
        discordUsername: formData.discordUsername || "Web Dashboard",
        gameSystem: formData.gameSystem,
        stats,
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
      gameSystem: "dnd" as GameSystem,
      name: "",
      race: "",
      characterClass: "",
      discordUsername: "",
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      int: 5,
      ref: 5,
      dex: 5,
      tech: 5,
      cool: 5,
      will: 5,
      luck: 5,
      move: 5,
      body: 5,
      emp: 5,
      backstory: "",
    });
  };

  const rollStats = () => {
    if (formData.gameSystem === "dnd") {
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
    } else {
      // Cyberpunk uses 1d10 for stats (values 1-10)
      const rollD10 = () => Math.floor(Math.random() * 10) + 1;
      setFormData((prev) => ({
        ...prev,
        int: rollD10(),
        ref: rollD10(),
        dex: rollD10(),
        tech: rollD10(),
        cool: rollD10(),
        will: rollD10(),
        luck: rollD10(),
        move: rollD10(),
        body: rollD10(),
        emp: rollD10(),
      }));
    }
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
                <Label htmlFor="gameSystem">Game System</Label>
                <Select 
                  value={formData.gameSystem} 
                  onValueChange={(value: GameSystem) => setFormData({ ...formData, gameSystem: value, race: "", characterClass: "" })}
                >
                  <SelectTrigger data-testid="select-game-system">
                    <SelectValue placeholder="Choose a game system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dnd">D&D 5e</SelectItem>
                    <SelectItem value="cyberpunk">Cyberpunk RED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="race">{formData.gameSystem === "dnd" ? "Race" : "Background"}</Label>
                <Select 
                  value={formData.race} 
                  onValueChange={(value) => setFormData({ ...formData, race: value })}
                >
                  <SelectTrigger data-testid="select-race">
                    <SelectValue placeholder={formData.gameSystem === "dnd" ? "Choose a race" : "Choose a background"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(formData.gameSystem === "dnd" ? DND_RACES : CYBERPUNK_BACKGROUNDS).map((race) => (
                      <SelectItem key={race} value={race}>{race}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">{formData.gameSystem === "dnd" ? "Class" : "Role"}</Label>
                <Select 
                  value={formData.characterClass} 
                  onValueChange={(value) => setFormData({ ...formData, characterClass: value })}
                >
                  <SelectTrigger data-testid="select-class">
                    <SelectValue placeholder={formData.gameSystem === "dnd" ? "Choose a class" : "Choose a role"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(formData.gameSystem === "dnd" ? DND_CLASSES : CYBERPUNK_ROLES).map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discordUsername">Discord Username</Label>
                <Input
                  id="discordUsername"
                  placeholder="e.g. zyro111 (to link with Discord)"
                  value={formData.discordUsername}
                  onChange={(e) => setFormData({ ...formData, discordUsername: e.target.value })}
                  data-testid="input-discord-username"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Discord username to use this character with !characters command
                </p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {formData.gameSystem === "dnd" ? "Set your ability scores" : "Set your stats (1-10)"}
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
              {formData.gameSystem === "dnd" ? (
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
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"] as const).map((stat) => {
                    const statLabels: Record<string, string> = {
                      int: "INT (Intelligence)",
                      ref: "REF (Reflexes)",
                      dex: "DEX (Dexterity)",
                      tech: "TECH (Technical)",
                      cool: "COOL",
                      will: "WILL (Willpower)",
                      luck: "LUCK",
                      move: "MOVE (Movement)",
                      body: "BODY",
                      emp: "EMP (Empathy)",
                    };
                    return (
                      <div key={stat} className="space-y-1">
                        <Label htmlFor={stat} className="text-xs uppercase">
                          {statLabels[stat]}
                        </Label>
                        <Input
                          id={stat}
                          type="number"
                          min={1}
                          max={10}
                          value={formData[stat]}
                          onChange={(e) => setFormData({ ...formData, [stat]: parseInt(e.target.value) || 5 })}
                          className="font-mono"
                          data-testid={`input-stat-${stat}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
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

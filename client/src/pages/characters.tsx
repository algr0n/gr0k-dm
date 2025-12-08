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
import { Plus, Trash2, Edit2, Loader2, Shield, Heart, Zap, LogIn, Sword, User, Dices, Package } from "lucide-react";
import { gameSystems, gameSystemLabels, type GameSystem, type SavedCharacter, classDefinitions, raceDefinitions, subraceDefinitions, dndSkills, type DndSkill, type DndClass, type DndRace, classSkillFeatures, type ClassLevelFeature } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { dnd5eData, cyberpunkRedData } from "@/lib/gameData";
import { ChevronDown, ChevronUp } from "lucide-react";

interface InventoryItemWithDetails {
  id: string;
  savedCharacterId: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  notes: string | null;
  attunementSlot: number | null;
  item: {
    id: string;
    name: string;
    category: string;
    type: string | null;
    subtype: string | null;
    rarity: string;
    cost: string | null;
    weight: number | null;
    description: string;
    properties: unknown;
    requiresAttunement: boolean;
    gameSystem: string;
    source: string | null;
  };
}

function CharacterInventory({ characterId }: { characterId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: inventory, isLoading } = useQuery<InventoryItemWithDetails[]>({
    queryKey: ["/api/saved-characters", characterId, "inventory"],
    enabled: isOpen,
  });

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setIsOpen(true)}
        data-testid={`button-show-inventory-${characterId}`}
      >
        <Package className="mr-1 h-3 w-3" />
        Show Inventory
        <ChevronDown className="ml-auto h-3 w-3" />
      </Button>
    );
  }

  return (
    <div className="mt-2 border-t pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground mb-2"
        onClick={() => setIsOpen(false)}
        data-testid={`button-hide-inventory-${characterId}`}
      >
        <Package className="mr-1 h-3 w-3" />
        Inventory
        <ChevronUp className="ml-auto h-3 w-3" />
      </Button>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !inventory || inventory.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-2">No items in inventory</p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {inventory.map((invItem) => (
            <div
              key={invItem.id}
              className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-muted/50"
              data-testid={`inventory-item-${invItem.id}`}
            >
              <span className="truncate flex-1" title={invItem.item.name}>
                {invItem.item.name}
                {invItem.quantity > 1 && ` (x${invItem.quantity})`}
              </span>
              {invItem.equipped && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  Equipped
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type FormStep = "system" | "details";

interface DnDFormData {
  characterName: string;
  race: string;
  subrace: string;
  class: string;
  level: number;
  background: string;
  alignment: string;
  maxHp: number;
  ac: number;
  speed: number;
  initiativeModifier: number;
  xp: number;
  backstory: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills: string[];
}

interface CyberpunkFormData {
  characterName: string;
  role: string;
  level: number;
  culturalOrigin: string;
  personality: string;
  clothingStyle: string;
  hairstyle: string;
  valuedPerson: string;
  valuedMost: string;
  feelingsAboutPeople: string;
  maxHp: number;
  xp: number;
  backstory: string;
  stats: {
    int: number;
    ref: number;
    dex: number;
    tech: number;
    cool: number;
    will: number;
    luck: number;
    move: number;
    body: number;
    emp: number;
  };
}

const defaultDnDForm: DnDFormData = {
  characterName: "",
  race: "",
  subrace: "",
  class: "",
  level: 1,
  background: "",
  alignment: "",
  maxHp: 10,
  ac: 10,
  speed: 30,
  initiativeModifier: 0,
  xp: 0,
  backstory: "",
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  skills: [],
};

const defaultCyberpunkForm: CyberpunkFormData = {
  characterName: "",
  role: "",
  level: 1,
  culturalOrigin: "",
  personality: "",
  clothingStyle: "",
  hairstyle: "",
  valuedPerson: "",
  valuedMost: "",
  feelingsAboutPeople: "",
  maxHp: 40,
  xp: 0,
  backstory: "",
  stats: {
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
  },
};

export default function Characters() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<SavedCharacter | null>(null);
  const [formStep, setFormStep] = useState<FormStep>("system");
  const [selectedSystem, setSelectedSystem] = useState<GameSystem | null>(null);
  
  const [dndForm, setDndForm] = useState<DnDFormData>(defaultDnDForm);
  const [cyberpunkForm, setCyberpunkForm] = useState<CyberpunkFormData>(defaultCyberpunkForm);
  const [selectedClassSkills, setSelectedClassSkills] = useState<DndSkill[]>([]);
  const [selectedRaceBonusSkills, setSelectedRaceBonusSkills] = useState<DndSkill[]>([]);
  const [expertiseSkills, setExpertiseSkills] = useState<Record<number, DndSkill[]>>({});

  const resetForm = () => {
    setDndForm(defaultDnDForm);
    setCyberpunkForm(defaultCyberpunkForm);
    setFormStep("system");
    setSelectedSystem(null);
    setEditingCharacter(null);
    setSelectedClassSkills([]);
    setSelectedRaceBonusSkills([]);
    setExpertiseSkills({});
  };

  // Get expertise features available for the current class and level
  const getExpertiseFeatures = (): ClassLevelFeature[] => {
    const charClass = dndForm.class as DndClass;
    if (!charClass || !classSkillFeatures[charClass]) return [];
    
    return classSkillFeatures[charClass]!.filter(
      f => f.type === "expertise" && f.level <= dndForm.level
    );
  };

  // Handle expertise skill toggle
  const handleExpertiseToggle = (level: number, skill: DndSkill, checked: boolean, maxChoices: number) => {
    const currentChoices = expertiseSkills[level] || [];
    
    if (checked) {
      if (currentChoices.length < maxChoices) {
        setExpertiseSkills({
          ...expertiseSkills,
          [level]: [...currentChoices, skill]
        });
      }
    } else {
      setExpertiseSkills({
        ...expertiseSkills,
        [level]: currentChoices.filter(s => s !== skill)
      });
    }
  };

  // Get all expertise skills as a flat array
  const getAllExpertiseSkills = (): DndSkill[] => {
    return Object.values(expertiseSkills).flat();
  };

  // Get race skill info for the selected race/subrace
  const getRaceSkillInfo = () => {
    const race = dndForm.race as DndRace;
    if (!race || !raceDefinitions[race]) return { autoSkills: [], bonusChoices: null };
    
    const raceDef = raceDefinitions[race];
    let autoSkills = [...raceDef.skillProficiencies];
    let bonusChoices = raceDef.bonusSkillChoices;
    
    // Check subrace for additional skills
    if (dndForm.subrace && subraceDefinitions[dndForm.subrace]) {
      const subraceDef = subraceDefinitions[dndForm.subrace];
      if (subraceDef.skillProficiencies) {
        autoSkills = [...autoSkills, ...subraceDef.skillProficiencies];
      }
      if (subraceDef.bonusSkillChoices) {
        bonusChoices = subraceDef.bonusSkillChoices;
      }
    }
    
    return { autoSkills, bonusChoices };
  };

  // Handle class skill toggle
  const handleClassSkillToggle = (skill: DndSkill, checked: boolean) => {
    const className = dndForm.class as DndClass;
    if (!className || !classDefinitions[className]) return;
    
    const classDef = classDefinitions[className];
    const { autoSkills } = getRaceSkillInfo();
    
    if (checked) {
      // Prevent selecting skills already granted by race auto or chosen as race bonus
      if (selectedClassSkills.length < classDef.numSkillChoices && 
          !autoSkills.includes(skill) && 
          !selectedRaceBonusSkills.includes(skill)) {
        setSelectedClassSkills([...selectedClassSkills, skill]);
      }
    } else {
      setSelectedClassSkills(selectedClassSkills.filter(s => s !== skill));
    }
  };

  // Handle race bonus skill toggle
  const handleRaceBonusSkillToggle = (skill: DndSkill, checked: boolean) => {
    const { bonusChoices, autoSkills } = getRaceSkillInfo();
    if (!bonusChoices) return;
    
    if (checked) {
      if (selectedRaceBonusSkills.length < bonusChoices.count && !autoSkills.includes(skill) && !selectedClassSkills.includes(skill)) {
        setSelectedRaceBonusSkills([...selectedRaceBonusSkills, skill]);
      }
    } else {
      setSelectedRaceBonusSkills(selectedRaceBonusSkills.filter(s => s !== skill));
    }
  };

  // Get all selected skills combined
  const getAllSelectedSkills = (): string[] => {
    const { autoSkills } = getRaceSkillInfo();
    const allSkills = new Set<string>([
      ...autoSkills,
      ...selectedRaceBonusSkills,
      ...selectedClassSkills
    ]);
    return Array.from(allSkills);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const closeDialog = () => {
    setCreateDialogOpen(false);
    resetForm();
  };

  // Roll 4d6 drop lowest for D&D ability scores
  const rollDnDStats = () => {
    const roll4d6DropLowest = () => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => b - a);
      return rolls.slice(0, 3).reduce((a, b) => a + b, 0);
    };
    setDndForm((prev) => ({
      ...prev,
      stats: {
        strength: roll4d6DropLowest(),
        dexterity: roll4d6DropLowest(),
        constitution: roll4d6DropLowest(),
        intelligence: roll4d6DropLowest(),
        wisdom: roll4d6DropLowest(),
        charisma: roll4d6DropLowest(),
      },
    }));
    toast({
      title: "Dice rolled!",
      description: "Your ability scores have been randomly generated using 4d6 drop lowest.",
    });
  };

  // Roll 1d10 for Cyberpunk stats
  const rollCyberpunkStats = () => {
    const rollD10 = () => Math.floor(Math.random() * 10) + 1;
    setCyberpunkForm((prev) => ({
      ...prev,
      stats: {
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
      },
    }));
    toast({
      title: "Dice rolled!",
      description: "Your stats have been randomly generated using 1d10 for each.",
    });
  };

  const { data: characters, isLoading } = useQuery<SavedCharacter[]>({
    queryKey: ["/api/saved-characters"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiRequest("POST", "/api/saved-characters", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters"] });
      closeDialog();
      toast({ title: "Character created", description: "Your new character has been saved." });
    },
    onError: () => {
      toast({ title: "Failed to create character", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/saved-characters/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters"] });
      closeDialog();
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

  const handleDnDSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dndForm.characterName.trim()) {
      toast({ title: "Name required", description: "Please enter a character name.", variant: "destructive" });
      return;
    }

    // Build levelChoices for expertise
    const levelChoices: Record<string, unknown>[] = [];
    Object.entries(expertiseSkills).forEach(([levelStr, skills]) => {
      if (skills.length > 0) {
        levelChoices.push({
          level: parseInt(levelStr),
          feature: "expertise",
          skills: skills,
        });
      }
    });

    // Build skill sources mapping (array to support multiple sources)
    const skillSources: Record<string, string[]> = {};
    
    // Helper to add source
    const addSource = (skill: string, source: string) => {
      if (!skillSources[skill]) {
        skillSources[skill] = [];
      }
      if (!skillSources[skill].includes(source)) {
        skillSources[skill].push(source);
      }
    };
    
    // Get base race skills separately from subrace skills
    const race = dndForm.race as DndRace;
    const baseRaceSkills = race && raceDefinitions[race] ? [...raceDefinitions[race].skillProficiencies] : [];
    const subraceSkills = dndForm.subrace && subraceDefinitions[dndForm.subrace]?.skillProficiencies 
      ? [...subraceDefinitions[dndForm.subrace].skillProficiencies] 
      : [];
    
    // Base race auto-granted skills
    baseRaceSkills.forEach((skill) => {
      addSource(skill, "Race");
    });
    
    // Subrace auto-granted skills
    subraceSkills.forEach((skill) => {
      addSource(skill, "Subrace");
    });
    
    // Race/Subrace bonus choice skills - check where the bonus choice came from
    const hasSubraceBonusChoice = dndForm.subrace && subraceDefinitions[dndForm.subrace]?.bonusSkillChoices;
    selectedRaceBonusSkills.forEach((skill) => {
      addSource(skill, hasSubraceBonusChoice ? "Subrace" : "Race");
    });
    
    // Class skills
    selectedClassSkills.forEach((skill) => {
      addSource(skill, "Class");
    });

    const data = {
      characterName: dndForm.characterName,
      race: dndForm.subrace || dndForm.race,
      class: dndForm.class,
      level: dndForm.level,
      background: dndForm.background,
      alignment: dndForm.alignment,
      maxHp: dndForm.maxHp,
      ac: dndForm.ac,
      speed: dndForm.speed,
      initiativeModifier: dndForm.initiativeModifier,
      xp: dndForm.xp,
      backstory: dndForm.backstory,
      stats: {
        ...dndForm.stats,
        skillSources,
      },
      skills: getAllSelectedSkills(),
      levelChoices: levelChoices,
      gameSystem: "dnd" as GameSystem,
    };

    if (editingCharacter) {
      updateMutation.mutate({ id: editingCharacter.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCyberpunkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cyberpunkForm.characterName.trim()) {
      toast({ title: "Name required", description: "Please enter a character name.", variant: "destructive" });
      return;
    }

    const lifepathDescription = [
      cyberpunkForm.culturalOrigin && `Origin: ${cyberpunkForm.culturalOrigin}`,
      cyberpunkForm.personality && `Personality: ${cyberpunkForm.personality}`,
      cyberpunkForm.clothingStyle && `Style: ${cyberpunkForm.clothingStyle}`,
      cyberpunkForm.hairstyle && `Hair: ${cyberpunkForm.hairstyle}`,
      cyberpunkForm.valuedPerson && `Values: ${cyberpunkForm.valuedPerson}`,
      cyberpunkForm.valuedMost && `Motivation: ${cyberpunkForm.valuedMost}`,
      cyberpunkForm.feelingsAboutPeople && `View: ${cyberpunkForm.feelingsAboutPeople}`,
    ].filter(Boolean).join(". ");

    const data = {
      characterName: cyberpunkForm.characterName,
      race: cyberpunkForm.role,
      class: cyberpunkForm.role,
      level: cyberpunkForm.level,
      background: lifepathDescription,
      alignment: "",
      maxHp: cyberpunkForm.maxHp,
      xp: cyberpunkForm.xp,
      ac: 11,
      speed: cyberpunkForm.stats.move * 2,
      initiativeModifier: cyberpunkForm.stats.ref - 5,
      backstory: cyberpunkForm.backstory,
      stats: cyberpunkForm.stats,
      gameSystem: "cyberpunk" as GameSystem,
    };

    if (editingCharacter) {
      updateMutation.mutate({ id: editingCharacter.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (character: SavedCharacter) => {
    setEditingCharacter(character);
    const system = character.gameSystem as GameSystem;
    setSelectedSystem(system);
    setFormStep("details");

    if (system === "dnd") {
      const stats = character.stats as Record<string, number> | null;
      const existingSkills = (character.skills as string[] | null) || [];
      
      // Check if the stored race is actually a subrace
      const storedRace = character.race || "";
      let baseRace = storedRace;
      let subrace = "";
      
      // Check if storedRace is in subraceDefinitions
      if (subraceDefinitions[storedRace]) {
        // It's a subrace - find the parent race
        const subraceDef = subraceDefinitions[storedRace];
        baseRace = subraceDef.parentRace;
        subrace = storedRace;
      }
      
      setDndForm({
        characterName: character.characterName,
        race: baseRace,
        subrace: subrace,
        class: character.class || "",
        level: character.level || 1,
        background: character.background || "",
        alignment: character.alignment || "",
        maxHp: character.maxHp,
        ac: character.ac,
        speed: character.speed,
        initiativeModifier: character.initiativeModifier,
        xp: character.xp || 0,
        backstory: character.backstory || "",
        stats: {
          strength: stats?.strength ?? 10,
          dexterity: stats?.dexterity ?? 10,
          constitution: stats?.constitution ?? 10,
          intelligence: stats?.intelligence ?? 10,
          wisdom: stats?.wisdom ?? 10,
          charisma: stats?.charisma ?? 10,
        },
        skills: existingSkills,
      });
      
      // Load skill selections from existing character
      const charClass = character.class as DndClass;
      
      // First calculate class skills
      let classSkills: DndSkill[] = [];
      if (charClass && classDefinitions[charClass]) {
        const classSkillChoices = classDefinitions[charClass].skillChoices;
        classSkills = existingSkills.filter(s => classSkillChoices.includes(s as DndSkill)) as DndSkill[];
        setSelectedClassSkills(classSkills);
      } else {
        setSelectedClassSkills([]);
      }
      
      // Calculate all auto skills from race and subrace
      let autoSkills: DndSkill[] = [];
      if (raceDefinitions[baseRace as DndRace]) {
        autoSkills = [...raceDefinitions[baseRace as DndRace].skillProficiencies];
      }
      if (subrace && subraceDefinitions[subrace]?.skillProficiencies) {
        autoSkills = [...autoSkills, ...subraceDefinitions[subrace].skillProficiencies];
      }
      
      // Race bonus skills are any stored skills that are NOT auto-granted and NOT class skills
      const bonusSkills = existingSkills.filter(s => 
        !autoSkills.includes(s as DndSkill) && 
        !classSkills.includes(s as DndSkill)
      ) as DndSkill[];
      setSelectedRaceBonusSkills(bonusSkills);
      
      // Load expertise from levelChoices
      const storedLevelChoices = (character.levelChoices as Array<{ level: number; feature: string; skills: string[] }>) || [];
      const loadedExpertise: Record<number, DndSkill[]> = {};
      storedLevelChoices.forEach(choice => {
        if (choice.feature === "expertise" && choice.skills) {
          loadedExpertise[choice.level] = choice.skills as DndSkill[];
        }
      });
      setExpertiseSkills(loadedExpertise);
    } else {
      const stats = character.stats as Record<string, number> | null;
      setCyberpunkForm({
        characterName: character.characterName,
        role: character.class || "",
        level: character.level || 1,
        culturalOrigin: "",
        personality: "",
        clothingStyle: "",
        hairstyle: "",
        valuedPerson: "",
        valuedMost: "",
        feelingsAboutPeople: "",
        maxHp: character.maxHp,
        xp: character.xp || 0,
        backstory: character.backstory || "",
        stats: {
          int: stats?.int ?? 5,
          ref: stats?.ref ?? 5,
          dex: stats?.dex ?? 5,
          tech: stats?.tech ?? 5,
          cool: stats?.cool ?? 5,
          will: stats?.will ?? 5,
          luck: stats?.luck ?? 5,
          move: stats?.move ?? 5,
          body: stats?.body ?? 5,
          emp: stats?.emp ?? 5,
        },
      });
    }
    setCreateDialogOpen(true);
  };

  const selectSystem = (system: GameSystem) => {
    setSelectedSystem(system);
    setFormStep("details");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You need to sign in to create and manage your saved characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              <LogIn className="mr-2 h-4 w-4" />
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableSubraces = selectedSystem === "dnd" && dndForm.race 
    ? dnd5eData.subraces[dndForm.race as keyof typeof dnd5eData.subraces] || []
    : [];

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Characters</h1>
          <p className="text-muted-foreground">
            Create and manage your saved characters
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          if (!open) closeDialog();
          else setCreateDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-create-character">
              <Plus className="mr-2 h-4 w-4" />
              New Character
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh]">
            {formStep === "system" && !editingCharacter ? (
              <>
                <DialogHeader>
                  <DialogTitle>Choose Game System</DialogTitle>
                  <DialogDescription>
                    Select the game system for your new character. Each system has different options.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Card 
                    className="cursor-pointer hover-elevate" 
                    onClick={() => selectSystem("dnd")}
                    data-testid="card-select-dnd"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <Sword className="h-5 w-5" />
                        D&D 5th Edition
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Create a fantasy hero with race, class, background, and ability scores.
                      </p>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer hover-elevate" 
                    onClick={() => selectSystem("cyberpunk")}
                    data-testid="card-select-cyberpunk"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Cyberpunk RED
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Build a edgerunner with role, lifepath, and cyberpunk stats.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : selectedSystem === "dnd" ? (
              <>
                <DialogHeader>
                  <DialogTitle>{editingCharacter ? "Edit D&D Character" : "Create D&D Character"}</DialogTitle>
                  <DialogDescription>
                    {editingCharacter ? "Update your character details." : "Build your hero for D&D 5th Edition."}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <form onSubmit={handleDnDSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="dnd-name">Character Name *</Label>
                      <Input
                        id="dnd-name"
                        value={dndForm.characterName}
                        onChange={(e) => setDndForm({ ...dndForm, characterName: e.target.value })}
                        placeholder="Enter character name"
                        data-testid="input-dnd-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dnd-race">Race</Label>
                        <Select 
                          value={dndForm.race} 
                          onValueChange={(v) => setDndForm({ ...dndForm, race: v, subrace: "" })}
                        >
                          <SelectTrigger id="dnd-race" data-testid="select-dnd-race">
                            <SelectValue placeholder="Select race" />
                          </SelectTrigger>
                          <SelectContent>
                            {dnd5eData.races.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {availableSubraces.length > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="dnd-subrace">Subrace</Label>
                          <Select 
                            value={dndForm.subrace} 
                            onValueChange={(v) => setDndForm({ ...dndForm, subrace: v })}
                          >
                            <SelectTrigger id="dnd-subrace" data-testid="select-dnd-subrace">
                              <SelectValue placeholder="Select subrace" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSubraces.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dnd-class">Class</Label>
                        <Select 
                          value={dndForm.class} 
                          onValueChange={(v) => setDndForm({ ...dndForm, class: v })}
                        >
                          <SelectTrigger id="dnd-class" data-testid="select-dnd-class">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {dnd5eData.classes.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dnd-level">Level</Label>
                        <Input
                          id="dnd-level"
                          type="number"
                          min={1}
                          max={20}
                          value={dndForm.level}
                          onChange={(e) => setDndForm({ ...dndForm, level: parseInt(e.target.value) || 1 })}
                          data-testid="input-dnd-level"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dnd-background">Background</Label>
                        <Select 
                          value={dndForm.background} 
                          onValueChange={(v) => setDndForm({ ...dndForm, background: v })}
                        >
                          <SelectTrigger id="dnd-background" data-testid="select-dnd-background">
                            <SelectValue placeholder="Select background" />
                          </SelectTrigger>
                          <SelectContent>
                            {dnd5eData.backgrounds.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dnd-alignment">Alignment</Label>
                        <Select 
                          value={dndForm.alignment} 
                          onValueChange={(v) => setDndForm({ ...dndForm, alignment: v })}
                        >
                          <SelectTrigger id="dnd-alignment" data-testid="select-dnd-alignment">
                            <SelectValue placeholder="Select alignment" />
                          </SelectTrigger>
                          <SelectContent>
                            {dnd5eData.alignments.map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Ability Scores</Label>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          onClick={rollDnDStats}
                          data-testid="button-roll-dnd-stats"
                        >
                          <Dices className="h-4 w-4 mr-1" />
                          Roll Stats
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {dnd5eData.stats.map((stat, idx) => (
                          <div key={stat} className="space-y-1">
                            <Label htmlFor={`stat-${stat}`} className="text-xs">{stat}</Label>
                            <Input
                              id={`stat-${stat}`}
                              type="number"
                              min={1}
                              max={20}
                              value={dndForm.stats[dnd5eData.statKeys[idx] as keyof typeof dndForm.stats]}
                              onChange={(e) => setDndForm({
                                ...dndForm,
                                stats: {
                                  ...dndForm.stats,
                                  [dnd5eData.statKeys[idx]]: parseInt(e.target.value) || 10
                                }
                              })}
                              data-testid={`input-dnd-${dnd5eData.statKeys[idx]}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Skill Proficiencies */}
                    {(dndForm.race || dndForm.class) && (
                      <div className="space-y-3">
                        <Label>Skill Proficiencies</Label>
                        
                        {/* Racial auto-skills */}
                        {getRaceSkillInfo().autoSkills.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">From Race</p>
                            <div className="flex flex-wrap gap-1">
                              {getRaceSkillInfo().autoSkills.map(skill => (
                                <Badge key={skill} variant="secondary">{skill}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Race bonus skill choices */}
                        {getRaceSkillInfo().bonusChoices && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Choose {getRaceSkillInfo().bonusChoices!.count} from Race ({selectedRaceBonusSkills.length}/{getRaceSkillInfo().bonusChoices!.count})
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {(getRaceSkillInfo().bonusChoices!.from === "any" ? dndSkills : getRaceSkillInfo().bonusChoices!.from as DndSkill[]).map(skill => (
                                <div key={skill} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`race-skill-${skill}`}
                                    checked={selectedRaceBonusSkills.includes(skill as DndSkill)}
                                    onCheckedChange={(checked) => handleRaceBonusSkillToggle(skill as DndSkill, !!checked)}
                                    disabled={getRaceSkillInfo().autoSkills.includes(skill as DndSkill) || selectedClassSkills.includes(skill as DndSkill)}
                                    data-testid={`checkbox-race-skill-${skill}`}
                                  />
                                  <label htmlFor={`race-skill-${skill}`} className="text-sm cursor-pointer">{skill}</label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Class skill choices */}
                        {dndForm.class && classDefinitions[dndForm.class as DndClass] && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Choose {classDefinitions[dndForm.class as DndClass].numSkillChoices} from Class ({selectedClassSkills.length}/{classDefinitions[dndForm.class as DndClass].numSkillChoices})
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {classDefinitions[dndForm.class as DndClass].skillChoices.map(skill => (
                                <div key={skill} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`class-skill-${skill}`}
                                    checked={selectedClassSkills.includes(skill)}
                                    onCheckedChange={(checked) => handleClassSkillToggle(skill, !!checked)}
                                    disabled={getRaceSkillInfo().autoSkills.includes(skill) || selectedRaceBonusSkills.includes(skill)}
                                    data-testid={`checkbox-class-skill-${skill}`}
                                  />
                                  <label htmlFor={`class-skill-${skill}`} className="text-sm cursor-pointer">{skill}</label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Expertise selection (Rogue, Bard, Ranger) */}
                        {getExpertiseFeatures().length > 0 && (
                          <div className="border-t pt-3 mt-2">
                            <p className="text-xs font-medium mb-2">Expertise (double proficiency bonus)</p>
                            {getExpertiseFeatures().map(feature => {
                              const currentLevelSkills = expertiseSkills[feature.level] || [];
                              const proficientSkills = getAllSelectedSkills();
                              const alreadyUsedExpertise = Object.entries(expertiseSkills)
                                .filter(([lvl]) => parseInt(lvl) !== feature.level)
                                .flatMap(([, skills]) => skills);
                              
                              return (
                                <div key={`${feature.level}-${feature.name}`} className="mb-2">
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Level {feature.level}: {feature.name} ({currentLevelSkills.length}/{feature.skillChoices || 2})
                                  </p>
                                  <div className="grid grid-cols-3 gap-2">
                                    {proficientSkills.map(skill => {
                                      const isSelected = currentLevelSkills.includes(skill as DndSkill);
                                      const isUsedElsewhere = alreadyUsedExpertise.includes(skill as DndSkill);
                                      return (
                                        <div key={skill} className="flex items-center gap-2">
                                          <Checkbox
                                            id={`expertise-${feature.level}-${skill}`}
                                            checked={isSelected}
                                            onCheckedChange={(checked) => 
                                              handleExpertiseToggle(feature.level, skill as DndSkill, !!checked, feature.skillChoices || 2)
                                            }
                                            disabled={isUsedElsewhere && !isSelected}
                                            data-testid={`checkbox-expertise-${feature.level}-${skill}`}
                                          />
                                          <label 
                                            htmlFor={`expertise-${feature.level}-${skill}`} 
                                            className={`text-sm cursor-pointer ${isUsedElsewhere && !isSelected ? 'text-muted-foreground' : ''}`}
                                          >
                                            {skill}
                                          </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dnd-hp">Max HP</Label>
                        <Input
                          id="dnd-hp"
                          type="number"
                          min={1}
                          value={dndForm.maxHp}
                          onChange={(e) => setDndForm({ ...dndForm, maxHp: parseInt(e.target.value) || 10 })}
                          data-testid="input-dnd-hp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dnd-ac">AC</Label>
                        <Input
                          id="dnd-ac"
                          type="number"
                          min={0}
                          value={dndForm.ac}
                          onChange={(e) => setDndForm({ ...dndForm, ac: parseInt(e.target.value) || 10 })}
                          data-testid="input-dnd-ac"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dnd-speed">Speed</Label>
                        <Input
                          id="dnd-speed"
                          type="number"
                          min={0}
                          value={dndForm.speed}
                          onChange={(e) => setDndForm({ ...dndForm, speed: parseInt(e.target.value) || 30 })}
                          data-testid="input-dnd-speed"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dnd-init">Init</Label>
                        <Input
                          id="dnd-init"
                          type="number"
                          value={dndForm.initiativeModifier}
                          onChange={(e) => setDndForm({ ...dndForm, initiativeModifier: parseInt(e.target.value) || 0 })}
                          data-testid="input-dnd-init"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dnd-xp">Experience Points (XP)</Label>
                      <Input
                        id="dnd-xp"
                        type="number"
                        min={0}
                        value={dndForm.xp}
                        onChange={(e) => setDndForm({ ...dndForm, xp: parseInt(e.target.value) || 0 })}
                        data-testid="input-dnd-xp"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dnd-backstory">Backstory</Label>
                      <Textarea
                        id="dnd-backstory"
                        value={dndForm.backstory}
                        onChange={(e) => setDndForm({ ...dndForm, backstory: e.target.value })}
                        placeholder="Write your character's backstory..."
                        rows={4}
                        data-testid="input-dnd-backstory"
                      />
                    </div>

                    <div className="flex gap-2">
                      {!editingCharacter && (
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setFormStep("system")}
                        >
                          Back
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-save-dnd-character"
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
                    </div>
                  </form>
                </ScrollArea>
              </>
            ) : selectedSystem === "cyberpunk" ? (
              <>
                <DialogHeader>
                  <DialogTitle>{editingCharacter ? "Edit Cyberpunk Character" : "Create Cyberpunk Character"}</DialogTitle>
                  <DialogDescription>
                    {editingCharacter ? "Update your edgerunner." : "Build your edgerunner for Cyberpunk RED."}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <form onSubmit={handleCyberpunkSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cp-name">Character Name *</Label>
                      <Input
                        id="cp-name"
                        value={cyberpunkForm.characterName}
                        onChange={(e) => setCyberpunkForm({ ...cyberpunkForm, characterName: e.target.value })}
                        placeholder="Enter your handle"
                        data-testid="input-cp-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cp-role">Role</Label>
                        <Select 
                          value={cyberpunkForm.role} 
                          onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, role: v })}
                        >
                          <SelectTrigger id="cp-role" data-testid="select-cp-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {cyberpunkRedData.roles.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cp-level">Rank</Label>
                        <Input
                          id="cp-level"
                          type="number"
                          min={1}
                          max={10}
                          value={cyberpunkForm.level}
                          onChange={(e) => setCyberpunkForm({ ...cyberpunkForm, level: parseInt(e.target.value) || 1 })}
                          data-testid="input-cp-level"
                        />
                      </div>
                    </div>

                    {cyberpunkForm.role && (
                      <p className="text-sm text-muted-foreground">
                        {cyberpunkRedData.roleDescriptions[cyberpunkForm.role as keyof typeof cyberpunkRedData.roleDescriptions]}
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Lifepath</Label>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cp-origin" className="text-sm">Cultural Origin</Label>
                          <Select 
                            value={cyberpunkForm.culturalOrigin} 
                            onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, culturalOrigin: v })}
                          >
                            <SelectTrigger id="cp-origin" data-testid="select-cp-origin">
                              <SelectValue placeholder="Select origin" />
                            </SelectTrigger>
                            <SelectContent>
                              {cyberpunkRedData.culturalOrigins.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cp-personality" className="text-sm">Personality</Label>
                          <Select 
                            value={cyberpunkForm.personality} 
                            onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, personality: v })}
                          >
                            <SelectTrigger id="cp-personality" data-testid="select-cp-personality">
                              <SelectValue placeholder="Select personality" />
                            </SelectTrigger>
                            <SelectContent>
                              {cyberpunkRedData.personalityTraits.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cp-style" className="text-sm">Clothing Style</Label>
                          <Select 
                            value={cyberpunkForm.clothingStyle} 
                            onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, clothingStyle: v })}
                          >
                            <SelectTrigger id="cp-style" data-testid="select-cp-style">
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                            <SelectContent>
                              {cyberpunkRedData.clothingStyles.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cp-hair" className="text-sm">Hairstyle</Label>
                          <Select 
                            value={cyberpunkForm.hairstyle} 
                            onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, hairstyle: v })}
                          >
                            <SelectTrigger id="cp-hair" data-testid="select-cp-hair">
                              <SelectValue placeholder="Select hairstyle" />
                            </SelectTrigger>
                            <SelectContent>
                              {cyberpunkRedData.hairstyles.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cp-valued-person" className="text-sm">Most Valued Person</Label>
                        <Select 
                          value={cyberpunkForm.valuedPerson} 
                          onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, valuedPerson: v })}
                        >
                          <SelectTrigger id="cp-valued-person" data-testid="select-cp-valued-person">
                            <SelectValue placeholder="Who do you value most?" />
                          </SelectTrigger>
                          <SelectContent>
                            {cyberpunkRedData.valuedPerson.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cp-valued-most" className="text-sm">What You Value Most</Label>
                        <Select 
                          value={cyberpunkForm.valuedMost} 
                          onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, valuedMost: v })}
                        >
                          <SelectTrigger id="cp-valued-most" data-testid="select-cp-valued-most">
                            <SelectValue placeholder="What drives you?" />
                          </SelectTrigger>
                          <SelectContent>
                            {cyberpunkRedData.valuedMost.map((v) => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cp-feelings" className="text-sm">Feelings About People</Label>
                        <Select 
                          value={cyberpunkForm.feelingsAboutPeople} 
                          onValueChange={(v) => setCyberpunkForm({ ...cyberpunkForm, feelingsAboutPeople: v })}
                        >
                          <SelectTrigger id="cp-feelings" data-testid="select-cp-feelings">
                            <SelectValue placeholder="How do you feel about people?" />
                          </SelectTrigger>
                          <SelectContent>
                            {cyberpunkRedData.feelingsAboutPeople.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Stats (1-10)</Label>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          onClick={rollCyberpunkStats}
                          data-testid="button-roll-cp-stats"
                        >
                          <Dices className="h-4 w-4 mr-1" />
                          Roll Stats
                        </Button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {cyberpunkRedData.stats.map((stat, idx) => (
                          <div key={stat} className="space-y-1">
                            <Label htmlFor={`cp-stat-${stat}`} className="text-xs" title={cyberpunkRedData.statDescriptions[stat as keyof typeof cyberpunkRedData.statDescriptions]}>
                              {stat}
                            </Label>
                            <Input
                              id={`cp-stat-${stat}`}
                              type="number"
                              min={1}
                              max={10}
                              value={cyberpunkForm.stats[cyberpunkRedData.statKeys[idx] as keyof typeof cyberpunkForm.stats]}
                              onChange={(e) => setCyberpunkForm({
                                ...cyberpunkForm,
                                stats: {
                                  ...cyberpunkForm.stats,
                                  [cyberpunkRedData.statKeys[idx]]: parseInt(e.target.value) || 5
                                }
                              })}
                              data-testid={`input-cp-${cyberpunkRedData.statKeys[idx]}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cp-hp">Hit Points</Label>
                        <Input
                          id="cp-hp"
                          type="number"
                          min={1}
                          value={cyberpunkForm.maxHp}
                          onChange={(e) => setCyberpunkForm({ ...cyberpunkForm, maxHp: parseInt(e.target.value) || 40 })}
                          data-testid="input-cp-hp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cp-xp">Improvement Points (XP)</Label>
                        <Input
                          id="cp-xp"
                          type="number"
                          min={0}
                          value={cyberpunkForm.xp}
                          onChange={(e) => setCyberpunkForm({ ...cyberpunkForm, xp: parseInt(e.target.value) || 0 })}
                          data-testid="input-cp-xp"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cp-backstory">Backstory</Label>
                      <Textarea
                        id="cp-backstory"
                        value={cyberpunkForm.backstory}
                        onChange={(e) => setCyberpunkForm({ ...cyberpunkForm, backstory: e.target.value })}
                        placeholder="How did you end up on the streets of Night City?"
                        rows={4}
                        data-testid="input-cp-backstory"
                      />
                    </div>

                    <div className="flex gap-2">
                      {!editingCharacter && (
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setFormStep("system")}
                        >
                          Back
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-save-cp-character"
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
                    </div>
                  </form>
                </ScrollArea>
              </>
            ) : null}
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
            <Button onClick={openCreateDialog} data-testid="button-create-first-character">
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
                      {character.gameSystem === "cyberpunk" 
                        ? `Rank ${character.level} ${character.class || character.race || "Edgerunner"}`
                        : character.race && character.class
                          ? `Level ${character.level} ${character.race} ${character.class}`
                          : character.class || character.race || `Level ${character.level}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary">
                      {gameSystemLabels[character.gameSystem as GameSystem] || character.gameSystem}
                    </Badge>
                    {character.currentRoomCode && (
                      <Badge variant="outline" className="text-xs" data-testid={`badge-in-game-${character.id}`}>
                        In Game
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 flex-wrap">
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
                <CharacterInventory characterId={character.id} />
                <div className="flex items-center gap-2 flex-wrap mt-4">
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

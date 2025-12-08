
import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Dice6, Users, Copy, Check, Loader2, MessageSquare, User, XCircle, Save, Eye, Package, Trash2, LogOut, Plus, Sparkles, Swords, Globe, UserX, Shield, SkipForward, StopCircle, Download, FolderOpen, Coins, Weight, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Message, type Room, type Player, type Character, type InventoryItem, type Item, type SavedCharacter, type CharacterStatusEffect, gameSystemLabels, type GameSystem, statusEffectDefinitions } from "@shared/schema";
import { SpellBrowser } from "@/components/spell-browser";
import { FloatingCharacterPanel } from "@/components/floating-character-panel";
import { DMControlsPanel } from "@/components/dm-controls-panel";
import { Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface InitiativeEntry {
  playerId: string;
  playerName: string;
  characterName: string;
  roll: number;
  modifier: number;
  total: number;
}

interface CombatState {
  isActive: boolean;
  currentTurnIndex: number;
  initiatives: InitiativeEntry[];
}

interface ParsedMessagePart {
  type: "text" | "item";
  content: string;
  item?: Item;
}

function formatTimestamp(timestamp: string | number | Date): string {
  if (!timestamp) return "";
  try {
    let date: Date;
    if (typeof timestamp === "string") {
      const numericValue = Number(timestamp);
      if (!isNaN(numericValue) && numericValue > 0) {
        date = new Date(numericValue);
      } else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === "number") {
      date = new Date(timestamp);
    } else {
      date = timestamp;
    }
    if (isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString();
  } catch {
    return "";
  }
}

function parseMessageForItems(content: string, itemNameMap: Map<string, Item>): ParsedMessagePart[] {
  if (itemNameMap.size === 0) {
    return [{ type: "text", content }];
  }

  const sortedItemNames = Array.from(itemNameMap.keys()).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `\\b(${sortedItemNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );

  const parts: ParsedMessagePart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    const matchedText = match[0];
    const item = itemNameMap.get(matchedText.toLowerCase());
    if (item) {
      parts.push({ type: "item", content: matchedText, item });
    } else {
      parts.push({ type: "text", content: matchedText });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content }];
}

function ItemTooltipContent({ item }: { item: Item }) {
  const properties = item.properties as any;
  
  const damageDice = properties?.damage?.damage_dice;
  const damageType = properties?.damage?.damage_type?.name;
  const armorBase = properties?.armor_class?.base;
  const armorDexBonus = properties?.armor_class?.dex_bonus;
  const armorMaxBonus = properties?.armor_class?.max_bonus;
  const cost = properties?.cost;
  const weight = properties?.weight;
  const weaponProperties = properties?.properties as Array<{ name: string }> | undefined;
  
  const hasWeaponInfo = damageDice && typeof damageDice === 'string';
  const hasArmorInfo = typeof armorBase === 'number';
  const hasCost = cost && typeof cost.quantity === 'number' && cost.unit;
  const hasWeight = typeof weight === 'number';
  const hasProperties = weaponProperties && Array.isArray(weaponProperties) && weaponProperties.length > 0;

  return (
    <div className="space-y-1 text-xs" data-testid={`item-tooltip-${item.id}`}>
      <div className="font-medium">{item.name}</div>
      {hasWeaponInfo && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Swords className="h-3 w-3" />
          <span>{damageDice}{damageType ? ` ${damageType}` : ""}</span>
        </div>
      )}
      {hasArmorInfo && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>AC {armorBase}{armorDexBonus ? ` + DEX${armorMaxBonus ? ` (max ${armorMaxBonus})` : ""}` : ""}</span>
        </div>
      )}
      {hasProperties && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span>{weaponProperties.filter(p => p?.name).map(p => p.name).join(", ")}</span>
        </div>
      )}
      {hasWeight && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Weight className="h-3 w-3" />
          <span>{weight} lb</span>
        </div>
      )}
      {hasCost && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Coins className="h-3 w-3" />
          <span>{cost.quantity} {cost.unit}</span>
        </div>
      )}
    </div>
  );
}

interface MessageContentProps {
  content: string;
  itemNameMap: Map<string, Item>;
  isDmMessage: boolean;
  onPickupItem: (item: Item) => void;
  canPickup: boolean;
  isPickingUp: boolean;
}

function MessageContent({ content, itemNameMap, isDmMessage, onPickupItem, canPickup, isPickingUp }: MessageContentProps) {
  const parts = parseMessageForItems(content, itemNameMap);
  
  if (parts.length === 1 && parts[0].type === "text") {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.content}</span>;
        }
        const badge = (
          <Badge
            variant="outline"
            className={cn(
              "font-medium cursor-default border-primary/50 bg-primary/10 text-primary",
              isDmMessage && canPickup && "cursor-pointer"
            )}
            data-testid={`item-badge-${part.item?.id}`}
          >
            <Package className="h-3 w-3 mr-1" />
            {part.content}
            {isDmMessage && canPickup && part.item && (
              <span
                className="inline-flex items-center justify-center ml-1 cursor-pointer hover-elevate active-elevate-2 rounded-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPickingUp) onPickupItem(part.item!);
                }}
                data-testid={`button-pickup-${part.item.id}`}
              >
                <Plus className="h-3 w-3" />
              </span>
            )}
          </Badge>
        );

        if (!part.item) {
          return (
            <span key={index} className="inline-flex items-center gap-1">
              {badge}
            </span>
          );
        }

        return (
          <span 
            key={index}
            className="inline-flex items-center gap-1"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                {badge}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <ItemTooltipContent item={part.item} />
              </TooltipContent>
            </Tooltip>
          </span>
        );
      })}
    </span>
  );
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [gameEnded, setGameEnded] = useState(false);
  const [isRoomPublic, setIsRoomPublic] = useState(false);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  
  // Floating character panel state
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [liveHp, setLiveHp] = useState<{ current: number; max: number } | null>(null);
  
  // View other player's character state
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);
  
  // Load saved character dialog state
  const [showLoadCharacterDialog, setShowLoadCharacterDialog] = useState(false);
  
  // Character death dialog state
  const [showDeathDialog, setShowDeathDialog] = useState(false);
  
  // Character form state
  const [characterName, setCharacterName] = useState("");
  const [characterStats, setCharacterStats] = useState<Record<string, any>>({});
  const [characterNotes, setCharacterNotes] = useState("");
  
  // Player info from session storage (read reactively to handle navigation timing)
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem("playerName") || "Anonymous");
  const [playerId, setPlayerId] = useState(() => sessionStorage.getItem("playerId") || "");
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | undefined>(user?.id);
  
  // Keep userIdRef up to date without triggering WebSocket reconnection
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);
  
  // Re-read session storage on mount to catch values written during navigation
  useEffect(() => {
    const storedPlayerName = sessionStorage.getItem("playerName");
    const storedPlayerId = sessionStorage.getItem("playerId");
    if (storedPlayerName && storedPlayerName !== playerName) {
      setPlayerName(storedPlayerName);
    }
    if (storedPlayerId && storedPlayerId !== playerId) {
      setPlayerId(storedPlayerId);
    }
  }, []);

  const { data: roomData, isLoading, error } = useQuery<Room & { players: Player[]; characters: Character[] }>({
    queryKey: ["/api/rooms", code],
    enabled: !!code,
  });

  // Get all characters from room data (already fetched with room info)
  const allCharacters = roomData?.characters || [];
  
  // Use roomData.players for display (most up-to-date after refetch), fallback to state for WebSocket updates
  const displayPlayers = roomData?.players || players;

  // Find current player's character from room data (characters link via playerId)
  const existingCharacter = allCharacters.find(c => c.playerId === playerId);

  // Find character for viewed player (match character's playerId to player's id)
  const viewingPlayer = displayPlayers.find(p => p.id === viewingPlayerId);
  const viewedCharacter = viewingPlayer 
    ? allCharacters.find(c => c.playerId === viewingPlayer.id) 
    : undefined;
  const isLoadingViewedCharacter = isLoading;

  // Fetch all items for item name detection in chat
  const { data: allItems } = useQuery<Item[]>({
    queryKey: ["/api/items"],
    staleTime: 1000 * 60 * 10,
  });

  // Fetch saved characters for authenticated user
  const { data: savedCharacters, isLoading: isLoadingSavedCharacters } = useQuery<SavedCharacter[]>({
    queryKey: ["/api/saved-characters"],
    enabled: !!user && (showLoadCharacterDialog || showDeathDialog),
  });

  // Fetch current player's room character data (unified model)
  interface MyCharacterData {
    roomCharacter: SavedCharacter;
    savedCharacter: SavedCharacter;
    statusEffects: CharacterStatusEffect[];
  }
  const { data: myCharacterData, isLoading: isLoadingMyCharacter } = useQuery<MyCharacterData>({
    queryKey: ["/api/rooms", code, "my-character"],
    enabled: !!code && !!user,
  });

  // Fetch inventory for current character from saved character (with joined item details)
  type InventoryWithItem = InventoryItem & { item: Item };
  const savedCharacterId = myCharacterData?.savedCharacter?.id;
  const { data: inventory, isLoading: isLoadingInventory, refetch: refetchInventory } = useQuery<InventoryWithItem[]>({
    queryKey: ["/api/saved-characters", savedCharacterId, "inventory"],
    enabled: !!savedCharacterId,
  });

  // Build a map of item names (lowercase) to item data for quick lookup
  const itemNameMap = allItems?.reduce((acc, item) => {
    acc.set(item.name.toLowerCase(), item);
    return acc;
  }, new Map<string, Item>()) ?? new Map<string, Item>();

  // Function to load a saved character into the form
  const loadSavedCharacter = (savedChar: SavedCharacter) => {
    setCharacterName(savedChar.characterName);
    setCharacterStats({
      ...savedChar.stats,
      maxHp: savedChar.maxHp,
      currentHp: savedChar.maxHp,
      ac: savedChar.ac,
      speed: savedChar.speed,
      initiativeModifier: savedChar.initiativeModifier,
      class: savedChar.class,
      race: savedChar.race,
      level: savedChar.level,
      background: savedChar.background,
      alignment: savedChar.alignment,
      skills: savedChar.skills || [],
      spells: savedChar.spells || [],
    });
    setCharacterNotes(savedChar.backstory || "");
    setShowLoadCharacterDialog(false);
    toast({
      title: "Character loaded",
      description: `${savedChar.characterName} has been loaded into the form. Remember to save!`,
    });
  };

  // Load character data when it exists
  useEffect(() => {
    if (existingCharacter) {
      setCharacterName(existingCharacter.characterName);
      setCharacterStats({
        ...(existingCharacter.stats || {}),
        skills: (existingCharacter as any).skills || [],
        spells: (existingCharacter as any).spells || [],
      });
      setCharacterNotes(existingCharacter.backstory || "");
    }
  }, [existingCharacter]);

  const saveCharacterMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rooms/${code}/characters`, {
        playerId,
        name: characterName,
        stats: characterStats,
        notes: characterNotes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate the main room query to refresh the characters list
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", code] });
      if (existingCharacter?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/characters", existingCharacter.id] });
        queryClient.invalidateQueries({ queryKey: ["inventory", existingCharacter.id] });
      }
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/characters", data.id] });
        queryClient.invalidateQueries({ queryKey: ["inventory", data.id] });
      }
      const newCurrentHp = characterStats.currentHp ?? 0;
      const newMaxHp = characterStats.maxHp ?? 1;
      setLiveHp({ current: newCurrentHp, max: newMaxHp });
      toast({
        title: "Character saved",
        description: "Your character has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save character",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const switchCharacterMutation = useMutation({
    mutationFn: async (savedCharacterId: string) => {
      const response = await apiRequest("POST", `/api/rooms/${code}/switch-character`, {
        savedCharacterId,
        playerName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", code, "my-character"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", code, "room-characters"] });
      setShowDeathDialog(false);
      toast({
        title: "Character switched",
        description: "You are now playing with a new character!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to switch character",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentPlayer = displayPlayers.find(p => p.id === playerId);
  const isHost = currentPlayer?.isHost || roomData?.hostName === playerName;
  
  // Combat turn check - determine if current player can send messages
  const currentTurnEntry = combatState?.isActive 
    ? combatState.initiatives[combatState.currentTurnIndex] 
    : null;
  const isMyTurn = !combatState?.isActive || isHost || currentTurnEntry?.playerName === playerName;
  const isCombatActive = combatState?.isActive ?? false;
  const currentTurnCharacterName = currentTurnEntry?.characterName || "another player";

  const deleteInventoryItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!savedCharacterId) throw new Error("No character");
      const response = await apiRequest("DELETE", `/api/saved-characters/${savedCharacterId}/inventory/${itemId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters", savedCharacterId, "inventory"] });
      toast({
        title: "Item removed",
        description: "The item has been removed from your inventory.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to remove item",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const dropInventoryItemMutation = useMutation({
    mutationFn: async (item: InventoryItem & { item: Item }) => {
      if (!savedCharacterId) throw new Error("No character");
      const response = await apiRequest("DELETE", `/api/saved-characters/${savedCharacterId}/inventory/${item.id}`);
      await response.json();
      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters", savedCharacterId, "inventory"] });
      if (wsRef.current?.readyState === WebSocket.OPEN && !gameEnded) {
        wsRef.current.send(JSON.stringify({
          type: "drop_item",
          itemId: item.id,
          itemName: item.item.name,
          quantity: item.quantity,
        }));
      }
    },
    onError: () => {
      toast({
        title: "Failed to drop item",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  const addInventoryItemMutation = useMutation({
    mutationFn: async (data: { name: string; quantity: number }) => {
      if (!savedCharacterId) throw new Error("No character");
      const response = await apiRequest("POST", `/api/saved-characters/${savedCharacterId}/inventory`, {
        itemName: data.name,
        quantity: data.quantity,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters", savedCharacterId, "inventory"] });
      toast({
        title: "Item added",
        description: "The item has been added to your inventory.",
      });
      setNewItemName("");
      setNewItemQuantity(1);
      setShowAddItemForm(false);
    },
    onError: () => {
      toast({
        title: "Failed to add item",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const pickupItemMutation = useMutation({
    mutationFn: async (data: { itemId: string; itemName: string }) => {
      if (!savedCharacterId) throw new Error("No character to add item to");
      const response = await apiRequest("POST", `/api/saved-characters/${savedCharacterId}/inventory`, {
        itemId: data.itemId,
        quantity: 1,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-characters", savedCharacterId, "inventory"] });
      toast({
        title: "Item picked up",
        description: `${variables.itemName} has been added to your inventory.`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to pick up item",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const endGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rooms/${code}/end`, { hostName: playerName });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Game ended",
        description: "The game has been closed.",
      });
      sessionStorage.removeItem("lastRoomCode");
      sessionStorage.removeItem("playerName");
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Failed to end game",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const leaveGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rooms/${code}/leave`, { playerId, playerName });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Left game",
        description: "You have left the game.",
      });
      sessionStorage.removeItem("lastRoomCode");
      sessionStorage.removeItem("playerName");
      sessionStorage.removeItem("playerId");
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Failed to leave game",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const kickPlayerMutation = useMutation({
    mutationFn: async (data: { playerId: string; playerName: string }) => {
      const response = await apiRequest("POST", `/api/rooms/${code}/kick`, {
        hostName: playerName,
        playerId: data.playerId,
        playerName: data.playerName,
      });
      return response.json();
    },
    onSuccess: (_, data) => {
      toast({
        title: "Player kicked",
        description: `${data.playerName} has been removed from the game.`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to kick player",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const response = await apiRequest("POST", `/api/rooms/${code}/visibility`, {
        hostName: playerName,
        isPublic: newValue,
      });
      return response.json();
    },
    onSuccess: (_, newValue) => {
      setIsRoomPublic(newValue);
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", code] });
      toast({
        title: newValue ? "Room is now public" : "Room is now private",
        description: newValue
          ? "Anyone can find and join your game."
          : "Only players with the code can join.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to change visibility",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (roomData) {
      setMessages(roomData.messageHistory || []);
      setPlayers(roomData.players || []);
      setGameEnded(!roomData.isActive);
      setIsRoomPublic(roomData.isPublic || false);
      sessionStorage.setItem("lastRoomCode", code || "");
    }
  }, [roomData, code]);

  useEffect(() => {
    // Wait for auth to resolve before connecting (prevents stale user?.id in closures)
    if (!code || !playerName || isAuthLoading) return;

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleaningUp = false;

    const getReconnectDelay = () => {
      return Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    };

    const connectWebSocket = async () => {
      if (isCleaningUp) return;
      
      setIsConnecting(true);
      
      // First, ping health endpoint to ensure server is awake (helps with cold starts)
      try {
        console.log("[WebSocket] Pinging server health endpoint...");
        const healthResponse = await fetch("/api/health");
        if (!healthResponse.ok) {
          console.warn("[WebSocket] Health check failed, attempting WebSocket anyway");
        } else {
          const health = await healthResponse.json();
          console.log("[WebSocket] Server health:", health);
        }
      } catch (error) {
        console.warn("[WebSocket] Health check error:", error);
      }
      
      if (isCleaningUp) return;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?room=${code}`;
      
      console.log(`[WebSocket] Connecting to ${wsUrl} (attempt ${reconnectAttempts + 1})`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        reconnectAttempts = 0;
        setIsConnected(true);
        setIsConnecting(false);
        ws.send(JSON.stringify({ type: "get_combat_state" }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Handle chat/action/roll/dm/system messages directly from broadcast
        if (data.type === "chat" || data.type === "action" || data.type === "roll" || data.type === "dm" || data.type === "system") {
          const newMessage: Message = {
            id: data.id || crypto.randomUUID(),
            roomId: data.roomId || "",
            playerName: data.playerName || "System",
            content: data.content,
            type: data.type,
            timestamp: data.timestamp?.toString() || Date.now().toString(),
            diceResult: data.diceResult,
          };
          setMessages((prev) => [...prev, newMessage]);
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === "player_joined") {
          setPlayers((prev) => [...prev, data.player]);
        } else if (data.type === "game_ended") {
          setGameEnded(true);
          toast({
            title: "Game ended",
            description: "The host has ended this game session.",
          });
        } else if (data.type === "inventory_update") {
          if (data.playerId === playerId && existingCharacter?.id) {
            queryClient.invalidateQueries({ queryKey: ["/api/characters", existingCharacter.id, "inventory"] });
          }
        } else if (data.type === "player_left") {
          setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
        } else if (data.type === "player_kicked") {
          setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
          if (data.playerId === playerId) {
            toast({
              title: "You were kicked",
              description: "The host has removed you from the game.",
              variant: "destructive",
            });
            sessionStorage.removeItem("lastRoomCode");
            sessionStorage.removeItem("playerName");
            sessionStorage.removeItem("playerId");
            setLocation("/");
          }
        } else if (data.type === "combat_update") {
          setCombatState(data.combat);
        } else if (data.type === "character_update") {
          // Check if this update is for the current user's character using ref for latest value
          const isMyCharacter = data.playerId === userIdRef.current;
          if (isMyCharacter) {
            setLiveHp({ current: data.currentHp, max: data.maxHp });
          }
          // Always invalidate queries to update the UI for all viewers
          queryClient.invalidateQueries({ queryKey: ["/api/rooms", code, "my-character"] });
          queryClient.invalidateQueries({ queryKey: ["/api/rooms", code, "room-characters"] });
          queryClient.invalidateQueries({ queryKey: ["/api/rooms", code] });
        } else if (data.type === "error") {
          toast({
            title: "Error",
            description: data.content,
            variant: "destructive",
          });
        }
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Connection closed: code=${event.code}, reason=${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        
        if (!isCleaningUp && reconnectAttempts < maxReconnectAttempts) {
          const delay = getReconnectDelay();
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          reconnectAttempts++;
          setIsConnecting(true);
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.log("[WebSocket] Max reconnection attempts reached");
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        setIsConnected(false);
        setIsConnecting(false);
      };
    };

    connectWebSocket();

    return () => {
      isCleaningUp = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [code, playerName, isAuthLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || gameEnded) return;

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

  const startCombat = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_combat" }));
    }
  };

  const nextTurn = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next_turn" }));
    }
  };

  const endCombat = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_combat" }));
    }
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
      <aside className="w-64 h-full border-r flex flex-col bg-muted/30 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-bold font-serif text-lg truncate" data-testid="text-room-name">
            {roomData.name}
          </h2>
          <Badge variant="secondary" className="mt-1">
            {gameSystemLabels[roomData.gameSystem as GameSystem]}
          </Badge>
          {gameEnded && (
            <Badge variant="destructive" className="mt-1 ml-2">
              Ended
            </Badge>
          )}
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
            <span className="text-sm font-medium">Players ({displayPlayers.length})</span>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {displayPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`player-${player.id}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("px-2 py-1 h-auto flex-1 text-left justify-start", player.name === playerName && "font-medium")}
                    onClick={() => setViewingPlayerId(player.id)}
                    data-testid={`button-view-player-${player.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">
                      {player.name}
                      {allCharacters?.find(c => (c as any).userId === player.userId)?.characterName && (
                        <span className="text-muted-foreground ml-1">
                          ({allCharacters.find(c => (c as any).userId === player.userId)!.characterName})
                        </span>
                      )}
                    </span>
                  </Button>
                  {player.isHost && <Badge variant="outline">Host</Badge>}
                  {isHost && !player.isHost && !gameEnded && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => kickPlayerMutation.mutate({ playerId: player.id, playerName: player.name })}
                      disabled={kickPlayerMutation.isPending}
                      data-testid={`button-kick-player-${player.id}`}
                    >
                      <UserX className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Combat</span>
          </div>
          
          {combatState?.isActive ? (
            <div className="space-y-2">
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {combatState.initiatives.map((entry, idx) => (
                    <div
                      key={entry.playerId}
                      className={cn(
                        "flex items-center justify-between text-sm px-2 py-1 rounded",
                        idx === combatState.currentTurnIndex && "bg-primary/20 font-medium"
                      )}
                      data-testid={`initiative-${entry.playerId}`}
                    >
                      <span className="truncate flex-1">
                        {idx + 1}. {entry.characterName}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {entry.total}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {isHost && !gameEnded && (
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={nextTurn}
                    data-testid="button-next-turn"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Next
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={endCombat}
                    data-testid="button-end-combat"
                  >
                    <StopCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            isHost && !gameEnded && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={startCombat}
                data-testid="button-start-combat"
              >
                <Swords className="h-4 w-4 mr-2" />
                Start Combat
              </Button>
            )
          )}
          
          {!combatState?.isActive && !isHost && (
            <p className="text-xs text-muted-foreground">No active combat</p>
          )}
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"
            )} />
            <span className="text-muted-foreground">
              {isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}
            </span>
          </div>
          
          {isHost && !gameEnded && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Public game</span>
              </div>
              <Switch
                checked={isRoomPublic}
                onCheckedChange={(checked) => toggleVisibilityMutation.mutate(checked)}
                disabled={toggleVisibilityMutation.isPending}
                data-testid="switch-public"
              />
            </div>
          )}
          
          {isHost && !gameEnded && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => endGameMutation.mutate()}
              disabled={endGameMutation.isPending}
              data-testid="button-end-game"
            >
              {endGameMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              End Game
            </Button>
          )}
          
          {!isHost && !gameEnded && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => leaveGameMutation.mutate()}
              disabled={leaveGameMutation.isPending}
              data-testid="button-leave-game"
            >
              {leaveGameMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Leave Game
            </Button>
          )}
          
          {gameEnded && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                window.open(`/api/rooms/${code}/pdf`, '_blank');
              }}
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Adventure PDF
            </Button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="sticky top-0 z-50 border-b px-4 bg-background flex items-center justify-between gap-2">
            <TabsList className="h-12">
              <TabsTrigger value="chat" className="gap-2" data-testid="tab-chat">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="character" className="gap-2" data-testid="tab-character">
                <User className="h-4 w-4" />
                Character
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2" data-testid="tab-inventory">
                <Package className="h-4 w-4" />
                Inventory
              </TabsTrigger>
              {roomData?.gameSystem === "dnd" && (
                <TabsTrigger value="skills" className="gap-2" data-testid="tab-skills">
                  <Swords className="h-4 w-4" />
                  Skills & Spells
                </TabsTrigger>
              )}
              {isHost && (
                <TabsTrigger value="dm" className="gap-2" data-testid="tab-dm-controls">
                  <Shield className="h-4 w-4" />
                  DM
                </TabsTrigger>
              )}
            </TabsList>
            <Button
              variant={showCharacterPanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCharacterPanel(!showCharacterPanel)}
              data-testid="button-toggle-character-panel"
            >
              <Heart className="h-4 w-4 mr-2" />
              {liveHp ? `${liveHp.current}/${liveHp.max}` : "HP"}
            </Button>
          </div>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="flex-1 min-h-0 p-4">
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
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                    )}
                    <p>
                      <MessageContent
                        content={message.content}
                        itemNameMap={itemNameMap}
                        isDmMessage={message.type === "dm"}
                        onPickupItem={(item) => pickupItemMutation.mutate({ itemId: item.id, itemName: item.name })}
                        canPickup={!!existingCharacter?.id && !gameEnded}
                        isPickingUp={pickupItemMutation.isPending}
                      />
                    </p>
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

            {roomData?.gameSystem === "dnd" && existingCharacter && characterStats.str && (
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-2">Quick Roll:</span>
                  {[
                    { stat: "str", label: "STR" },
                    { stat: "dex", label: "DEX" },
                    { stat: "con", label: "CON" },
                    { stat: "int", label: "INT" },
                    { stat: "wis", label: "WIS" },
                    { stat: "cha", label: "CHA" },
                  ].map(({ stat, label }) => {
                    const value = characterStats[stat] || 10;
                    const modifier = Math.floor((value - 10) / 2);
                    const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                    return (
                      <Button
                        key={stat}
                        variant="outline"
                        size="sm"
                        disabled={!isConnected || gameEnded || (!isMyTurn && isCombatActive)}
                        onClick={() => {
                          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({
                              type: "chat",
                              content: `/roll 1d20${modifierStr}`,
                            }));
                          }
                        }}
                        data-testid={`button-quick-roll-${stat}`}
                      >
                        {label} ({modifierStr})
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={sendMessage} className="p-4 flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  gameEnded 
                    ? "Game has ended" 
                    : (!isMyTurn && isCombatActive)
                      ? `Waiting for ${currentTurnCharacterName}'s turn...`
                      : "Type a message... (use /roll 2d6+3 for dice, *asterisks* for actions)"
                }
                disabled={!isConnected || gameEnded || (!isMyTurn && isCombatActive)}
                data-testid="input-chat-message"
              />
              <Button 
                type="submit" 
                disabled={!isConnected || !inputValue.trim() || gameEnded || (!isMyTurn && isCombatActive)}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="character" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
            <div className="max-w-2xl mx-auto space-y-4 p-4">
              {isLoadingMyCharacter ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !myCharacterData ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-serif text-xl mb-2">No Character in This Game</h3>
                    <p className="text-muted-foreground mb-4">
                      You need to select a character to join this game.
                    </p>
                    <Button onClick={() => setLocation("/characters")} data-testid="button-go-to-characters">
                      Manage Characters
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="font-serif text-2xl" data-testid="text-character-name">
                          {myCharacterData.savedCharacter.characterName}
                        </CardTitle>
                        <p className="text-muted-foreground" data-testid="text-character-class-race">
                          Level {myCharacterData.savedCharacter.level || 1}{" "}
                          {myCharacterData.savedCharacter.race && `${myCharacterData.savedCharacter.race} `}
                          {myCharacterData.savedCharacter.class || "Adventurer"}
                        </p>
                      </div>
                      {!myCharacterData.roomCharacter.isAlive && (
                        <Badge variant="destructive" className="text-sm" data-testid="badge-dead">
                          <XCircle className="h-3 w-3 mr-1" />
                          Dead
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!myCharacterData.roomCharacter.isAlive && (
                      <Card className="border-destructive bg-destructive/5">
                        <CardContent className="py-4">
                          <div className="flex items-center gap-4">
                            <XCircle className="h-8 w-8 text-destructive shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium">Your character has fallen</h4>
                              <p className="text-sm text-muted-foreground">
                                You can continue watching or bring in a new character.
                              </p>
                            </div>
                            <Button 
                              onClick={() => setShowDeathDialog(true)}
                              data-testid="button-switch-character"
                            >
                              <User className="h-4 w-4 mr-2" />
                              New Character
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Heart className="h-4 w-4 text-destructive" />
                          Hit Points
                        </span>
                        <span className="text-sm font-mono" data-testid="text-hp-display">
                          {myCharacterData.roomCharacter.currentHp} / {myCharacterData.savedCharacter.maxHp}
                          {myCharacterData.roomCharacter.temporaryHp > 0 && (
                            <span className="text-primary ml-1">
                              (+{myCharacterData.roomCharacter.temporaryHp} temp)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-destructive transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(0, (myCharacterData.roomCharacter.currentHp / myCharacterData.savedCharacter.maxHp) * 100))}%`,
                          }}
                          data-testid="progress-hp"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-ac">{myCharacterData.savedCharacter.ac}</div>
                        <div className="text-xs text-muted-foreground">AC</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-speed">{myCharacterData.savedCharacter.speed} ft</div>
                        <div className="text-xs text-muted-foreground">Speed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-initiative">
                          {myCharacterData.savedCharacter.initiativeModifier >= 0 ? "+" : ""}
                          {myCharacterData.savedCharacter.initiativeModifier}
                        </div>
                        <div className="text-xs text-muted-foreground">Initiative</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-gold">{myCharacterData.roomCharacter.gold}</div>
                        <div className="text-xs text-muted-foreground">Gold</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 rounded-md bg-muted/50">
                        <div className="text-xl font-bold" data-testid="text-total-xp">{myCharacterData.savedCharacter.xp || 0}</div>
                        <div className="text-xs text-muted-foreground">XP</div>
                      </div>
                      <div className="p-3 rounded-md bg-muted/50">
                        <div className="text-xl font-bold" data-testid="text-level">{myCharacterData.savedCharacter.level || 1}</div>
                        <div className="text-xs text-muted-foreground">Level</div>
                      </div>
                    </div>

                    {myCharacterData.savedCharacter.stats && Object.keys(myCharacterData.savedCharacter.stats).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-3">Ability Scores</h4>
                          <div className="grid grid-cols-6 gap-2">
                            {[
                              { key: "str", long: "strength", label: "STR" },
                              { key: "dex", long: "dexterity", label: "DEX" },
                              { key: "con", long: "constitution", label: "CON" },
                              { key: "int", long: "intelligence", label: "INT" },
                              { key: "wis", long: "wisdom", label: "WIS" },
                              { key: "cha", long: "charisma", label: "CHA" },
                            ].map((stat) => {
                              const stats = myCharacterData.savedCharacter.stats as Record<string, number>;
                              const value = stats?.[stat.key] ?? stats?.[stat.long] ?? 10;
                              const modifier = Math.floor((value - 10) / 2);
                              return (
                                <div key={stat.key} className="text-center p-2 rounded-md bg-muted/50">
                                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                                  <div className="text-lg font-bold" data-testid={`text-stat-${stat.key}`}>{value}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ({modifier >= 0 ? "+" : ""}{modifier})
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {myCharacterData.statusEffects && myCharacterData.statusEffects.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Active Status Effects
                          </h4>
                          <div className="space-y-2">
                            {myCharacterData.statusEffects.map((effect) => (
                              <div
                                key={effect.id}
                                className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
                                data-testid={`status-effect-${effect.id}`}
                              >
                                <Badge variant={effect.isPredefined ? "secondary" : "outline"} className="shrink-0">
                                  {effect.name}
                                </Badge>
                                <div className="flex-1 text-sm text-muted-foreground">
                                  {effect.description}
                                  {effect.duration && (
                                    <span className="ml-2 text-xs">({effect.duration})</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {myCharacterData.savedCharacter.skills && (myCharacterData.savedCharacter.skills as string[]).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-3">Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {(myCharacterData.savedCharacter.skills as string[]).map((skill, idx) => (
                              <Badge key={idx} variant="outline" data-testid={`badge-skill-${idx}`}>
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {myCharacterData.savedCharacter.spells && (myCharacterData.savedCharacter.spells as string[]).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Spells
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {(myCharacterData.savedCharacter.spells as string[]).map((spell, idx) => (
                              <Badge key={idx} variant="secondary" data-testid={`badge-spell-${idx}`}>
                                {spell}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {myCharacterData.savedCharacter.backstory && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Backstory</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-backstory">
                            {myCharacterData.savedCharacter.backstory}
                          </p>
                        </div>
                      </>
                    )}

                    {myCharacterData.roomCharacter.notes && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Session Notes</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-session-notes">
                            {myCharacterData.roomCharacter.notes}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
            <div className="max-w-2xl mx-auto space-y-4 p-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Inventory
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Track your items here.
                      {isHost && " Use /give @PlayerName ItemName x Quantity to grant items to players."}
                    </p>
                  </div>
                  {myCharacterData && (
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddItemForm(!showAddItemForm)}
                      data-testid="button-add-item"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {showAddItemForm && myCharacterData && (
                    <div className="mb-4 p-3 border rounded-md space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Item name"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          data-testid="input-new-item-name"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                          className="w-20"
                          data-testid="input-new-item-quantity"
                        />
                        <Button
                          onClick={() => addInventoryItemMutation.mutate({ name: newItemName, quantity: newItemQuantity })}
                          disabled={!newItemName.trim() || addInventoryItemMutation.isPending}
                          data-testid="button-submit-add-item"
                        >
                          {addInventoryItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {!myCharacterData ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Create a character first to see your inventory.</p>
                      <Button 
                        variant="outline" 
                        className="mt-2"
                        onClick={() => setActiveTab("character")}
                        data-testid="button-go-to-character"
                      >
                        Go to Character Tab
                      </Button>
                    </div>
                  ) : isLoadingInventory ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : inventory && inventory.length > 0 ? (
                    <div className="space-y-2">
                      {inventory.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-3 border rounded-md"
                          data-testid={`inventory-item-${item.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" data-testid={`text-item-name-${item.id}`}>{item.item.name}</span>
                              {item.quantity > 1 && (
                                <Badge variant="secondary" data-testid={`badge-quantity-${item.id}`}>
                                  x{item.quantity}
                                </Badge>
                              )}
                            </div>
                            {item.item.description && (
                              <p className="text-sm text-muted-foreground mt-1">{item.item.description}</p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Note: {item.notes}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteInventoryItemMutation.mutate(item.id)}
                            disabled={deleteInventoryItemMutation.isPending}
                            data-testid={`button-delete-item-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Your inventory is empty.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The DM can grant you items during the game.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {roomData?.gameSystem === "dnd" && (
            <TabsContent value="skills" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
              <div className="max-w-2xl mx-auto space-y-4 p-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Swords className="h-5 w-5" />
                      Skills
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Click "Use" to tell the AI DM you're attempting that skill check.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { name: "Acrobatics", stat: "dex" },
                        { name: "Animal Handling", stat: "wis" },
                        { name: "Arcana", stat: "int" },
                        { name: "Athletics", stat: "str" },
                        { name: "Deception", stat: "cha" },
                        { name: "History", stat: "int" },
                        { name: "Insight", stat: "wis" },
                        { name: "Intimidation", stat: "cha" },
                        { name: "Investigation", stat: "int" },
                        { name: "Medicine", stat: "wis" },
                        { name: "Nature", stat: "int" },
                        { name: "Perception", stat: "wis" },
                        { name: "Performance", stat: "cha" },
                        { name: "Persuasion", stat: "cha" },
                        { name: "Religion", stat: "int" },
                        { name: "Sleight of Hand", stat: "dex" },
                        { name: "Stealth", stat: "dex" },
                        { name: "Survival", stat: "wis" },
                      ].map((skill) => {
                        const statNameMap: Record<string, string> = {
                          str: "strength",
                          dex: "dexterity", 
                          con: "constitution",
                          int: "intelligence",
                          wis: "wisdom",
                          cha: "charisma",
                        };
                        const fullStatName = statNameMap[skill.stat] || skill.stat;
                        const statValue = characterStats[fullStatName] || characterStats[skill.stat] || 10;
                        const modifier = Math.floor((statValue - 10) / 2);
                        const proficiencyBonus = Math.ceil(1 + (characterStats.level || 1) / 4);
                        const skillsArray = Array.isArray(characterStats.skills) ? characterStats.skills : [];
                        const isProficient = skillsArray.includes(skill.name) || characterStats[`skill_${skill.name.replace(/\s/g, "_").toLowerCase()}`] || false;
                        const totalMod = modifier + (isProficient ? proficiencyBonus : 0);
                        return (
                          <div 
                            key={skill.name} 
                            className="flex items-center justify-between p-2 border rounded-md gap-2"
                            data-testid={`skill-${skill.name.replace(/\s/g, "-").toLowerCase()}`}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={isProficient}
                                onCheckedChange={(checked) => {
                                  setCharacterStats(prev => {
                                    const currentSkills = Array.isArray(prev.skills) ? prev.skills : [];
                                    if (checked) {
                                      return {
                                        ...prev,
                                        skills: currentSkills.includes(skill.name) 
                                          ? currentSkills 
                                          : [...currentSkills, skill.name],
                                      };
                                    } else {
                                      return {
                                        ...prev,
                                        skills: currentSkills.filter((s: string) => s !== skill.name),
                                      };
                                    }
                                  });
                                }}
                                data-testid={`checkbox-skill-${skill.name.replace(/\s/g, "-").toLowerCase()}`}
                              />
                              <span className="text-sm">{skill.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {skill.stat.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {totalMod >= 0 ? "+" : ""}{totalMod}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !gameEnded) {
                                    const roll = Math.floor(Math.random() * 20) + 1;
                                    const total = roll + totalMod;
                                    wsRef.current.send(JSON.stringify({
                                      type: "action",
                                      content: `*${characterName || playerName} attempts a ${skill.name} check* (Rolled d20: ${roll} + ${totalMod} = ${total})`,
                                    }));
                                    toast({
                                      title: `${skill.name} Check`,
                                      description: `Rolled d20 (${roll}) + ${totalMod} = ${total}`,
                                    });
                                    setActiveTab("chat");
                                  }
                                }}
                                disabled={!isConnected || gameEnded}
                                data-testid={`button-use-skill-${skill.name.replace(/\s/g, "-").toLowerCase()}`}
                              >
                                Use
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Spell Browser
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Browse and manage your spells. Click a spell for details.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <SpellBrowser
                      characterClass={characterStats.class}
                      knownSpells={characterStats.knownSpells || []}
                      preparedSpells={characterStats.preparedSpells || []}
                      onAddKnownSpell={(spellId) => {
                        setCharacterStats(prev => {
                          const known = prev.knownSpells || [];
                          if (known.includes(spellId)) {
                            return prev;
                          }
                          return {
                            ...prev,
                            knownSpells: [...known, spellId],
                          };
                        });
                        toast({
                          title: "Spell Added",
                          description: "Added spell to your known spells.",
                        });
                      }}
                      onRemoveKnownSpell={(spellId) => {
                        setCharacterStats(prev => ({
                          ...prev,
                          knownSpells: (prev.knownSpells || []).filter((id: string) => id !== spellId),
                          preparedSpells: (prev.preparedSpells || []).filter((id: string) => id !== spellId),
                        }));
                        toast({
                          title: "Spell Removed",
                          description: "Removed spell from your known spells.",
                        });
                      }}
                      onTogglePreparedSpell={(spellId) => {
                        setCharacterStats(prev => {
                          const prepared = prev.preparedSpells || [];
                          if (prepared.includes(spellId)) {
                            return {
                              ...prev,
                              preparedSpells: prepared.filter((id: string) => id !== spellId),
                            };
                          } else {
                            return {
                              ...prev,
                              preparedSpells: [...prepared, spellId],
                            };
                          }
                        });
                      }}
                      onCastSpell={(spell) => {
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !gameEnded) {
                          // Check spell slot availability for non-cantrips
                          if (spell.level > 0) {
                            const usedKey = `spellSlots${spell.level}Used`;
                            const totalKey = `spellSlots${spell.level}Total`;
                            const used = characterStats[usedKey] || 0;
                            const total = characterStats[totalKey] || 0;
                            
                            if (used >= total) {
                              toast({
                                title: "No Spell Slots",
                                description: `You have no level ${spell.level} spell slots remaining.`,
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // Consume spell slot
                            setCharacterStats(prev => ({
                              ...prev,
                              [usedKey]: (prev[usedKey] || 0) + 1,
                            }));
                          }
                          
                          wsRef.current.send(JSON.stringify({
                            type: "action",
                            content: `*${characterName || playerName} casts ${spell.name}!* (${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} ${spell.school} - ${spell.castingTime}, Range: ${spell.range})`,
                          }));
                          
                          const slotInfo = spell.level > 0 
                            ? ` (Used 1 level ${spell.level} slot)` 
                            : "";
                          toast({
                            title: "Spell Cast",
                            description: `You cast ${spell.name}!${slotInfo}`,
                          });
                          setActiveTab("chat");
                        }
                      }}
                      onRollSpellDice={(spell, diceExpression) => {
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !gameEnded) {
                          wsRef.current.send(JSON.stringify({
                            type: "chat",
                            content: `/roll ${diceExpression} for ${spell.name}`,
                          }));
                          toast({
                            title: "Rolling Dice",
                            description: `Rolling ${diceExpression} for ${spell.name}`,
                          });
                          setActiveTab("chat");
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {isHost && (
            <TabsContent value="dm" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
              <div className="p-4 max-w-2xl mx-auto">
                <DMControlsPanel 
                  roomCode={code!} 
                  hostName={playerName} 
                  gameSystem={(roomData?.gameSystem || "dnd") as GameSystem} 
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={viewingPlayerId !== null} onOpenChange={(open) => !open && setViewingPlayerId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <User className="h-5 w-5" />
              {viewingPlayer?.name}'s Character
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingViewedCharacter ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : viewedCharacter ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Character Name</span>
                  <p className="font-medium" data-testid="text-viewed-character-name">{viewedCharacter.characterName}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Player</span>
                  <p className="font-medium">{viewingPlayer?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-2 bg-muted rounded-md">
                  <span className="text-xs text-muted-foreground">Level</span>
                  <p className="font-mono font-bold text-lg" data-testid="text-viewed-level">{viewedCharacter.level || 1}</p>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <span className="text-xs text-muted-foreground">Max HP</span>
                  <p className="font-mono font-bold text-lg" data-testid="text-viewed-hp">{viewedCharacter.maxHp}</p>
                </div>
              </div>

              {viewedCharacter.stats && Object.keys(viewedCharacter.stats).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground mb-2 block">
                      {roomData?.gameSystem === "dnd" ? "Ability Scores" : "Stats"}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(viewedCharacter.stats).map(([key, value]) => {
                        const dndLabels: Record<string, string> = {
                          strength: "STR", dexterity: "DEX", constitution: "CON",
                          intelligence: "INT", wisdom: "WIS", charisma: "CHA"
                        };
                        const cyberpunkLabels: Record<string, string> = {
                          int: "INT", ref: "REF", dex: "DEX", tech: "TECH",
                          cool: "COOL", will: "WILL", luck: "LUCK", move: "MOVE",
                          body: "BODY", emp: "EMP"
                        };
                        const label = roomData?.gameSystem === "dnd" 
                          ? dndLabels[key] || key.toUpperCase()
                          : cyberpunkLabels[key] || key.toUpperCase();
                        return (
                          <div key={key} className="text-center p-2 bg-muted rounded-md" data-testid={`stat-${key}`}>
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <p className="font-mono font-bold text-lg">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {viewedCharacter.backstory && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Backstory</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap" data-testid="text-viewed-character-notes">
                      {viewedCharacter.backstory}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-character">
              This player hasn't created a character yet.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <FloatingCharacterPanel
        roomCode={code || ""}
        isOpen={showCharacterPanel}
        onClose={() => setShowCharacterPanel(false)}
        currentHp={liveHp?.current}
        maxHp={liveHp?.max}
        onDropItem={(item) => dropInventoryItemMutation.mutate(item)}
        isDropping={dropInventoryItemMutation.isPending}
      />

      <Dialog open={showLoadCharacterDialog} onOpenChange={setShowLoadCharacterDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Load Saved Character
            </DialogTitle>
            <DialogDescription>
              Select a character from your saved collection to use in this game.
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingSavedCharacters ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : savedCharacters && savedCharacters.length > 0 ? (
            <div className="space-y-3">
              {savedCharacters
                .filter(char => char.gameSystem === roomData?.gameSystem)
                .map((char) => (
                  <Card 
                    key={char.id} 
                    className="hover-elevate cursor-pointer"
                    onClick={() => loadSavedCharacter(char)}
                    data-testid={`card-saved-character-${char.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate" data-testid={`text-character-name-${char.id}`}>
                            {char.characterName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {char.race && char.class ? `${char.race} ${char.class}` : ""}
                            {char.level ? ` (Level ${char.level})` : ""}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadSavedCharacter(char);
                          }}
                          data-testid={`button-load-character-${char.id}`}
                        >
                          Load
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              {savedCharacters.filter(char => char.gameSystem === roomData?.gameSystem).length === 0 && (
                <p className="text-center text-muted-foreground py-4" data-testid="text-no-matching-characters">
                  No saved characters match this game system ({gameSystemLabels[roomData?.gameSystem as GameSystem] || roomData?.gameSystem}).
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-saved-characters">
              You don't have any saved characters yet. Create characters from the Characters page in your account menu.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDeathDialog} onOpenChange={setShowDeathDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <User className="h-5 w-5" />
              Select New Character
            </DialogTitle>
            <DialogDescription>
              Your character has fallen. Choose another character to continue your adventure.
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingSavedCharacters ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : savedCharacters && savedCharacters.length > 0 ? (
            <div className="space-y-3">
              {savedCharacters
                .filter(char => char.gameSystem === roomData?.gameSystem)
                .map((char) => (
                  <Card 
                    key={char.id} 
                    className="hover-elevate cursor-pointer"
                    onClick={() => switchCharacterMutation.mutate(char.id)}
                    data-testid={`card-death-character-${char.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate">
                            {char.characterName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {char.race && char.class ? `${char.race} ${char.class}` : ""}
                            {char.level ? ` (Level ${char.level})` : ""}
                          </p>
                        </div>
                        <Button 
                          size="sm"
                          disabled={switchCharacterMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            switchCharacterMutation.mutate(char.id);
                          }}
                          data-testid={`button-select-death-character-${char.id}`}
                        >
                          {switchCharacterMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              {savedCharacters.filter(char => char.gameSystem === roomData?.gameSystem).length === 0 && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-muted-foreground">
                    No saved characters match this game system ({gameSystemLabels[roomData?.gameSystem as GameSystem] || roomData?.gameSystem}).
                  </p>
                  <Button variant="outline" onClick={() => setLocation("/characters")}>
                    Create New Character
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">
                You don't have any saved characters yet.
              </p>
              <Button onClick={() => setLocation("/characters")}>
                Create Character
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

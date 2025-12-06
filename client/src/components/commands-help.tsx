import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, MessageSquare } from "lucide-react";

const COMMANDS = [
  {
    command: "!help",
    description: "Show available commands",
    category: "general",
  },
  {
    command: "!start [name]",
    description: "Start a new adventure with an optional name",
    category: "game",
  },
  {
    command: "!create",
    description: "Create a new character with guided prompts",
    category: "character",
  },
  {
    command: "!character",
    description: "View your active character",
    category: "character",
  },
  {
    command: "!inventory",
    description: "Check your character's inventory",
    category: "character",
  },
  {
    command: "!stats",
    description: "View your character's stats and abilities",
    category: "character",
  },
  {
    command: "!roll [dice]",
    description: "Roll dice (e.g., !roll 2d6+3, !roll d20)",
    category: "dice",
  },
  {
    command: "!quest",
    description: "View your current quests",
    category: "game",
  },
  {
    command: "!action [text]",
    description: "Perform an action in the game",
    category: "game",
  },
  {
    command: "!say [text]",
    description: "Say something in character",
    category: "game",
  },
  {
    command: "!scene",
    description: "Get a description of the current scene",
    category: "game",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  game: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  character: "bg-green-500/20 text-green-700 dark:text-green-300",
  dice: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

export function CommandsHelp() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <span className="font-serif">Discord Commands</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {COMMANDS.map((cmd) => (
              <div
                key={cmd.command}
                className="flex items-start justify-between gap-3 p-2 rounded-md bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono font-medium text-primary">
                    {cmd.command}
                  </code>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cmd.description}
                  </p>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`text-xs shrink-0 ${CATEGORY_COLORS[cmd.category] || ""}`}
                >
                  {cmd.category}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="mt-4 p-3 rounded-md bg-primary/5 border border-primary/10">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Natural Language</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can also talk naturally to the DM! Just type your actions or questions 
                without any command prefix, and Grok will respond as your Dungeon Master.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

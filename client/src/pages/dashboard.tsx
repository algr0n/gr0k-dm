import { BotStatusCard } from "@/components/bot-status";
import { DiceRoller } from "@/components/dice-roller";
import { CharacterList } from "@/components/character-list";
import { GameSessions } from "@/components/game-sessions";
import { QuestLog } from "@/components/quest-log";
import { ActivityFeed } from "@/components/activity-feed";
import { CommandsHelp } from "@/components/commands-help";

export default function Dashboard() {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-serif tracking-tight">
          Grok DM
        </h1>
        <p className="text-muted-foreground mt-2">
          AI-powered Dungeon Master for your Discord adventures
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BotStatusCard />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CharacterList />
            <div className="space-y-6">
              <GameSessions />
              <QuestLog />
            </div>
          </div>

          <ActivityFeed />
        </div>

        <div className="space-y-6">
          <DiceRoller />
          <CommandsHelp />
        </div>
      </div>
    </div>
  );
}

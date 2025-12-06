import { BotStatusCard } from "@/components/bot-status";
import { DiceRoller } from "@/components/dice-roller";
import { CharacterList } from "@/components/character-list";
import { GameSessions } from "@/components/game-sessions";
import { QuestLog } from "@/components/quest-log";
import { ActivityFeed } from "@/components/activity-feed";
import { CommandsHelp } from "@/components/commands-help";
import { SessionChat } from "@/components/session-chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Swords, ScrollText } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-serif tracking-tight">
          Grok DM
        </h1>
        <p className="text-muted-foreground mt-2">
          AI-powered Dungeon Master for your tabletop adventures
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BotStatusCard />
          
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="games" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="games" className="gap-2" data-testid="tab-games">
                    <Swords className="h-4 w-4" />
                    <span className="hidden sm:inline">Active Games</span>
                    <span className="sm:hidden">Games</span>
                  </TabsTrigger>
                  <TabsTrigger value="characters" className="gap-2" data-testid="tab-characters">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Characters</span>
                    <span className="sm:hidden">Chars</span>
                  </TabsTrigger>
                  <TabsTrigger value="quests" className="gap-2" data-testid="tab-quests">
                    <ScrollText className="h-4 w-4" />
                    <span className="hidden sm:inline">Quest Log</span>
                    <span className="sm:hidden">Quests</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="games" className="mt-0">
                  <GameSessions />
                </TabsContent>
                <TabsContent value="characters" className="mt-0">
                  <CharacterList />
                </TabsContent>
                <TabsContent value="quests" className="mt-0">
                  <QuestLog />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <SessionChat />
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

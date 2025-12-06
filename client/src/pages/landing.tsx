import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords, Users, Dice6, Bot } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-3xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight">Welcome to Gr0k DM</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your AI-powered Dungeon Master for tabletop adventures. Run games on Discord with an intelligent DM that narrates stories, manages combat, and brings your world to life.
          </p>
          
          <div className="pt-4">
            <Button 
              size="lg" 
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
            >
              Sign In as Dungeon Master
            </Button>
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full">
          <Card>
            <CardHeader className="pb-2">
              <Bot className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">AI Dungeon Master</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Intelligent storytelling that adapts to player choices and creates immersive narratives.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Swords className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Multiple Systems</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Support for D&D 5e and Cyberpunk RED with system-specific mechanics and themes.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Discord Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Players join games directly in Discord where they already hang out with friends.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Dice6 className="h-8 w-8 text-muted-foreground mb-2" />
              <CardTitle className="text-lg">Built-in Dice</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Full dice rolling support with history tracking and character integration.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="py-6 border-t text-center text-sm text-muted-foreground">
        Powered by Grok AI
      </footer>
    </div>
  );
}

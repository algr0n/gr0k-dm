import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, User, Scroll } from "lucide-react";
import Landing from "@/pages/landing";
import RoomPage from "@/pages/room";
import Characters from "@/pages/characters";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/room/:code" component={RoomPage} />
      <Route path="/characters" component={Characters} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Header() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <Link href="/">
          <span className="text-xl font-bold font-serif cursor-pointer" data-testid="link-home">
            Grok DM
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Link href="/characters">
              <Button variant="ghost" size="sm" data-testid="link-my-characters">
                <Scroll className="mr-2 h-4 w-4" />
                My Characters
              </Button>
            </Link>
          )}
          <ThemeToggle />
          {isLoading ? null : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                    <AvatarFallback>{getInitials(user.firstName || user.email || "U")}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm font-medium" data-testid="text-user-name">
                  {user.firstName} {user.lastName}
                </div>
                <div className="px-2 pb-1.5 text-xs text-muted-foreground" data-testid="text-user-email">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/characters">
                    <Scroll className="mr-2 h-4 w-4" />
                    My Characters
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" data-testid="button-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" asChild data-testid="button-login">
              <a href="/api/login">
                <LogIn className="mr-2 h-4 w-4" />
                Log in
              </a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <Header />
            <main>
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

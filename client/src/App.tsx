import { Switch, Route, Link, useLocation } from "wouter";
import { Suspense, lazy } from "react";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, User, Scroll, Settings, Landmark } from "lucide-react";
import Landing from "@/pages/landing";
import RoomPage from "@/pages/room";
import Characters from "@/pages/characters";
import ProfileSettings from "@/pages/profile";
import AuthPage from "@/pages/auth-page";
import MyRooms from "@/pages/my-rooms";
import NotFound from "@/pages/not-found";
import ComponentsDemo from "@/pages/ComponentsDemo";

const Bestiary = lazy(() => import("@/pages/bestiary"));

function Router() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/demo" component={ComponentsDemo} />
      <Route path="/room/:code" component={RoomPage} />
      <Route path="/characters" component={Characters} />
      <Route path="/profile" component={ProfileSettings} />
      <Route path="/my-rooms" component={MyRooms} />
      <Route path="/bestiary" component={Bestiary} />
      <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function Header() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
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
            <>
              <Link href="/my-rooms">
                <Button variant="ghost" size="sm" data-testid="link-my-rooms">
                  <Landmark className="mr-2 h-4 w-4" />
                  My Rooms
                </Button>
              </Link>
              <Link href="/characters">
                <Button variant="ghost" size="sm" data-testid="link-my-characters">
                  <Scroll className="mr-2 h-4 w-4" />
                  My Characters
                </Button>
              </Link>
            </>
          )}
          <ThemeToggle />
          {isLoading ? null : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.customProfileImageUrl || user.profileImageUrl || undefined} alt={user.username || user.firstName || "User"} />
                    <AvatarFallback>{getInitials(user.firstName || user.email || "U")}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm font-medium" data-testid="text-user-name">
                  {user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User'}
                </div>
                <div className="px-2 pb-1.5 text-xs text-muted-foreground" data-testid="text-user-email">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/my-rooms">
                    <Landmark className="mr-2 h-4 w-4" />
                    My Rooms
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/characters">
                    <Scroll className="mr-2 h-4 w-4" />
                    My Characters
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" data-testid="link-profile-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button variant="outline" size="sm" data-testid="button-login">
                <LogIn className="mr-2 h-4 w-4" />
                Log in
              </Button>
            </Link>
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

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Loader2, Upload, User, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { User as UserType } from "@shared/schema";

export default function ProfileSettings() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { username?: string; customProfileImageUrl?: string | null }) => {
      const response = await apiRequest("PATCH", "/api/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest("PUT", "/api/profile/image", { imageUrl });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to update your profile picture. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/profile/upload-url");
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (uploadURL: string) => {
    uploadImageMutation.mutate(uploadURL);
  };

  const handleSaveUsername = () => {
    updateProfileMutation.mutate({ username });
  };

  const handleRemoveCustomImage = () => {
    updateProfileMutation.mutate({ customProfileImageUrl: null });
  };

  const getDisplayName = () => {
    if (user?.username) return user.username;
    if (user?.firstName || user?.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return "User";
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.slice(0, 2).toUpperCase();
  };

  const getProfileImageUrl = () => {
    return user?.customProfileImageUrl || user?.profileImageUrl || null;
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please log in to access your profile settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-serif tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">Customize your profile</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a custom profile picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={getProfileImageUrl() || undefined} alt={getDisplayName()} />
              <AvatarFallback className="text-2xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <ObjectUploader
                onGetUploadParameters={getUploadParameters}
                onComplete={handleUploadComplete}
                onError={(error) => {
                  toast({
                    title: "Upload error",
                    description: error.message,
                    variant: "destructive",
                  });
                }}
                disabled={uploadImageMutation.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Picture
              </ObjectUploader>
              {user.customProfileImageUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCustomImage}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-remove-image"
                >
                  Remove custom picture
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Name</CardTitle>
          <CardDescription>Choose a username that others will see</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              data-testid="input-username"
            />
            <p className="text-sm text-muted-foreground">
              This is how other players will see you in games.
            </p>
          </div>
          <Button 
            onClick={handleSaveUsername}
            disabled={updateProfileMutation.isPending || username === (user.username || "")}
            data-testid="button-save-username"
          >
            {updateProfileMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Username"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details from Replit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Email:</span>
            <span className="text-sm">{user.email || "Not provided"}</span>
          </div>
          {(user.firstName || user.lastName) && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Name:</span>
              <span className="text-sm">{`${user.firstName || ""} ${user.lastName || ""}`.trim()}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

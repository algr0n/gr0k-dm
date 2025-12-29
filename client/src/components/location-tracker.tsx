import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { DynamicLocation } from "@shared/schema";

interface LocationTrackerProps {
  roomId: string;
}

interface LocationTypeInfo {
  color: string;
  bgColor: string;
  label: string;
}

function getLocationTypeInfo(type: string): LocationTypeInfo {
  switch (type.toLowerCase()) {
    case "dungeon":
      return {
        color: "text-red-600",
        bgColor: "bg-red-500",
        label: "Dungeon"
      };
    case "town":
      return {
        color: "text-blue-600",
        bgColor: "bg-blue-500",
        label: "Town"
      };
    case "wilderness":
      return {
        color: "text-green-600",
        bgColor: "bg-green-500",
        label: "Wilderness"
      };
    case "building":
      return {
        color: "text-purple-600",
        bgColor: "bg-purple-500",
        label: "Building"
      };
    default:
      return {
        color: "text-gray-600",
        bgColor: "bg-gray-500",
        label: "Location"
      };
  }
}

function LocationCard({ location }: { location: DynamicLocation }) {
  const typeInfo = getLocationTypeInfo(location.type);
  const features = Array.isArray(location.features) ? location.features : [];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              typeInfo.bgColor,
              "text-white"
            )}>
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">{location.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {typeInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {location.description && (
          <p className="text-sm text-muted-foreground">{location.description}</p>
        )}
        
        {location.boxedText && (
          <div className="border-l-4 border-primary pl-3 py-2 bg-muted/50 rounded-r">
            <p className="text-sm italic text-muted-foreground">
              {location.boxedText}
            </p>
          </div>
        )}

        {features.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-2">Features:</p>
              <ul className="list-disc list-inside space-y-1">
                {features.map((feature, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function LocationTracker({ roomId }: LocationTrackerProps) {
  const { data: locations, isLoading } = useQuery<DynamicLocation[]>({
    queryKey: ["dynamic-locations", roomId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/rooms/${roomId}/dynamic-locations`);
      return (await response.json()) as DynamicLocation[];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Sort locations by creation date (newest first) - memoized for performance
  const sortedLocations = useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return [...locations].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [locations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MapPin className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <MapPin className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Locations Discovered</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          As you explore, places will be recorded here. 
          Your journey through the world will be documented for easy reference.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Locations
          </h2>
          <p className="text-sm text-muted-foreground">
            Track the places you've discovered on your journey. Reference locations, their features, and important details.
          </p>
        </div>

        <div className="grid gap-4">
          {sortedLocations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

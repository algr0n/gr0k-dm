import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

interface AdminRoom {
  id: string;
  code: string;
  name: string;
  hostName?: string | null;
  playerCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminRoomsPage() {
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<AdminRoom[]>({
    queryKey: ["/api/admin/rooms"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/rooms");
      return res.json();
    },
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await apiRequest("DELETE", `/api/admin/rooms/${roomId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rooms"] });
      toast({ title: "Room deleted", description: "Room and associated data removed." });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message || "Failed to delete room", variant: "destructive" });
    }
  });

  return (
    <div className="max-w-6xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin: Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button variant="default" size="sm" onClick={() => refetch()}>Refresh</Button>
          </div>

          {isLoading && <div>Loading...</div>}
          {error && <div className="text-red-500">{String(error)}</div>}

          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="truncate max-w-xs">{r.name}</TableCell>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.hostName || '—'}</TableCell>
                    <TableCell>{r.playerCount}</TableCell>
                    <TableCell>{r.isActive ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true })}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(`/room/${r.code}`, "_blank")}>Open</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Room?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the room "{r.name}" and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

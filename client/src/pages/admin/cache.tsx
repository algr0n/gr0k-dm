import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function AdminCachePage() {
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["/api/cache/stats"],
    queryFn: async () => {
      // Use apiRequest (credentials included) so session cookie is sent for auth
      const res = await apiRequest("GET", "/api/cache/stats");
      return res.json();
    },
    retry: false,
  });

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Cache Statistics (Admin)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button variant="default" size="sm" onClick={() => refetch()}>Refresh</Button>
          </div>

          {isLoading && <div>Loading...</div>}
          {error && <div className="text-red-500">{String(error)}</div>}

          {data && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div>Size: <strong>{data.size}</strong></div>
                <div>Total Uses: <strong>{data.totalUses}</strong></div>
                <div>Estimated Tokens Saved: <strong>{data.estimatedTokensSaved}</strong></div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topEntries.map((e: any) => (
                    <TableRow key={e.pattern + e.context}>
                      <TableCell className="max-w-xl truncate">{e.pattern}</TableCell>
                      <TableCell>{e.uses}</TableCell>
                      <TableCell>{e.context}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

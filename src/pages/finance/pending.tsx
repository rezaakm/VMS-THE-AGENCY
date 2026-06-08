import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileEdit, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getJournalEntries } from "@/lib/queries/journal";

export default function PendingPanel() {
  const draftQ = useQuery({
    queryKey: ["journal-entries", "DRAFT"],
    queryFn: () => getJournalEntries("DRAFT"),
  });

  const pendingQ = useQuery({
    queryKey: ["journal-entries", "PENDING_REVIEW"],
    queryFn: () => getJournalEntries("PENDING_REVIEW"),
  });

  const allPending = [...(draftQ.data ?? []), ...(pendingQ.data ?? [])];

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Approvals" description="Draft and review items" />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          loading={draftQ.isLoading}
          title="Draft Entries"
          value={String(draftQ.data?.length ?? 0)}
          icon={FileEdit}
        />
        <StatCard
          loading={pendingQ.isLoading}
          title="Pending Review"
          value={String(pendingQ.data?.length ?? 0)}
          icon={Clock}
        />
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">
            Pending Journal Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {draftQ.isLoading || pendingQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : allPending.length === 0 ? (
            <EmptyState title="No pending entries" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPending.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.description || "Untitled Entry"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            e.status === "PENDING_REVIEW" ? "warning" : "secondary"
                          }
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.created_at
                          ? format(new Date(e.created_at), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
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

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wallet, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getPayrollEntries } from "@/lib/queries/payroll";

export default function PaymentsSalariesPanel() {
  const payrollQ = useQuery({
    queryKey: ["payroll-entries"],
    queryFn: () => getPayrollEntries(),
  });

  const entries = payrollQ.data ?? [];
  const totalPayroll = entries.reduce(
    (s, e) => s + (e.net_pay ?? e.gross_pay ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Payments & Salaries" description="Payroll and compensation" />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          loading={payrollQ.isLoading}
          title="Total Payroll"
          value={formatOMR(totalPayroll)}
          icon={Wallet}
        />
        <StatCard
          loading={payrollQ.isLoading}
          title="Entries"
          value={String(entries.length)}
          icon={Users}
        />
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">Payroll Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {payrollQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Pay Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.employee_name ?? "-"}
                      </TableCell>
                      <TableCell>{e.period ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatOMR(e.gross_pay)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatOMR(e.net_pay)}
                      </TableCell>
                      <TableCell>
                        {e.pay_date
                          ? format(new Date(e.pay_date), "dd MMM yyyy")
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

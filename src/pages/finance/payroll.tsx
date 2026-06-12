import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wallet, Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatOMR } from "@/lib/utils";
import { getPayrollEntries } from "@/lib/queries/payroll";
import { useEntityScope } from "@/hooks/use-entity-scope";

export default function PayrollPanel() {
  const { entityFilter, scope } = useEntityScope();

  const payrollQ = useQuery({
    queryKey: ["payroll-entries", scope],
    queryFn: () => getPayrollEntries(undefined, entityFilter),
  });

  const entries = payrollQ.data ?? [];
  const totalGross = entries.reduce((s, e) => s + (e.gross_pay ?? 0), 0);
  const totalNet = entries.reduce((s, e) => s + (e.net_pay ?? e.gross_pay ?? 0), 0);

  // Unique employees
  const employees = new Set(entries.map((e) => e.employee_name).filter(Boolean));

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR / Payroll"
        description="Staff and monthly salaries"
        showScope
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard loading={payrollQ.isLoading} title="Total Net Payroll" value={formatOMR(totalNet)} icon={Wallet} />
        <StatCard loading={payrollQ.isLoading} title="Total Gross" value={formatOMR(totalGross)} icon={DollarSign} />
        <StatCard loading={payrollQ.isLoading} title="Staff Members" value={String(employees.size)} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="t-card-title">Payroll Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {payrollQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState title="No payroll entries yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.employee_name ?? "-"}</TableCell>
                      <TableCell>{e.period ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatOMR(e.gross_pay)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatOMR(e.net_pay)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {e.pay_date ? format(new Date(e.pay_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        {e.entity && <Badge variant="outline" className="text-[10px]">{e.entity}</Badge>}
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

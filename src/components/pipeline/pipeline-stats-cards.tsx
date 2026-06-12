import { Card, CardContent } from "@/components/ui/card";

interface PipelineStatsCardsProps {
  newEnquiries: number;
  draftSheets: number;
  approvedSheets: number;
}

export function PipelineStatsCards({ newEnquiries, draftSheets, approvedSheets }: PipelineStatsCardsProps) {
  const stats = [
    {
      value: newEnquiries,
      label: "New Enquiries",
      color: "text-blue-400",
    },
    {
      value: draftSheets,
      label: "Drafts to Review",
      color: "text-amber-400",
    },
    {
      value: approvedSheets,
      label: "Approved / Quoted",
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {stat.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}